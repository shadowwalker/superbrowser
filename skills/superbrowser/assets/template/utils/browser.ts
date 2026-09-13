import { localBrowser, Stagehand, type StagehandCreateOptions } from "@browserbasehq/stagehand";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, realpath } from "node:fs/promises";

export class BrowserUnavailableError extends Error {}

export function cdpOrigin() {
  const url = new URL(process.env.SUPER_BROWSER_CDP_URL || "http://127.0.0.1:9222");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SUPER_BROWSER_CDP_URL must be a local HTTP origin");
  }
  return url.origin;
}

export async function browserInfo() {
  const origin = cdpOrigin();
  try {
    const response = await fetch(`${origin}/json/version`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = await response.json();
    const socketUrl = new URL(info.webSocketDebuggerUrl);
    if (socketUrl.protocol !== "ws:" || !["127.0.0.1", "localhost", "[::1]"].includes(socketUrl.hostname)) throw new Error("Expected a local browser WebSocket");
    return { origin, socketUrl: socketUrl.href };
  } catch {
    throw new BrowserUnavailableError(`Chrome Dev is unavailable at ${origin}. Start the shared browser using the skill's setup reference`);
  }
}

// Small preflight connection. It never controls tabs or closes Chrome.
async function extensionId(socketUrl: string, reset = false) {
  const extensionDir = await realpath(join(dirname(fileURLToPath(import.meta.resolve("@browserbasehq/stagehand"))), "extension"));
  const manifest = JSON.parse(await readFile(join(extensionDir, "manifest.json"), "utf8"));
  const socket = new WebSocket(socketUrl);
  let id = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  socket.addEventListener("message", event => {
    const message = JSON.parse(String(event.data));
    const task = pending.get(message.id);
    if (!task) return;
    clearTimeout(task.timer);
    pending.delete(message.id);
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error("Chrome disconnected during preflight")); }
    pending.clear();
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Chrome preflight connection timed out")), 3000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Chrome preflight connection failed")); }, { once: true });
    });
    const command = (method: string, params = {}) => new Promise<any>((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Chrome ${method} timed out`)); }, 5000);
      pending.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    const { extensions } = await command("Extensions.getExtensions");
    const installed = extensions.find((extension: { path: string; enabled: boolean; version: string }) =>
      extension.path === extensionDir && extension.enabled && extension.version === manifest.version);
    if (reset && installed) await command("Extensions.uninstall", { id: installed.id });
    // Recreate only an orphaned runtime after a killed script; Chrome and its profile stay open.
    if (reset) return (await command("Extensions.loadUnpacked", { path: extensionDir })).id;
    // Avoid the SDK's default extension reload on each sequential attachment.
    return installed?.id ?? (await command("Extensions.loadUnpacked", { path: extensionDir })).id;
  } catch (error) {
    throw new BrowserUnavailableError(`Stagehand extension preflight failed. Chrome Dev must run with --enable-unsafe-extension-debugging. ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    socket.close();
  }
}

export async function connectBrowser(options: Omit<StagehandCreateOptions, "browser"> = {}, onRecovery?: () => void) {
  const { origin, socketUrl } = await browserInfo();
  for (let attempt = 0; attempt < 2; attempt++) {
    const browser = await localBrowser.connect({ cdpUrl: origin, extensionId: await extensionId(socketUrl, attempt === 1) });
    try {
      const stagehand = await Stagehand.create({ browser, logging: { level: "off" }, ...options });
      if (attempt === 1) onRecovery?.();
      return { stagehand, browser, context: browser.context };
    } catch (error) {
      if (attempt !== 0 || !(error instanceof Error) || !error.message.includes("A Stagehand instance is already initialized")) throw error;
    }
  }
  throw new Error("Could not recover the Stagehand session");
}
