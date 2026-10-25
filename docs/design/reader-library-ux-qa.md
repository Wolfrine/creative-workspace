# Lead QA: populated Library and reader turns

Scope: the 25 October owner feedback about odd reader motion, useful Library
display icons, and actual populated navigation. Living Atlas and Quiet Folio
stay; private author reading only. Collections stay flat. The existing local
10 s / cloud 60 s trailing-idle writing behavior is outside this change.

## Evidence and role boundary

The designer implements, the independent critic scores rendered states first,
and the lead separately inspects the evidence and runs release checks. Current
Central design guidance is 0.1.0 at base
`ba1235fe7b220842778414f3f70fca38e7df4c53`. Browser-control transport was
unavailable; actual Chromium interaction, screenshots and WebM recordings from
the repository harness are used. No native-phone or owner acceptance is inferred.

The reusable corpus is `tests/helpers/populated-workspace.ts`: three distinct
universes, twelve collections, twenty-four documents including one trashed,
rich prose, short Inbox fragments, same-named cross-world groups, Hindi,
links/backlinks, and two exact-byte synthetic originals. Generated writing is
AI-origin and unverified. The archive SHA is
`194f57715a1a93e4c1a98d107067efd82ee29c242315a0daac4f33230f861d42`.
This is realistic evaluation structure, not real owner writing or canon.

## Actual lead inspections before the final candidate

- Online references and the three studies: personally inspected the historical
  Play Books 11 s content-bearing finger turn, settled spreads, Kindle
  Library/appearance context, the working StPageFlip fold, and all six desktop /
  mobile study intermediate images after critic scoring. B soft leaf was chosen;
  C's ghosted overlapping text was rejected. Reference limitations are in the
  [research record](../research/reader-motion-2026-10-25.md).
- Cycle 1: desktop List, phone Tile and Detailed. Agreed with critic that Tile
  wasted space and Detailed preview depth was insufficient. The partial mobile
  capture failed after assuming quick navigation stayed visible during focused
  writing; its original bytes and failure explanation remain retained.
- Cycle 2: phone Tile, Detailed and populated Atlas. Confirmed useful compactness,
  three-line excerpts, provenance and the universe label. The capture script
  raced an automatically closing universe drawer; this is recorded as an
  incomplete run. A separate lifecycle test exposed the real missing first
  animation: the engine clock had not initialized. This round is rejected.
- Cycle 3 checkpoint after independent scores: personally inspected the 320 px
  Tile, mobile backward intermediate image and desktop forward fold. Confirmed
  the clipped card and stationary old mobile leaf. Forward content-bearing
  geometry improved, but the candidate is rejected. Its passing disposal tests
  did not prove that a backward turn actually moved. Expanded tests now require
  actual rotated/clipped geometry and the settled visible first source.
- The independent 50,000-word benchmark then exposed long tasks and one retained
  completed batch of full-article projections. It is retained as a failed
  performance candidate. The design response is bounded curl plus a single
  canonical-article slide for larger/complex books; follow-up measurements,
  complete responsive captures and final scores are required before release.

## Release gate

Final runtime identity is
`488155fe8ec9c3bbdd0ea7d372dfb7f7762adeccf582319389dcd1b77ab65668`.
After the critic's final scores, the lead personally viewed List at 1440,
Tile at 320, Detailed at 390, Atlas at 768, night reader at 390, contents at
320, and the complete sampled sequences from both exact final soft-leaf and
both large-source slide recordings. Both directions settle correctly; titles,
previews and controls fit. The agent lead scores task/context 8.3, prose/motion
8.2, hierarchy 8.2, responsive/access 8.2, overall 8.2. These are separate from
the critic's 8.2 overall and do not assert author acceptance or measured human
attention/comfort.

Cycle 4 and the final cycle each contain 52 actual states across 1440/768/390/
320, including night/single-page and contents. The independent critic's separate
navigation run passed 15 checks at desktop and both phone widths with 21
screenshots. A late tablet Atlas intrinsic-width failure is retained under
`failures/`; the corrected final source fits its map, index and preview.

The character cutoff is 20,000 UTF-16 code units; the complexity guard is 600
descendant elements. Actual near-character-limit curl (18,311 characters)
reached its first RAF in 24–58 ms on this host. Final post-Atlas-CSS 50k-word
slides reached first RAF in 36–85 ms desktop and 76–90 ms phone-sized; the largest
observed long task was 119 ms, versus roughly 443–486 ms before the correction.
Slides created zero projection leaves, and post-GC DOM counts returned within
four nodes of the starting count. One canonical semantic article and exact
documents/revisions/originals/receipts/pending state remained intact. These are
controlled desktop Chromium measurements, not physical mobile/GPU guarantees.
The 600-element guard is functionally tested independently of character length;
its exact upper-edge timing is not separately characterized.

The measured script is retained byte-identically as
`scripts/measure-reader-volume.mjs`; use `npm run profile:reader-volume --
new-run 1000,3000,5000,10000,50000` from the F checkout with the DEV server on
5817 and no competing browser benchmark. Results go to `.local`, never frozen
evidence. The independent navigation reproducer is
`scripts/check-populated-navigation.mjs`. All scripts use synthetic isolated
notebooks and do not authenticate to production.

The complete local browser regression passed 53/53, the client suite passed
89, 15 actual Firestore Rules checks passed, and 20/20 acknowledged device
checkpoints survived browser crashes. The actual import/edit archive projection
also passed the independent originals/revision/saved-text oracle; the evidence
checker suite passed 26 checks. The first extended cloud no-write test assumed
Pages while the new navigation correctly preserved Collections; its failed
report is retained. The test now explicitly selects Pages before searching;
this correction does not change the application.

Authenticated cloud regression passed 10/10 after correcting that test context.
The real emulator inventory and observed RPCs show zero writes for changing
Library layout/search, entering Read, turning pages and changing appearance.
The original/revision/server inventory remains identical. Expected transport
warnings occur during deliberately offline-device cases.

Bind final source/renders/test outputs, then deliver directly from `main`
through the existing Firebase GitHub Action and verify the
matching `noveliaa.web.app` build. A deployed sign-in screen and matching assets
prove hosted delivery; authenticated app behavior is tested with isolated
synthetic accounts, without accessing the owner's manuscript.
