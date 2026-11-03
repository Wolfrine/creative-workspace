# Heartbeat backend handoff — 2026-11-03

Ownership: one backend child under the existing native Noveliaa parent. No child
delegation, commit, deploy, credential access or production manuscript access.
Only functions source/test files and this ignored F-drive evidence directory were
changed by this lane. Parent owns frontend, Rules proof, docs/plugin and delivery.

## Changed source/tests

- `functions/src/integration-heartbeat.mjs`: strict schema, verified source/span
  validation, append-only annotation+receipt transaction, server-scoped read.
- `functions/src/integration-tools.mjs`: seventh `submit_heartbeat` tool; original
  six tool names/contracts preserved; fresh grant permissions checked by wrapper.
- `functions/src/integration-http.mjs`: authenticated GET route and bounded error
  statuses (400/403/409/413).
- `functions/test/heartbeat.test.mjs`: five strict validation unit tests.
- `functions/test/mcp-integration.test.mjs`: current actual OAuth/MCP emulator
  harness expanded; existing integration command includes the heartbeat tests.

## Wire contract

MCP `submit_heartbeat`:

```json
{
  "documentId": "scene", "revisionId": "revision", "contentHash": "64 lowercase SHA-256 hex",
  "idempotencyKey": "16-120 letters-digits-underscore-hyphen",
  "provider": "Self-reported provider (1-80 chars)",
  "model": "Self-reported model (1-120 chars)",
  "contextNote": "Nonblank context (1-1200 chars)",
  "beats": [{
    "start": 0, "end": 5, "quote": "Exact",
    "foreground": "Quiet tension", "undertone": "Resolve",
    "weight": 3, "trajectory": "hold", "tone": "cool",
    "reasoning": "Nonblank interpretation rationale (1-1200 chars)"
  }]
}
```

`beats` may be empty, max80. Quote max2000 chars, nonblank. Start/end integer
UTF-16 offsets in exact `fetch_page` plainText, sorted/nonoverlapping, exact quote
match, never split a surrogate pair. Foreground and optional undertone contain
1-3 words/max48 chars. Weight1-5. Trajectory build/hold/shift/release/quiet. Tone
warm/cool/tense/tender/somber/wonder/neutral. Serialized UTF-8 input max96KiB.
Unknown fields rejected at root and beat level, including through actual MCP.

Receipt: `{id,schema:'noveliaa-heartbeat-1',verification:'unverified',
sourceIsCurrent:true,createdAt,replayed:boolean}`. Exact retry returns the same
receipt/time/id with replayed true; changed reuse conflicts. Stale retries fail.

GET `/api/integrations/heartbeat?documentId=...&revisionId=...&contentHash=...`
uses signed-in Firebase bearer identity and no-store. Returns
`{schema:'noveliaa-heartbeat-1',annotations:[],sourceIsCurrent:boolean}` with
annotations length0-1. The most recent permitted annotation contains
`{id,schema,documentId,anchor:{documentId,revisionId,contentHash,title},
attribution:{provider,model},contextNote,beats,origin:'ai',verification:'unverified',
inference:'AI interpretation; not measured emotion or author intent.',clientName,
createdAt}`. Server-only grantId/universeId are omitted. Current source hash must
also match the local complete Document snapshot hash before UI rendering; local
dirty state and a frozen reader edition are frontend acceptance concerns.

Annotation path:
`noveliaaWorkspaces/{workspace}/heartbeatAnnotations/{document}/revisions/{revision}/entries/{id}`.
Global idempotency receipt path:
`noveliaaWorkspaces/{workspace}/heartbeatReceipts/{digest(grantId:key)}`.
Existing client Rules default-deny both paths. No new composite index required.

## Verification

- `node --test functions/test/heartbeat.test.mjs`: 5/5 PASS.
- `npm --prefix functions test`: 34 PASS, 0 FAIL, 1 SKIP (the actual emulator
  harness is skipped outside emulators), process exit0. See functions-test.log.
- Existing Firebase auth+Firestore emulators + `npm --prefix functions run
  test:integration`: 17 PASS, 0 FAIL, 0 SKIP, test script exit0. See
  emulator-integration.log. Outer Windows PowerShell invocation reported exit1
  after CLI native stderr output during emulator update; retained CLI output
  explicitly records successful script exit0 and orderly emulator shutdown.
- Syntax checks of all five modified/new JS modules: PASS.
- `git diff --check -- functions/src functions/test`: PASS.
- Independent critic reported 20 synthetic validator attack cases PASS and no
  source-level security blocker; parent owns synthesized critic evidence.

Actual HTTP/emulator checks cover original six plus new seventh discovery,
anonymous/wrong-owner denial, strict unknown-field rejection, exact anchor/quote,
cross-universe and trashed writes, read-only grant denial, live read grant
revocation/narrowing/proposal-scope/expiry/owner/reset filtering, stale hash hiding,
source corruption, revocation/scope/reset/head changes after source preflight,
concurrent identical retries, concurrent conflicting retries, quiet empty beats,
stale-head retry rejection, source collections unchanged, and existing proposal
storage/review/export unchanged. All writing was synthetic demo-project material.

## Remaining limits

- Read scans the newest50 annotations for the exact revision and returns the
  newest still permitted one. Older valid entries can be omitted when50 newer
  entries have invalid grants. Append-only records remain stored.
- This lane did not exercise deployed signed-in UI, real client inference,
  production manuscripts or owner acceptance. Parent owns browser desktop/mobile
  QA, direct-Firestore deny proof, delivery checks and hosted acceptance.
- Provider/model are client assertions, never independently verified identity.
