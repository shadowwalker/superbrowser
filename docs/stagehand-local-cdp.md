# Stagehand with an external Chrome Dev browser

Superbrowser pins **Stagehand 4.1.0** and runs one automation or exploration session at a time. Chrome Dev belongs to the user and remains open between runs. See [browser ownership](adr/0001-external-browser-lifetime.md), the [v4 decision](adr/0003-stagehand-v4-sequential-sessions.md), and the [current validation record](../.scratch/superbrowser-v4/validation.md).

Research and local checks were performed on 2026-09-12. The [Context7 index](https://context7.com/websites/stagehand_dev/llms.txt) supplied discovery links. APIs were checked against the installed 4.1.0 declarations and release source. This reference covers local CDP only; portable workflow instructions live in the skill's [scripting reference](../skills/superbrowser/references/scripting.md).

## Browser startup and connection

Setup starts Chrome outside automation scripts with a dedicated persistent profile, a loopback debugging port, and `--enable-unsafe-extension-debugging`. The profile defaults to `~/.agents/browsers/default`, overridable through SUPER_BROWSER_DATA_DIR. Chrome's debugging restrictions require a nonstandard data directory. Connecting cannot switch the profile of an existing process. [Chrome debugging changes](https://developer.chrome.com/blog/remote-debugging-port).

The HTTP origin defaults to `http://127.0.0.1:9222`, overridable through SUPER_BROWSER_CDP_URL. Discover the browser WebSocket from `/json/version` each run; its UUID changes after a restart. The v4 connection shape is:

```ts
const browser = await localBrowser.connect({ cdpUrl, extensionId });
const stagehand = await Stagehand.create({ browser });
const context = browser.context;
```

The extension ID is optional in the public API. Superbrowser supplies it to reuse the loaded extension between sequential sessions. [Browser documentation](https://docs.stagehand.dev/v4/configuration/browser), [4.1.0 browser factory source](https://github.com/browserbase/stagehand/blob/cd7b230778cf92269e4cb90e80d97f5113781c51/packages/sdk-ts/src/browser/factories.ts).

The [connection utility](../skills/superbrowser/assets/template/utils/browser.ts) locates the installed SDK extension and checks its path, enabled state, and manifest version through Extensions.getExtensions. It loads the extension only when needed. Chrome's Extensions CDP domain is experimental; use a recent Chrome Dev with the required commands and flag. [Chrome Extensions protocol](https://chromedevtools.github.io/devtools-protocol/tot/Extensions/).

## Sequential lifetime and forced termination

Earlier v4 tests intermittently failed with stale worker targets or initialization timeouts, including sequential runs. The SDK's default attachment reloads its extension; reusing it avoids that reload. This is a locally validated workaround, not proof of the earlier upstream race's cause. Historical evidence remains in the [foundation validation](../.scratch/superbrowser-skill/validation.md).

A force-killed script can leave the extension runtime initialized. On the specific `A Stagehand instance is already initialized` error, the utility resets only the matching Stagehand extension and reconnects once, before executing workflow code. It does not replay website actions. This requires the agreed sequential-use constraint. [4.1.0 session implementation](https://github.com/browserbase/stagehand/blob/cd7b230778cf92269e4cb90e80d97f5113781c51/packages/sdk-ts/src/stagehand.ts).

For cleanup, await stagehand.close(), then exit the standalone script process to release its remaining host transport. Do not call browser.close(): the pinned local browser handle sends Browser.close and shuts down attached Chrome. The public guide's broader lifecycle wording is insufficient for this ownership model; release source and local process tests establish the behavior. [Browser close implementation](https://github.com/browserbase/stagehand/blob/cd7b230778cf92269e4cb90e80d97f5113781c51/packages/sdk-ts/src/browser/factories.ts#L282-L296), [Stagehand close implementation](https://github.com/browserbase/stagehand/blob/cd7b230778cf92269e4cb90e80d97f5113781c51/packages/sdk-ts/src/stagehand.ts#L271-L297).

The [shared runner](../skills/superbrowser/assets/template/utils/run.ts) handles normal completion, SIGINT, SIGTERM, deadlines, status, and bounded cleanup. SIGKILL bypasses cleanup, leaving a running status with a dead PID. The next process recovers the stale extension session. The 36-case Bun/Node matrix verified these transitions while preserving browser and unrelated page IDs.

## API changes relevant to scripts

| Need | Stagehand 4.1.0 API |
| --- | --- |
| Connect and initialize | localBrowser.connect(), then Stagehand.create() |
| List or create tabs | await context.pages(); await context.newPage(url) |
| Identify a tab | await page.url(); page.pageId; await page.title() |
| Read accessible DOM | await page.snapshot(), returning formattedTree, xpathMap, urlMap |
| Inspect layout | await page.screenshot({ path }) |
| Read known data | await page.evaluate(fn, input); locator.innerText() |
| Wait and act deterministically | waitForSelector(), locator.count(), isVisible(), click(), fill() |
| Interpret a step | stagehand.observe(), act(), extract(), with an explicit page and model |
| Read a model result | v4 returns data and metadata, rather than v3's direct data shape |

Page/context lookups that were synchronous in v3 now need await. Stagehand's page API resembles Playwright but is not interchangeable with it. [Migration guide](https://docs.stagehand.dev/v4/migrations/v3), [page reference](https://docs.stagehand.dev/v4/reference/page), [locator reference](https://docs.stagehand.dev/v4/reference/locator).

Deterministic operations run without a model key. The coding agent's model is separate from Stagehand inference configuration. In 4.1.0, even act(Action) requires a configured model, so deterministic replay should use locators where practical. For model calls, supply the chosen provider configuration and inspect data and metadata. Check website postconditions independently of an action's reported success. [Stagehand reference](https://docs.stagehand.dev/v4/reference/stagehand), [release runtime](https://github.com/browserbase/stagehand/blob/cd7b230778cf92269e4cb90e80d97f5113781c51/packages/extension/runtime.ts).

The pinned package requires Node >=22.18.0. Bun runs TypeScript directly; the Node path compiles it first. All three dependency-install paths, Bun/pnpm/npm, passed fresh-workspace checks. See the [bundled setup reference](../skills/superbrowser/references/setup.md).

## Authentication and repair

Use site-specific authentication checks and leave the sign-in tab open for the user. Scheduled processes record auth_required and exit 75; after sign-in, the next run reuses the browser profile. Persistent cookies can still expire or be revoked by the website. The real Transparent Classroom session survived the v4 browser restart and subsequent Bun and Node runs.

An agent diagnoses a failed run from the script's original goal, status, step events, and available page evidence. Authentication, browser availability, and website changes need different responses. A configured scheduler or monitor must invoke an agent for unattended repair. See the self-contained [operations reference](../skills/superbrowser/references/operations.md).
