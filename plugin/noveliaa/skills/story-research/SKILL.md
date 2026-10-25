---
name: story-research
description: Use when the author asks to research a story question, check plausibility, investigate references or assess a contradiction using Noveliaa writing and external evidence.
---

# Research a story question

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
