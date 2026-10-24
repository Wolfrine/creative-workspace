# Noveliaa Phase 1 results — Spark candidate

Phase 1 implements capture, quiet rich-text writing, optional universes and
collections, stable links/backlinks, Living Atlas, local search, focus/type
controls, durable offline checkpoints, revision recovery, original provenance
and portable exports. External AI, reader editions and feedback remain deferred.

**The owner requires Spark.** The current cloud adapter uses Authentication,
Firestore and Hosting. It replaces the earlier Functions/Storage design. No
billing upgrade, new key, Functions deployment or Storage bucket is requested.
The owner reviews the actual Firebase site, **https://noveliaa.web.app**, after
the Actions release passes. **The Spark release is now live and verified**, with
24 hosted file digests matching its build. See [release and hosted evidence](DEPLOYMENT.md).

## October 24 refinement evidence

The owner requested themed desktop collection movement, optional first-line
indentation and quieter sync. The new candidate uses persistent multi-tab
Firestore cache and server-confirmed metadata listeners. Clean selected pages
advance automatically; genuine unsent branches remain recoverable. Local saves
still checkpoint after 300 ms; automatic cloud drain starts about one minute
after the first pending checkpoint. Manual sync, reconnect and tab hiding can
drain sooner. Every distinct saved revision remains in history.

Current checks: **47 client/integration tests**, **11 actual Firestore
Rules/adapter tests**, **5 authenticated browser flows**, **17 writing/browser
checks**, and **26 evaluator mutation tests**. The authenticated flows include
the previously used laptop reopening after phone edits, live new-page delivery,
and genuine parallel-edit retention. Focused cases cover listener ordering,
cached/optimistic event rejection, no recurring full-library GETs, the minute
deadline, startup/disposal races, lagging head acknowledgement and unchanged
legacy archive hashes. These results use invented fixtures, not live manuscripts.

The retained [refinement manifest](evidence/phase1/refinement-2026-10-24/manifest.json)
binds the revised source, logs and actual captures. Parent and independent critic
visually inspected desktop 1440×1000 and mobile 390×844/320×844, including the
open collection list and More controls. The final browser checks report no
overflow and passing accessibility checks. Physical keyboards/IME, screen-reader
interaction and the owner's current production session remain separate.

## Original Spark release evidence (retained)

All writing in tests and captures is **invented synthetic material** executed
through real application, browser and emulator code. No live manuscript was
imported, rewritten or seeded. The [Spark manifest](evidence/phase1/spark/manifest.json)
binds the original Spark source, test logs and actual browser captures. The old visual
candidate digest does not cover this adapter. The release verifies its own
configured production build against every hosted file.

| Check | Actual result | Evidence |
|---|---|---|
| Client/config/engine | 31 passed; emulator tests are skipped here and run separately | [Log](evidence/phase1/spark/client.log) |
| Actual Firestore Rules + Spark adapter | 11 passed: owner isolation, immutable originals/chunks/history, hash verification, idempotency, racing roots, head protection, catalog additions, multi-chunk reconstruction, corrupt-source rejection and restore ancestry | [Log](evidence/phase1/spark/rules.log), [test source](../src/cloud/spark.emulator.test.ts) |
| Authenticated browser + Auth/Firestore emulators | 3 passed: second-device writing, durable offline/reconnect and exact text export; byte-exact original/provenance/revision recovery/archive; rejected real Auth account | [Log](evidence/phase1/spark/authenticated-browser.log), [machine report](evidence/phase1/spark/browser-results.json) |
| Writing/browser regressions | 14 passed at 320/390/768/1440px, including 390×480 writing and production shell offline cache | [Log](evidence/phase1/spark/regression-browser.log) |
| Evidence checker | 26 mutation tests passed; new real-browser before/after archive checked against independent source-text oracle | [Log](evidence/phase1/spark/checker.log), [projection](evidence/phase1/spark/structural/report.json) |
| Typecheck + production build | Passed; main bundle approximately 1,280 kB / 393 kB gzip; size warning remains | [Log](evidence/phase1/spark/build.log) |

The authenticated browser test signs into the real emulator, waits for “Synced,”
opens a separate browser context, checks the same words, edits offline, closes
the tab after a device acknowledgement, reopens online, then verifies the exact
export on a second context. This is **not** an authenticated offline cold start.
The production-shell test cold reloads cached code offline at the unconfigured
gate. It confirms the development notebook path is absent from production.

Browser checks found and fixed a fresh-device blank view despite loaded pages,
an unhelpful raw permission message, and a stale optimistic-head Rules rejection
that needed a proven-race retry. Original files, intervening revisions and losing
branches remain recoverable; imported assistant statements stay unverified.

## Visual verification

Actual authenticated desktop **1440×1000** and mobile **390×844** writing were
rendered and visually inspected. Denied-account gates were inspected at desktop
and **320×640**. Hierarchy, prose width, controls and status labels remain readable
with no horizontal overflow or clipping. Authenticated desktop/mobile axe scans
reported zero violations. [Desktop](evidence/phase1/spark/desktop-writing.png),
[mobile](evidence/phase1/spark/mobile-writing.png),
[mobile access explanation](evidence/phase1/spark/mobile-denied.png).

The actual hosted sign-in screen was then visually checked at 1440×1000,
390×844 and 320×640. Desktop/mobile axe scans reported zero violations, the public
shell cold-reloaded offline, Firebase project/App ID matched and an unsigned
Firestore read returned 403. [Hosted evidence](evidence/phase1/spark-hosted/visual-check.json).
This establishes the hosted public entry point, not the owner's authenticated
production writing session.

The six original visual rounds, final critic 8.2 / lead 8.3, process-crash recovery
20/20, and writing-performance profile remain historical evidence under
`evidence/phase1`. The unchanged editor still has that design history; those
scores and timings were not remeasured for Spark. Earlier callable, Storage and
backup test results describe an unshipped architecture, not the current backend.

## Remaining acceptance

G1 remains open for the author's real writing/recovery session and physical
Android/iPhone keyboard, Hindi IME, rotation and background behavior. Production
Google sign-in/sync, authenticated offline cold start, auth expiry, pending-work
account switching, Safari/Firefox, manual screen-reader and 400% zoom checks are
not inferred from Chromium emulator results. G2–G4 remain deferred.

Spark has finite storage/read/write quotas. Failure retains local writing and its
outbox; it never earns a false cloud receipt. Cloud load currently reads the full
library/history. Per-import, blob and archive limits are explicit in
[architecture](ARCHITECTURE.md). Large libraries need pagination and a larger
archive format before complete-history portability beyond the current limit.

Device checkpoints, immutable cloud history and downloadable archives are current
recovery. Scheduled independent backups, protected retention, PITR and a verified
24-hour disaster RPO are not shipped. No bucket lock, billing/IAM change or
production login bypass was performed. Initial console Google-provider setup
and the actual hosted Actions result are tracked in [deployment](DEPLOYMENT.md).
