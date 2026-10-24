# October 24 writing refinements

All prose, accounts and original files here are invented synthetic fixtures.
Tests execute the actual app, Chromium, Auth emulator and Firestore Rules engine.
No production manuscript was read, seeded, rewritten or deleted.

## Executed checks

| Check | Result | Retained evidence |
|---|---|---|
| Client, engine, actual-headless Tiptap, listener ordering and archive compatibility | 47 passed; 11 emulator cases run separately | `client.log` |
| Actual Firestore Rules and Spark adapter | 11 passed | `rules.log` |
| Authenticated browser, independent device stores, offline reconnect, used laptop refresh, live new pages, genuine concurrent branches | 5 passed | `authenticated-browser.log`, `spark-browser-results.json` |
| Writing/browser, collection keyboard movement, paragraph independence, exports, accessibility and 320/390/768/1440 layouts | 17 passed | `regression-browser.log`, `browser-results.json` |
| Evaluator mutation checks | 26 passed | `checker.log` |
| Actual browser archive versus separately captured source/saved-text oracle | STRUCTURAL_EVIDENCE_VALID | `structural/report.json` |
| Typecheck and production build | Passed; bundle-size warning retained | `build.log` |

Commands: `npm test`, `npm run build`, `npm run test:rules`,
`npm run test:cloud`, `npm run test:browser`, `npm run test:evidence`.
Browser reports were retained with
`NOVELIAA_EVIDENCE_DIR=docs/evidence/phase1/refinement-2026-10-24`.
The SDK transport warnings in the offline test are expected while its context
is deliberately disconnected; the subsequent durable recovery assertions pass.

The immutable-byte corruption test uses a fresh SDK device cache after an
administrator deliberately bypasses Rules to damage a chunk. Existing verified
immutable caches are not a continuous audit of administrator mutations.

## Visual review

The parent personally inspected the actual open desktop collection menu and
390px writing/formatting renders, plus authenticated mobile writing. The
independent visual critic personally inspected desktop 1440×1000 and mobile
390×844/320×844 captures and found no visible blocker: the collection surface
matches Living Atlas, paragraph indentation is independent, and More controls
remain reachable. At 320px Redo wraps to a second row. The initial HTML-export
assertion expected no CSS whitespace; that test expectation was corrected and
the final 17-case run passes. No app failure was hidden or waived.

These are bounded refinements of the owner's accepted design. Historical visual
rounds and Spark evidence remain unchanged. The critic could not use CUA live
interaction; root's actual Playwright browser interactions and screenshots cover
those controls. Screen-reader and physical-phone keyboard/IME acceptance are
not inferred from viewport simulations.

## Integrity and operation limits

Device checkpoints still acknowledge only completed IndexedDB transactions.
The 60-second deadline starts with the oldest pending checkpoint and does not
reset forever during continued typing. Manual sync, reconnect and hiding the
page can drain sooner; a browser shutdown does not guarantee cloud completion.
Wait for Synced when switching devices. Tests retain every distinct revision.

Clean cached heads adopt confirmed descendants without conflict; unsent divergent
writing stays protected, including genuinely offline branches. Metadata streams
can arrive independently: missing dependencies are hydrated by ID, verified
known bytes are reused, and cached/optimistic events do not earn cloud receipts.
The listener harness asserts no repeated full-library GETs during hydration.
Initial metadata reads still cost reads, and preserved revisions still require
writes. This release does not claim measured production billing savings.

The source/render digest is in `manifest.json`. Configured hosted asset identity
and Actions completion must be verified separately after publication. The owner
production session, physical devices, and independent disaster backup remain
separate acceptance evidence. No later-phase AI, reader or feedback features
are introduced.
