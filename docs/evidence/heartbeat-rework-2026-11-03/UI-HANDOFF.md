# UI lane handoff — source frozen after round 7 regression repair

Existing native parent with one UI implementation lane; no child agents spawned by this lane. No commit, push, deployment, authentication or admin operation performed. All new scripts, evidence and scratch stayed under the owning F-drive repository.

## Result

Retains cream paper, sage controls, serif prose, facing-page choice, selectable source, bookmarks, contents, appearance and keyboard/page-turn behavior. Replaces repeated large title/front matter and per-beat footer with compact source opening and a low-chrome key. The key uses exact returned foreground labels, deduplicated within only the visible page/spread. Undertone, trajectory, weight, reasoning, provider/model and revision provenance require explicit selection. Narrow phones show one current label plus an explicit additional-feelings dialog when needed.

Only validated continuous analysis paints the field; no inferred gap filling. Sparse legacy data hides all colors and asks for full regeneration. Explicit analyzed neutral/rest is visibly gray and named by the returned label. Day/night colors are distinct, with symbols and accessible labels beyond color. Unsupported native Highlight rendering explicitly says “Feeling key / Colors unavailable” and preserves exact labeled access.

Page geometry remains constant while turning pages within the field mode. Off/on and appearance changes can repaginate while retaining the exact stored passage anchor. Writer keys follow visible prose through a scoped, passive, RAF-batched local DOM scroll listener; no network request or Firestore listener is added.

## Files owned and changed

- `src/components/Reader.tsx`: compact opening and margins, current-page legend, stable field-footer geometry, retained anchor behavior.
- `src/library-reader.css`: compact book/header/footer and responsive typography.
- `src/components/Writer.tsx`: below-passage sticky key, visible-passage calculation and listener/RAF cleanup.
- `src/heartbeat/Heartbeat.tsx`: exact feeling key, explicit details, sparse/fallback messages.
- `src/heartbeat/heartbeat.css`: semantic paper/night tint families, neutral field, readable keys/details, narrow toolbar fit.
- `src/heartbeat/decorations.ts`: continuous-only native ranges, merged explicit regions, bounded inert projection range copy/cleanup.
- **New** `src/heartbeat/presentation.ts`: semantic symbols and exact-label key grouping.
- `src/reader/page-turn.ts`: create projection ranges after PageFlip DOM moves and include the portrait temporary clone.
- `src/App.tsx` (narrow parent-approved extension): existing title ResizeObserver schedules height writes in RAF and cancels on cleanup; no global error suppression.
- `tests/browser/heartbeat-visual.spec.ts`: revised full-coverage fixtures/display assertions while preserving off/stale/source/integrity/accessibility checks.
- **New** `tests/browser/heartbeat-layout.spec.ts`: exact source traversal, field contrast, density, complete native mapping, all projection registration and motion cleanup.

All 11 owned source/test files were normalized to UTF-8 without BOM and LF before the current `round-7-sources.json` hashes. `src/styles.css`, model/state/backend, Functions, docs/plugin and source manuscripts were not edited by this lane.

## Evidence and comparison

Central 0.2.3, base `d097786cf3d6c5a2859439112afdd39538316567`; required project/context and redesign/emotional-direction/designer/render-and-QA references read. Control UI revision `73b8455337f0c4223fa8973fe072755bd622f23c`. Matched four-paragraph synthetic counterpart is in the parent-owned `tests/helpers/heartbeat-continuity-fixture.ts`. No original manuscript text was read or copied by this UI lane.

Baseline and three rendered structural alternatives were captured before source UI edits. Compact spread was selected conditionally by parent and independent critic; flowing folio and margin current retained separately. Same 20px/1.85 text at all viewports in the final structural comparison. First uncalibrated Saltwater study remains labeled supplemental. Prior mood-image asset unavailable; emotional hypothesis remains unverified. Actual existing Google Play/Kindle/PageFlip reference images were inspected; no photo direction adopted.

| CSS viewport | Baseline first prose lines | Final first prose lines | Baseline prose rectangle area | Final prose rectangle area | Final book / stage height |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1366×768 | 20 | 28 | 27.7% | 39.1% | 625 / 583 px |
| 390×844 | 10 | 15 | 27.1% | 42.4% | 701 / 671 px |
| 320×568 | 4 | 8 | 16.8% | 32.8% | 425 / 398 px |

Line and area measurements exclude title/provenance and use visible source text-node Range rectangles; area is an approximation of ink-line bounding area, not human attention or comfort. DPR 1, zoom 1. Additional 1366×590 usable-height diagnostic: book 447px, stage 405px, 18 prose lines, 33.0% text-rectangle area; no simulated browser toolbar is included in the primary CSS viewport metrics.

An intentional 20px/1.75 density comparison gave 29/16/8 lines, but the independent critic found the gain modest and the colored lines busier. Retained 1.85 and all existing stored appearance preferences.

Artifacts: `baseline/`, `alternatives/`, `density-study/`, `usable-height/`, `round-2-sources.json` through `round-6-sources.json`; independent actual-browser renders in `critic/round2`, `round3`, `round3-details`, `round4-details`, `round4-semantics`, `round5`, `round5-motion`, `round6`, `round6-motion`, `round6-fallback`, `round6-slide`.

## Meaningful defects found and repaired

1. Narrow Writer toolbar wrapped Heartbeat into a separate row; now fits one row and key follows visible text.
2. Undefined `--sans` caused large inherited undertone/swatch fonts; explicit font family fixes it and reasoning appears before the long source quote.
3. Variable legend height during a page turn repaginated backward and repeated source characters. Fixed compact row geometry; exact traversal now sees every meaningful source character once.
4. Creating native clone ranges before PageFlip reparenting collapsed them. Registered after final moves.
5. PageFlip portrait turning creates another temporary clone. Actual phone curl still showed plain moving prose despite the first DOM oracle passing. Added registration for that temporary clone and a timed all-projections oracle. Final actual phone moving face is colored.
6. Reader invalidation/off clears transient motion ranges. Resize and exit clean them too.
7. Title ResizeObserver wrote within its callback; moved the existing writes into RAF. Independent round-5 runtime review observed no remaining page/console/RO errors.
8. Full repository QA caught source-title glyphs extending 3px above the compact line box at 1440 and 320. Enlarged only source-title leading from 1.3 to 1.5 so the actual glyph ink fits; retained the exact existing mixed-Unicode/rich-text oracle. All three rich-text sizes now pass.
9. Full repository QA also caught collection-header identity being replaced by, then combined with, the active chapter. Restored the exact existing collection title; current chapter remains in the hover title and Contents. Resume and both exact browse-context tests now pass. Parent owns the full-suite rerun; historical R6 and pre-header R7 evidence is retained separately from the final current-byte capture.

## Checks

- R6 targeted Playwright: **30/30 PASS**, native exit **0**, `.local/heartbeat-rework/ui-browser-final.log` (1.4m).
- R7 affected regressions: exact rich text at 1440/390/320 and collection resume **4/4 PASS** in `rich-regression.log`; after restoring the exact header text, both browse contexts **2/2 PASS**, native exit **0**, `browse-regression.log`. The earlier two failing browse results remain visible in `rich-regression.log` and are not represented as a clean whole run.
- Final `npm run typecheck`: **PASS**, native exit **0**, `.local/heartbeat-rework/typecheck-final.log`.
- Includes serious/critical axe checks at 1366/390/320, manual dialog contrast, all seven native field color-family contrasts in paper/night, exact source immutability, no wrapper marks, complete character traversal, all desktop/portrait projection ranges, off-mid-turn/resize/exit cleanup, sparse/neutral/long/error/fallback states, stored-anchor continuity, and writer scroll without another annotation fetch.
- Parent owns full repository/browser/cloud suites, build, evidence manifest and release; these are not claimed as run by this lane.

Current source is frozen. Final independent critic and parent verdicts should be read from their current `round7-final` records; this designer handoff does not award owner acceptance. Signed-in production/device, physical phone and author comfort/interpretation acceptance remain separate from synthetic browser verification.
