# Issue tracker: local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- Use one directory per feature at `.scratch/<feature-slug>/`.
- Write the spec at `.scratch/<feature-slug>/spec.md`.
- Write one implementation issue per file at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`.
- Record triage state in a `Status:` line near the top of each issue. Use the values in `triage-labels.md`.
- Append comments and conversation history under a `## Comments` heading.

## Publish to the issue tracker

Create the spec or issue file at the path defined above. Create its directory if needed.

## Fetch the relevant ticket

Read the referenced issue file. Resolve an issue number within the relevant feature directory.

## Wayfinding operations

The `/wayfinder` skill uses a map file and one child file per ticket.

- Store the map at `.scratch/<effort>/map.md`, with Notes, Decisions-so-far, and Fog sections.
- Store child tickets at `.scratch/<effort>/issues/<NN>-<slug>.md`, numbered from `01`. Put the question in the body and record the ticket type in a `Type:` line using `research`, `prototype`, `grilling`, or `task`.
- Record blockers near the top with `Blocked by: NN, NN`. A ticket is unblocked when every listed ticket has `Status: resolved`.
- To select work, scan the effort's issues for open, unblocked, unclaimed tickets. Choose the first by number.
- To claim a ticket, set `Status: claimed` and save before starting work.
- To resolve a ticket, append the answer under `## Answer` and set `Status: resolved`. Then append a summary and link to the map's Decisions-so-far section.
