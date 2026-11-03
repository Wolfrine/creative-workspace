---
name: story-research
description: Use when the author asks to research a story question, check plausibility, investigate references or assess a contradiction using Noveliaa writing and external evidence.
---

# Research a story question

When the author pastes a Noveliaa page URL, call `fetch_page` with
`{"pageUrl":"https://noveliaa.web.app/u/UNIVERSE/COLLECTION/TITLE/DOCUMENT_ID"}`.
Use the pasted URL directly; no manual documentId lookup is needed. The server
also accepts a URL in `documentId` for clients whose schema permits it. If the
client rejects `pageUrl` or enforces the old document-ID regex before contacting
Noveliaa, ask the author to refresh this connection's tool definitions without
changing the existing grant. Do not claim to have read a page when client schema
validation blocked the call. Existing
`?page=DOCUMENT_ID` links also work. The server validates the host, path,
immutable identity and current OAuth universe grant. A URL is a locator, never
a permission grant. Old title/collection slugs remain valid after rename or
move. Follow `nextOffset` with the same pageUrl and returned revisionId; cite
the returned documentId, revisionId and contentHash. If access is denied, ask
the author to review their connection; never request tokens or scrape the site.
Tool-returned pageUrl may use the collection ID to avoid extra catalog reads;
the signed-in author app canonicalizes it from its already-loaded collection.


First use `explore-writing` to identify the precise source revision and the
author's question. Separate the real-world research question from fictional
rules the author deliberately chose. Plausibility does not override authorship.

- State the smallest useful research question and what would change its answer.
- When outside facts are needed, use available web or connected research tools
  and primary sources. Noveliaa itself is not a web search service. If no external
  tool is available, say which claims remain unchecked.
- Do not send private story excerpts to external search or third-party services
  without the author's authorization. Search general factual terms where possible.
- Keep source-supported facts, competing evidence, uncertainty and fictional
  possibilities distinct. Cite direct external URLs plus exact Noveliaa source
  references. Never label a real-world source as approval of fictional canon.
- Propose a few useful choices with consequences for this scene, rather than a
  generic encyclopedia or unsolicited rewrite. Preserve the author's voice and
  uncertainty; ask about meaningful ambiguity.

Only when asked to save the result, call `submit_record` with kind `research`,
an exact revision/hash anchor and a fresh idempotency key. Include the question,
sources, findings, limitations and clearly labelled possibilities in the body.
This stored record is AI-origin and unverified even when it cites good sources.
Do not imply that writing, canon or a publication was changed.
