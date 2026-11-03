# R6 frozen synthetic reader evidence

Implementation and capture handoff only. Independent QA, visual critique and owner acceptance remain separate. No designer scores or acceptance claim.

The public seven-region continuity fixture was seeded into isolated loopback DEV notebooks. No real manuscript, live annotation, cloud account, plugin or MCP submission was read or changed. Browser/server lifecycle was isolated on Vite 5853 and closed in the capture helper. All new work is under F:.

## Focus of this pass

- Reader key labels are 14px. Desktop uses 28px beside-label samples; mobile uses 24px samples above exact names in a 26px band, with the AI interpretation caption in the existing 44px control row.
- Mobile footer is a constant 70px; desktop 66px. The writer retains its existing 13px strip labels and 31px narrow strip. No R6 Writer.tsx edit.
- The opt-in reader fit uses a bounded hidden/inert DOM ruler, one ResizeObserver and font-ready remeasure. Actual label/sample/gap widths reserve the Unanalysed and All feelings actions. Full-document feeling identities/colors remain unchanged.
- Existing visible Range geometry ranks preview labels only when overflow occurs. Source labels, emotional weights and annotation beats are unchanged.
- Scoped dark Heartbeat/source-dialog active controls use the reader ink. Actual night close contrast is 11.116867:1, over the actual rgb(36,43,39) dialog paper.

## Structural study and tradeoff

R6 compared actual reader DOM/CSS studies against frozen R5. The parent and independent critic chose mobile samples above labels. Both observed two-name pairs fit fully at 14px, including Disappointment + Tempered eagerness. The reviewed beside-label option could not fit the latter pair in 284px without hiding a meaning.

At the final native end state three currents are visible. The inline preview deliberately shows Frustration and Quiet reward, followed by the explicit All feelings action. Tempered eagerness is available in the full document key. This is a partial preview with a full-key fallback; it is not a claim that all three meanings are inline. All seven document labels appear without ellipses in the explicit full-key capture. Native arbitrary scroll offsets can intersect a line at the viewport edge; the entire source remains reachable and the opening has ten complete lines without a stray next-line glyph.

## Main geometry

All reader prose is 20px with 37px line height (1.85); no horizontal overflow. Every measured footer button is inside the footer and viewport. Pages remains 44px high. All five main states have the exact seven-beat source partition, continuous paths and at least three stable ready frames.

| Viewport | Mode | Complete prose lines | Prose width | Footer | Expected actual paths |
|---|---|---:|---:|---:|---:|
| 1366×590 | pages | 19 | 533px | 66px | 10 |
| 1366×768 | pages | 28 | 533px | 66px | 8 |
| 390×700 | scroll | 13 | 350px | 70px | 7 |
| 390×844 | pages | 17 | 350px | 70px | 8 |
| 320×568 | scroll | 10 | 288px | 70px | 7 |

Matched writer OFF/ON/focused captures show 7/6/7 complete lines, at 18px/33.3px, with initial text start 300px. The large initial header/title space is inherited; no editor-header redesign was made. Focused capture retains the real editing caret and selection. The reader's genuine 2px green keyboard focus remains unchanged and was probed rather than suppressed.

## Verification

- npm run typecheck and git diff --check passed before parent normalization. Parent then froze canonical LF source and coordinates final build/typecheck separately; their outcome is not claimed here.
- 14 ready screenshots were captured and personally inspected. No browser errors. All 11 capture checks passed.
- Minimum actual SVG sample contrast: 3.155840:1. Minimum measured text-label contrast: 5.351858:1. Minimum active interactive SVG paint contrast: 3.155840:1. The icon guard includes active close/refresh controls and actual opacity; disabled controls are excluded.
- 54 source/fixture SHA256 entries match before/after and at release. Every screenshot byte matches the immutable manifest. Full individual hashes are in source-fingerprints.json and geometry.json.
- Source-set SHA256 before and after: 2afa0744de8f8a06aa59ab563c24369e49a38c779c765106fb7d8b03a9d5756e.

- PASS: Exact scroll anchor survives Heartbeat toggle and Scroll-Pages-Scroll
- PASS: Exact scroll anchor survives width/height reflow
- PASS: Exact anchor survives 20-to-22-to-20 font reflow
- PASS: PageDown scrolls native text and updates bookmark
- PASS: Native keyboard focus remains visible
- PASS: Native 320 multicolor state
- PASS: Both actual mid currents have exact visible feeling names
- PASS: End preview includes the long visible Quiet reward current and explicit full key
- PASS: Matched writer OFF/ON/focused source, revisions and originals unchanged
- PASS: Actual dark guide dialog theme/contrast
- PASS: Actual dark provenance dialog theme/contrast

## Evidence inventory

- reader-on-1366x590.png
- reader-on-1366x768.png
- reader-on-390x700.png
- reader-on-390x844.png
- reader-on-320x568.png
- night-detail-390x844.png
- rest-320x568.png
- sparse-320x568.png
- reader-mid-multicolor-320x568.png
- reader-end-multicolor-320x568.png
- reader-full-key-320x568.png
- writer-initial-off-320x568.png
- writer-initial-on-320x568.png
- writer-focused-on-320x568.png

The five focused preceding passes remain distinct: R1 structural, R2 initial runtime, R3 key/navigation, R4 line key, R5 night/a11y/narrow flow. R6 addresses convergent visible key-width feedback and the measured night icon contrast failure. Study re-captures do not count as additional accepted improvements.

No commits, push, deploy, production data writes or plugin operations were performed. Runtime and frozen PNGs remain held for parent independent review/QA.
