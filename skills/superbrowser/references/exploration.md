# Explore a website before scripting

Use this reference for a new workflow or when a website change breaks an existing script. Exploration should produce enough observed evidence to implement and verify the requested outcome. Read [scripting.md](scripting.md) for the Stagehand v4 APIs.

## Establish the data and completion conditions

Identify the account or page in scope, requested operation, inputs, output destination, and what proves completion. For date-based workflows, distinguish the website's record date from its upload timestamp and define the timezone used for "today". For collections, establish pagination and the end condition before claiming that all records were processed.

Keep probes and private artifacts under `~/.superbrowser/scripts/<name>/exploration/`, and retain concise findings in that script's README.md. Put reusable techniques in the skill; keep personal records, signed download links, and account-specific details in the user's workspace or output directory.

## Inspect through the shared browser

Connect using `utils/browser.ts` and select the intended tab by its observed URL. Start with a snapshot to find the relevant section, then narrow DOM reads to that section. Full account pages may include unrelated personal information. Read just the fields, attributes, or controls needed for the next decision.

When the site requests authentication, leave that tab open and hand off to the user. Stop browser automation until the user finishes. Then verify the destination and a site-specific authenticated state or successful authenticated data request. A stale signed-in page does not prove its session is still valid.

For repeated inspection, save a small TypeScript probe in the script's exploration folder and run it as a standalone process. An available Chrome DevTools MCP or other browser tool is also suitable if it connects to this same CDP browser and profile. Verify its target before using it; a separate browser session will not share the user's sign-in. Stop other browser automation while exploring. Keep returned evidence compact: selectors, field names, counts, date ranges, and a representative record. Redact query strings on signed media links before printing or retaining evidence.

## Follow the page's actual data flow

Inspect observed DOM links and requests made when loading the page, navigating to its relevant tab, or triggering pagination. `performance.getEntriesByType("resource")` can reveal recent request URLs, but a narrow keyword filter can hide the key request; capture with a broad filter, or attach a network listener before repeating the read operation.

Use a DOM parser to turn observed description HTML into text. Preserve the complete description when the UI visually clips it. For downloads, compare the real Download link with preview URLs. An original file may have a completely different path from its thumbnail; use the observed original URL rather than changing a filename suffix.

Avoid copying browser cookies into saved scripts. Fetch session-protected records in the browser. When the site returns a signed download URL, use it unchanged for that download and obtain a fresh URL on the next run. Signed URLs often expire and can be method-specific: test downloads with the same method the script uses (`GET`, not `HEAD`). Keep credentials and expiring signatures out of logs and saved metadata.

## Find the page's data API

Before scripting repeated DOM parsing, look for the request that already delivers the records. Beyond observed XHR/fetch traffic, try the page URL with a `.json` suffix (common in Rails apps), `/api` and GraphQL siblings, and embedded JSON (`__NEXT_DATA__`, `<script type="application/json">`).

Validate a candidate endpoint against the visible page before relying on it:

- Fetch it inside `page.evaluate()` with the browser's session, never with copied cookies.
- Compare record IDs, dates, and counts with the UI, including the first and last page.
- Confirm its scope matches the page's account, child, project, or filter.
- Follow observed pagination parameters and find the terminal response. Empty arrays, repeated pages, and error payloads are different outcomes.
- Note the endpoint's own authentication signal. A `401` with a JSON body is cleaner than an HTML sign-in redirect, and an expired session must never look like an empty collection.
- Record the schema, and log the field names of unrecognized records so drift fails visibly instead of silently dropping data.

A structured endpoint is usually faster and more reliable than repeated DOM reads: no rendering, stable field names, fewer requests. Treat it as an observed interface, not a contract — undocumented endpoints can change without notice, so keep the DOM as fallback evidence for repair. Prefer the endpoint only when it exposes the requested records more directly than UI interactions, and keep its resource scope intact.

## Verify boundaries before implementing the full run

Check a representative record, another page of results, and the collection's terminal page or cursor. For a date filter, verify exact dates and an empty date. Confirm whether one record can contain multiple files or whether some records have no downloadable file. Choose a stable record or file ID for filenames and deduplication.

Distinguish "no matching records" from a changed response schema, an unprocessed image, a repeated pagination page, or a failed request. Make these failures visible so the agent can repair the affected step.

Write down the observed endpoint or selectors, required fields, date meaning, authentication signal, pagination rule, download source, and verification result in a short task-specific note. The final script should use deterministic reads and actions for the verified steps. Add a model call only for a step whose interpretation still requires it.
