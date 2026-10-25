# Library and private reader — independent visual critique

**Scope:** Owner-approved collection renaming, a flat Library with Pages and Collections views, a private author reading mode, and Read replacing Export in mobile navigation. Public editions, publishing, feedback and nested collections remain deferred. Critic: `reader_critic`; designer and lead/QA are separate roles. No candidate code is edited by the critic.

**Guidance loaded:** repository `AGENTS.md`, `INTENT.md`, `.harness/objective.md`; Central visual-design-director **0.1.0**, base `ba1235fe7b220842778414f3f70fca38e7df4c53`, its independent critic guide; ui-visual-verifier. Candidate baseline specified by lead: `17be1fa` on main.

**Current verdict: independently agent-reviewed after cycle 5, including direct desktop/mobile browser interaction and bounded paper-turn evidence; no observed visual blocker.** Existing owner acceptance of Living Atlas with Quiet Folio informs the direction; it does not approve new screens automatically. Owner comfort, physical-phone behavior and production acceptance remain separate.

**Workspace:** Work resumed only at `F:/Workspace/Programs/Independent-Products/Noveliaa` after the verified migration in `docs/evidence/operations/2026-10-25-f-drive-migration.json`. Cycle 1 report/evidence were preserved byte for byte; the old C-drive checkout remains read-only.

## Baseline personally inspected

- `design/prototypes/02-living-atlas.webp`: clear writing canvas, restrained navigation and optional relationships; useful mechanism is making prose the dominant object.
- `design/prototypes/01-quiet-folio.webp`: quiet paper, readable serif prose and compact supporting controls; preserve this restraint without copying ornamental device photography.
- `docs/evidence/phase1/sync-2026-10-25/quiet-writing-1440.png`: accepted product material and writing hierarchy; sidebar currently holds page navigation and can grow.
- `docs/evidence/phase1/sync-2026-10-25/quiet-writing-390.png`: mobile prose remains the main object; secondary tools stay compact. These are historical reference pixels, not evidence for the new candidate.

## Critical dimensions declared before candidate scores

| Dimension | Observable pass condition |
|---|---|
| Task and navigation clarity | Library exposes Pages/Collections and current collection context; page/open/read/rename actions are distinguishable; private reading has a clear return to writing; mobile Read replaces Export without removing menu export. |
| Prose, typography and reading flow | Comfortable line length, hierarchy and contrast; page boundaries avoid clipping or visual duplication; titles/paragraphs/links remain legible with long and multilingual content. Content completeness needs separate behavioral evidence. |
| Restraint, material and hierarchy | Living Atlas/Quiet Folio remains recognizable; page text or actual collection content dominates; no decorative dashboard metrics or repetitive cards displace the author task. |
| Responsive fit and access | Desktop, 390px and 320px layouts fit; controls and long names wrap or truncate intentionally; touch actions remain reachable; settings/contents do not trap or cover required actions. |

Each critical dimension and overall must independently reach **8/10**. Scores reflect visible evidence, never test counts. Page-turn motion requires a recording or direct interaction; still frames alone cannot pass it. Reduced-motion, keyboard behavior, exact text coverage, saved drafts and Firestore operations are separate QA gates.

## Cycle records

Five substantive implementation/state review cycles are requested; unchanged recaptures will not be counted as new cycles. All scores below were sent before the critic saw any parent scores.

### Cycle 1 — first Library pages and collections

Candidate source fingerprint `ceaad69bed33d68962001d9d34731c7e04c8745f3d07000dc2f27a80103d5d0b`; actual images and identity: `docs/evidence/phase1/library-reader-2026-10-25/cycle-1/capture.json`, `library-pages-{1440,390}.png`, `library-collections-{1440,390}.png`. Dataset: synthetic 12 pages/4 collections, isolated dev notebook, no production cloud data.

| Dimension | Score | Visible reason |
|---|---:|---|
| Task/navigation | 7.7 | Pages/Collections and collection membership are clear, but desktop All writing and Library compete as seemingly similar destinations. Read/open actions need interaction confirmation. |
| Prose/type | 8.1 | Serif titles and snippets maintain the notebook voice; clear row separators and modest metadata support retrieval. Long content/reader is not yet covered. |
| Restraint/material | 7.8 | Quiet paper and editorial rows fit the accepted direction. Large repeated introductory chrome and collection boxes consume space better used for actual writing. |
| Responsive fit/access | 7.1 | 390px fits without visible horizontal overflow, but the first page begins around 460px; only about 2.5 rows fit. Collections exposes one large card rather than a browseable shelf. |
| Overall | 7.6 | Credible retained direction, mobile density blocks acceptance. |

**Generic-risk decisions:** editorial page rows are justified; collection cards are justified by grouped membership but need denser phone treatment; a repeated hero plus duplicate New thought action is defective on the browsing phone state. **Layers:** retain type, palette and page rows; refine mobile spacing/composition and current-writing versus catalogue navigation; imagery is unnecessary. **Strongest reference gap:** Quiet Folio keeps the working content immediately visible, whereas this phone Library spends most of the first screen introducing itself.

**Highest-priority correction:** compact the mobile title/action area and collection entries/previews. Sent directly to designer `library_reader` and lead. **Visual verdict:** below acceptance threshold. **Separate QA:** lead-owned; screenshots do not establish tap behavior, content completeness, Firestore operation counts or animation. Reader, collection detail, rename, 320px and motion were unobserved this cycle.

### Cycle 2 — compact browsing, collection detail and rename

Candidate `3bd7a7ea52d4750a48c5a4eb781ae3fe7376abc28ce4a0bcd034d6c02d972e7f`; inspected all 12 actual images in `docs/evidence/phase1/library-reader-2026-10-25/cycle-2/`, as enumerated by `capture.json`: Pages, Collections, collection detail and collection rename at 1440×1000, 390×844 and 320×844. Same explicitly synthetic dev dataset.

| Dimension | Score | Visible reason |
|---|---:|---|
| Task/navigation | 8.2 | Continue writing now differs clearly from Library; collection heading, Rename and Read collection have an obvious hierarchy; export remains in desktop menu and Read appears in phone navigation. |
| Prose/type | 8.2 | Editorial titles/snippets remain comfortable. Rename dialog keeps the current collection and preservation meaning visible; narrow titles can truncate heavily, a residual long-title risk. |
| Restraint/material | 8.0 | Phone title/action row is compact; card icon and heading share a row instead of consuming separate large bands. Actual writing dominates page listing. |
| Responsive fit/access | 8.0 | Four or more page rows and over two collection entries are visible at 390px; dialog and collection actions fit 320px. Keyboard appearance remains separate QA. |
| Overall | 8.1 | The consequential cycle-1 gaps visibly improved; observed Library states meet threshold. |

**Generic-risk decisions:** page rows remain justified; collection boxes are resolved on mobile through reduced vertical spacing; compact hero is resolved, with title and creation action sharing one row. **Layers:** retain palette, type and row composition; refine long-title treatment only if stress evidence shows retrieval suffers. Strongest remaining reference gap is 320px titles losing more context than Quiet Folio's purposeful short titles: test wrapping to two lines or reducing repeated collection metadata before reducing type size.

**Highest-priority next state:** actual reader pagination/contents/settings at desktop/phone, then long and multilingual writing. Sent scores and residual risk to designer/lead before parent scores. **Visual verdict:** Library observed states pass; no full-candidate acceptance. **Separate QA:** lead owns flow/rename/offline assertions; capture report lists no browser errors/overflow, but those facts do not raise visual scores. Motion and reader remain unobserved.

### Cycle 3 — actual book spread, phone reader and panels

Candidate `9ebfc721008d51602b93838964606b6aa0fd6c7429efbe1cca174f74db093a24`; inspected all nine actual `reader-prose`, `reader-contents` and `reader-appearance` images at 1440×1000, 390×844 and 320×844 under `docs/evidence/phase1/library-reader-2026-10-25/cycle-3/`; identity in `capture.json`. Synthetic five-document collection; repeated test prose with English/Hindi and emoji. Reduced-motion stills provide no animation evidence.

| Dimension | Score | Visible reason |
|---|---:|---|
| Task/navigation | 8.0 | Back to writing, contents, appearance and progress are recognizable. Current source document has no visible selected marker in contents; PAGE 01 can be confused with screen pagination 1/24. |
| Prose/type | 8.5 | Comfortable wide spread, restrained gutter, legible ragged-right prose and multilingual paragraph; mobile line length is deliberately readable. |
| Restraint/material | 8.4 | Actual prose owns the display. Paper edges and shallow gutter create book character without decoration obscuring text; controls remain secondary. |
| Responsive fit/access | 8.1 | Single-page phone reading and both panels fit 320px; contents/action hierarchy stays legible. Short height/large text and night mode are not covered yet. |
| Overall | 8.3 | Normal reader screens meet threshold; missing stress and motion coverage prevent final acceptance. |

**Generic-risk decisions:** paper spread/gutter is justified by the requested book experience; settings are organized around reading choices rather than a generic dashboard; author provenance labels are justified but should not grow into distracting chrome. **Layers:** retain type, colour, spacing and book composition; refine navigation's current-location marker and ordinal wording. No images are needed. **Strongest reference gap:** the accepted Quiet Folio clearly marks its active scene, while reader contents currently makes all source documents look equivalent.

**Highest-priority correction:** visible current-source marker in Contents and distinct source ordinal versus paginated screen count. Sent to designer/lead before parent scores. **Visual verdict:** normal reader observed states pass; no final-candidate acceptance. **Separate QA:** lead is testing source preservation, anchors, focus and coverage; none is inferred from these stills. Next state coverage should include night, large text, short viewport and long titles. Parent round-3 inspection requested; actual motion still pending.

### Cycle 4 — short viewports, night/large type, current location

Candidate `1e640d6a72c4dd6b4a61c18d6c5bd7a037488873faeec385858426da0a06d503`; all 20 actual stills personally inspected under `docs/evidence/phase1/library-reader-2026-10-25/cycle-4/`: prose, next screen, contents, appearance and night/large at 1440×720, 768×620, 390×568 and 320×568. `capture.json` identifies four actual WebM recordings; their existence was checked, but critic motion viewing has not happened at this record point. Night stress uses 28px text, 2.2 line spacing and wide margins, so fewer visible words are an explicit reading preference rather than a density defect.

| Dimension | Score | Visible reason |
|---|---:|---|
| Task/navigation | 8.3 | Current source is now highlighted in Contents; WRITING 01 separates source ordinal from reading-screen count. Previous/next and Back to writing remain reachable in short layouts. |
| Prose/type | 8.4 | Large night prose has comfortable contrast and visible line boundaries; normal paper/Hindi remains clear. Short chapter openings contain fewer lines but subsequent pages reclaim that space. |
| Restraint/material | 8.4 | Paper and night variants retain the same quiet reading composition; no controls intrude into actual lines. |
| Responsive fit/access | 8.2 | 320×568 still exposes page-turn controls and panel close; 768px sensibly becomes a single page. Appearance's final explanatory note falls below visible short-panel height and needs scroll QA. |
| Overall | 8.3 | Meaningful location and stress-state coverage improves confidence without inventing a visual redesign. |

**Generic-risk decisions:** book edge/shadow is justified, but animation quality is not established by a shadow in a still; night palette is resolved as a coherent reading preference; settings panel is justified and appropriately isolated. **Layers:** retain typography, palette, composition and navigation refinements; verify panel scroll and keyboard access rather than adding decorative polish. **Strongest reference gap:** no severe gap in observed states; motion polish and exact prose continuity require actual behavioral evidence.

**Highest-priority next state:** final keyboard/link/focus behavior and long-content Library/reader states; direct critic browser/motion review after candidate freeze. Sent first scores to designer/lead. **Visual verdict:** observed still states pass; motion and final candidate remain pending. **Separate QA:** lead-owned, including no early cloud save, precise text coverage, anchors and short-panel scroll. Capture report's no-overflow/no-browser-error results are supporting QA, not aesthetic scores.

**Recording follow-up:** personally inspected `cycle-4/motion-contact-1440.png` and `motion-contact-390.png`, chronological tiles decoded from the actual WebMs. They show the real writer → Library → reader → next → Contents → appearance → night sequence and stable final states. Twenty-five samples across 3.6–4.6 seconds contain only one or two turn-transition frames; they cannot establish perceived smoothness or a physical page curl. No visible transition-state blocker was found. Direct final browser interaction or denser turn frames remain necessary for a bounded motion verdict.

### Cycle 5 — final candidate, return-to-writing and empty states

Candidate `638d2859b83cae6f226590fdea923b6195b0865360e8b009c1588d7badde2137`; all **33** current images personally inspected under `docs/evidence/phase1/library-reader-2026-10-25/cycle-5/`: Library Pages/Collections, collection detail/rename, reader prose/next/contents/appearance/night, return-to-writing, empty Library, each at 1440×1000, 390×844 and 320×844. Dataset remains synthetic. Independent PowerShell SHA-256 verification checked every image against `capture.json`: **33 matched, zero mismatches**. Manifest SHA-256: `4384bb85c5b8478b9a724d2b3e2dd3ed2f7933d876a489a60bd0fc6be0c2f617`; manifest sourceBefore/sourceAfter both equal the candidate above.

| Dimension | Score | Visible reason |
|---|---:|---|
| Task/navigation | 8.4 | Library, source context, collection rename and private Read actions are distinct; current Contents marker and Back to writing provide clear orientation. Empty Library offers capture rather than unnecessary setup. |
| Prose/type | 8.5 | Book spread and phone reading preserve the accepted literary hierarchy. English/Hindi and emoji remain readable; 320px Library titles now wrap rather than losing useful context immediately. |
| Restraint/material | 8.4 | Editorial page rows, quiet collection shelf and restrained book material fit the author's notebook; repeated collection metadata was removed from collection-detail rows. |
| Responsive fit/access | 8.3 | Desktop, phone and narrow layouts stay coherent; title wrapping improves narrow browsing, modal controls fit, private reader tools stay secondary to prose. |
| Overall | 8.4 | Current still evidence supports the accepted direction and closes prior material findings. |

These scores were sent to the lead before parent cycle-5 scoring. **Generic-risk decisions:** editorial listing is justified by retrieval; collection shelf boxes are resolved with meaningful membership previews and compact phone treatment; book material is justified by reading mode and does not replace selectable text with decorative imagery. **Layers:** retain typography, palette, composition and navigation; no further visual replacement recommended. Strongest residual reference gap is subjective page-turn/long-session comfort, which cannot be certified from screenshots or synthetic data.

**Dedicated motion evidence:** personally inspected `docs/evidence/phase1/library-reader-2026-10-25/motion/before-{1440,390}.png` and all twelve `turn-{1440,390}-{0,90,180,270,360,500}.png` frames, together with `motion.json`. Filenames are requested sample targets, **not** measured timings: desktop target 90ms was actually captured around 422ms; phone samples include actual 88/158/292/388/457ms values. These actual temporal states show a restrained changing leaf/shadow on the right, then a stable clean page. Bounded motion presentation **8.0/10**, with no observed obstruction/blocker; this is not a physical paper simulation, measured frame-rate result or human smoothness judgment. The report records `reducedMotionNoLeaf: true` for both cases; that is lead test evidence, not an independent OS-setting test by the critic.

**Direct browser review:** the critic's available CUA surface exposed Chrome only, so the lead's IAB tab was not claimed. The critic created and closed its own Chrome tab **1189486222**, session `Reader review`, at `http://127.0.0.1:5817/?local=1&notebook=library-qa-20261025`. This explicitly isolated local notebook began empty; 18 disposable English/Hindi test paragraphs (936 words) were entered only there. Personally inspected actual 1440×1000 book spread, clicked Next, resized to 390×844 single-page reading, opened appearance, checked Night at actual DOM-verified 390×568, disabled animation, turned another page, returned to the original writing and opened mobile Library/Collections. Current title/prose remained visible after return; this is a flow observation, not a substitute for integrity tests. Settings and explanatory note were visible in the short viewport; no error/warning logs were captured. Temporary viewport override was reset and the critic-owned tab closed. CUA images/state remain in this task's tool evidence; the retained reproducible screenshot files above are the formal candidate pixels.

**Final critic verdict:** no observed visual blocker; candidate meets the critic's declared visual dimensions. Exact text coverage, offline/cloud behavior, Rules and recovery assertions are the lead/integrity reviewers' separate QA lane. The critic did not inspect a production author's manuscripts or validate a physical phone, screen reader or long creative-writing session. Five substantive state/change cycles are recorded; no stronger-model override or full formal Central-process certification is claimed.
