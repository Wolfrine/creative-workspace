---
name: collaborate-on-writing
description: Use when the author asks for story critique, emotional heartbeat, alternative wording, a discussion record or an AI proposal saved back into Noveliaa. Keep interpretations and proposals separate from original writing with exact provenance.
---

# Collaborate without taking ownership

Retrieve the actual scene with `fetch_page` before critiquing or proposing
changes. Use its documentId, revisionId and contentHash as the anchor. For an
unfinished or ambiguous scene, identify the intended effect with the author;
do not confidently impose plot structure or fill missing meaning.

Keep exact quotations distinguishable from proposed text. A proposal should
explain the concrete issue, intended effect and tradeoff while preserving voice.
Do not rewrite an entire scene when a small question or local alternative helps.
Never turn remembered wording, an assistant's reconstruction or an imported
conversation into verified author material.

When the author asks to save a discussion, research result, critique or proposal:

1. Check `list_universes` for `allowProposals`. If false, explain that the author
   can reconnect and permit proposals; do not bypass the grant or ask for tokens.
2. Prepare a short descriptive title and a self-contained body. Include the
   request, exact source reference, relevant uncertainty, and proposed content.
   If recording a conversation, copy only messages actually visible; mark any
   omissions. Role attribution supplied by an agent remains unverified.
3. Call `submit_record` with the matching kind, exact anchor and a new random
   idempotencyKey of 16–120 letters/digits/underscores/hyphens. Reuse it only for
   an identical retry after a network failure. Never retry changed content with
   the old key or duplicate a successful record.
4. Check the receipt. If `sourceIsCurrent` is false, explain that the source has
   advanced and the record is anchored to an earlier revision. Do not update the
   anchor without rereading and reassessing the proposal.
5. Link the returned reviewUrl. Say that a separate unverified record was saved.
   Original writing is untouched. Review/dismiss happens in Noveliaa; reviewed
   is not approved canon. Applying text is an explicit manual author action.

## Emotional Heartbeat

When the author asks to save an emotional interpretation, use `submit_heartbeat`
instead of putting structured annotations inside a discussion record. First
check `allowProposals` and fetch the current exact revision. Read the available
preceding and following narrative context, following `nextOffset` where needed;
record any missing context in `contextNote`. Do not claim access to unread pages.

Choose meaningful emotional beats, including connected paragraphs where useful.
Do not tag every sentence or optimize toward stronger feeling. Quiet, uncertain
and mixed passages are valid. Leave unneeded spans untagged; `beats: []` is a
valid quiet interpretation. Use crisp one-to-three-word `foreground` and optional
`undertone` labels. `weight` (1–5) describes perceived emotional weight, not model
confidence. `trajectory` is `build`, `hold`, `shift`, `release` or `quiet`;
`tone` is `warm`, `cool`, `tense`, `tender`, `somber`, `wonder` or `neutral`.
Give each beat a concise `reasoning` explanation; the UI reveals it on demand.

Spans use zero-based UTF-16 `start` (inclusive) and `end` (exclusive) offsets in
the exact full `fetch_page` plain text. Include the matching exact `quote`.
Preserve whitespace and Unicode; never split a surrogate pair. Order spans and
avoid overlaps (use an undertone for mixed emotion). Each quote is at most 2000
UTF-16 units, each explanation 1200, and there are at most 80 beats. Keep the
serialized input under 96 KiB. Include honest self-reported `provider`, `model`
and `contextNote`; never invent a model identity.

Submit the exact `documentId`, `revisionId`, `contentHash`, analysis fields and a
new random `idempotencyKey` as described above. Identical network retries reuse
the key; changed content requires a new key. If writing changed, reread and
reassess before submitting a new analysis. A receipt confirms a separate
AI-origin, unverified interpretation, never a manuscript edit. Old or revoked
interpretations are hidden; no quote-based automatic reattachment is allowed.
The author enables Heartbeat in writing or private Read. AI perception is not
author intent and does not measure actual readers' emotions.

No MCP tool can approve canon, overwrite a page, delete evidence, publish,
reset a workspace or expose another universe. Do not invent such capabilities.
If submission fails, preserve the proposed content in chat and report the error
without claiming it was saved. Never request Firebase credentials or API keys.
