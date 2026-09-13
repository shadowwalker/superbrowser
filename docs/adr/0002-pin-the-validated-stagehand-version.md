# Pin the validated Stagehand version

Superseded by [ADR 0003](0003-stagehand-v4-sequential-sessions.md). This records the initial compatibility decision.

The first Superbrowser template uses Stagehand 3.7.0, the version used by the earlier project. Stagehand 4.1.0 passed an initial single-tab lifecycle probe but later failed during repeated attachment with a stale-target error and initialization timeouts; 3.7.0 passed the expanded checks without extension-loading workarounds. Keep the template pinned to 3.7.0 and re-run the browser lifecycle checks before upgrading, because predictable attachment is more important here than adopting the newest SDK API.
