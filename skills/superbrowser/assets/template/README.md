# Superbrowser workspace

This is the shared home for browser automation scripts and utilities. Agents should read [AGENTS.md](AGENTS.md) and the relevant script README before development or repair.

| Script | Goal | Instructions |
| --- | --- | --- |
| example | Check the shared browser connection and read a page deterministically | [Example](scripts/example/README.md) |

## Run a script

Chrome Dev must already be running with local CDP and the persistent Superbrowser profile. Run one browser script at a time.

```sh
bun scripts/example/main.ts
```

For Node, compile first with `pnpm run build` or `npm run build`, then run:

```sh
node dist/scripts/example/main.js
```

Source and compiled scripts resolve configuration and logs from this workspace, independently of the caller's working directory. Shared code lives in `utils`; each script owns its task notes, helpers, configuration, exploration files, and logs. Save downloaded artifacts in the configured output destination.

## Run results

Each script writes `logs/latest.json` and a separate folder for every run. Authentication expiry produces `auth_required` and a local sign-in notification. Sign in through Chrome Dev, then rerun or let the next scheduled run resume. Failures produce a failed status, step logs, and page evidence when available. macOS notification settings control whether notifications are displayed; logs and exit status remain available. Set `SUPER_BROWSER_NOTIFY=0` to disable desktop notifications.

Scheduling and unattended agent repair are configured for each user's environment. Use absolute runtime and script paths, preserve the user's HOME and local browser session, and avoid overlapping runs. Record the installed schedule and notification or agent integration in that script's README.
