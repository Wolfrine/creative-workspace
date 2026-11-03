# Runtime pass 3 — frozen for independent review

Five actual-reader PNGs are ready. This is a designer handoff, **not visual acceptance**. Round 2 remains partial evidence because a later observer saw a loading state; do not score it as a verified steady-state candidate.

This pass shows every visible feeling on the wide desktop (four at 590px height, six at 768px), at 12.5px. Phones retain two when present; 320px initially shows only Eager calm. Readable-region filtering excludes zero-width ranges, less-than-half-visible text and the bottom flow fade. The source-range boundary repair belongs to the parent lane.

Automatic reading uses native scroll at 320px and at 390x700. The initial prompt says Scroll to read; a normal Pages button switches layout. The button measures 50.516x44px and sits entirely inside both the 70px footer and viewport: y524–568 at 320x568, y656–700 at 390x700. No row-gap clipping remains. The other footer controls also pass both containment checks. Native flow keeps the manuscript width and uses a 10px continuation fade, removed at the end.

| Viewport | Layout | Footer | Prose width | Full prose lines |
| --- | --- | ---: | ---: | ---: |
| 1366x590 | Pages | 66px | 533px | 19 |
| 1366x768 | Pages | 66px | 533px | 28 |
| 390x700 | Scroll | 70px | 350px | 13 |
| 390x844 | Pages | 68px | 350px | 17 |
| 320x568 | Scroll | 70px | 280px | 10 |

All five: body 20px/37px, no horizontal overflow, unchanged synthetic source and zero page errors. Readiness was asserted before capture: nonempty feeling key, continuous SVG, exact expected path counts (10/8/7/8/7), all seven source beat indexes/ranges, font-ready geometry and three additional stable readiness frames. `geometry.json` retains each source partition, annotation anchor, screenshot hash, control rectangles and source fingerprints. Fifteen relevant source files, including parent rails/ranges/geometry and page-turn code, matched before and after capture.

The exact UTF-16 bookmark (passage 1, offset 266) remained fully visible and unchanged through Heartbeat off/on, Scroll→Pages→Scroll, width/height changes, and the existing body-size control changing 20→22→20. Heartbeat toggling and the mode round trip also retained native scrollTop 782px. The delivered/default body remained 20px. PageDown moved the native viewport and stored the visible passage 2, offset 105.

Owned runtime edits: `Reader.tsx`, `Writer.tsx`, `library-reader.css`, `Heartbeat.tsx`, `heartbeat.css`. Parent owns rails, range mapping, page-turn projections and tests; mapper owns the stable whole-document feeling map. The designer used no descendants. No commit, deployment, backend/plugin operation or production manuscript access occurred.

Checks: `npm run typecheck` PASS; four native QA probes PASS; all five renders personally inspected. Independent critique, the remaining focused passes, full writer/state/night/motion coverage and owner acceptance are pending. Preserve the current keyboard focus treatment. No further runtime edits until the parent opens the next pass.
