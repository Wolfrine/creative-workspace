# Emotional Heartbeat security review

Status: source-level security gate PASS; independent validator checks PASS; retained HTTP/emulator evidence inspected. Parent direct-Firestore/QA/delivery gates remain separate.

Scope is read-only source inspection and synthetic local checks. This critic writes only `.local/heartbeat/critic`. No production data, credentials, deployment or source edits.

Baseline `cfea728a56921a89786644b8a4af6a900be1124c` already supplies important boundaries:

- `functions/src/integration-writing.mjs:9-39`: chunk bytes, source digest, revision/document/universe identity and current trashed state are verified before exposing writing.
- `functions/src/integration-writing.mjs:78-99`: collaboration append has a separate immutable record, source hash, owner/reset/current grant checks and idempotent fingerprint; its head read does not itself decode a newly changed revision.
- `functions/src/integration-tools.mjs`: OAuth READ/PROPOSE and optional proposal permission apply to write tools; each invocation obtains the current grant.
- `functions/src/integration-http.mjs`: signed-in author checks protect author APIs; no-store/private, same-origin JSON writes, no token/body logging.
- `firestore.rules`: client read list excludes annotations; all unmatched paths deny read/write; source records are create-only and deletion is denied.

## Attack cases required for the new layer

1. Bind server-derived workspace, universe, document, immutable revision/hash; reject forged hash, cross-document revision, out-of-scope or trashed writing. Recheck current head and grant/reset configuration at append commit, including races after preflight.
2. Require READ and PROPOSE plus optional proposal permission in the live grant; reject revoked, expired, narrowed and reset grants. No browser direct annotation writes.
3. Validate ordered, nonoverlapping integer UTF-16 spans against exact source text. Reject negative/reversed/out-of-bounds/fractional indices, mismatched quotes and surrogate-pair splits; retain multilingual/emoji/CRLF text exactly.
4. Strictly validate 1-3 word labels, weight 1-5, trajectory enum, bounded payload and reasoning/context. Server sets origin/verification; reject forged approval/canon/workspace/source fields.
5. Identical retry returns one immutable entry/receipt; changed payload reusing a key conflicts even across documents/revisions. Concurrent retries must not duplicate.
6. Source changes fail closed for display; no old annotation maps onto new text. Read mode's frozen source must be matched exactly. Loading, abort/navigation and failure must clear earlier annotations.
7. Author read endpoint requires current Firebase identity and owner workspace, no-store; source integrity/trash/grant must be revalidated before returning annotations.
8. Labels, context and reasoning are plain escaped text. No raw HTML, embedded chat, source transformation, publication, real emotion/reader-response assertions or canon approval.
9. Verify annotations/toggles/reader navigation create no manuscript, head, original, revision, operation or history mutations and do not change 10s/60s idle saves.

Checklist sent to parent and backend worker before final implementation review. This is an acceptance plan, not proof that cases have passed.

## Current implementation inspected

`functions/src/integration-heartbeat.mjs` implements strict top-level and beat schemas, 96KiB serialized limit, 80-beat maximum, exact ordered UTF-16 quote checks including both surrogate boundaries, and required context/provider/model. Server-derived annotations carry AI/unverified attribution and no approval operation.

Submission verifies source bytes via `WritingAccess.page`, requires the current revision/hash, and within the append transaction rechecks owner/workspace, active grant uid/client/scopes/optional proposal permission/expiry/universe, current head and immutable revision hash. Only `heartbeatAnnotations/{document}/revisions/{revision}/entries/{id}` and `heartbeatReceipts/{id}` are written with `tx.create`. The receipt id binds the grant and idempotency key across documents/revisions; conflicting fingerprint rejects. Historical records remain stored; stale retries are deliberately rejected.

Read preflight verifies immutable bytes and current non-trashed source, then the transaction rechecks owner/reset, source metadata/head/hash, universe and the current grant of candidate annotations. Revoked/narrowed/expired or no-proposal grants cannot supply visible annotations. Only the newest permitted entry among the newest50 is returned. The HTTP route sits behind existing current Firebase identity/owner middleware and no-store/private headers; no browser write route was added. Existing deny-all client Rules exclude both annotation and receipt paths. The seventh MCP tool uses the strict Zod object itself, preserving rejection of unknown approval/source fields rather than stripping them before handler validation.

Frontend `src/heartbeat/useHeartbeat.ts` hashes the complete exact snapshot and immediately withholds earlier annotation state when its snapshot key changes; it aborts stale requests and never requests data when off. `src/heartbeat/model.ts` validates exact revision/hash/quote/range again. `decorations.ts` uses native CSS Highlight ranges without creating ProseMirror marks or manuscript DOM mutations. Heartbeat text is rendered through React text nodes, not raw HTML. No embedded chat, measured-response or approval/publication control found.

## Verification actually performed or inspected

- Independently executed `.local/heartbeat/critic/validate-attacks.mjs`:20/20 PASS; retained machine-readable `validate-attacks.json`. Includes UTF-16 whole/split emoji, exact CRLF/combining text, quiet beats, forged source/approval/nested fields, bounds, overlaps and invalid labels/enums/weights.
- Independently opened current browser1440x1000 and390x844 with synthetic local notebook and mocked heartbeat HTTP only. `browser-review.json`:0 requests while off; exact documents/revisions/originals unchanged across toggles and Read navigation; stale response clears all native highlights; no horizontal page overflow. This does not prove authenticated HTTP or Firestore Rules.
- Inspected `.local/heartbeat/backend/emulator-integration.log` and actual test source:17 PASS,0 FAIL,0 SKIP; CLI reports script exit0. Cases cover actual OAuth/MCP transport, read/write grant denial and narrowing, source/hash/quotes, source corruption, trash, reset/revocation/scope/head races, concurrent identical/conflicting retries, quiet annotation and no source collection changes. Backend reported outer Windows shell exit1 after native emulator stderr, while retained script result is0; these are distinguished.
- Parent owns direct client-Rules denial proof and full browser regression/QA. No production manuscript was seeded/read/modified; no deployed signed-in inference, owner intent comparison or physical phone/IME acceptance was performed by this critic.

## Findings and limits

No unresolved security blocker found in the reviewed source. The read bound is a product limit: if50 newer entries have inactive grants, an older permitted entry may be omitted. Backend handoff now states this. Provider/model attribution is explicitly self-reported. Native CSS highlights may be absent in older browser engines; the text strip remains the fallback, and physical-device acceptance remains open. Visual blockers are tracked independently in `review.md`; a security PASS does not grant visual or owner acceptance.
