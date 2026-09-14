import childProcess from "node:child_process";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import timers from "node:timers/promises";

export class BrowserUnavailableError extends Error {}
export type BrowserStartupEvent = "browser_starting" | "browser_ready";

export function cdpOrigin() {
  const url = new URL(process.env.SUPER_BROWSER_CDP_URL || "http://127.0.0.1:9222");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SUPER_BROWSER_CDP_URL must be a local HTTP origin");
  }
  return url.origin;
}

async function probeBrowser(origin: string, timeoutMs = 2000) {
  let response: Response;
  try {
    response = await fetch(`${origin}/json/version`, { signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
  } catch {
    return undefined;
  }
  try {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = await response.json();
    const socketUrl = new URL(info.webSocketDebuggerUrl);
    if (socketUrl.protocol !== "ws:" || !["127.0.0.1", "localhost", "[::1]"].includes(socketUrl.hostname)) throw new Error("Expected a local browser WebSocket");
    return { origin, socketUrl: socketUrl.href };
  } catch (error) {
    // An occupied port with an invalid response is a setup problem, not a stopped browser.
    throw new BrowserUnavailableError(`Invalid Chrome CDP response at ${origin}. ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function browserInfo(onStartup?: (event: BrowserStartupEvent) => void) {
  const origin = cdpOrigin();
  const existing = await probeBrowser(origin);
  if (existing) return existing;
  if (process.platform !== "darwin") throw new BrowserUnavailableError(`Chrome Dev is unavailable at ${origin}. Automatic startup requires macOS`);

  const profile = process.env.SUPER_BROWSER_DATA_DIR || join(homedir(), ".agents", "browsers", "default");
  if (!isAbsolute(profile)) throw new BrowserUnavailableError("SUPER_BROWSER_DATA_DIR must be an absolute path");
  const port = new URL(origin).port || "80";
  try {
    await mkdir(profile, { recursive: true });
    onStartup?.("browser_starting");
    // Launch Services owns Chrome's lifetime. Never use -n: reuse a starting app.
    await new Promise<void>((resolve, reject) => {
      childProcess.execFile("/usr/bin/open", [
        "-a", "Google Chrome Dev", "--args",
        `--remote-debugging-port=${port}`,
        "--remote-allow-origins=*",
        "--enable-unsafe-extension-debugging",
        "--no-first-run",
        "--restore-last-session",
        `--user-data-dir=${profile}`,
      ], { timeout: 5000 }, error => error ? reject(error) : resolve());
    });
  } catch (error) {
    throw new BrowserUnavailableError(`Could not start Chrome Dev at ${origin}. Check that Google Chrome Dev is installed and this process runs in a logged-in macOS session. ${error instanceof Error ? error.message : String(error)}`);
  }

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const ready = await probeBrowser(origin, Math.max(1, Math.min(2000, deadline - Date.now())));
    if (ready) {
      onStartup?.("browser_ready");
      return ready;
    }
    await timers.setTimeout(Math.max(0, Math.min(250, deadline - Date.now())));
  }
  throw new BrowserUnavailableError(`Chrome Dev did not become ready at ${origin} within 20 seconds after automatic startup. Check its profile (${profile}) and launch flags. An already-running Chrome Dev ignores new flags; preserve its work before restarting it using the skill's setup reference`);
}
