# Shared-browser example

## Original goal

Verify that a standalone automation can attach to the user's persistent Chrome Dev browser, inspect a page without model calls, exit, and reconnect to the same tab on another run.

## Run and configuration

`config.json` selects the URL, initially https://example.com/. Pass an HTTP or HTTPS URL as the first argument to override it for a controlled fixture.

```sh
bun scripts/example/main.ts
```

With Node, build from the workspace root using the selected package manager, then run `node dist/scripts/example/main.js`.

## Success and side effects

The script reuses a tab with the exact URL or creates one. It checks for a visible body, title, and readable snapshot. The result contains the title, URL, page ID, and a short snapshot. Two consecutive runs should report the same page ID and leave Chrome open. No model configuration or website sign-in is needed for the default URL.

## Operations and repair

There is no installed schedule. See `logs/latest.json` for the latest result and the referenced run directory for step events. The shared utility starts a stopped Chrome Dev automatically and waits up to 20 seconds for CDP readiness. `browser_unavailable` means automatic startup or connection failed and setup or Chrome flags need attention. A failure in `verify-page` may reflect page readiness, connectivity, or changed content. Inspect that page and its captured evidence before changing the script. Preserve the original connection-and-reuse goal.
