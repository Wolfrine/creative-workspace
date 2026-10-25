# Populated author-workspace navigation audit

Scope: the actual Phase 1 app, evaluated with a reusable synthetic corpus rather
than a blank notebook or repeated filler. This report does not claim owner,
physical-phone, assistive-technology, or production-manuscript acceptance.

## Material used

`tests/helpers/populated-workspace.ts` builds three worlds, twelve flat
collections, twenty-four pages (one set aside), and two exact-byte originals.
Each world has an empty collection and loose Inbox material. Collection names
include long names and the same `Draft chapters` name in separate worlds. Two
worlds have a page titled `The window`, with different text. The corpus includes
a long scene with distinct events, character notes, a physical setting, rules,
a field sketch, questions, an unsent letter, a poem, and Hindi/decomposed Unicode.
Explicit links and backlinks connect the relevant sources within each world.

All newly generated story material has **AI origin and unverified status**.
The opaque imported notebook is `unknown`; the imported conversation remains
`imported_chat`. Neither imported source is verified. The exact CRLF bytes are
retained with SHA-256 hashes. No material is represented as owner-authored,
approved canon, or source from NovaSaga/another story repository.
The separate scripted capture journey exercises the app's normal Author writing
default on a new page; its explicitly synthetic test input is not an assertion
that the real owner wrote or approved that sentence.

The helper exports `buildPopulatedWorkspace`, `populatedArchive`,
`populatedFixtureManifest`, and `seedPopulatedWorkspace`. The last helper checks
an exact isolated loopback DEV notebook URL, a local-only session, and an empty
store before using the normal validated archive importer. It has no production
seed path. The manifest identifies every source/body/original hash and count.

The initial fixture is deterministic:

| Universe | Collections | Live pages | Loose Inbox pages |
| --- | ---: | ---: | ---: |
| The Saltwater Ledger | 4 | 9 | 2 |
| Signal Orchard | 4 | 7 | 2 |
| Paper Lanterns · काग़ज़ की रोशनी | 4 | 7 | 1 |

Initial archive SHA-256:
`194f57715a1a93e4c1a98d107067efd82ee29c242315a0daac4f33230f861d42`.
Generated archives/manifests and runner traces default to `.local` on F, not
historical retained release evidence. Root owns final evidence promotion.

## Concrete baseline findings

| Observed source behavior | Practical friction | Requested correction |
| --- | --- | --- |
| Universe selection kept the old collection ID, query and view in App while the engine cleared its current page. | Switching from a populated collection could show an apparently empty Library in another world; returning did not reopen the prior writing. | Reset foreign UI context; choose a valid page and remember the prior writing within the session. |
| Sidebar `All collections` opened Library's existing/default tab. | A destination named Collections could land on Pages. | Give the shortcut an explicit Collections destination; detail Back returns there. |
| Atlas nodes and index entries immediately opened the writing editor. | Following a connection discarded the map, making further exploration require repeated re-entry. | Keep selection and preview in Atlas; use explicit Open writing to leave it. |
| New thought appeared in global navigation, Library header and Library empty state. New collection appeared in sidebar, toolbar and a create tile. | Several equally weighted actions repeated the same operation and competed with the content. | Retain global capture; provide one main New collection action in the collection view. |
| Library rendered one card/list treatment for every situation. | Neither scanning many titles nor browsing rich previews was a deliberate choice. | Offer icon controls for Tile, List and Detailed, remembering the choice locally for each universe. |
| The product says both thought and page. They are one WritingDocument model. | Presenting these as separate content types would add an artificial decision before writing. | Explain that thoughts, scenes and chapters are pages; retain one capture path. |

These findings were sent to root and the frontend owner before app changes.
Only the fixture, journey tests, and this report belong to this audit lane.

## Journey verification

The focused suite is `tests/browser/populated-journeys.spec.ts`. It exercises
actual DOM controls after safe fixture import; the engine hook is used only for
seeding and independent state/original/recovery assertions.

- Exact source bodies, original bytes, revision snapshots and unverified labels.
- Tile/List/Detailed at 1440, 390 and 320 CSS px: body search, Inbox filtering,
  long names, empty collections, unchanged source, scoped view persistence,
  no document horizontal overflow, and no duplicate Library capture button.
- Collection detail to another universe and back; repeated collection/page
  names stay scoped; collection Back and shortcut destinations match their names.
- Capture from an empty collection, local recovery on leaving, same-ID rename,
  move to permanent Inbox, creation of a separate world, and return to writing.
- Atlas outgoing/backlink traversal, current selection, body search, explicit
  editor opening and universe isolation.
- Collection reader pagination/resume, exact current-source return and source
  invariance; no reading-generated manuscript revision.
- Editing before the idle delay, navigation safety flush and exact reload
  recovery; all other documents and imported originals remain unchanged.

Focused result: **10 passed, 0 failed, 0 skipped, 0 flaky**, in 33.0 seconds.
The retained runner report is `.local/populated-journeys/browser-results.json`.
A final independent capture-journey rerun also passed in 3.2 seconds after adding
an assertion that all twenty-four pre-existing source records and both originals
remain exact through capture, collection rename, move, new-universe creation,
and return. Its report is
`.local/populated-capture-confirm/browser-results.json`. Assigned-file
`git diff --check` passed.

The suite now verifies both `All collections` and `Browse collections` open the
Collections tab, not only that the tab itself works. Atlas traversal and
isolation were exercised at both 1440 and 390 px. The three Library widths cover
every display mode and collection treatment.

The first audit exposed an input-cost tradeoff: returning from Library-origin
Read forced the author into writing, focused the canvas, and hid mobile bottom
navigation. Root selected an explicit context return instead. Library-origin
Read now offers **Back to Library**, while one **Edit current page** icon opens
the exact source deliberately. Writer-origin Read retains **Back to writing**.
The Library stays mounted but hidden and inert while reading, preserving its
local browse state without exposing hidden controls to keyboard navigation.

Two new full journeys passed at 1440 and 390 px in 9.1 seconds; results are in
`.local/populated-context-return-focused/browser-results.json`. Each verifies:

- Top-level Pages, Tile layout, body query, collection filter and title sort all
  survive Read and Back to Library.
- Collection detail, Detailed layout, body query and title sort survive Read and
  Back to Library; no editor opens as a side effect.
- Resuming the collection keeps its reading position. Selecting another source
  in contents and choosing Edit current page opens that source's exact text.
- Writer-origin Read still returns directly to the writer. All source records,
  revisions, originals and receipts remain unchanged by these reading actions.

The final populated suite contains thirteen cases: the additional cases include
actual mobile backward-leaf geometry/visible content and tablet Atlas bounds.
Every Library display mode also checks actual card/control bounds inside the
Library viewport, rather than relying only on document scroll width. At 768 px,
Atlas traversal checks the map, index, preview, nodes and index buttons against
their actual parent bounds. Return journeys additionally check focus returns to
the original Read control, avoiding an unwanted text-input focus.

The preceding eleven-case run
had nine passes and two query-expectation failures: `third glass` legitimately
occurs in both the long scene and the separate page title. A unique body phrase
corrected that test assumption, and both new journeys then passed. Root owns the
complete final regression run and its build-bound result record.

## Independent page-turn lifecycle audit

Inspected `src/reader/page-turn.ts`, the checked-in generated vendor source,
`scripts/build-pageflip.mjs`, vendor provenance and
`tests/browser/page-turn-lifecycle.spec.ts`. Executed the generator's read-only
`--check`: **four pinned outputs verified**. It asserts the upstream aggregate
hash, exact package/build-tool versions and patch-anchor counts before comparing
generated bytes. The inspected patches own and cancel the vendor RAF handle,
clear initialization timers, make destruction idempotent, and remove the resize
listener even when mouse/touch handling is disabled.

The lifecycle tests instrument real vendor call stacks in the isolated browser.
They retain actual RAF IDs, timeout IDs and resize-listener identities; they do
not infer cleanup solely from the absence of an overlay. The first two tests
require positive frame allocation, nonzero soft-leaf rotation/clipping in both
directions, visible first-page content after turning back, and zero pending
owned resources through twenty turns at desktop and phone widths. The third
exercises rapid replacement, twenty exits, resize and reduced-motion changes,
with its own positive allocation/cancellation assertion. A fourth checks the
large-book canonical slide, twenty turns and its cancellation paths. Runtime
execution of that separate test file belongs to its owner/root; the designer
reported 3/3 curl tests and 1/1 slide test passing.

The resource audit found a substantive problem: each visual leaf cloned the
entire article, so a bounded projection count did not bound the amount of copied
text/DOM. A 50,000-word actual-app measurement then confirmed large blocking
tasks and retention of the last removed batch. These findings were sent to root
and the designer before final acceptance. Root approved an adaptive correction:
soft curl only for a small source budget; otherwise animate the canonical text
track directly, without copied leaves. The wrapper now clears the removed leaf
root and releases the stopped vendor reference.

## Measured small/large-book behavior

The standalone `.local/large-reader-measure.mjs` creates fresh isolated DEV
notebooks, each with ten authored-order sources, real rich paragraphs and
internal links. Its procedural synthetic volume is explicitly AI-origin and
unverified. It is a performance corpus, not a claim of 50,000 distinct polished
story words. The coherent three-world navigation fixture and its archive hash
were not changed. Three turns were measured per size and viewport.

Environment: headless Chromium 156.0.8078.4, Windows 10 x64, AMD Ryzen 5 2600
(twelve logical CPUs), approximately 32 GiB RAM, CPU throttle rate explicitly 1,
loopback application. Root paused its capture and lifecycle browser work during
measurement. The adaptive run recorded 3.6–14.2% aggregate system CPU across all
twelve logical cores, plus CDP CPU deltas for its own browser processes. System
CPU includes unrelated processes; this is not an idle-machine guarantee.

| Material | Selected motion | Observed first RAF after click, desktop | Phone-sized viewport | Maximum observed long task |
| --- | --- | --- | --- | --- |
| Baseline 50,000 words | Full-source curl | 451–491 ms | 292–395 ms | 486 ms |
| Adaptive 1,000 words | Soft curl | 18–25 ms | 20–26 ms | None ≥50 ms observed |
| Adaptive 3,000 words | Soft curl | 47–58 ms | 24–31 ms | 57 ms |
| Adaptive 5,000 words | Canonical slide | 13–17 ms | 14–24 ms | None ≥50 ms observed |
| Adaptive 10,000 words | Canonical slide | 14–29 ms | 14–24 ms | None ≥50 ms observed |
| Adaptive 50,000 words | Canonical slide | 38–84 ms | 79–90 ms | 109 ms |

The reports retain actual projection-mount, first-RAF and settle times,
long-task/event observations, before/during/after-GC heap and DOM counters,
source-code hashes, and exact core-state hashes. The failed baseline remains
unchanged at `.local/large-reader-measure/report.json`; the separate adaptive
report is `.local/large-reader-measure/adaptive-report.json`.
Root retained copies as [rejected full-source measurement](../evidence/phase1/reader-ux-2026-10-25/failures/full-article-50k.json)
and [adaptive performance measurement](../evidence/phase1/reader-ux-2026-10-25/adaptive-performance.json).

The adaptive run covered thirty turns in ten size/viewport cases. Every case
kept exact documents, revisions, originals, receipts and pending counts; code
hashes remained unchanged during execution. It observed one canonical source,
zero copied leaves for 5k/10k/50k sources, actual canonical WAAPI completion and
zero active animations afterward. Explicit CDP garbage collection was available
and performed. At 50k words, desktop DOM nodes returned to 3,768 versus a 3,764
baseline, and phone-sized nodes to 3,770 versus 3,766. Before the correction,
post-GC counts remained 14,382 versus 3,762 and 11,732 versus 3,764 respectively.
The extra complete source batches are no longer retained in these measurements.

The implemented curl guard is at most 20,000 UTF-16 characters and 600 descendant
elements. The 3k case measured 18,311 characters and 180 elements, supporting a
conservative character cutoff near the measured source. The 600-element guard
is an additional complexity cap; the report does not independently qualify its
maximum with a near-600-element source. Larger/complex sources take the measured
slide path. This is adaptive motion, **not constant-memory full-book curl**.
CDP JS heap excludes substantial native DOM/layout/GPU memory. Three turns per
case and phone-sized desktop Chromium do not establish physical-phone frame
rate, comfort or universal latency guarantees.

After the tablet Atlas CSS correction, a separate final-source 50k check repeated
three turns at each viewport. It preserved the earlier reports and wrote
`.local/large-reader-measure/post-css-report.json` (SHA-256
`9569546c69ae695185de01591e300b28950d55b8567ea7ecf939f27f03f9488b`).
The reading adapter, Reader, App and vendor hashes matched the adaptive run;
the updated CSS hash is `91aa863426ddc86677ee2a88c891fc1499edd5749c9b502ae6ca05b6e4021cd9`.
Those hashes were stable throughout this rerun.

The final-source check measured desktop first RAF at 35.9–84.6 ms and maximum
long task at 72 ms; the phone-sized viewport measured 75.5–89.6 ms and 119 ms.
It observed one canonical source, zero projections, zero active animations
after completion and no page errors. Exact core-state hashes stayed unchanged.
Explicit GC again returned DOM counters to 3,768 versus 3,764 and 3,770 versus
3,766. Aggregate system CPU during the three-turn windows was 9.3% and 8.4%
across twelve logical cores; own browser-process CPU deltas are retained.
These timings remain host-specific observations, and the root-owned canonical
regression and final rendered review remain required before release.

The initial failed fixture trial was corrected by explicitly choosing the start
document after archive restore: IndexedDB returns records by key rather than
the fixture declaration order. A second early assertion incorrectly assumed a
phrase appeared only in a title; Atlas correctly also found a linked mention in
body text. The recovery test now inserts text natively into the existing rich
scene and checks the independent full-text oracle, rather than replacing all
content with Playwright `fill`, which legitimately left a blank final paragraph.
These were corrected test assumptions, not data-loss fixes.

Root owns final rendered visual review, full regression, retained build-bound
evidence and deployment. Physical devices, production Google-account navigation,
durable per-universe return across a browser restart, and a real author's
subjective comfort remain separate acceptance work. No production data was
seeded, read, renamed or changed by this audit.
