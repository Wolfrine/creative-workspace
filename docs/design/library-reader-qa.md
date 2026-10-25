# Library and author reader: lead / QA record

Scope and predeclared dimensions: [design contract](LIBRARY_READER.md).
Synthetic fixtures only; no production manuscript was used.

## Cycle 1

Independent critic scored first. Root then personally inspected the 390 px
Library Pages render and 1440 px Collections render from cycle-1. The phone
header/actions/filter stack leaves only about 2.5 page rows visible; compacting
this is the priority. Desktop collections preserve the accepted serif/paper/sage
language, but the editor and catalogue destinations need distinct visible names.
Lead judgment: task 8, prose 8.1, restraint 7.8, responsive 7.2. Full candidate
remains unverified. These are reasoned visual judgments, not human task timing.

Separate QA: actual Chromium capture harness used an isolated 12-page,
four-collection dev notebook. Four screenshots and source fingerprint are in
cycle-1/capture.json. Browser errors and document horizontal overflow checks
passed. Reader fidelity, motion, metadata conflicts and physical-device checks
were not established by this cycle.

## Development-location change

Owner supplied F-drive-only instructions during implementation. All development
was paused, the owned C server stopped, and the complete checkout was copied to
F:/Workspace/Programs/Independent-Products/Noveliaa. All 459 tracked/nonignored
new-file hashes, HEAD and dirty status matched before resuming. The C copy was
retained unchanged for recovery. See the operations migration verification.
New runtime/cache/temp/build/test/report work is on F via the environment helper;
Codex/Windows-managed application state is the stated platform exception.

## Cycle 2

Critic scored first; root inspected 320 px Library Pages and the 390 px rename
dialog. Compact masthead/filters now expose four or more rows, while the
preservation message and current name remain clear. Continue writing and Library
have distinct purposes. Lead judgment: task 8.2, type 8.2, restraint 8.1,
responsive 8.1. No blocker in these observed Library states. Twelve actual
captures cover Pages, Collections, detail and rename at 1440/390/320 px; no
document horizontal overflow or browser errors in the capture report.

## Cycle 3 — required parent checkpoint

After the critic's independent review, root personally inspected 1440 px reader
prose, 320 px reader prose and 390 px appearance panel. Quiet Folio's prose
hierarchy translates to a coherent book spread and a readable single leaf.
Lead: task 8.1, type 8.5, restraint 8.4, responsive 8.2. Current-document contents
selection and source ordinal wording were the next refinements, not grounds to
replace the accepted direction. The nine captures have matching UI source
fingerprints before/after rendering. Motion was not inferred from these stills.

Separate QA: four actual Chromium stress tests passed, including offline phrase
and Hindi retrieval among 150 notes, bounded sidebar inventory, and exact rich
text/provenance across 1440/390/320 px. Every non-whitespace code point in the
long mixed-language fixture was independently checked with DOM Range fragments
for a reachable column and unclipped bounds. Odd final spreads, empty paragraphs,
list numbering, hard breaks, indentation and long unbroken code text passed.
Turning through the entire reading preserved all document/revision/original and
receipt state. This is automated evidence, not H02/H08 human acceptance.

## Cycle 4

Critic independently reviewed all 20 short-height, contents, appearance and
night/28 px/wide-margin stills. Root then inspected the 320 px night/large-text
screen and the mobile recording contact sheet. Current contents selection and
WRITING ordinal resolve the prior navigation ambiguities. Lead observed-state
judgment: task 8.3, type 8.4, restraint 8.4, responsive 8.2. No still-layout blocker.
The contact sheet spans the actual full UI flow; it is not 25 separate turn
frames or proof of human-perceived smoothness. Actual WebM files are retained.

Separate QA: ten actual Auth/Firestore emulator browser tests passed. A positive
control observed 12 seed write RPCs; the reader sequence observed zero write
RPCs, and all nine workspace namespaces were byte/record equivalent before and
after reading. Rename adopted on another isolated device; unrelated stale
uploads retained the new name. No production manuscript was scanned or seeded.
Final keyboard/link/navigation recovery checks remain for cycle 5.

## Cycle 5 — required parent checkpoint and final candidate

Critic sent its independent scores first: task 8.4, type 8.5, restraint 8.4,
responsive 8.3, overall 8.4. Root then personally inspected all 33 actual final
renders at 1440x1000, 390x844 and 320x844, covering Library Pages/Collections,
detail, rename, prose, next, contents, appearance, night, return to writing and
empty Library. UI fingerprint is
`638d2859b83cae6f226590fdea923b6195b0865360e8b009c1588d7badde2137`.
Two-line narrow titles preserve useful identity; collection detail avoids
repeating membership metadata. The current contents marker, WRITING ordinal,
paper/night hierarchy and compact controls keep actual prose dominant. Empty
Library and rename fit both phones; returning to writing retains Quiet Folio.

Lead visual judgment: task 8.4, type 8.5, restraint 8.5, responsive 8.3, overall
8.4. No observed visual blocker. This is agent review, not owner acceptance or
measured reading comfort. Accepted Living Atlas/Quiet Folio prototype images and
the preceding quiet-writing runtime capture were personally inspected as the
three retained task-matched comparisons.

Root also inspected the desktop/mobile before/transition/settled frames in
`motion/`, alongside actual elapsed times and computed animation transforms.
The observed effect is a restrained transient leaf/shadow, not a full physical
page curl. Desktop sampling overhead exceeds requested frame intervals; these
are not a fixed-rate performance measurement. Reduced-motion checks suppress
the leaf. The independent critic additionally interacted with the final actual
reader in a separate browser using synthetic prose.

Root then directly used the final app in its own isolated synthetic notebook:
filled 18 numbered mixed English/Hindi paragraphs, opened the 1440x1000 reader,
turned to the next spread, resized to 390x568 while retaining the passage, and
returned to the writer. The eighteenth paragraph was still present; no browser
warning/error was reported. The temporary viewport override was reset and the
owned local QA tab closed. This interaction confirms the observed UI path,
not physical-phone touch or sustained reading comfort.

Separate final QA: 89 client, 15 actual Rules, 10 Auth/Firestore browser and 35
writing/browser tests passed; 26 evidence evaluations and 20/20 forced Chromium
crash recoveries passed. Keyboard offscreen links, available/off-book and
unavailable links, focus trapping, local-only navigation recovery, selected
collection creation, exact rich-text coverage and byte-preserved source state
are covered. Final cloud runs retained eight source hashes unchanged. Canonical
reports, positive-control zero-write RPC evidence and full source/build binding
are retained with this candidate. No production manuscript was accessed.

Physical-phone keyboards/IME, Safari, manual screen-reader experience and the
author's production writing session remain outside this browser acceptance.
