# Noveliaa Phase 1 results — Spark candidate

Phase 1 implements capture, quiet rich-text writing, optional universes and
collections, stable links/backlinks, Living Atlas, local search, focus/type
controls, durable offline checkpoints, revision recovery, original provenance
and portable exports. External AI, reader editions and feedback remain deferred.

**The owner requires Spark.** The current cloud adapter uses Authentication,
Firestore and Hosting. It replaces the earlier Functions/Storage design. No
billing upgrade, new key, Functions deployment or Storage bucket is requested.
The owner reviews the actual Firebase site, **https://noveliaa.web.app**, after
the Actions release passes. See [current deployment status](DEPLOYMENT.md).

## Current executed evidence

All writing in tests and captures is **invented synthetic material** executed
through real application, browser and emulator code. No live manuscript was
imported, rewritten or seeded. The [Spark manifest](evidence/phase1/spark/manifest.json)
binds the current source, test logs and actual browser captures. The old visual
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
