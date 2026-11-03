# Emotional Heartbeat rework acceptance — 3 November 2026

Owner rejected 73b8455. This is a new agent-reviewed candidate, not owner acceptance. Same verified F-drive checkout and native parent, main only. The bridge EPERM was infrastructure failure; no bridge records were edited or duplicated.

## Scope and chosen structure

Central visual-design-director 0.2.3, verified base d097786cf3d6c5a2859439112afdd39538316567. Read redesign, emotional-direction and render-and-QA guidance. Three independently rendered structures (compact spread, flowing folio, margin current) were compared at the same 20px/1.85 typography. Compact spread protects the accepted cream/sage/serif book and wins desktop capacity. The unavailable dark cozy phone study was treated only as the owner's described mood hypothesis; no claim that we viewed it, no image copied into the product.

Current target: calm focus with a perceptible emotional current. Compact title, larger book, stable key below the source, retained collection identity/navigation/bookmarks/appearance, optional writer/reader toggle. Foreground labels map to visible colors; undertone, trajectory, weight, reasoning and attribution require explicit interaction. No embedded chat, source mutation, canon promotion or public edition.

## Independent work and evidence

Same native parent integrated backend continuity, UI, generation skill, emulator/browser QA and delivery. Narrow native children: heartbeat_continuity (seven backend/model/hook files), heartbeat_redesign (owned UI/test files), heartbeat_rework_critic (read-only independent browser critique and evidence), blind_reading_one and blind_reading_two (raw real prose only; no previous labels, product goals, tools or outside context). Every child spawn explicitly requested gpt-6.1-sol/xhigh and the platform accepted those settings. No separate effective-runtime model introspection was available. No bridge recursion or other-workspace edits.

The two blind LLM readings converge on anticipation/ease, remembered attachment, friendship opening possibility, restricted access, renewed restrained eagerness, further letdown and modest payoff. This is AI interpretation, not measured readers' responses or established author intent. Exact private revision/hash and structural checks are summarized in proposal-quality.json; raw text and proposed quotes remain ignored/private. Public renders use an invented four-paragraph counterpart (1617 UTF-16 characters), not the author's 1704-character original. Fixture counts and screen metrics therefore describe the public synthetic comparison.

## Measured comparison

Same source, CSS viewport, DPR1/zoom1, 20px type and 1.85 leading. Paragraph-only lines count actual visible manuscript lines, excluding heading/metadata. Area sums visible text Range rectangles, not a bounding box of the whole book. Before: 1366×768 =20 lines/27.7%/554px book;390×844 =10/27.1%/659px;320×568 =4/16.8%/383px. Final:

|CSS viewport|Paragraph lines|Text rectangle area|Book height|Header / footer|Horizontal overflow|
|---|---:|---:|---:|---:|---:|
|1366×768|28|39.1%|625px|54px / 76px|0|
|390×844|15|42.4%|701px|46px / 97px|0|
|320×568|8|32.8%|425px|46px / 97px|0|

These are first-screen capacities, not an average over all pages. The owner's screen resolution is not necessarily the CSS viewport: a separate 1366×590 usable-height render is retained. A denser 1.75 study gained one line desktop/390 and none at320; it was rejected because it looked busier. The default remains1.85 and existing appearance control remains available.

## Actual visual review

Six implementation rounds R2–R7 follow the three-alternative comparison. Independent critic inspected actual desktop/mobile resting, next-page, night, writer, selected reasoning, explicit rest, sparse/stale and unsupported-browser renders, plus sampled native curl/reduced/large-slide frames and recordings. Parent personally inspected R3, R5 and final R6/R7 desktop/390/320, phone moving faces, night, writer, fallback and detail frames. Final critic scores and frozen hashes are in critic/verdict-round7-final.json; parent scores are in final-review.json. Every critical dimension is at least8/10. This is separate from owner comfort, physical devices and signed-in production acceptance.

## Failures found and repaired

- Page-dependent key height could repeat source text at offset1196 on320. Stable per-mode geometry repaired it; exact per-character traversal remains enforced.
- PageFlip reparenting collapsed projected ranges; portrait curl added another temporary clone. Register ranges after final DOM structure and cover every active clone. Actual moving phone frames now retain their fields; inert/aria-hidden projections clean on turn, off, stale, resize and exit.
- ResizeObserver title writes caused loop notifications; RAF batching/cancellation removed them in later independent captures.
- First complete93-test run:88 pass/5 fail. Existing fragmented-rich-text oracle found22 heading glyphs3px above the clip boundary on1440/320. The compact heading line box now contains its actual glyph ink. Collection identity was also restored exactly; optional inline chapter text failed two original context assertions and was removed. No original oracle, security check or assertion was weakened. Negative attempt evidence is retained separately.
- Backend emulator startup attempts hit a startup timeout and a shared logging-port collision. The successful isolated local config used loopback Auth19099/Firestore18080/hub14400/log14450; Actions retains its clean-runner config. These are infrastructure attempts, not hidden passing tests. Cloud offline/reconnect cases deliberately emit transport warnings; native exit and all11 results pass.

## Checks

- Client:98 passed;16 Rules cases intentionally skipped outside emulator, separately16/16 pass.
- Functions:37 passed/1 integration case skipped outside emulator; actual Auth/Firestore/OAuth MCP HTTP integration18/18, zero skipped.
- Complete browser:93/93, zero failed/flaky/skipped. Includes exact rich text and every fragmented character, page turns/bookmarks/appearance, editor selection/edit staleness, all seven tint families' paper/night contrast, keyboard/modal focus, axe, unsupported API, long/mixed/empty/sparse/malformed annotations, native clone range text and cleanup.
- Authenticated emulator browser:11/11, including actual MCP write/read/revocation and unchanged manuscript inventory.
- Evidence regression:26/26. Typecheck, build, Functions syntax check, plugin package schema/byte integrity and git diff checks pass. Detailed logs and result JSON are retained; the evidence verifier binds current source bytes and preserves both older historical manifests.

## Security, cost and remaining limits

Continuity is derived from valid ordered exact spans over an immutable revision/hash, server-side and independently on the client. Structural completeness is not a guarantee of literary correctness. Quiet factual text can hold a supplied feeling; explicit neutral+quiet means rest. Missing/invalid coverage does not invent a feeling: all colors stay hidden with a regenerate prompt. Original annotations/receipts remain append-only; historical receipts replay unchanged. Owner/workspace/universe/grant, stale/hash, race, replay and revocation tests remain intact. No production admin SDK use, manuscript edits, IAM/billing changes or added Firestore polling/listeners. A local passive scroll listener only updates the visible writer key without another annotation request.

Hosted public-shell/discovery verification and the optional single OAuth annotation example are post-deployment checks, reported with the exact commit/Actions links. This pre-release artifact does not claim a live deployment. Real author interpretation/comfort, physical phone/IME and signed-in production UI remain distinct acceptance. Browser-native Highlight absence is explicitly disclosed; labels/details remain usable. Existing size/quote/beat bounds and the newest50 exact-revision read bound remain unchanged.

## Hosted-runner probe repair before production

The first deployment run for5b98302 stopped before publication:92 browser tests passed, but the320 motion probe found no active projection. The same commit's independent Phase1 workflow passed all93. The downloaded CI trace showed cancellation within55ms, not expiry of the460/750ms animation. A controlled font-release reproduction recorded Reader.measure calling stopMotion14.8ms after start while initial geometry was still settling. This is the existing defensive cancellation on layout change; the landed page retained its field and source.

The test now waits for measured geometry after fonts settle and captures/turns off the actual moving projection within one renderer callback. All exact range, source immutability, every-clone coverage, inert/bounded and cleanup checks remain. Runtime UI bytes are unchanged from the final independently reviewed captures. The changed probe is stress checked and the complete93 suite is rerun before this candidate is recorded. Failure excerpt and diagnostic are retained; no pipeline gate or assertion was bypassed.

