---
name: collaborate-on-writing
description: Use when the author asks for story critique, alternative wording, a discussion record or an AI proposal saved back into Noveliaa. Keep proposals separate from original writing with exact provenance.
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

No MCP tool can approve canon, overwrite a page, delete evidence, publish,
reset a workspace or expose another universe. Do not invent such capabilities.
If submission fails, preserve the proposed content in chat and report the error
without claiming it was saved. Never request Firebase credentials or API keys.
