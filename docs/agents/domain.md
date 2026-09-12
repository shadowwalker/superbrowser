# Domain docs

This repo uses a single-context layout.

## Before exploring

- Read `CONTEXT.md` at the repo root for domain terms and their definitions.
- Read ADRs in `docs/adr/` that apply to the area you are about to work in.

If these files or directories do not exist, proceed silently. The `/domain-modeling` skill creates them when domain terms or decisions are resolved. Setup does not create placeholder domain docs.

## File structure

- `CONTEXT.md` holds the repo's domain context and glossary.
- `docs/adr/` holds architecture decision records.

## Use the glossary's vocabulary

Use the terms defined in `CONTEXT.md` when naming domain concepts in issue titles, proposals, hypotheses, and tests. Follow any guidance about synonyms to avoid.

If a needed concept is missing, check whether an existing term fits. If there is a real gap, note it for `/domain-modeling`.

## Flag ADR conflicts

When a proposal contradicts an existing ADR, identify the ADR and explain why the decision should be reconsidered.
