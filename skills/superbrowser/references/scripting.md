# Write Stagehand v4 scripts

The template pins Stagehand 4.1.0. Use its installed declarations or the v4 documentation for uncertain APIs. The bundled [example](../assets/template/scripts/example/main.ts) and [runner](../assets/template/utils/run.ts) are the starting point.

## Script layout and execution

Create `~/.superbrowser/scripts/<name>/main.ts` and README.md. Keep its config.json, helpers, exploration files, and logs in that folder. Shared helpers belong in `~/.superbrowser/utils`; dependencies and TypeScript configuration stay at the workspace root. Keep the root README script index current.

Use `.js` extensions in relative imports. Bun resolves them to TypeScript source; compilation preserves them for Node. Run `bun scripts/<name>/main.ts`, or build using `pnpm run build` or `npm run build`, then run `node dist/scripts/<name>/main.js`. Rebuild after edits. Use absolute entrypoint paths when starting from another directory or scheduling.

The runner's `scriptDir` points to the source script folder on both runtimes. Resolve configuration and local files from it. `import.meta.url` points into dist after compilation, so it is not the base for user configuration or logs. External output destinations should be explicit configuration.

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runScript } from "../../utils/run.js";

await runScript({ name: "my-script" }, async run => {
  const config = JSON.parse(await readFile(join(run.scriptDir, "config.json"), "utf8"));
  const page = await run.step("select-page", async () => {
    for (const page of await run.context.pages()) {
      if (await page.url() === config.url) return page;
    }
    return await run.context.newPage(config.url);
  });
  run.usePage(page);
  return await run.step("read-result", async () => ({
    url: await page.url(), title: await page.title(),
  }));
});
```

Use meaningful step names and explicit postconditions. Return the verified result; the runner records it in the final status. `run.log(event, data)` records intermediate counts and outcomes. For authentication, call `run.authRequired(message, loginUrl)` or throw `AuthenticationRequiredError`. The marker `AUTH_REQUIRED:` is also recognized in errors propagated from page.evaluate. See [operations.md](operations.md) for exit codes and logs.

## Browser connection and APIs

The runner uses the shared connection utility to start Chrome Dev automatically when CDP is unavailable and wait up to 20 seconds for readiness. The launch preserves the configured profile and restores its previous session. It then calls `localBrowser.connect({ cdpUrl, extensionId })` and `Stagehand.create({ browser })`. The connection utility loads the installed extension if needed and reuses its ID afterward. This avoids reloading the extension on every sequential attachment. The automatic launch includes `--enable-unsafe-extension-debugging`. The HTTP CDP origin remains stable; the utility rediscovers the browser WebSocket URL each run.

For standalone exploration probes, use `connectBrowser` from utils/browser.ts, close only `stagehand` in finally, and exit the process so its remaining transport cannot hold the probe open. Keep these probes separate from the production runner's latest status. Always preserve Chrome and unrelated tabs. In the pinned SDK, `browser.close()` closes the attached Chrome process; do not call it.

V4 page and context lookups are asynchronous: `await context.pages()`, `await page.url()`, `await context.newPage(url)`, and `await page.title()`. Use `page.pageId` for tab identity. `page.snapshot()` returns formattedTree, xpathMap, and urlMap. `page.screenshot({ path })` writes an image and returns its bytes. `page.evaluate(fn, arg)` supports scoped DOM reads and observed authenticated requests. The callback runs in the page: it cannot reference Node variables or imports, so define helpers inside it and pass inputs as serializable arguments. These operations need no model key.

Locator APIs include click, fill, innerText, count, and isVisible. Check `await page.waitForSelector(selector, { state: "visible", timeout: 10000 })` and the resulting website state. API names resemble Playwright but are not interchangeable. [Page reference](https://docs.stagehand.dev/v4/reference/page), [locator reference](https://docs.stagehand.dev/v4/reference/locator).

## Read site data from the page's endpoint

When exploration validated a JSON read endpoint, fetch it inside `page.evaluate()` so the browser's session applies. Map records to the minimal fields the workflow needs before returning them to Node, and keep signed URLs and private text out of logs.

```ts
const response = await page.evaluate(async (url: string) => {
  const result = await fetch(url, { headers: { accept: "application/json" } });
  const contentType = result.headers.get("content-type") ?? "";
  if (!result.ok) return { status: result.status, contentType, finalUrl: result.url, records: undefined };
  const body = await result.text();
  try {
    const records = (JSON.parse(body) as Array<Record<string, unknown>>).map(record => ({
      id: record.id, date: record.date, url: record.original_photo_url,
    }));
    return { status: result.status, contentType, finalUrl: result.url, records };
  } catch {
    return { status: result.status, contentType, finalUrl: result.url, records: undefined };
  }
}, requestUrl);

if (response.status === 401 || response.finalUrl.includes("/sign_in")) run.authRequired("Session expired", loginUrl);
if (response.status !== 200 || !response.records) throw new Error(`Endpoint returned HTTP ${response.status} (${response.contentType})`);
```

Treat `401` or a sign-in redirect as authentication, a non-JSON or malformed-array response as schema drift, and an empty array as "no records". Log the field names of unrecognized records so drift is visible. Download signed asset URLs from Node with the same method the site uses (`GET`), since signatures can be method-specific and expire; obtain fresh URLs on every run.

## Reuse workspace utilities

Check `utils/` before writing task-local helpers: `browser.ts` (CDP connection), `run.ts` (status, logging, notifications, page evidence), `paths.ts` (workspace-relative paths), `dates.ts` (`--all`/`--date`/`--today` selection and timezone-aware today), and `download-image.ts` (atomic image writes, JPEG checks, hash sidecars, skip-on-match).

## Model calls

The coding agent's model and credentials are separate from Stagehand's inference configuration. A workflow authored by any capable agent can run deterministically without a Stagehand model key.

When a step needs interpretation, supply an explicit model to the runner, for example `{ name, model: { modelName, apiKey } }`, using the user's chosen provider. Call `stagehand.observe`, `stagehand.act`, or `stagehand.extract` with an explicit `{ page }`. V4 returns `{ data, metadata }`; metadata includes token usage. Log usage if it helps evaluate the workflow, not credentials or full prompts containing private data.

Prefer locators for deterministic replay. The pinned v4 runtime requires model configuration for act calls even when an Action was supplied. Use observe to plan uncertain actions, then validate and execute the selected action. Do not retry a failed write without checking its effect. [Stagehand reference](https://docs.stagehand.dev/v4/reference/stagehand).
