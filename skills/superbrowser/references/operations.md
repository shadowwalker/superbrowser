# Scheduled runs, authentication, and repair

Use this reference when a script will run repeatedly, unattended, or after a failure. Each script's README is the record of its goal, inputs, output location, success conditions, schedule, notification setup, and repair history.

## Run records

The shared runner creates `scripts/<name>/logs/<run-id>/events.jsonl` and status.json, and atomically updates `logs/latest.json`. Status records contain the script, process ID, run ID, timestamps, state, exit code, last step, and result or error. Step events retain intermediate progress. Failed workflows also capture a screenshot and DOM snapshot of the selected page when available; authentication failures do not capture login screens.

| State | Exit | Next action |
| --- | --- | --- |
| succeeded | 0 | Verify the result matches the task's success conditions |
| auth_required | 75 | Ask the user to sign in through shared Chrome, then verify and rerun |
| browser_unavailable | 69 | Automatic startup or connection failed; follow setup to diagnose installation, session, profile, port, or flags |
| failed | 1 | Diagnose configuration, connectivity, website changes, or partial execution |
| interrupted | 130 or 143 | Check partial effects before rerunning |
| running with a dead PID | No final exit recorded | Inspect its last event; a forced termination may have bypassed cleanup |

Run one script or browser exploration session at a time. SIGINT and SIGTERM allow cleanup. SIGKILL cannot; the next connection can recreate an orphaned Stagehand extension session once before workflow execution. This recovery relies on sequential use. It does not retry website actions.

When Chrome Dev is stopped, the shared connection utility starts it automatically with the persistent profile and waits up to 20 seconds for CDP. `browser_starting` and `browser_ready` events show this before workflow execution. A healthy browser is reused; failed launch or readiness remains `browser_unavailable`.

Use `run.step` for meaningful stages and `run.log` for compact progress. Redact credentials and signed URLs at the source. The runner also strips URL queries and known credential fields, but arbitrary text may still contain private data. Keep logs and screenshots private, and retain relevant failing runs through repair. Archive or prune older runs according to the user's retention preference.

## Authentication and notifications

Keep the sign-in tab open. In an interactive task, pause and ask the user to authenticate. Check a site-specific authenticated state or successful authenticated request before continuing.

An unattended process cannot perform the human handoff. It records auth_required, sends a local macOS notification, and exits 75. Once the user signs in, the next scheduled or manual run reconnects to the same profile and resumes its repeat-safe workflow. Avoid leaving a cron process waiting indefinitely for input.

The runner also notifies on failures or unavailable browser setup. Repeated runs in the same attention state suppress duplicate notifications until the state changes. macOS controls notification delivery; logs and exit codes remain authoritative. Set SUPER_BROWSER_NOTIFY=0 to disable desktop notifications. For remote machines or another notification channel, configure the user's chosen integration explicitly and record it in the README.

## Scheduling

When the user asks to install a schedule, establish the timing, timezone, runtime path, script arguments, and notification destination. Use their chosen scheduler. There is no schedule installed by the template.

Use an absolute runtime and entrypoint, preserve the user's HOME, and pass any CDP and profile overrides and required environment variables explicitly. Cron often has a minimal PATH and does not inherit the interactive shell environment. The shared utility launches Chrome Dev when needed, using an absolute `/usr/bin/open` path. The browser must run in the same logged-in macOS session; a sleeping or logged-out Mac cannot reliably run this local GUI workflow. Keep browser startup in the shared utility rather than individual workflows or scheduler wrappers.

For Bun, the command shape is `/absolute/path/to/bun /absolute/workspace/scripts/<name>/main.ts`. For Node, build beforehand and use `/absolute/path/to/node /absolute/workspace/dist/scripts/<name>/main.js`. Rebuild after repairs. Redirect scheduler stdout and stderr to a file in the script's logs directory so module-load or runtime failures before the runner starts are also retained. Test the exact command with the scheduler's environment from an unrelated working directory.

Space schedules so they cannot overlap, or let the scheduler serialize them globally across this shared browser. Run the command manually and inspect its status before installing a schedule. Record the installed scheduler entry and how to pause it in the script README.

## Agent-assisted repair

A script writes evidence; an agent must be invoked to interpret it. During an active agent session, read the relevant latest status when the user asks about a run. For automatic repair, configure the scheduler or an external monitor to invoke the user's chosen agent after a failed script process exits. The skill does not include a hidden daemon, a model API key, or a dependency on one agent application.

Pass that agent the installed Superbrowser skill, workspace AGENTS.md, script README, latest status, and referenced run directory. A suitable task is: "Diagnose this script's failed run against its original goal. Read the logs, explore the affected page through the shared browser, make the smallest supported correction, and verify a safe rerun. Update the script README with the cause and result. If sign-in is needed, notify the user and stop."

Use the selected agent's documented headless invocation and existing credentials. Do not assume the coding agent's model credentials configure Stagehand model calls. Trigger one repair attempt per failed run, only after the workflow releases its connection, and prevent recursive repair loops. Authentication expiry goes to the user; failed automatic browser startup goes through setup. Persistent or ambiguous failures need human review.

For a website change, compare the recorded selector, request schema, date meaning, and pagination assumptions with fresh evidence. Keep the original task and output contract. Before repeating a submission, purchase, message, or other write, establish whether the failed run already completed it. Validate both the corrected run and repeat behavior, then retain the cause and verification in the README and rebuild Node output.
