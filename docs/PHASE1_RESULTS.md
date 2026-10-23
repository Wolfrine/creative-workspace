# Noveliaa Phase 1 results

**Implemented for author review; not deployed or release accepted.** The owner
approved Phase 1 on 23 October 2026. Living Atlas supplies optional context and
explicit links; Quiet Folio supplies focused writing. Story Workbench's broader
review workflows, external AI, reader editions and feedback remain deferred.

The implementation provides untitled capture, rich-text writing, optional
collections/universes, stable links/backlinks, local search, focus/type controls,
durable checkpoints/outbox, branch-preserving cloud commits, revision comparison
and recovery, provenance, exact-original downloads and portable exports. See
[architecture and limits](ARCHITECTURE.md) and [development commands](../README.md).

All automated material is **invented synthetic writing** executed through actual
app/browser/emulator code. No author manuscript was imported or transformed.
Firebase production identity, project mapping and deployed behavior are not
inferred from local tests.

## Candidate and retained evidence

Source candidate: `5d0035a034a94c8525316cd5cb47d047208b3d861539d4acadb243a2bb734bf6`.
[Final manifest](evidence/phase1/round-6/manifest.json) identifies 32 runtime/config
source files, the fixture script, Chromium version, 18 unframed renders and their
SHA-256 values. [Candidate index](evidence/phase1/candidate.json) binds the 24
production build files, tests/scripts and retained evidence. Run
`node scripts/verify-candidate.mjs` after building to detect changed sources or
renders. Hash verification checks identity, not experience or literary quality.

| Verification | Actual result | Evidence |
|---|---|---|
| Client/config/engine tests | 31 passed, including 13 engine-to-trusted-service integrations; fake-indexeddb transaction tests are labeled | [Client log](evidence/phase1/client-tests.log) |
| Trusted service/backup unit tests | 15 passed | [Backend log](evidence/phase1/backend-unit.log) |
| Real Firebase emulators | 12 passed: 9 Rules/Admin-path checks and 3 authenticated HTTP callable checks | [Emulator log](evidence/phase1/backend-emulators.log) |
| Browser flows | 14 passed in Chromium 156.0.8078.4; 320/390/768/1440px and short 390×480 writing | [Browser log](evidence/phase1/browser-tests.log), [machine report](evidence/phase1/browser-results.json) |
| Forced browser-process crashes | 20/20 randomized post-acknowledgement interruptions recovered every earlier checkpoint; offline at crash, developer shell reopened online | [Crash report](evidence/phase1/crash-recovery.json) |
| Evidence checker | 26 mutation tests passed; actual browser archive projection validated against a separate input oracle | [Checker log](evidence/phase1/checker-tests.log), [projection result](evidence/phase1/structural/report.json) |
| Typecheck/production build | Passed; Vite reports an 847 kB main chunk (263 kB gzip) | [Build log](evidence/phase1/build.log) |
| Synthetic disaster restore | 3 revisions, 1 original, 1 retained conflict; verified restore 4.670 s, 6,610-byte archive | [Emulator log](evidence/phase1/backend-emulators.log) |

The final production-shell test cold reloads offline with cached code/styles/fonts
and verifies that development notebook access is absent from the production
build. It exercises the unconfigured access gate, **not an authenticated author's
offline cold start**. The archive browser test imports declared conversation
material through the UI, downloads the exact original, checks assistant turns
remain unverified, edits the derivative and validates saved-text oracles.

Important failures found and repaired: stale cloud refresh overwriting a new
checkpoint; tab conflicts disappearing after restart; late original imports
missing from sync; archive replay ordering and mutual links; archive restoration
racing another tab or subsequent author edits; refresh losing fresh original
references; unsupported formatting/metadata entering the editor. Separate
persistent test stores now exercise both offline reconnect orders, retaining both
branches and a visible conflict. These are logical devices, not physical phones.

## Writing performance and visual review

On Windows/AMD Ryzen 5 2600, 12 logical CPUs, 32 GiB RAM, unthrottled loopback,
the 400-document/two-universe/100,000-word development fixture includes 20,000-word
scenes. Ten warm-library navigations were editable within 3 s. The
beforeinput-to-second-animation-frame proxy p95 improved from **114.6 ms to
56.6 ms** after memoizing shelf rendering and bounded snippets; device checkpoint
p95 was **371.4 ms**. [Raw final profile](evidence/phase1/performance.json) and
[retained baseline](evidence/phase1/performance-baseline-single-paragraph.json)
describe the workload. This is not field INP, a production cold-load benchmark,
a five-minute sync run, or the proposed 4-core/8-GiB/physical-phone A24 profile.

Six substantive design/refinement rounds retained real renders and independent
critique. The final critic scored **8.2/10** overall, every critical dimension
at least 8; the lead independently scored **8.3/10**, every dimension at least 8.
History is contained and readable at 320px; short writing retains its lower active
line with an actually painted, pointer-accessible formatting popup. Desktop/mobile
axe scans have zero reported violations. See the [design record](design/PHASE1_REVIEW.md).
These establish a reviewed candidate, not owner acceptance or screen-reader/IME
acceptance. A scanner did not determine aesthetic scores.

## Acceptance gaps and decisions

**G1 remains open.** Executed subsets cover A01–A11/A22–A24, with owner-only
security/account-isolation controls also tested. Complete original procedures are
not blanket passes. Remaining checks include authenticated production/offline
cold bootstrap and sign-out/account switching with pending writing, real auth
expiry, denied persistence, the full golden search/index matrix, Firefox/Safari,
400% browser zoom, manual screen-reader work, physical Android/iPhone keyboard,
Hindi IME/rotation/background behavior, and H01–H04/H07 author sessions. The
production backup schedule, ≤24-hour RPO, IAM/retention and production restore
have not been established. G2–G4 are deferred and have no fabricated records.

The next owner review is a real writing/recovery session using the local preview.
Before deployment, verify and approve the Firebase project/site/bucket, author
UID/allowlists and region; review any required billing, IAM and separate backup
bucket/retention changes. Shared-project Rules require separate integration
review. The metadata-only workflow is prepared but has not been dispatched.
No secret was opened, no production bypass added, and no production deployment
or irreversible bucket lock performed. The initial archive/import size limits
are explicit; a larger archive format is required before moving a notebook whose
full history exceeds 64 MiB.
