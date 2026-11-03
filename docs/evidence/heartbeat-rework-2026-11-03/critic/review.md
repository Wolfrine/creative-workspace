Current verdict: R7-final independent critic PASS. Current source hashes and limits: verdict-round7-final.json. R2-R7 comprise six substantive implementation/review rounds. Parent release and explicit owner acceptance remain separate.

# Independent critic — baseline and review gate

Role: `/root/heartbeat_rework_critic`; review-only. Product source and test ownership remain elsewhere. This record is agent judgment, not owner acceptance, emotion measurement, or production manuscript access.

Loaded: repository AGENTS, INTENT, objective, LIBRARY_READER and EMOTIONAL_HEARTBEAT; installed Central 0.2.3, base d097786cf3d6c5a2859439112afdd39538316567, redesign/emotional-direction/critic/render-QA; ui-visual-verifier. Previous critic scores were not loaded. Owner rejection of 73b8455 is the active verdict.

## Evidence

Parent baseline actual images inspected: `baseline/reader-on-{1366x768,390x844,320x568}.png`, desktop next. Independently opened actual local-only browser pages, seeded only the existing synthetic Saltwater Ledger fixture, mocked annotation HTTP responses, toggled Heartbeat and turned a reader page using `critic/capture-control.mjs`. Independently reproduced captures and geometry are under `critic/baseline`. No signed-in/production state, Firestore listener or authentication bypass was used. Browser viewport/zoom/DPR: exact stated CSS dimensions, scale 1, DPR 1.

| Matched state | Book height | Prose lines (first / next) | Text rectangle area of viewport (first / next) | Header+footer / viewport |
| --- | ---: | ---: | ---: | ---: |
| 1366×768 | 554 px | 18 / 22 | 21.5% / 26.5% | 21.1% |
| 390×844 | 659 px | 9 / 15 | 23.0% / 37.7% | 16.9% |
| 320×568 | 383 px | 3 / 8 | 12.1% / 29.4% | 25.2% |

The owner-described 385 px desktop book has not been recreated in this exact CSS viewport. The 320 capture does measure 383 px. Preserve this difference; do not label these captures a reproduction of all owner measurements. Text-rectangle percentage is an occupied-ink-line proxy, not full manuscript panel percentage or measured reading utility. Visible-line measurement includes ranges from semantic passage nodes; it excludes the standalone source heading.

## Baseline judgment

The dominant first-page object is the title block, especially on mobile. At 320 px only two complete visible text lines are visually apparent after the chapter heading; the DOM metric counts three. The first two source-context rows and giant in-book title repeat context before the reader reaches prose. At desktop the book is generous in width yet uses only two short text columns with a deep first-page vacancy below the left paragraph.

The cream paper, soft sage surround, dark green serif and quiet book seam remain valuable. They convey an agent-inferred impression of private literary calm, not a measured user response. Carry these mechanisms forward without copying a generated dark-room photograph literally.

Heartbeat highlights are isolated pale fragments. Their boundaries may be exact anchors, but the visual result does not make continuous foreground feeling intelligible. Unshaded prose may read as absent analysis, neutral feeling, or omission. The tiny footer labels and attribution are visibly difficult at normal screenshot size. Their thin weight/trajectory marks require close inspection and have no immediately legible map to the tinted passages.

| Critical dimension | Score /10 | Visible reason |
| --- | ---: | --- |
| Narrative expression | 4.5 | Pale isolated sentences plus ambiguous gaps do not expose sustained foreground feeling. |
| Visual craft | 6.0 | Coherent paper/serif identity; scattered tints and miniature footer lack a unified visual relation. |
| Reading ergonomics | 4.0 | Title/context repetition consumes scarce height; narrow first screen yields minimal prose. |
| Mobile quality | 3.5 | 320×568 first-page prose is subordinate to title/header/footer; labels remain miniature. |
| Accessibility | 4.5 provisional | Main prose is clear/selectable; legend/attribution visually too small. Keyboard, contrast and screen reader are not yet independently audited. |

These are baseline scores, not prior accepted scores.

## Retain / refine / replace / explore

- Retain cream/sage/serif and the optional off state, selectable exact source, private author context, page navigation and typography settings.
- Refine title/context density and book-to-working-viewport allocation. Show substantially more actual prose at the same type preference without reducing its legibility.
- Replace the miniature per-beat footer and isolated marker-scrap interpretation. Foreground should be continuously readable; gaps need explicit meaning.
- Explore three rendered structural alternatives before selection, using the same content, type scale and actual viewport. Do not select from CSS descriptions.

Three generic risks: book metaphor is justified by quiet private rereading; oversized opener is defective in this working reading state; an unexplained color overlay is defective because it obscures its own relationship to the source.

Strongest comparison gap: a good reading surface makes its text primary immediately. Here the first screen introduces the page repeatedly and asks the reader to decipher tiny secondary notation.

## Acceptance gate

Critical ratings stay narrative expression, visual craft, ergonomics, mobile and access; each independently >=8, with better/worse/unchanged/unverified deltas and no lost valued identity. Required evidence is three structural alternatives; matched first/continuation desktop390/320; semantic coverage and legend; writer and night; passage selection/page turning/reduced motion. Five–ten substantive render/review rounds are required by current task; unchanged rescoring does not count. Two stagnant failing rounds reopen selection. Parent owns separate QA and round3/5/final checkpoints. Only explicit owner response can accept the result.
## Round 1 � three structural alternatives, preliminary selection

Actual images inspected before reading designer preference: compact/flow/margin at all three exact viewports. Then independently opened all nine HTML prototype states in Chromium via `critic/inspect-alternatives.mjs`; rendered copies/geometry under `critic/alternatives`. Source HTML SHA-256 retained in the geometry. Reference images actually inspected: `.local/reader-reference-inspection/google-play-14s.png`, `google-play-18s.png`, `curl-open.png`, `kindle-55s.png`. These are reference-only prior captures, not current browser evidence for those external products. The spread references preserve a strong paper object and the appearance reference reveals controls on demand; neither provides a precedent for unreadably small permanent annotation chrome.

| Candidate | Narrative | Craft | Ergonomics | Mobile | Access | Judgment |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Compact | 6.5 | 6.5 | 8.0 provisional | 7.0 | 5.5 | Strongest structural foundation; conditional only |
| Flow | 6.5 | 6.5 | 6.5 | 7.0 | 5.5 | Weak use of desktop width; long single-column lines |
| Margin | 6.5 | 6.0 | 6.0 | 5.5 | 5.5 | Nearly empty folio/rail spends width and harms narrow title/prose |

Compact better: more immediate prose; restrained opener; preserved paper/sage/serif and facing pages. Worse: saturated tints plus persistent underlines cause a school-marked texture; phone legend hides two or more categories with little visible scrolling cue. Unchanged: fundamental source/provenance boundaries and cream/sage identity. Unverified: real pagination/motion/selection because these are static structural prototypes; mood-image target comparison because that image is unavailable this session; actual meaning of the invented synthetic colors.

Independent compact geometry: 624/701/427 px books; 26/16/9 source prose lines; 33.4/46.1/32.0% text-rectangle area. Legend overflow 0/106/143 px; only four of six items fully visible at either phone size. Legend 11px desktop/390 and 10px at320. Source heading 81.8px desktop and51.9px390 compared with baseline119.9px and155.3px respectively.

**Comparison confound:** baseline uses20px leading1.85; prototypes use20px leading1.68 desktop/1.62phone and19px narrow. Therefore density improvement cannot yet be attributed solely to structure. A pending length-matched four-paragraph counterpart must refresh baseline and all three alternatives with identical type/leading before final selection. This preliminary round is not a formal acceptance result.

Owner-provided emotional target, relayed by parent: **calm focus; perceptible emotional current**. The prior dark cozy phone study is unavailable; its owner description is reference-only and must not be copied literally into UI or described as an image inspection. No new image was generated by critic. The useful current relation is cream/sage calm plus a perceptible, intelligible foreground field. Color legend must state actual returned foreground words rather than guess generic names from tone tokens.

Three generic risks: book metaphor remains justified; decorative margin rail is defective where it consumes mobile width without adding reading meaning; all-text marker underlines are defective because they compete with reading and resemble editorial emphasis rather than an optional emotional current.

Highest-impact correction: retain compact book structure, refresh fair comparison, and replace miniature/hidden legend with a legible continuous-field explanation that maps to actual words and has clear gap meaning. Do not add extra decorative imagery. Parent owns selection and separate QA; all critical dimensions remain below acceptance where listed.

### Round 1 frozen comparison (supersedes preliminary numbers)

Parent supplied a four-paragraph synthetic counterpart; baseline and all three alternatives were rerendered with identical20px/1.85 typography at1366�768,390�844,320�568. The real private source was not read by critic. Matched baseline copies are `critic/matched-baseline`. Original18/9/3 baseline metrics were source-passage lines including one chapter heading; paragraph-only counts were17/8/2. This clarification does not affect the new four-paragraph matched fixture.

A reproducibility defect was found when prototype HTML showed all seven legend labels while designer screenshots filtered current-page labels. Designer corrected the actual HTML and froze it. Critic reran all nine actual Chromium states; final evidence is `critic/round1-alternatives`, including exact rendered DOM snapshots and SHA-256 per state. The failed all-seven-key capture remains under `critic/alternatives`; it is not the selected candidate.

| Frozen candidate |1366 paragraph lines / area |390 paragraph lines / area |320 paragraph lines / area |
| --- | --- | --- | --- |
| Compact |29 /39.1% |15 /42.4% |8 /32.8% |
| Flow |13 /24.1% |15 /40.9% |8 /32.8% |
| Margin |12 /25.8% |15 /36.2% |8 /29.3% |

Compact books622/699/423px; current-page legend11px, zero horizontal overflow,6/2/1 relevant labels. Font/leading equal baseline. The before/after structural improvement is now credible without relying on smaller text/tighter leading. Compact preserves book identity while exposing substantially more text than the alternatives on desktop. Flow and margin leave a large desktop reading-capacity gap; margin also creates a disconnected folio column.

Final round1 scores: narrative7.5, craft8.0, ergonomics8.0, mobile8.0, access7.0. Compact is selected as a conditional structural foundation, not accepted final UI. Narrative still needs real continuous-field semantics, gap handling and on-demand reasoning; access needs actual interactive controls/keyboard/contrast. No prototype score substitutes for those checks.

Better: prose and title balance, full foreground field, actual foreground names, no marker underlines, current-page-only key. Worse: no unresolved identity regression in the frozen prototype, but color could dominate if the implementation adds further emphasis. Unchanged: cream/sage/serif quiet book. Unverified: interactive selection, turning, night/writer, source integrity, actual author reaction, unavailable mood image. Generic risks now resolved for oversized opener/marker underlines; book metaphor remains justified. Next: render implemented compact first/continuation on/off at all three viewports for round2.

## Round 2 � implemented compact reader and continuous field

Independent actual-browser capture: `critic/round2/{reader-off,reader-on,reader-next,reader-night,writer-on,writer-off}-{1366x768,390x844,320x568}.png`; DOM snapshots and per-state source/DOM fingerprints in `evidence.json`. All source hashes stable across capture. Actual on/off/turn/night/return-to-writing controls exercised. Local-only synthetic fixture, intercepted annotation HTTP only; no production access. All first/on/continuation states and writer/night screenshots visually inspected.

Reader on: book625/703/427px; paragraph lines28/15/8; text-rectangle area39.1/42.4/32.8%; root horizontal overflow0. Reader off: books655/754/478px and29/17/10 lines. The small final desktop continuation contains only the actual story ending; its3 visible lines are not a density failure. Exact20px/1.85 prose retained.

| Critical dimension |Score |Evidence |
| --- | ---: | --- |
| Narrative expression |8.0 | Continuous returned feeling ranges, actual foreground labels, no unexplained islands in the full fixture. |
| Visual craft |8.0 | Cream/sage/serif and subtle book seam retained; tinted fields no longer carry distracting underlines. |
| Reading ergonomics |8.0 | Compact opener; source text fills the book; key remains below it and off state restores height. |
| Mobile quality |7.0 | Reader390/320 now strong; writer320 toolbar wraps Heartbeat and global key pushes save/word status below viewport. |
| Accessibility |7.5 provisional |11�12px readable text labels, actual buttons and optional layer; interactive details/contrast/focus still need independent review. |

**Material correction:** at320 the writer Heartbeat icon occupies an entire second toolbar row even off. When on, three global feelings plus More occupy two key rows although only the first field is visible. Word/save status falls below the captured viewport. Keep toolbar icon inline and make mobile writer key compact/relevant with explicit access to the full key. Do not change the now-successful book structure. Reader continuation390 displays `+1 feelings`; plural is polish.

Better: manuscript prominence and full-field intelligibility, responsive book/legend, plain off state. Worse: narrow writer allocation remains inadequate; it must not be hidden by strong reader-only ratings. Unchanged: private-author context, exact selectable source and original visual identity. Unverified: full semantic gap handling, keyboard details/reasoning, actual motion, real author emotion/comfort and unavailable mood study.

Three generic risks: tinting every line is now justified by an explicit complete synthetic interpretation with an off control; reader opener/title dominance is resolved; global miniature-control inventory in the narrow writer is still defective. Main reference gap is the writer's inability to keep controls out of the text's limited vertical space.

QA separation: root owns source integrity/runtime/coverage acceptance. Capture emitted two Vite ResizeObserver-loop notifications on stdout; `pageerror` arrays are empty. This discrepancy is explicitly reported for QA investigation, not called a clean runtime pass. Parent checkpoint required after round3.

## Round 3 � narrow writer, page-relevant key and on-demand detail

Actual new source rendered independently: `critic/round3` and `critic/round3-details`; sourceStable=true in both evidence records. Parent checkpoint requested with desktop390/320 reader and writer plus detail images. Reader geometry remains the successful round2 values. Narrow writer toolbar is now one row; only the visible foreground appears in its key. At320 six prose lines are visible versus four in round2. The status footer remains below this short viewport in both on/off screenshots; parent QA must distinguish existing shell min-height/scroll behavior from annotation allocation.

Independent keyboard checks at all three viewports: Enter opens a selected feeling; Escape closes and restores the trigger focus. Body/plainText match the original synthetic source after reader/appearance/return operations. The390 full-key dialog names exactly the three visible-page feelings rather than manufacturing a generic tone dictionary. Dialogs have no horizontal overflow. At320 the selected reasoning dialog is intentionally scrollable:860px content /531px client height.

Scores: narrative8.0, ergonomics8.0, mobile8.0, access8.0 (visual/keyboard; quantitative contrast remains separate QA), craft7.8. Newly inspected detail craft is the blocker: the swatch's glyph visibly escapes its small circle, and the undertone uses near-display scale, wrapping over two large lines at320 and displacing the actual explanation. Reduce undertone to metadata scale and contain the swatch glyph. This is a local correction, not a reason to reopen the successful book composition.

Better: writer key/task allocation, no forced extra toolbar row, readable current-page key, selected-only explanation and keyboard return. Worse: the detailed state reveals a new local typography/glyph defect. Unchanged: book/quiet off/cream/sage/serif and exact source. Unverified: sparse/neutral semantic handling and timed turning/selection; no human acceptance or measured feeling. Generic risks: writer global inventory resolved; dialog overhierarchy remains defective; native modal/reasoning-on-demand is justified.

Runtime note remains open: two ResizeObserver-loop notifications emitted by Vite during each independent run while pageerror arrays remain empty. Separate QA must classify/resolve this before a clean runtime claim. No annotation requests or writes were performed against live services.

## Round 4 � corrected detail hierarchy and honest coverage semantics

New source actual-browser evidence: `critic/round4-details` and `critic/round4-semantics`, sourceStable=true. All three widths. Visually inspected corrected selected detail at1366/390/320, full key390, sparse desktop/320, explicit rest at all three widths and stale writer320.

The selected detail now keeps its glyph inside the13px swatch; undertone is13px metadata. Actual explanation precedes the long quote and is visible above the fold at320. The quote stays exact and scrollable. The390 full key fits three foreground labels with a clear selected-action path. Keyboard Enter/Escape/focus return and exact original body/plainText preservation pass again.

Actual coverage states:

- A legacy sparse annotation renders **no** reader highlights at any width, with `Incomplete reading. Regenerate for the full revision; unanalysed text stays uncolored.` It does not invent a neutral bridge.
- No returned annotation produces the explicit no-Heartbeat prompt, not an inferred emotion.
- A deliberately returned full-source `Rest` beat renders a named gray field at all widths; native highlight background is rgb(226,229,218). Rest is explicit synthetic data, not deduced from gaps.
- Editing the synthetic writer immediately clears writer native highlights and shows a fresh-revision/regenerate message. Reading, interpretation and view changes themselves preserve exact source.

Scores: narrative8.2, visual craft8.0, ergonomics8.0, mobile8.0, accessibility8.0 for the states observed. All critical dimensions now meet the visual threshold; this is still conditional on final motion/selection and separate QA. No overall acceptance is inferred from scores alone.

Better: detail hierarchy, visible explanation, explicit difference between rest/unanalysed/absent/stale. Worse: no new observed visual regression. Unchanged: readable serif prose, cream/sage and paper book, one optional layer, source evidence/privacy. Unverified: timed motion/selection, neutral night state, actual author comfort and unavailable mood image. Three generic risks are now resolved or justified: source/title ceremony resolved; static legend inventory replaced with current-page names; modal detail is justified by keeping interpretations out of the main reading task.

Runtime notifications remain reported: Vite still emits two ResizeObserver-loop warnings per run. The empty pageerror arrays do not erase that observation. Parent QA owns classification/repair and final runtime verdict.

### Acceptance hold after round4

Designer/QA reports a narrow320 per-character traversal duplicate around source offset1196 (desktop passes); investigation points to page-dependent legend height changing pagination/bookmarks. This does not establish source mutation, but it can repeat visible writing and is a critical reading-integrity blocker. The round4 visual scores apply only to the states observed. Final agent-reviewed status is on hold pending repair, full traversal and fresh renders/motion. Current verdict remains unverified, not accepted.

## Round 5 � stable geometry, selection and timed native/reduced/large reading

Actual new source captures: `critic/round5`, sourceStable=true; includes App/Writer/page-turn/presentation hashes. Reader on first-screen28/15/8 paragraph lines,39.1/42.4/32.8% ink-line area; books625/701/425px. Narrow legend geometry now stable across pages. Main static desktop/mobile screenshots and narrow writer visually checked again. Prior ResizeObserver notifications did not recur; no page or console errors in six native/reduced and two long-slide contexts.

Density study: inspected all six paired1.85/1.75 images. Retain1.85. The tighter option stays legible and adds one line desktop/390, but no additional320 line; it compresses the colored rhythm and loses some valued unhurried spacing. Existing user control can select denser spacing. Structural comparison and default stay separate.

Independent timed checks retained under `critic/round5-motion` (three curl + three reduced contexts) and `critic/round5-slide` (desktop/320 long source). Every context selects `Late afternoon` exactly; selected text remains legible over the field. Native curl creates inert, aria-hidden bounded projections; reduced motion creates no moving projection; large source slides canonical prose. All contexts preserve source body/plainText and leave zero turns/motion highlights. Native exact-range match passes. Night Rest is visibly gray and legible at390/320. Actual WEBM recordings retained with rAF timelines and sampled timed browser frames. Frame inspection supports continuity findings; screenshots/timers do not measure owner animation comfort.

A critic fixture error initially stopped long-slide capture: the reused short annotation left a quote over the2000-character validation limit. The product correctly rejected it. Only that helper data was corrected into1800-character continuous synthetic chunks and the two long-slide cases rerun. This is not recorded as a product failure.

**New visual blocker found by actual frame inspection:** phone curl's rotating outgoing face is plain while source and destination underneath are colored. See `round5-motion/curl-390x844-at-1045.png` and `curl-320x568-at-1030.png`. Desktop incoming curl is colored. Phone timeline has three projection nodes but only14 ranges (two sets of seven); desktop has three nodes/21 ranges. Likely portrait temporary clone is unregistered. Passing existing range-match/inert assertions did not prove every visible clone was painted. Requested correction and a stronger per-projection coverage assertion.

Scores for newly observed phone motion: narrative7.5/mobile7.5; other resting states retain round4 >=8. Final acceptance remains **on hold** until the moving phone face retains the actual field. Book composition needs no reset; this is a bounded rendering projection defect. Parent round5 checkpoint notified. Parent/QA traversal must confirm the earlier repeated source offset is repaired; critic does not convert designer reports into independent traversal proof.

## Round 6 � repaired portrait projection and explicit no-color fallback

Actual current source evidence: `critic/round6`, `round6-motion`, `round6-slide`, `round6-fallback`. Every capture has sourceStable=true; all final UI hashes matched the current source immediately after capture. Main static first/on/off/continuation/night/writer states were freshly rendered at1366�768,390�844,320�568. Parent personally inspected final images separately; critic scores retain independently declared round4 thresholds and do not copy parent ratings.

Actual moving portrait faces are now colored: `round6-motion/curl-390x844-at-1405.png`, `curl-320x568-at-1316.png`; desktop `curl-1366x768-at-3136.png`. Stronger timeline checks show zero active frames with an uncolored projection; all three curl sizes register21 exact ranges across three projections. Projections remain inert/aria-hidden and clean to zero. Selection reads `Late afternoon` exactly, with legible selected text. Reduced motion records zero active frames; >20000-character canonical slide fallback works desktop/320 without cloned highlights, source changes or runtime errors. Native/reduced/slide video and timed frame evidence retained; owner comfort is not inferred.

The unsupported-color fixture actually disables both CSS.highlights and Highlight before app startup. At all three sizes the UI visibly says `Feeling key` / `Colors unavailable`, preserves readable plain prose and named feeling actions, opens detail through keyboard, and preserves exact body/plainText. This is a verified capability fallback, not an assumed browser condition. Neutral night field remains gray and legible. No page/console/ResizeObserver error recurred in final capture runs.

### Final independent R6 visual ratings

| Dimension | Score /10 | Visible basis |
| --- | ---: | --- |
| Narrative expression |8.2 | Full returned foreground field, exact names, explicit rest/incomplete/absent states; color now persists on the moving portrait face. |
| Visual craft |8.0 | Retained cream/sage/serif and paper seam; contained swatches, subordinate undertone and selected-only reasoning. |
| Ergonomics |8.0 | Short opener, substantially more actual writing, stable page key and quiet off state; same20px/1.85 type. |
| Mobile |8.0 |390/320 book and controls fit; one relevant narrow key plus explicit More; writer toolbar stays inline; phone motion field persists. |
| Accessibility |8.0 | Readable named labels, symbols beyond color, keyboard dialog/return, selectable exact text, reduced-motion and explicit unsupported-color path. |
| Overall |8.0 | No observed visual blocker remains in the reviewed R6 fixture/state matrix. |

### Matched baseline delta

| Viewport |Baseline ? R6 paragraph lines |Ink-line area |Book height |Source opener height |
| --- | --- | --- | --- | --- |
|1366�768 |20 ?28 |27.7% ?39.1% |554 ?625px |119.9 ?59.3px |
|390�844 |10 ?15 |27.1% ?42.4% |659 ?701px |155.3 ?54.7px |
|320�568 |4 ?8 |16.8% ?32.8% |383 ?425px |155.3 ?52.1px |

Both use the same four-paragraph synthetic counterpart and20px/1.85. These are occupied line-rectangle proxies, not manuscript panel percentages or human attention. Header/footer1366 reduce70+92 ?54+76px; mobile60+83 ?46+97px. The mobile footer is14px taller for legible labels, balanced by the14px shorter header and removed repeated context; the book and actual prose still grow. Current-page key is11�12px with measured zero overflow. No root horizontal overflow observed.

| Attribute | Delta | Loss/limit |
| --- | --- | --- |
| Manuscript hierarchy/density |Better |Original quiet type/leading retained; density improvement comes from structure. |
| Emotional field/legend |Better |More perceptible tint is intentionally more present; actual foreground labels and off state preserve agency. |
| Selected explanation |Better |Long quote remains scrollable; explanation now precedes it. |
| Responsive reading/writing |Better |Narrow existing writer remains vertically constrained; no full editor redesign is claimed. |
| Motion and source selection |Better |Phone transient field loss repaired; frame evidence does not measure owner comfort. |
| Cream/sage/serif/private-book identity |Unchanged |No literal dark cozy image/theme copied. |
| Mood-study comparison / actual author feeling |Unverified |Prior image unavailable; no human reaction measured or invented. |

Three generic-risk decisions: book metaphor is justified by private rereading; title ceremony is resolved; miniature/global legend inventory is resolved with current-page names and on-demand detail. The five substantive implementation/review rounds are R2 compact field, R3 narrow writer/detail, R4 semantic coverage/detail hierarchy, R5 stable geometry/selection/timed evidence, R6 portrait projection and capability fallback. R1 was structural exploration, not counted as implementation.

**Current scope verdict:** R6 independent visual critic PASS. **Global release remains on hold:** parent full browser suite has found fragmented rich-text clipping at1440/320 and is investigating with the designer. That state is outside these fixture captures; this report does not overrule it. Any source repair needs affected-state rerender and renewed fingerprint comparison. Parent full QA, release/deployment and explicit owner acceptance remain separate gates.

## Round 7 final � rich-text title ink, collection identity and current-byte binding

**Current independent critic verdict: PASS.** Authoritative manifest: `critic/verdict-round7-final.json`; current static folder: `critic/round7-final`. Historical `round7` is pre-header-correction evidence and `round7-final-pretrim` is before the final EOF-only CSS cleanup. They are preserved and are not mislabeled current.

R7 repairs actual title glyph clipping by increasing its line box, while retaining exactly the collection identity in the running header. Critic independently executed the unchanged existing rich-text character oracle with the exact synthetic seed from `tests/browser/library-release.spec.ts`; helper copy/output live only in `critic`. Zero clipped characters at1440�1000,1366�768,390�844,320�844,320�568. Actual desktop and narrow rich-text renders inspected: title ink fits and Unicode text remains readable. This is an actual oracle result, not an assertion relaxation.

A populated synthetic collection was opened through real Library navigation. Desktop visibly reads `Draft chapters` in the running header with no redundant current-chapter text; the exact identity matches at1366/390/320. Mobile retains its existing hidden running-title treatment; Contents exposes the two chapter names. Actual mobile Contents renders and primary reader states are retained. An initial critic harness navigation selector was replaced with the visible navigation drawer; this was a helper routing issue, not recorded as a product defect.

Current R7 static/motion/slide/fallback captures were stable within run and freshly rendered. Actual mobile curl frames are `round7-final-motion/curl-390x844-at-2243.png` and `curl-320x568-at-1417.png`; both moving faces retain the field. Zero uncolored active projection frames at all three sizes. Native/reduced/large-slide and unsupported-color paths preserve source, selection and cleanup, with no captured runtime error. Parent separately reports final93 browser/11 cloud checks PASS, native exit0; critic did not run that whole suite.

The final one-blank-line EOF trim in `library-reader.css` has no semantic change. Critic preserved pretrim static evidence and recaptured all18 current static states. SourceStable=true, current source mismatches=[], all three primary PNGs byte-identical to the visually reviewed pretrim captures. A computed SHA-256 of current CSS plus one LF exactly equals the pretrim CSS hash, proving the supporting timed/fallback/rich/collection evidence differs only by that terminal LF; this equivalence is explicit in the final manifest. No new aesthetic cycle is counted for whitespace cleanup.

Final geometry is unchanged:28/15/8 first-screen paragraph lines;39.1/42.4/32.8% ink-line area;625/701/425px book heights. No title-top clipping or root horizontal overflow. Same20px/1.85. Final scores remain narrative8.2, craft8.0, ergonomics8.0, mobile8.0, accessibility8.0, overall8.0. The six substantive implementation/review rounds are R2�R7; structural alternatives were R1. Round7 is the actual rich-text/context regression repair, not a score-only resubmission.

No observed visual blocker remains in the current reviewed matrix. The prior fragmented-rich-text release hold is resolved by the independent zero-clip oracle and parent full-suite result. Parent owns release/build/deployment acceptance. Explicit owner/physical-device comfort and the unavailable prior mood-image comparison remain unverified; no author emotion, real reader response or owner approval is inferred.

Topology and ownership: one parent lead, separate designer and independent critic, parent QA; critic used no descendants. Critic changed only helpers/reports/render evidence under `.local/heartbeat-rework/critic`; no product/source/test/docs/plugin edits, commits, authentication or private production access. All new files are on F. All rendered source content is synthetic, including the length-matched counterpart and mixed-Unicode rich-text fixture.
