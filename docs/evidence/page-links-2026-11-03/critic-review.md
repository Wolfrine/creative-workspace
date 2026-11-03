# Independent page-link visual review — 3 November 2026

**Verdict:** visual pass for this bounded refinement, 8.5/10 overall; no remaining visual blocker in the inspected states. This is an independent agent judgment, not owner acceptance, release acceptance or proof of stable-link correctness.

Reviewer: `page_link_visual_review`, read-only implementation lane. Only this report was written. Read repository AGENTS/INTENT/objective, Library/Reader contract, Central Visual Design Director + critic/redesign guides and UI Visual Verifier. Verified Central **0.2.3**, base `d097786cf3d6c5a2859439112afdd39538316567` from release metadata. Baseline source: `3637a2c6e3b52c25edfbe0b6a1a84bf08c19b84f`; candidate is the parent's working tree on that base.

## Evidence actually viewed

- All 12 matched PNGs: `before/` and `after/`, each containing `1440-writing.png`, `1440-reader.png`, `390-writing.png`, `390-reader.png`, `320-writing.png`, `320-reader.png`. Viewports: 1440×1000, 390×844, 320×568. These show explicitly synthetic evaluation prose.
- Final follow-up: personally re-viewed all 15 final `after/` PNGs, comprising those six ordinary states plus `{1440,390,320}-writing-link-focus.png`, `-reader-link-copied.png` and `-copy-fallback.png`. The final captures preserve the same prose layout and control placement; focus outlines, copied checkmarks and padded fallback bodies fit at every width.
- Independently opened Chromium through Playwright at `http://127.0.0.1:5817/?local=1&notebook=critic-page-link-*`, seeded only the DEV-only test engine, and opened Writing and Reader at all three sizes. The app exposed the corresponding `/u/<synthetic-universe>/the-tide-notebooks/the-room-above-the-sea/<synthetic-page>` route. No production writing was accessed.
- Personally viewed live header screenshots with keyboard focus at all three sizes, 390 Reader copy confirmation, 320 Writing, and the 320 Reader clipboard-denied fallback before and after the correction. Live screenshots were returned directly to the review tool, not saved as report files.
- Copied URLs used `https://noveliaa.web.app/u/...` without local preview query parameters. The accessible confirmation was exactly **“Page link copied. Access remains private.”** Actual screen-reader announcement was not tested.
- Narrow live follow-up after the final accessibility change: the empty confirmation span has `aria-live="polite"` and no `role`; after keyboard copy it has `role="status"`, retains `aria-live="polite"`, and contains the exact confirmation above. The 320 Writing surface still has zero horizontal overflow. This verifies the DOM transition, not an assistive-technology announcement.
- Final LF follow-up: personally viewed regenerated `after/320-writing.png` and `after/320-copy-fallback.png`; no visual change observed. The source normalization check below proves that the three reviewed files changed only from CRLF to LF. The visual pass is retained.

## Delta judgment

| Critical attribute | Delta | Score | Observed evidence / loss |
|---|---|---:|---|
| Link discoverability | Better | 8 | A small chain icon is present in both destination headers at every width; accessible name and initial title are “Copy page link.” Icon-only presentation stays quiet; first-time touch discovery has not been measured. |
| Prose dominance | Unchanged | 9 | Matched captures retain the title scale, paragraph rhythm, line wrapping and large reading surface. At 320 the page title still has the same two-line wrap. The action adds no toolbar row or prose displacement. |
| Controls fit and keyboard access | Unchanged | 8.5 | Zero document horizontal overflow measured in Writing and Reader at all three widths. Writing copy target: 31×31 desktop, 38×44 at 390, 34×44 at 320; Reader: 34×34. All existing adjacent actions remain. Tab shows a visible sage focus outline; Enter copies and changes chain to check. Reader targets remain compact like their neighbors; physical touch comfort is unverified. |
| Quiet Folio identity | Unchanged | 9 | Cream paper, sage chrome, serif manuscript text and reading margins remain recognisable. No added card, banner, saturated accent or change of visual language. The basic Heartbeat control remains in place. |
| Narrow collection-name visibility | Worse, minor | 8 | The 320 picker abbreviates “The tide notebooks” earlier to make room for the fifth action. The full page title and writing remain visible; this is the only observed ordinary-state loss. |
| Clipboard-denied fallback | Better after correction | 8.5 | Initial body text/input touched the dialog edge. Final body uses 22px side inset; a 240px field fits inside the 286px dialog at x17 on the 320 viewport. Focus ring has breathing room, body copy wraps cleanly, no horizontal overflow. Input is focused/selected; Escape closes and restores Copy focus. |
| Nonempty Heartbeat rail, motion and device comfort | Unverified | — | The fixtures used here do not establish annotated-rail behavior, motion quality, physical-phone ergonomics or author comfort. |

**Highest-priority finding resolved:** the fallback's missing body inset. No further visual correction is required for the reviewed subset. Retain type, color, prose composition and navigation; the local modal-spacing refinement is sufficient.

Generic-risk assessment: (1) icon-only utility action is justified by the requested small action and established header pattern; (2) serif/paper styling is justified by the incumbent Quiet Folio identity rather than a new decorative template; (3) the modal exists only for real clipboard failure, and its formerly edge-bound content is now corrected. The strongest gap against the incumbent is the earlier 320 collection-name truncation; it does not displace the primary writing object.

Final viewed-source statement: `CopyPageLink.tsx` assigns `role="status"` only while copied, as verified in source and a narrow live check. All 15 candidate captures were viewed after that correction. The parent then normalized source to LF without changing semantics. I independently reconstructed CRLF from each current LF file in memory and obtained an **exact match to its previously reviewed SHA-256**, proving newline-only differences for all three files. None of the current files contains CR characters. I then viewed the final narrow writing/fallback captures and retained the 8.5/10 pass.

Canonical final LF candidate SHA-256:

- `src/components/CopyPageLink.tsx`: `BF667F27E4785A04F0CA95C63D1CB46CDA84D40E50F0C5AC12A63694EE7ED183`
- `src/components/Reader.tsx`: `6FD85F0B197646E076B95F652CA2540D5472439BFC1F7A0A11514E05F30B3A90`
- `src/styles.css`: `D8BCB5F0AB4AD5C3AA39E3AAF84D9A5083BA208E191AECA9782EB84237A2A61E`

Historical reviewed CRLF SHA-256, each exactly reproduced from the corresponding canonical LF file:

- `src/components/CopyPageLink.tsx`: `3D633FABF2C95863F77459590EA8AE5F88CC48BF481E1D5CB820C1EF876AFB9C`
- `src/components/Reader.tsx`: `A5D1CB14F4F71E0191B9B248D58554EAC5929CF4B80EF640DC529645C49F57A2`
- `src/styles.css`: `C6AD696956C1EF67C896F845616B6C92CB9A7FE89A6A31BBE57BBFED652F456D`

The parent retains technical QA, stable-link/auth verification, evidence retention, hosted verification and release decisions. Long-title/collection combinations beyond this fixture, night appearance, nonempty annotations, motion, screen readers, physical phones and owner acceptance remain outside this visual pass.
