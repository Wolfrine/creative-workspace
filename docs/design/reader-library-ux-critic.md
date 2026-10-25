# Reader motion and populated navigation: independent review

Current owner verdict: **rejected** for page-change animation and the realism of
navigation evaluation. The earlier reader review scores do not establish active
acceptance for these states. Living Atlas / Quiet Folio remains the accepted
overall visual language. This report is independent criticism, not owner
acceptance or production-data research.

Final candidate status after the new review: **agent-reviewed, 8.2 overall**,
runtime `488155fe8ec9c3bbdd0ea7d372dfb7f7762adeccf582319389dcd1b77ab65668`.
The owner's rejection above applies to the previous baseline; acceptance of the
replacement by the owner is still pending.

Review role: `motion_navigation_critic`. Central visual-design-director 0.1.0,
base `ba1235fe7b220842778414f3f70fca38e7df4c53`; critic guide, repository
AGENTS/INTENT, Library/Read design contract and ui-visual-verifier loaded.
Critical dimensions for the new review are task/context clarity, prose
continuity/motion, restraint/hierarchy, and responsive/accessibility. Each must
reach 8 independently; tests cannot raise a visual score.

## Rejected baseline inspected

Actual retained renders inspected:

- `docs/evidence/phase1/library-reader-2026-10-25/cycle-5/library-pages-1440.png`
  and `library-pages-390.png`.
- `docs/evidence/phase1/library-reader-2026-10-25/cycle-5/collection-detail-390.png`.
- `docs/evidence/phase1/library-reader-2026-10-25/motion/turn-390-180.png` and
  `turn-1440-180.png`, with the actual timestamp/transform manifest
  `motion/motion.json`.

These are prior synthetic test-notebook captures, not the author's writing.
The baseline capture UI identity is
`638d2859b83cae6f226590fdea923b6195b0865360e8b009c1588d7badde2137`.
Reading `Reader.tsx` and `library-reader.css` establishes the mechanism: `go()`
immediately commits the destination prose transform, then displays an empty
40%-width gradient with a 35-degree rotation. The mobile intermediate image
shows the gradient strip over already-replaced words; there is no visible
departing text-bearing page. This explains the disconnected effect. The
desktop manifest also shows screenshot collection overhead missed most of the
440 ms interval: labels such as `180` are target labels, not exact playback
timestamps. These stills and code support the mechanism finding, **not** a
claim of observing smooth motion or author comfort.

Library rows repeat the same 102-word prose under different titles. Only one
universe is visible. This is insufficient evidence for distinct scene,
thought, lore, reference, mixed-origin and cross-collection retrieval or context
preservation. Baseline review cannot establish those journeys.

Three generic-risk decisions:

1. **Defective:** empty decorative page-strip animation signals a physical page
   turn without carrying the text being turned. Replace the mechanism.
2. **Refine:** New thought appears in desktop sidebar and Library header, and a
   page inventory appears in both sidebar and the main Library. A global create
   shortcut is justified, but repeated same-state emphasis competes with the
   real retrieval task. Reduce duplication where the visible context already
   supplies the same destination.
3. **Justified:** serif prose, muted sage controls and paper surfaces support
   author-first writing. Preserve this language. Tile/list/detail should alter
   retrieval density and preview depth rather than introduce decorative covers
   or fabricated metadata.

Layers: retain type/material/color; refine Library composition, density,
context labels and navigation; replace motion. Strongest reference gap awaits
the current Kindle/Google Play Books image/recording packet. Highest-priority
correction is text-bearing directional continuity, alongside a populated
multi-universe navigation corpus. New candidate scores remain unverified until
their actual renders and interaction evidence are inspected.

Two concrete baseline context risks were passed to implementation and QA:
the universe picker calls only `workspace.selectUniverse`, while the local
Library collection/query/view state survives, allowing an old-universe
collection filter to yield a false empty Library after switching universes;
and the sidebar's **All collections** action navigates to Library without
selecting its Collections tab. These are source findings, pending direct
reproduction and verification of the replacement behavior. The new corpus must
include same-named collections in two universes, distinct prose and provenance,
uncollected pages, empty collections, multiple explicit links, and long titles.

## Cycle 1: populated Library, retrieval layouts and Atlas

UI identity: `1ef6e035a509c15d6c49c361462c029da4775926f51e4c77898702bb6afdb3d6`,
stable before/after in
`docs/evidence/phase1/reader-ux-2026-10-25/cycle-1/capture.json`.
Fixture `three-worlds-2026-10-25-v1`: 3 universes / 12 collections / 24 total
sources, AI-generated synthetic evaluation material, unverified. This exercises
actual app rendering but is not actual owner writing.

Personally inspected Pages list/tile/detailed at 1440x1000 and 390x844;
Collections list at desktop and tile/detailed at mobile; mobile collection
detail; desktop populated Atlas. Scores were sent before parent scoring:

| Critical dimension | Score | Visible reason |
| --- | --- | --- |
| Task/context clarity | 8.0 | Named universe and real collection memberships, distinct prose, useful compact list, recognizable view icons. Context-switch and Atlas semantics still need journey confirmation. |
| Prose continuity/motion | Unverified replacement | The production reader still has the rejected baseline mechanism; no motion acceptance is inherited. |
| Restraint/hierarchy | 7.8 | The duplicate header New thought is removed, but mobile tiles are about 375 px tall with unused lower space. One card dominates a retrieval viewport. |
| Responsive/access | 7.8 | No observed overlap in inspected captures, but Detailed preview is only one truncated line on mobile and is too close to List to justify its extra height. 320 px is not yet covered this cycle. |

No overall acceptance: critical dimensions remain below 8 and replacement
motion is pending. Priority is to compact mobile tile spacing and allow 2–3
readable preview lines in Detailed while preserving the compact default List.

Three generic-risk decisions: real prose previews **justified** for retrieval;
oversized mostly-empty mobile tiles **defective** density; global New thought
with removed duplicate page-header action **resolved** duplication. Retain
serif/sage/paper, refine tile composition and preview depth, replace old motion.

## Motion direction studies, before production integration

Study source `.local/motion-study.html`; actual Chromium rendering manifest
`.local/motion-study/report.json`. Same four synthetic leaves, 1440 facing and
390 single page. Inspected all six `*-mid.png` images directly. These are
mechanism studies, not production app completion or measured smoothness.

- **A, continuous prose slide:** actual outgoing and incoming prose share a
  coherent track. A credible simple fallback, although a whole facing spread
  moves sideways behind the static gutter and feels more like a carousel than
  a book.
- **B, text-bearing soft leaf:** the fold carries actual departing/destination
  text and shadow along its surface. It has the clearest physical relationship
  to the requested book interaction and is the preferred direction, conditional
  on full observed movement, text fidelity and integration QA.
- **C, vertical paper stack:** transparent moving sheets make both paragraphs
  readable over each other at once. Reject: obvious ghost text and no convincing
  book-turn relationship.

The current public-reference stills inspected show Kindle Library and its
appearance control cue; these do not yet establish the current Kindle turning
mechanism. StPageFlip's actual working demo provides an implementation
reference, not evidence of Amazon's or Google's implementation.

The reviewer also decoded both actual B-study WebMs from the manifest
(`page@2aff1bfa6ccf0940f0d7b52274488b98.webm` at 1440 and
`page@6cbbb1f7db134f298f7b24381acfe5dc.webm` at 390): 50 frames at 25 fps
each, then personally inspected 17 labelled frame samples per recording in
`.local/critic-motion-1440/contact.png` and
`.local/critic-motion-390/contact.png`. The observed sequence is corner lift,
text-bearing fold travelling across the spread/leaf, and destination settling.
It is materially more coherent than the rejected empty-strip effect. This
supports a conditional **8.3/10 motion-study** judgment, not production reader
acceptance or a human comfort claim. The prototype dependency's reported
perpetual RAF and incomplete disposal must be resolved or avoided before
integration can pass runtime QA; a visual preference does not waive a known
lifecycle leak. The initial desktop video blank frame precedes ready content,
and is not evidence of a page-turn flash.

## Cycle 2: density, provenance and context-return refinement

UI identity: `82696d460b3ad4cc131aba5eef9bcc9dd50123b9df37336638ac4486bacaabff`,
stable before/after in
`docs/evidence/phase1/reader-ux-2026-10-25/cycle-2/capture.json`.
Retained partial evidence from an actual run; not a complete QA pass. The
capture stopped on a harness Close navigation action after universe selection
had already closed the drawer. It did not reach 320 px. The integration motion
test separately found that the new effect disappears before observation,
although the page advances. This failure remains open.

Personally inspected Pages list/tile/detailed at 390, Detailed at 1440,
Collections tiles at 390, Atlas at 390, settled reader prose at 1440/390, and
Signal Orchard Library at 1440. First scores were sent before parent scoring:

| Critical dimension | Score | Visible reason |
| --- | --- | --- |
| Task/context clarity | 8.3 | Actual universe name replaces generic eyebrow, the second world has its own collections/counts, and reader return is labelled Back to Library with a separate edit action. |
| Prose continuity/motion | Unverified; integration QA failed | Settled prose is readable, but no acceptable actual replacement turn has yet been observed. The conditional study score cannot substitute for this failure. |
| Restraint/hierarchy | 8.1 | Page tiles shed the unused upper icon/large blank space; Detailed now reveals several prose lines; current-origin labels remain visible in all layouts. |
| Responsive/access | 8.0 for inspected 1440/390 | Controls fit, previews are legible and long titles wrap. 320 coverage and direct end-to-end interaction remain pending. |

No overall acceptance: motion is blocked and this is incomplete responsive QA.
The largest earlier Library defects materially improved, so retain the current
Library composition and spend the next change on actual motion, not more
unrelated cosmetic controls.

Three generic-risk decisions: icon-only layout switch **justified** because its
selected state and different content depth are visible; large single-column
collection tiles **justified** as an optional overview with real page previews,
while compact List remains available; generic world eyebrow **resolved** by the
actual universe name. Strongest remaining reference gap is an observable
content-bearing turn in the actual app. Priority: fix the disappearing effect,
then capture forward/backward on desktop/mobile with a stable source identity.

## Cycle 3: complete population states and first integrated soft-leaf motion

Runtime source identity:
`fa13ef78005ee60141967d557e56c703e3c646b098e55c046b22848274c628ed`.
`cycle-3/capture.json` and `cycle-3/motion/motion.json` bind stable sources to
actual Chromium renders. This expanded fingerprint includes vendored runtime
JavaScript, so it is not directly comparable with the older UI-only hash.

Personally inspected 320 Pages list/tile/detailed, 320 Collections detailed,
320 Atlas, 390 Signal Orchard Library, and 320 reader; then actual forward
1440 frames at 233/415 ms, backward 1440 at 418 ms, forward 390 at 124/275 ms,
and backward 390 at 130/665 ms. The labels in filenames are requested offsets;
the manifest's actual elapsed time is the observation time.

| Critical dimension | Score | Visible reason |
| --- | --- | --- |
| Task/context clarity | 8.3 | Real universe context and explicit Library/edit return remain legible; Signal Orchard shows its own counts and groups. |
| Prose continuity/motion | 6.2 | Forward turns now carry real text and bend coherently. Desktop back works in the inspected frames, but mobile back has no movement and keeps the previous leaf visible while the counter already says page 1. |
| Restraint/hierarchy | 8.2 | Prose remains dominant; provenance, compact List and more useful Detailed hierarchy survive 320 px. |
| Responsive/access | 7.2 | The 320 Tile card and its prose extend past the visible right edge. A document-level no-horizontal-scroll check misses this internally clipped grid. |

Overall **7.2, not accepted**. The working forward mechanism is a real visual
improvement, but a backwards turn is part of the same critical interaction and
cannot be averaged away. First findings/scores were sent before parent scoring.

Concrete blockers:

- `motion/back-390-0.png` through `back-390-650.png` show the previous leaf
  beginning “The tide had withdrawn…” while the counter says `1 / 15`.
  The manifest reports all leaf transforms `none`, with the projection still
  present at 665 ms. The adapter has a 750 ms fallback cleanup, so this evidence
  proves a stalled back effect and temporary text/counter mismatch, **not**
  permanent canonical-source corruption. Verify the true post-cleanup state
  beyond 800 ms as well as fixing the back mechanism.
- `pages-tile-320.png` visibly cuts the card's right edge and prose. Constrain
  the grid's minimum track/content width and assert each tile's bounds inside
  the Library viewport; checking only `document.scrollWidth` is insufficient.

The reviewer decoded both actual cycle-3 WebMs at 10 fps and personally viewed
the complete sampled sequences in `.local/critic-cycle3-1440/contact.png` and
`.local/critic-cycle3-390/contact.png`. Desktop movement works in both
directions. The mobile recording confirms that back keeps the second leaf
stationary, then snaps to the correct first-leaf heading after the fallback
(around recording time 2.7 s). Thus the source ultimately appears correctly,
but this is an unanimated delay rather than the requested reverse page turn.

Three generic-risk decisions: text-bearing fold **resolved** the empty-gradient
problem in the observed forward direction; origin labels **justified** by the
approval boundary; minimum-content overflow in a supposedly responsive tile
**defective**. Preserve the successful forward look and typography, repair
backward flow and 320 containment. No direction reset is called for because the
new mechanism materially improved the failing motion dimension.

## Cycle 4: reverse turn, narrow containment and adaptive motion

Runtime identity:
`488155fe8ec9c3bbdd0ea7d372dfb7f7762adeccf582319389dcd1b77ab65668`.
Actual evidence: `cycle-4/capture.json` (52 states, 1440/768/390/320) and
`cycle-4/motion/motion.json` (four directional turns, including observations
beyond the previous fallback interval). The failed earlier 768 Atlas capture
is retained separately under `failures/`; it is not presented as passing.

Personally viewed the corrected 320 Tile, 768 Atlas, 768 night reader/contents,
320 night reader/contents and 768 Tile. Both 1440 and 390 actual WebMs were
decoded at 10 fps, then the complete sampled sequences were personally
inspected in `.local/critic-cycle4-1440/contact.png` and
`.local/critic-cycle4-390/contact.png`. The mobile reverse turn now actually
travels and settles to the first heading rather than waiting for fallback;
the 900 ms settled capture shows the expected first leaf. Desktop forward and
reverse retain coherent text-bearing movement.

| Critical dimension | Score | Visible reason |
| --- | --- | --- |
| Task/context clarity | 8.4 | Universe and collection context, a predictable Library return, and distinct editing/inspection actions remain legible. |
| Prose continuity/motion | 8.2 | Actual forward/reverse sequences carry text, reveal the destination and settle cleanly. The failed mobile reverse mechanism is visibly repaired. |
| Restraint/hierarchy | 8.2 | Prose is dominant; night colors keep a paper-like hierarchy; Library density options remain useful without fabricated covers. |
| Responsive/access | 8.2 | Tile boundaries now remain inside 320 px; the 768 Atlas graph/preview fits its column; reader contents and controls fit at both widths. |

Overall **8.2 for the inspected candidate states**, first scores sent before
parent scoring. No observed visual blocker remains in these states. Final
agent acceptance is still conditional on final-source interaction QA, final
captures and the large-source adaptive transition being personally inspected.
Reported lifecycle/performance tests are valuable separate QA; they do not
raise this visual score by themselves.

Three generic-risk decisions: restrained folding shadow **justified** by the
physical leaf relationship; tile containers **resolved** once they contain
their real prose at 320 px; actual universe context **justified** despite being
visible in global navigation as well, because mobile otherwise hides that
scope. Retain the typography/material and current layout; verify focus return,
changed-source action wording and the large-source fallback in the final pass.
The strongest remaining reference difference is native finger-following curl
versus the app's deterministic triggered transition. No claim of identical
Kindle/Google implementation, measured comfort or physical-phone smoothness is
made.

## Cycle 5: final candidate, large-source transition and independent journeys

Runtime remains
`488155fe8ec9c3bbdd0ea7d372dfb7f7762adeccf582319389dcd1b77ab65668`.
This cycle verifies materially new large-source motion and final end-to-end
interaction; it does not pretend that the unchanged Library received another
visual redesign. `cycle-5/capture.json` retains 52 actual states across
1440/768/390/320. `cycle-5/motion/motion.json` retains soft-leaf turns, and
`cycle-5/large-motion/motion.json` retains four actual canonical-slide turns
with the additional large synthetic AI-generated volume.

Personally viewed final 320 Tile, 768 Atlas, 390 night reader, 320 contents,
mobile soft-back settled first leaf, and desktop/mobile large-source moving and
settled frames. Both large-source recordings and both **exact final** soft-leaf
recordings were independently decoded at 10 fps; complete sampled sequences
were personally inspected. Retained derived contacts live in the corresponding
`motion/critic-contact-{1440,390}.png` and
`large-motion/critic-contact-{1440,390}.png`. The new
`cycle-5/critic-derived-contacts.json` records each contact's SHA-256, originating
WebM path/hash and the sampling/tiling method. They are video-derived evidence,
not generated scene images or owner manuscripts.

Final visual scores were sent before parent scoring:

| Critical dimension | Score | Visible reason |
| --- | --- | --- |
| Task/context clarity | 8.4 | Distinct universes and collection memberships remain retrievable; Library return and explicit editing are separated. |
| Prose continuity/motion | 8.2 | Real short-source folds and large-source canonical slides move in the intended direction and settle cleanly. Back now restores the heading. The large-source path is a slide, not a physical curl. |
| Restraint/hierarchy | 8.2 | Content-led density options, quiet material and visible unverified provenance support the manuscript rather than decorative scaffolding. |
| Responsive/access | 8.2 | Correct narrow tile bounds, readable reader/contents controls, contained tablet Atlas and verified keyboard return preserve the working hierarchy. |

Overall **8.2, agent-reviewed**. No unresolved visual blocker was observed in
the required reviewed states. Three generic-risk decisions: view icons
**justified** by real Tile/List/Detailed density; content-bearing curl
**resolved** the old empty-gradient cue; large-source sliding track
**justified** by exact semantic prose and bounded runtime work, without falsely
claiming that the fallback is a simulated page curl. The strongest remaining
reference difference is still native finger-following interaction versus the
web app's triggered movement.

Independent browser interaction used fresh loopback DEV notebooks, never the
production owner's workspace. `.local/critic-navigation.mjs` completed at
1440x1000, 390x844 and 320x844 with the exact same runtime before/after, Chromium
156.0.8078.4, 21 screenshots, 15 checks and no page errors. Checks:

- Searching “brass key” retrieves the actual three distinct matching sources.
- Reader contents closes with Escape, and Back to Library retains the exact
  collection, Detailed layout and focus on its Read collection button, without
  activating the writer.
- Universe switching clears the foreign collection/query and shows the next
  world's own pages.
- Atlas selection of Iona keeps Atlas visible and updates its graph/preview;
  explicit Open writing opens Iona's source.
- The same-named “The window” source is retrieved within Paper Lanterns from
  its own “spoon-shaped moon” passage.

The reviewer personally inspected search results at desktop/320, return focus
at 390, Iona's Atlas at desktop/320, editing at 390 and Paper Lanterns retrieval
at 320. The initial script incorrectly expected two “brass key” matches; the
fixture contains three (scene, character and place). That harness assertion was
corrected after reading the source fixture. Its failed report is retained in
`.local/critic-navigation/initial-fixture-expectation-failure.json`; no app
change was made to make the check pass. Successful report and screenshot hashes
are in `.local/critic-navigation/report.json`, ready for root retention.

## Verification boundary

No app source edited, no production data read/seeded, no deployment performed
by this reviewer. Final evidence is actual local Chromium rendering and
interaction over explicit synthetic, AI-generated and unverified evaluation
material. The browser-control plugin was unavailable; the actual repository
Playwright Chromium route and personal pixel inspection provided the fallback.
Physical phone/GPU behavior, real assistive-technology use and owner comfort
remain separate acceptance domains. Parent's own final checkpoint, full release
QA and hosted verification belong to the root and are not asserted here.
