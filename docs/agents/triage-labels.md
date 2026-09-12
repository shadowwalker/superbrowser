# Triage labels

Use these default values in the `Status:` line of local issues.

| Canonical role | Tracker value | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | A maintainer needs to evaluate the issue. |
| `needs-info` | `needs-info` | The reporter needs to provide more information. |
| `ready-for-agent` | `ready-for-agent` | The issue is fully specified and ready for an unattended agent. |
| `ready-for-human` | `ready-for-human` | The issue requires human implementation. |
| `wontfix` | `wontfix` | The issue will not be implemented. |

When a skill asks to apply a triage role, use the corresponding tracker value. Edit the Tracker value column to change this repo's vocabulary.

Wayfinding tickets also use `claimed` and `resolved` as described in `issue-tracker.md`.
