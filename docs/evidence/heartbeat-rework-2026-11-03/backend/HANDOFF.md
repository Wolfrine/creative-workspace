# Heartbeat continuity backend/client handoff

Scope: one native child, no descendants. Owned only the seven agreed server,
client-model/hook and test files. No commits, deployment, authentication-file
access or production manuscript access. All fixtures below are synthetic.

## Contract

`coverage.contract = noveliaa-heartbeat-continuity-1` contains:

- `status`: `continuous`, `sparse`, `empty`, or `invalid`.
- `sourceCharacters`: complete source length in UTF-16 units.
- `meaningfulCharacters`: source UTF-16 units matching JavaScript `\S`.
- `coveredMeaningfulCharacters` and `uncoveredMeaningfulCharacters`.

Continuous means every meaningful source unit appears inside a valid, exact,
ordered, nonoverlapping supplied beat span. No meaningful gaps are filled or
assigned a feeling. Whitespace gaps are exempt from the coverage count and are
not extended into adjacent regions. A nonempty source with no beats is sparse,
including whitespace-only source. Only zero-length source is empty. Malformed
beat fields/ranges/quotes are invalid and contribute no asserted coverage.
Coverage checks structural source coverage, never emotional accuracy.

New annotations and new receipts carry computed coverage. Reads recompute it
from WritingAccess's already-loaded, hash-verified source bytes, so historical
records need no migration or mutation. The client independently recomputes it
from the exact local source and ignores supplied coverage claims. Existing
receipts replay their original response without adding coverage or modifying
stored content. Input schema, fingerprint, grant/replay/hash checks and all
seven MCP tool names remain compatible with the installed tool schema.

Client API in `src/heartbeat/model.ts`:

- `heartbeatCoverage(text, beats)` returns `HeartbeatCoverage`.
- `heartbeatRegions(text, beats)` returns `HeartbeatRegion[]`, only for
  continuous coverage. Each region has `start/end`, `foreground/undertone`,
  `tone/weight/trajectory`, and original `beatIndexes`.
- Adjacent exact ranges merge only when the full feeling tuple is equal.
  Original beats and their reasoning remain unmodified. This merges legitimate
  2000-unit quote splits without creating extra emotional transitions.
- `isHeartbeatRest(beat)` is true only for explicit tone `neutral` plus
  trajectory `quiet`. Missing annotations are never rest.
- `useHeartbeat` adds optional `coverage` and `regions` to existing state.
  Sparse valid records retain `status: ready` and their annotation as evidence,
  with no regions. UI must gate colors on `coverage.status === continuous`.

No Firestore queries, polling, listeners, refresh triggers or source writes
were added. This is inspected source behavior, not a measured billing claim.
The existing 80-beat/2000-unit-quote/96-KiB limits remain; requests beyond those
limits must not claim complete coverage. `submit_heartbeat` instructions now
require natural whole-passage regions, held feeling through factual text,
explicit rest and no mechanical sentence tagging.

## Verification

PASS: backend heartbeat unit tests, 8/8 (`backend-unit-tests.txt`). Includes
whitespace exemption, punctuation/astral coverage, sparse/empty distinction,
held factual sections, explicit neutral rest, legitimate long-hold quote
splits, malformed payloads, unknown fields and existing input limits.

PASS: frontend model tests, 9/9 (`frontend-tests.txt`). Includes the same
coverage principles, forged metadata ignored, exact region merging and no
input mutation, combining characters, array holes, malformed payloads and
existing immutable snapshot/source anchors.

PASS: Functions suite, 37 passed / 1 emulator case skipped in its ordinary
non-emulator run (`functions-tests.txt`). The emulator case was run separately
and passed in full as described next.

PASS: actual Auth + Firestore emulator MCP/OAuth HTTP integration, 18/18,
zero skipped (`emulator-tests.txt`). New assertions cover unchanged MCP input
field schema, new stored/read/receipt coverage, explicit full neutral rest,
legacy receipt replay without mutation and sparse empty beats. Existing
revocation/reset/scope/race/stale/unknown-field/corrupt-byte and no-source-write
checks remain and pass.

PASS: `tsc -b` (`typecheck.txt`) and `git diff --check`.

Integration startup attempt 1 timed out before Firestore started
(`emulator-attempt-1.txt`). Warm attempt 2 hit the shared host's occupied
logging port 4500 and therefore Auth connection refused
(`emulator-attempt-2.txt`); neither is counted as passing evidence. Stopped only
the verified own orphan Firestore process. Successful attempt used local-only
`firebase.emulator-test.json`: Auth 19099, Firestore 18080, websocket 19150,
hub 14400, logging 14450. CLI cleanly shut down its own emulators afterward.

## Remaining acceptance

Parent/UI lane owns visual acceptance, generation prompt/example changes,
independent blind reading and main/pipeline delivery. No claim here establishes
emotion fidelity, author acceptance, signed-in production behavior or live
deployment. No other source files were edited by this lane.
