// Run with Node 22.18+ or Bun: node --test tests/chrome.test.ts
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import timers from "node:timers/promises";
import { afterEach, beforeEach, mock, test } from "node:test";
import { BrowserUnavailableError, browserInfo } from "../skills/superbrowser/assets/template/utils/chrome.ts";

let temp: string;
let env: NodeJS.ProcessEnv;
let launches: { file: string; args: string[]; options: { timeout: number } }[];
let now: number;
let polls: number;
let launchError: Error | undefined;
const ready = () => Response.json({ webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/test" });
const stopped = () => { throw new TypeError("fetch failed"); };

beforeEach(async () => {
  env = { ...process.env };
  delete process.env.SUPER_BROWSER_CDP_URL;
  temp = await mkdtemp(join(tmpdir(), "superbrowser-startup-"));
  process.env.SUPER_BROWSER_DATA_DIR = join(temp, "profile with spaces");
  launches = [];
  launchError = undefined;
  now = 0;
  polls = 0;
  mock.method(Date, "now", () => now);
  mock.method(timers, "setTimeout", async (ms: number) => { now += ms; });
  // Mock the OS launch so failure tests never touch the user's real Chrome.
  mock.method(childProcess, "execFile", (file, args, options, callback) => {
    launches.push({ file, args, options });
    callback(launchError, "", "");
    return {};
  });
});

afterEach(async () => {
  mock.restoreAll();
  process.env = env;
  await rm(temp, { recursive: true, force: true });
});

test("a healthy browser is reused without launching or startup events", async () => {
  mock.method(globalThis, "fetch", async () => ready());
  const events: string[] = [];
  const info = await browserInfo(event => events.push(event));
  assert.equal(info.origin, "http://127.0.0.1:9222");
  assert.equal(launches.length, 0);
  assert.deepEqual(events, []);
});

test("a stopped browser launches once and waits for CDP readiness", async () => {
  mock.method(globalThis, "fetch", async () => ++polls < 4 ? stopped() : ready());
  const events: string[] = [];
  await browserInfo(event => events.push(event));
  assert.equal(launches.length, 1);
  assert.equal(launches[0].file, "/usr/bin/open");
  assert.deepEqual(launches[0].args, [
    "-a", "Google Chrome Dev", "--args", "--remote-debugging-port=9222",
    "--remote-allow-origins=*", "--enable-unsafe-extension-debugging",
    "--no-first-run", "--restore-last-session",
    `--user-data-dir=${process.env.SUPER_BROWSER_DATA_DIR}`,
  ]);
  assert.equal(launches[0].options.timeout, 5000);
  assert((await stat(process.env.SUPER_BROWSER_DATA_DIR!)).isDirectory());
  assert.equal(polls, 4);
  assert(now > 0);
  assert.deepEqual(events, ["browser_starting", "browser_ready"]);
});

test("custom port and profile are passed as literal arguments", async () => {
  process.env.SUPER_BROWSER_CDP_URL = "http://localhost:9333";
  process.env.SUPER_BROWSER_DATA_DIR = join(temp, "profile $(not-a-command) 'quoted'");
  mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "http://localhost:9333/json/version");
    return ++polls === 1 ? stopped() : ready();
  });
  await browserInfo();
  assert(launches[0].args.includes("--remote-debugging-port=9333"));
  assert(launches[0].args.includes(`--user-data-dir=${process.env.SUPER_BROWSER_DATA_DIR}`));
});

test("the default persistent profile is reused", async () => {
  delete process.env.SUPER_BROWSER_DATA_DIR;
  mock.method(globalThis, "fetch", async () => ++polls === 1 ? stopped() : ready());
  await browserInfo();
  assert(launches[0].args.includes(`--user-data-dir=${join(homedir(), ".agents", "browsers", "default")}`));
});

test("launch failure is browser_unavailable and does not poll or retry", async () => {
  launchError = new Error("Application cannot be found");
  mock.method(globalThis, "fetch", async () => { polls++; return stopped(); });
  await assert.rejects(browserInfo(), error => error instanceof BrowserUnavailableError && /Could not start.*Application cannot be found/.test(error.message));
  assert.equal(launches.length, 1);
  assert.equal(polls, 1);
});

test("readiness timeout is bounded and never relaunches Chrome", async () => {
  mock.method(globalThis, "fetch", async () => { polls++; return stopped(); });
  const events: string[] = [];
  await assert.rejects(browserInfo(event => events.push(event)), error => error instanceof BrowserUnavailableError && /within 20 seconds/.test(error.message));
  assert.equal(now, 20_000);
  assert.equal(launches.length, 1);
  assert(polls > 1);
  assert.deepEqual(events, ["browser_starting"]);
});

test("HTTP failure, invalid JSON, and nonlocal WebSockets do not trigger a launch", async () => {
  for (const response of [new Response("occupied", { status: 503 }), new Response("not json"),
    Response.json({ webSocketDebuggerUrl: "ws://example.com/devtools/browser/test" })]) {
    mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(browserInfo(), BrowserUnavailableError);
  }
  assert.equal(launches.length, 0);
});

test("a nonlocal CDP origin is rejected before fetching or launching", async () => {
  process.env.SUPER_BROWSER_CDP_URL = "https://example.com";
  mock.method(globalThis, "fetch", async () => { polls++; return ready(); });
  await assert.rejects(browserInfo(), /local HTTP origin/);
  assert.equal(polls, 0);
  assert.equal(launches.length, 0);
});

test("a relative profile is rejected without launching", async () => {
  process.env.SUPER_BROWSER_DATA_DIR = "relative/profile";
  mock.method(globalThis, "fetch", async () => stopped());
  await assert.rejects(browserInfo(), /absolute path/);
  assert.equal(launches.length, 0);
});

test("a profile path that is a file reports a setup error without launching", async () => {
  await writeFile(process.env.SUPER_BROWSER_DATA_DIR!, "keep this file");
  mock.method(globalThis, "fetch", async () => stopped());
  await assert.rejects(browserInfo(), BrowserUnavailableError);
  assert.equal(launches.length, 0);
});
