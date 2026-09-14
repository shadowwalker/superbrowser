import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { Page, StagehandCreateOptions } from "@browserbasehq/stagehand";
import { BrowserUnavailableError, connectBrowser } from "./browser.js";
import { scriptDirectory } from "./paths.js";

export class AuthenticationRequiredError extends Error {
  constructor(message: string, public readonly loginUrl?: string) { super(message); }
}

type Status = "running" | "succeeded" | "auth_required" | "browser_unavailable" | "failed" | "interrupted";
type Connection = Awaited<ReturnType<typeof connectBrowser>>;
type RunOptions = { name: string; model?: StagehandCreateOptions["model"]; timeoutMs?: number; notify?: boolean };
export type RunContext = Connection & {
  scriptDir: string;
  log(event: string, data?: unknown): void;
  step<T>(name: string, action: () => Promise<T>): Promise<T>;
  usePage(page: Page): void;
  authRequired(message: string, loginUrl?: string): never;
};

function clean(value: unknown): unknown {
  if (value instanceof Error) return clean({ name: value.name, message: value.message, stack: value.stack });
  if (typeof value === "string") return value.replace(/https?:\/\/[^\s<>"']+/g, match => {
    const punctuation = match.match(/[.,;!?)\]]+$/)?.[0] ?? "";
    const candidate = punctuation ? match.slice(0, -punctuation.length) : match;
    try { const url = new URL(candidate); url.username = ""; url.password = ""; url.search = ""; url.hash = ""; return url.href + punctuation; }
    catch { return "[url]"; }
  });
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /password|secret|cookie|authorization|api.?key|access.?token|refresh.?token/i.test(key) ? "[redacted]" : clean(item)]));
  return value;
}

function notify(title: string, message: string): Promise<void> {
  if (process.platform !== "darwin" || process.env.SUPER_BROWSER_NOTIFY === "0") return Promise.resolve();
  return new Promise(resolve => {
    const child = spawn("/usr/bin/osascript", ["-e", "on run argv\n display notification (item 2 of argv) with title (item 1 of argv)\nend run", title, message], { stdio: "ignore" });
    const timer = setTimeout(() => { child.kill(); resolve(); }, 3000);
    child.once("error", () => { clearTimeout(timer); resolve(); });
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  });
}

// Standalone process runner. stagehand.close() releases its session; process exit releases the host transport.
export async function runScript(options: RunOptions, work: (run: RunContext) => Promise<unknown>): Promise<never> {
  const scriptDir = scriptDirectory(options.name);
  const logsDir = join(scriptDir, "logs");
  const startedAt = new Date().toISOString();
  const runId = `${startedAt.replace(/[:.]/g, "-")}-${process.pid}`;
  const runDir = join(logsDir, runId);
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
  const statusPath = join(logsDir, "latest.json");
  let previous: { status?: string } = {};
  try { previous = JSON.parse(readFileSync(statusPath, "utf8")); } catch {}
  let connection: Connection | undefined;
  let activePage: Page | undefined;
  let currentStep = "connect";
  let finishing: Promise<never> | undefined;
  let result: unknown;
  const log = (event: string, data?: unknown) => {
    const line = JSON.stringify(clean({ time: new Date().toISOString(), runId, event, step: currentStep, data }));
    appendFileSync(join(runDir, "events.jsonl"), line + "\n", { mode: 0o600 });
    process.stderr.write(line + "\n");
  };
  const status = (state: Status, code: number | null, details: unknown = {}) => {
    const value = clean({ script: options.name, runId, pid: process.pid, startedAt, updatedAt: new Date().toISOString(), status: state, exitCode: code, step: currentStep, runDir, details });
    writeFileSync(join(runDir, "status.json"), JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
    const temporary = `${statusPath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
    renameSync(temporary, statusPath);
  };
  const finish = (state: Status, code: number, error?: unknown): Promise<never> => {
    finishing ??= (async () => {
      clearTimeout(deadline);
      const cutoff = setTimeout(() => {
        log("cleanup_timeout");
        status(state === "succeeded" ? "failed" : state, code || 1, { error: "Cleanup timed out", result });
        process.exit(code || 1);
      }, 8000);
      if (error) log("run_error", error);
      let pageUrl: string | undefined;
      if (activePage && connection) {
        try {
          await Promise.race([
            (async () => {
              pageUrl = await activePage!.url();
              if (state === "failed") {
                await activePage!.screenshot({ path: join(runDir, "failure.png") });
                const snapshot = await activePage!.snapshot();
                writeFileSync(join(runDir, "failure.dom.txt"), String(clean(snapshot.formattedTree)), { mode: 0o600 });
              }
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Evidence capture timed out")), 3000)),
          ]);
        } catch { log("evidence_unavailable"); }
      }
      try { await connection?.stagehand.close(); }
      catch (cleanupError) { log("cleanup_error", cleanupError); if (state === "succeeded") { state = "failed"; code = 1; error = cleanupError; } }
      const details = { result, error: error instanceof Error ? error.message : error, pageUrl,
        ...(state === "auth_required" ? { action: "Sign in in the shared Chrome Dev window, then rerun or wait for the next scheduled run", loginUrl: error instanceof AuthenticationRequiredError ? error.loginUrl : pageUrl } : {}) };
      status(state, code, details);
      log("run_finished", { status: state, exitCode: code });
      if (options.notify !== false && ["auth_required", "failed", "browser_unavailable"].includes(state) && previous.status !== state) {
        await notify(`Superbrowser: ${options.name}`, state === "auth_required" ? "Sign-in needed in Chrome Dev. The next run will resume after you sign in." : `Run needs attention (${state}). Read ${statusPath}`);
      }
      const output = JSON.stringify(clean({ status: state, exitCode: code, runDir, ...details }), null, 2) + "\n";
      await new Promise<void>(resolve => process.stdout.write(output, () => resolve()));
      clearTimeout(cutoff);
      process.exit(code);
    })();
    return finishing;
  };
  const deadline = setTimeout(() => { void finish("failed", 1, new Error("Run deadline exceeded")); }, options.timeoutMs ?? 15 * 60 * 1000);
  process.once("SIGINT", () => { void finish("interrupted", 130, new Error("Interrupted by SIGINT")); });
  process.once("SIGTERM", () => { void finish("interrupted", 143, new Error("Interrupted by SIGTERM")); });
  status("running", null);
  log("run_started");
  try {
    connection = await connectBrowser({ model: options.model }, () => log("stale_session_recovered"), event => log(event));
    const run: RunContext = {
      ...connection, scriptDir, log,
      async step(name, action) { currentStep = name; status("running", null); log("step_started"); const value = await action(); log("step_finished"); return value; },
      usePage(page) { activePage = page; },
      authRequired(message, loginUrl): never { throw new AuthenticationRequiredError(message, loginUrl); },
    };
    result = await work(run);
    return await finish("succeeded", 0);
  } catch (error) {
    const authentication = error instanceof AuthenticationRequiredError || (error instanceof Error && /\bAUTH_REQUIRED:/.test(error.message));
    return await finish(authentication ? "auth_required" : error instanceof BrowserUnavailableError ? "browser_unavailable" : "failed", authentication ? 75 : error instanceof BrowserUnavailableError ? 69 : 1, error);
  }
}
