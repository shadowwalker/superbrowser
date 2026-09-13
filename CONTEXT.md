# Superbrowser

Superbrowser helps users work with AI agents to explore websites, build browser automations, and maintain those automations as websites change.

## Language

**Exploration**:
An agent's investigation of a website to understand how to complete the user's requested workflow.

**Authentication handoff**:
A pause in automation while the user authenticates with the website.

**Browser profile**:
The saved browser data used across automation runs, including website sessions and preferences.
_Avoid_: Browser process

**Shared browser**:
The one running browser used by the user and automation scripts. Its lifetime is independent of individual automation runs.
_Avoid_: Browser profile

**Automation script**:
A saved, executable browser workflow intended for repeated runs. Its steps may be deterministic or use natural-language interpretation where needed.

**Automation workspace**:
The user's shared home for automation scripts, reusable helpers, snippets, and dependencies. Scripts use these common resources across website workflows.

**Repair**:
Revisiting exploration and updating an automation script after a failed run.
_Avoid_: Self-improvement
