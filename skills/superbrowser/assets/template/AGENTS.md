# Develop in this automation workspace

Read the root README index and the relevant `scripts/<name>/README.md` before changing a workflow. Each script's README records the user's goal, constraints, data semantics, commands, success criteria, and repair evidence. Update it when behavior changes, and add new scripts to the root index.

## Layout and runtime

- Put reusable utilities in `utils/` and each workflow in `scripts/<name>/`. Keep its main.ts, helpers, config.json, exploration files, and logs together.
- Use TypeScript with `.js` extensions in relative imports. Bun resolves the source; TypeScript preserves imports for Node. Run `bun scripts/<name>/main.ts`, or build using the selected package manager and run `node dist/scripts/<name>/main.js`.
- Reuse the root dependencies and compiler configuration. Add dependencies here rather than creating separate packages inside script folders. Check package.json for the pinned Stagehand version.
- Resolve configuration and logs with `scriptDirectory(name)` or the runner's `scriptDir`. These paths point to the source workspace even when running compiled code from another working directory. User outputs have their own configured destination.
- Run `bun run typecheck` and `bun run build` after TypeScript changes. With Node, use `pnpm run` or `npm run` instead. Validate the user's requested outcome as well as the exit status.

## Browser workflow

The browser belongs to the user and outlives scripts. Chrome Dev starts separately using the persistent profile and local CDP. Run one browser automation or exploration session at a time. Stagehand v4's connection utility reuses its loaded extension. Use `runScript` from `utils/run.ts` for saved workflows. It connects, logs, closes the Stagehand session, and exits the standalone process. Never call `browser.close()` or `browser.context.close()` in a workflow.

Stagehand v4 uses asynchronous `context.pages()` and `page.url()`, `page.pageId`, and `browser.context`. The runner supplies `context` and `stagehand`. Its example shows current usage; installed SDK declarations resolve uncertain APIs. Deterministic page operations need no model key. If a step needs act/observe/extract, supply explicit model configuration and target its page. The coding agent's model is separate from Stagehand's inference configuration.

Select a tab by the intended site and resource. Inspect the relevant DOM, snapshot, or observed read request before choosing selectors and endpoints. Prefer a validated JSON read endpoint over DOM parsing when it exposes the same records, and keep the DOM as fallback evidence. Prefer deterministic code with explicit success checks. Keep temporary exploration under the script's folder, and retain concise findings in its README. Preserve other tabs and the browser profile.

## Logs, authentication, and repair

Use `run.step("name", async () => ...)` for meaningful workflow stages, `run.log(event, data)` for progress, and `run.usePage(page)` for failure evidence. Log counts, record IDs, and outcomes rather than secrets or full page data. The runner strips URL queries and known credential fields; callers still choose what data is appropriate to log.

Throw `AuthenticationRequiredError`, call `run.authRequired(message, loginUrl)`, or use the explicit `AUTH_REQUIRED:` marker for errors crossing page.evaluate. Interactive agents pause and ask the user to sign in through Chrome Dev, then verify authentication and rerun. Scheduled processes exit 75 with `auth_required`; they resume on the next run after sign-in. The persistent profile retains website sessions until the website expires or revokes them.

Read `scripts/<name>/logs/latest.json` first, then that run's events.jsonl and any failure evidence. Exit codes are 0 for success, 75 for authentication, 69 for unavailable browser setup, 1 for workflow failures, and 130/143 for interruption. A stale `running` status whose PID is gone means the process ended before it could record completion.

Separate authentication, browser availability, bad configuration, network failures, and website changes. For repair, compare fresh website evidence with the script's documented goal and assumptions, change the affected step, and verify a safe rerun. Check partial effects before repeating submissions or other writes. Stop repeated repair attempts when the cause remains unclear. Preserve previous logs and update the README with the cause and verified correction.

The skill and scripts do not wake an AI agent by themselves. An unattended repair flow needs the user's scheduler to invoke a configured agent after a failed process exits, passing the script README and run status. Keep that invocation separate from the browser run so sessions do not overlap. Authentication requires the user, not a code repair.
