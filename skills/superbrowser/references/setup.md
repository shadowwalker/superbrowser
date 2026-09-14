# Set up Superbrowser on macOS

Use on first use, for missing prerequisites, failed automatic browser startup, and when upgrading the workspace. Resolve paths independently of the agent's current directory. This version supports macOS; the agent needs filesystem, shell, and network access. Chrome DevTools MCP is optional.

## Prerequisites

Check `sw_vers -productVersion`. Chrome Dev and Bun require macOS 13 or newer. Check the browser executable:

```sh
"/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev" --version
```

If missing, use `brew install --cask google-chrome@dev` when Homebrew is available. Otherwise download and mount Google's universal Dev DMG:

```sh
superbrowser_download_dir="$(mktemp -d)"
curl -fL "https://dl.google.com/chrome/mac/universal/dev/googlechromedev.dmg" \
  -o "$superbrowser_download_dir/googlechromedev.dmg"
hdiutil attach "$superbrowser_download_dir/googlechromedev.dmg" -nobrowse
```

Use the reported mount path, verify Google Chrome Dev.app, copy it into /Applications with `ditto`, and detach the mount. Let the user handle administrator authentication if macOS requires it. Recheck the executable. [Google installation](https://support.google.com/chrome/answer/95346), [Homebrew cask](https://formulae.brew.sh/cask/google-chrome%40dev).

Detect runnable Bun, Node, pnpm, and npm commands from the user's home directory, outside a project that may enforce another package manager. Check `~/.bun/bin/bun` if Bun is not on PATH. Prefer Bun when both runtimes are installed. Stagehand v4 requires Node 22.18.0 or newer. Update an incompatible runtime through its existing manager.

| Available | Install workspace dependencies | Execute TypeScript |
| --- | --- | --- |
| Bun | `bun install` | `bun scripts/example/main.ts` |
| Node and pnpm, without Bun | `pnpm install` | `pnpm run build`, then `node dist/scripts/example/main.js` |
| Node without Bun or pnpm | `npm install` | `npm run build`, then `node dist/scripts/example/main.js` |

If neither runtime exists, install Bun with `curl -fsSL https://bun.com/install | bash`, then verify `~/.bun/bin/bun --version`. Use its absolute path if later shells do not preserve PATH. Detect Node independently of pnpm; repair a Node installation missing its package manager. [Bun installation](https://bun.com/docs/installation).

Set `superbrowser_runtime` to the resolved Bun or Node executable for the following copy command.

## Create or update the workspace

Resolve `superbrowser_skill_dir` to the installed folder containing this skill's SKILL.md. All required starter files are bundled under assets/template, including nested script folders and dotfiles.

```sh
superbrowser_workspace="$HOME/.superbrowser"
mkdir -p "$superbrowser_workspace"
"$superbrowser_runtime" --input-type=module -e '
  import { cp } from "node:fs/promises";
  await cp(process.argv[1], process.argv[2], {
    recursive: true, force: false, errorOnExist: false
  });
' "$superbrowser_skill_dir/assets/template" "$superbrowser_workspace"
cd "$superbrowser_workspace"
```

The recursive copy adds missing files and preserves existing ones. Inspect existing files before merging updates. Merge dependencies, build commands, and compiler settings rather than replacing user customization. Preserve script configs, outputs, credentials, lockfiles, and README entries. The template omits packageManager so it works with the selected package manager.

For the automatic-startup update, merge `utils/chrome.ts`, `utils/browser.ts`, and `utils/run.ts` together. Update the workspace AGENTS.md and README to say the shared connection utility starts a stopped Chrome Dev automatically. Rebuild compiled Node output; copying only missing files leaves the old attach-only connection code in place.

For an existing v3 or flat workspace, back up its source, documentation, configuration, package files, and lockfile before migration. Move common helpers into utils and each script into scripts/<name>; bring its notes, config, and exploration files with it. Update imports, configuration paths, the root README index, and affected README commands. Migrate v3 synchronous page lookups and direct result shapes to v4. Rebuild dist from source and validate existing workflows before retiring old entrypoints. Keep the backup outside active compiler inputs.

Run the selected dependency installer in the workspace. The template pins Stagehand 4.1.0. Read the workspace AGENTS.md explicitly. If an agent started elsewhere, use absolute file paths or set command working directories; do not create another dependency installation in that starting directory.

## Start or reuse Chrome Dev

The default CDP origin is `http://127.0.0.1:9222`; SUPER_BROWSER_CDP_URL can select another local HTTP origin. `runScript` and `connectBrowser` probe `<origin>/json/version` and reuse a healthy browser. When CDP is unavailable, the shared utility creates the profile directory if needed, starts Chrome Dev once through `/usr/bin/open`, and polls readiness for up to 20 seconds before attaching Stagehand. The runner records `browser_starting` and `browser_ready`. A stopped browser is handled automatically in both manual and scheduled runs.

The launch uses the port from SUPER_BROWSER_CDP_URL, the absolute SUPER_BROWSER_DATA_DIR or `~/.agents/browsers/default`, and the flags below. Launch Services keeps Chrome independent of the script process, with its previous session restored. For manual setup diagnosis on the default port, the equivalent command is:

```sh
superbrowser_data_dir="${SUPER_BROWSER_DATA_DIR:-$HOME/.agents/browsers/default}"
mkdir -p "$superbrowser_data_dir"
open -a "Google Chrome Dev" --args \
  --remote-debugging-port=9222 \
  --remote-allow-origins="*" \
  --enable-unsafe-extension-debugging \
  --no-first-run \
  --restore-last-session \
  --user-data-dir="$superbrowser_data_dir"
```

Set SUPER_BROWSER_DATA_DIR to an absolute path before running a script to override the profile. Keep CDP on loopback. When diagnosing an existing endpoint, confirm that its process is Chrome Dev using the intended profile and flags; an unrelated browser on the port is not the shared browser.

Reuse an already healthy process. `open` does not apply new flags to an existing browser. If a running profile lacks the v4 extension flag, preserve its tabs and work, explain the required restart, and restart it with the same profile and `--restore-last-session`. Wait for the old Chrome process to exit fully before calling open; otherwise Launch Services can send the new launch request to the closing process. If unsaved work makes the restart uncertain, hand that step to the user. Never remove the profile to fix a connection.

If automatic startup fails or times out, the runner exits 69 with `browser_unavailable` and a setup diagnostic. Check installation, the logged-in macOS session, port, profile, and process flags. The utility does not kill or restart an existing browser. The bundled utility uses Chrome's Extensions CDP commands to load and reuse the installed Stagehand extension. Upgrade Chrome Dev if those commands are unavailable. An SDK upgrade may require refreshing its extension; test sequential reconnects afterward. [V4 browser configuration](https://docs.stagehand.dev/v4/configuration/browser).

## Verify before exploring

Run the example twice using the selected runtime. It should report succeeded, the same page ID, and a live Chrome process after both runs. For Node, build first. A custom HTTP or HTTPS fixture URL can be passed as the first argument. The default example uses no provider key or model call.

Read `scripts/example/logs/latest.json` and its referenced events.jsonl. Confirm the actual runtime paths for later scheduling. Report the workspace, profile, CDP origin, runtime, and check result. Sign-in to the user's target website is the next exploration step; website cookies remain in this profile until expiry or revocation.
