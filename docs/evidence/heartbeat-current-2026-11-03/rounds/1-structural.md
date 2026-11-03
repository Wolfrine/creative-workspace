# Three local reader treatments

Status: **unverified alternatives for independent review**. The designer does not approve these studies. Send reviewers only the 15 PNGs in `screens`, identified as A/B/C. This record and the recommendation below are deliberately separate from that blind input.

All three use the actual Noveliaa Reader from the F-drive checkout, the same public `tests/helpers/heartbeat-continuity-fixture.ts`, and its exact seven feeling labels. This is synthetic AI fiction, never canon; no real manuscript or production annotation was read or written. The only changes in this lane are under `PROTOTYPES`. No runtime source edit, commit, push, plugin operation or deployment was made.

Baseline: `6044ccf324a9a2f0aab42e523b63384bedef75f8`, owner rejected. Parent supplied matched baseline images under `../baseline`. Central 0.2.3/base `d097786cf3d6c5a2859439112afdd39538316567` loaded with designer, redesign, emotional-direction and render/QA references. Parent confirmed the designer spawn accepted `gpt-6.1-sol` / `xhigh`.

| Candidate | Actual treatment |
| --- | --- |
| A | Thin colored current 13px left of each prose column. The current runs through paragraph spaces; its width follows source weight, and small ticks mark feeling changes. |
| B | Stitched colored thread at each page's outside edge. Fine repeated cross marks distinguish the field from manuscript highlighting and leave the inner margins blank. Stitch width follows weight. |
| C | Faint hairline with stronger short ticks only at feeling changes. On phones the same actual prose uses native vertical scrolling; the underlined Scroll control switches back to Pages. |

Shared changes: manuscript ink and paper remain plain; seven distinct feeling colors replace reused tone colors in this local study. Exact feeling names remain in the compact key. An accessible `i` trigger replaces the caption row. Progress occupies one horizontal row. Serif body typography remains **20px / 37px (1.85)** at all five sizes. Facing pages remain on desktop.

| Viewport | Baseline footer | All prototype footers | A/B full prose lines | C full prose lines |
| --- | ---: | ---: | ---: | ---: |
| 1366x590 | 76px | 64px | 18 | 18 |
| 1366x768 | 76px | 64px | 28 | 28 |
| 390x700 | 97px | 66px | 12 | 12 |
| 390x844 | 97px | 66px | 16 | 16 |
| 320x568 | 97px | 66px | 8 | 9 |

`geometry.json` retains screenshot SHA-256 values, source fingerprints, page geometry, exact legend labels, rail geometry, native-scroll probes and source equality checks. All 15 captures: zero horizontal overflow, original synthetic source unchanged, no remaining native text highlight paints, and zero page errors. Each run used one intercepted synthetic annotation request. Visual inspection covered desktop, compact laptop, 390px and 320px actual captures. The C phone probes scrolled into later feelings, updated the visible key, and returned to Pages. The local Vite/browser processes were closed after capture.

Designer preference, **not a score or acceptance**: A offers the clearest quiet continuity while keeping the prose dominant. B's repeated stitch is more visible but can resemble a ruler. C is quieter, with easier continuous reading on the smallest phone, but native scrolling naturally exposes a partial next line at the viewport edge. Its page/scroll switch currently returns to the top: if selected, preserve the passage anchor in runtime integration. C's local interpretation buttons use temporary browser alerts; this is an interaction study, not production modal code.

Remaining gates: independent screenshot-only readback and parent selection; implementation with the mapper's whole-document palette; separate weight 1/4/5, explicit rest, dark mode, reduced-motion/page-turn and source-integrity regression tests. The fixed public fixture has weights 2/3 and no explicit rest, so those screenshots cannot establish rest readability. No human emotional response, color-vision acceptance, owner/device acceptance or final visual score is claimed.

Reproduce from the repo after dot-sourcing `.harness/dev-environment.ps1`: `node .local/heartbeat-current/PROTOTYPES/render.mjs`. It opens only an isolated loopback DEV notebook and seeds the existing public synthetic archive helper.
