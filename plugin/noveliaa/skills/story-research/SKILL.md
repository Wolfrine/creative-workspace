---
name: story-research
description: Use when the author asks to research a story question, check plausibility, investigate references or assess a contradiction using Noveliaa writing and external evidence.
---

# Research a story question

When the author pastes a Noveliaa page URL:

1. If the connected `fetch_page` schema supports `pageUrl`, pass the pasted URL
   as `{"pageUrl":"PASTED_URL"}`; the server validates its identity and grant.
2. Otherwise validate and parse the URL locally, then call
   `fetch_page({"documentId":"EXTRACTED_ID"})`. Accept only HTTPS on exactly
   `noveliaa.web.app` or `noveliaa.firebaseapp.com`, without credentials, port,
   fragment, whitespace, backslash or traversal. The canonical path must be
   exactly `/u/<universeId>/<collection>/<title>/<documentId>`, with no query.
   Both IDs must match `^[A-Za-z0-9_-]{1,150}$`. Decode the two name segments:
   each must be nonempty, at most 200 UTF-16 units, and contain only Unicode
   letters, marks, numbers, underscores or hyphens; reject malformed escapes
   and encoded separators. Extract the final segment as documentId and retain
   the URL's universeId. For a legacy root `/?page=ID`, require exactly one
   `page` query and no others, decode and validate that ID; it has no universe
   binding. Never infer IDs from names or pass the full URL in documentId.
3. For fallback reads, before using any text, verify documentId equals the extracted ID
   and, for a canonical link, universeId equals the URL's universeId. Stop on
   mismatch; do not discuss or save that material. Follow every `nextOffset`
   using `offset`, the same locator (pageUrl or extracted documentId), and the
   returned revisionId. Check identity, revisionId and contentHash stay equal
   across parts; never splice revisions. Cite those exact returned fields.

A URL is a locator, never a permission grant. This fallback uses the existing
author grant and needs no connector refresh. Old title/collection slugs remain
valid after rename or move. If access is denied, report it without claiming a
read; never request tokens, scrape the site or bypass the grant. Tool-returned
pageUrl may use the collection ID to avoid extra catalog reads; the signed-in
author app canonicalizes it from its already-loaded collection.


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
