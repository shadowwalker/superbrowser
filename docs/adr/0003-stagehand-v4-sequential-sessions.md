# Use Stagehand v4 with sequential sessions

The user chose Stagehand v4 and a single automation session at a time against the shared Chrome Dev browser. Root and workspace dependencies pin 4.1.0. Browser lifetime remains external as defined in ADR 0001.

Use localBrowser.connect with an already loaded extension ID, then Stagehand.create. The SDK's default connection reloads its extension each time; earlier sequential tests encountered worker-target errors and timeouts. The shared utility uses Chrome's Extensions commands to find or load the installed SDK extension and reuse it between runs. A force-killed process can leave its Stagehand session initialized. On that specific initialization error, recreate only the matching Stagehand extension once before any workflow actions, then reconnect. This depends on the agreed sequential-use constraint.

Close the Stagehand session, then exit the standalone process to release the remaining host transport. Do not call the browser handle's close method, which closes attached Chrome in this pinned SDK. Preserve tabs, profile data, and authentication across runs.

The template logs each run and distinguishes sign-in, browser availability, workflow failures, and interruptions. Scheduled runs exit on authentication expiry and can resume after the user signs in. Automated repair needs an explicitly configured agent invocation after the workflow exits.
