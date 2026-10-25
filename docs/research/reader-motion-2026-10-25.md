# Book turns and populated navigation

Inspected online on 25 October 2026 for the owner's rejection of Noveliaa's
previous page-change effect. The overall Living Atlas / Quiet Folio direction
is retained. These references inform interaction; they do not establish that a
web implementation duplicates the current native Kindle or Play Books engine.

## What the references actually support

- [Amazon's Colorsoft user guide](https://d1ergij2b6wmg5.cloudfront.net/kug/kindle_colorsoft/v1/en-US/html/kug.html)
  documents forward/back tap zones and swipes, and optional page-turn animation
  for directional feedback. It does not promise a physically simulated curl.
- [Amazon's Kindle app guide](https://www.aboutamazon.com/news/devices/kindle-app-guide)
  shows a content-led Library, resume reading, and in-book appearance controls.
  Keep retrieval, reading and writing as clear contexts rather than repeating
  every command everywhere.
- [Google's 2012 Android announcement](https://android.googleblog.com/2012/09/turning-page-with-new-google-play-books.html)
  explicitly offered a 2D sliding turn. This is historical evidence that more
  than one turn mechanism can be legitimate, not a claim about the current app.
- The [current Play Books listing](https://play.google.com/store/apps/details?id=com.google.android.apps.books&hl=en)
  was opened and its actual screenshots inspected. Shelves and books lead the
  Library. Static store images cannot prove the quality of a moving transition.
- The historical [Play Books turning recording](https://www.youtube.com/watch?v=gOJ15ysPsRo)
  was played and sampled at actual video times. The 11 s frame shows a finger
  moving a text-bearing leaf across the gutter while the next leaf is revealed.
  Text, reverse-side translucency and fold shadow move together. The 8/14 s
  samples show settled spreads. This short old recording is an independent
  visual reference, not Google implementation documentation.
- A [2020 Kindle animation tutorial](https://www.youtube.com/watch?v=eiVw4DBM7jo)
  was inspected at 25/40/55 s for Library/appearance context. No useful actual
  Kindle turn was captured; it is not used to claim a particular curl geometry.
- The primary [StPageFlip demo](https://nodlik.github.io/StPageFlip/) and
  [MIT source](https://github.com/Nodlik/StPageFlip) demonstrate HTML soft-page
  folding. Its actual moving demo was inspected. The pinned npm release 2.0.7
  is old; adoption is conditional on our own lifecycle and fidelity checks.

## Chosen behavior and rejected alternatives

Three working studies used the same meaningful, explicitly synthetic unverified
fiction at desktop and phone sizes: a continuous content slide, a soft
text-bearing fold, and a vertical paper stack. Independent critic inspected
first; parent personally inspected all six intermediate images. The soft leaf
is selected because outgoing text, fold and arriving page belong to one motion.
The slide is coherent but moves the whole spread like a carousel. The stack
produces doubled ghost text and is rejected. The previous blank gradient strip
with an immediate underlying text jump is rejected.

Keep one canonical, selectable semantic article at rest. Only current and next
leaf projections participate in a transient turn; do not clone an entire book
per page. Respect reduced motion and animation off. Cancellation, reverse,
rapid turns, resize, typography changes, odd last leaves, keyboard and links
must preserve the destination and exact source. Engine RAF, timers and resize
handlers must stop after disposal; visual quality cannot excuse a resource leak.

The first integrated curl exposed two failures missed by its initial passing
cleanup test: portrait backward movement was rejected by the engine's click
corner guard, and a 50,000-word collection incurred roughly 0.4–0.5 s main-thread
tasks when four complete articles were cloned. A completed cleanup closure also
retained its last detached projections. These are recorded failed candidates,
not accepted performance. The design response is adaptive: use a bounded soft
fold for smaller/simple reading sources and a compositor-driven slide of the
single canonical article for large/complex sources. No arbitrary-length book
is copied to animate a turn. The existing animation option applies to both;
reduced motion and animation off remain direct changes. Final measurements
and the actual cutoff belong to the retained candidate, not a universal mobile
performance claim.

## Evaluation material and limits

Use 3 distinct universes, 12 collections and 24 varied sources: scenes, small
Inbox fragments, notes about people/places/rules, Hindi/Unicode, exact-byte
synthetic imports, linked Atlas entries, empty collections and same titles in
different worlds. Generated prose remains AI-origin and unverified. No sample
is inserted into the production author's account.

Exercise discovery, open, move, rename, return, cross-universe isolation, Atlas
selection/backlinks and source-preserving reader return. Tile, List and Detailed
must share search and actions, with visibly useful differences in density and
preview depth. Layout preferences and page turns stay local; the existing
10-second local / 60-second cloud trailing-idle contract is unchanged.

Retained reference capture reports record actual elapsed/video times, including
failed seeks. Screenshot calls are not a fixed-frame-rate recording. A seek to
22 s failed because the Google clip is only 19.41 s; a Kindle seek to 70 s timed
out. Neither failed seek is presented as inspected motion. Browser viewport
and emulator evidence do not establish physical-phone, native-app equivalence,
human comfort or owner acceptance.
