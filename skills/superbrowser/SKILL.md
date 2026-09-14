---
name: superbrowser
description: Explore websites and build, run, schedule, or repair browser automation with Stagehand and a persistent local Chrome Dev browser. Use for workflows that need browser interaction, including sites where the user must sign in.
---

# Superbrowser

Use one persistent Chrome Dev browser through local CDP. The shared connection utility starts Chrome Dev when needed and waits for readiness; Chrome then outlives automation scripts. Support macOS, TypeScript, Bun or compiled Node, and sequential browser sessions.

## Enter the workspace

This skill works from any starting directory. Resolve the installed skill directory from this SKILL.md, not the agent's current working directory. On first use, missing prerequisites or workspace files, or failed automatic browser startup, follow [references/setup.md](references/setup.md). A stopped Chrome Dev alone needs no manual setup: connect through the shared utility.

Keep the user's automations in `~/.superbrowser`. Read its AGENTS.md explicitly, even if the agent started elsewhere and did not load it automatically. Read the root README index and the relevant script README before changing an existing workflow. The bundled template is self-contained; no source-repository checkout or particular agent plugin is required.

## Build a workflow

1. Establish the user's goal, inputs, output destination, and success conditions. Create `scripts/<name>/README.md` with that information, or update the existing one.
2. Follow [references/exploration.md](references/exploration.md). Use a temporary TypeScript probe or an available browser tool connected to the same CDP browser. Look for the page's own data requests and validate a JSON read endpoint against the UI before scripting DOM parsing. Record observed selectors, endpoints, schemas, data semantics, and pagination in the script README.
3. If authentication is required, leave the relevant tab open, pause browser automation, and ask the user to sign in there. Verify authentication afterward. The persistent profile retains the session until the website expires or revokes it.
4. Follow [references/scripting.md](references/scripting.md). Build TypeScript under `scripts/<name>/`, reuse `utils/` and the root dependencies, and prefer short deterministic workflows. Add narrow model calls only where they materially improve the solution.
5. Run and verify the requested outcome and a repeat run. Keep the script's commands, configuration, outputs, and repair findings in its README. Add it to the root README index.

## Operate and repair

For repeated or unattended runs, follow [references/operations.md](references/operations.md). Use per-run logs and durable status, distinguish authentication expiry from a broken workflow, and configure the user's chosen scheduler and notification or agent integration when requested. A skill cannot wake an agent by itself.

When a run fails, read its README, latest status, step logs, and available page evidence. Resolve authentication or browser setup first. For a website change, re-explore the affected step, update the script, and verify the correction. Before replaying a write, determine whether the previous attempt already succeeded. Stop repeated repair attempts when the cause or outcome remains unclear.

Run one automation or exploration session at a time against the shared browser. Use `runScript` or `connectBrowser` so automatic startup stays in the shared utility. It uses macOS Launch Services, the persistent profile, and the required CDP and extension flags, then waits up to 20 seconds. The shared runner releases its Stagehand session and exits its standalone process. Keep custom launch code out of workflows; never close the browser or remove its profile.
