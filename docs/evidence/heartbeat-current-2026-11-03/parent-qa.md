# Emotional Heartbeat: margin-current iteration

Owner-rejected baseline: `6044ccf`. This second visual iteration uses the same F-drive main checkout. The owner’s external blind scores supersede the earlier internal ≥8 claims. The existing real seven-region annotation, immutable manuscript/revision, OAuth/MCP contract and private plugin `0.1.2` are preserved. No production manuscript or annotation was read, regenerated or written in this iteration.

## Result and evidence boundary

A narrow continuous rail replaces every prose fill. Manuscript ink remains plain. Matching line samples name feelings below the passage: 28px beside desktop labels, 24px above mobile labels. Reader labels are 14px. Reasoning, undertone, weight, exact revision and self-reported provider/model remain on demand. OFF removes canonical and moving-page cues. Rest is dashed; incomplete or unfetched writing is explicitly dotted Unanalysed. Full-document palette allocation fixes different foregrounds sharing an indistinguishable color and prevents page-turn palette drift.

All new renders use the public synthetic four-paragraph counterpart, not The Grand Opening. Reader body type remains 20px serif with 37px leading. Automatic native scrolling on short or narrow phones avoids seven tiny pages; explicit Pages, appearance, contents, selection, keyboard navigation and exact-passage bookmarks remain. No Firestore polling or listener was added.

## Measured comparison

| Viewport | Full visible prose lines | Book height | Footer | Final layout |
| --- | ---: | ---: | ---: | --- |
| [1366x590](final/reader-on-1366x590.png) | 18 → 19 | 447 → 457px | 76 → 66px | pages |
| [1366x768](final/reader-on-1366x768.png) | 28 → 28 | 625 → 635px | 76 → 66px | pages |
| [390x700](final/reader-on-390x700.png) | 11 → 13 | 557 → 584px | 97 → 70px | scroll |
| [390x844](final/reader-on-390x844.png) | 15 → 17 | 701 → 728px | 97 → 70px | pages |
| [320x568](final/reader-on-320x568.png) | 8 → 10 | 425 → 452px | 97 → 70px | scroll |

All final main views have zero horizontal overflow and unchanged source. Measurements use actual rendered glyph bounds. The owner-referenced 1366x768 and 390x844 baseline PNGs match fresh baseline hashes exactly. The old 320px image differs in bytes but has the same geometry, typography and eight-line result; it is retained as the owner’s reference without claiming pixel identity. Additional 590px desktop and 700px phone baselines are in `before/`.

## Independent direction and review

Central visual-design-director `0.2.3` and its redesign, emotional-direction and render-and-QA references were read from the installed cache. Targets: immersed, curious, effortless, insightful. Avoid cramped, over-explained, neon, academic and scanning labels. Three materially different actual-book treatments were compared side-by-side: margin current, page-edge stitch, change-only emphasis. Six representative PNGs and fifteen-render geometry are retained in `alternatives/`. Both initial no-context native observers chose the margin current; neither accepted its first small-screen key.

Six focused passes are retained in `rounds/`: structural alternatives; initial runtime (partial capture defect, not accepted); visible key/navigation and anchor correction; actual line samples and Night graphics; Night, accessibility and narrow-footer correction; full-width mobile key and actual close-control contrast. Raw low scores and criticisms remain in `reviews.json`. Capture defects and accessibility failures remain recorded as failures, followed by their corrections.

Topology: independent designer, whole-document mapper, browser QA, screenshot-only critic, fresh no-context native readers, and parent integration/visual inspection. Every child was spawned explicitly with `gpt-6.1-sol` / `xhigh` and `fork:none`; the native calls accepted those settings. The parent inspected all 14 final PNGs; the independent critic inspected 14; each final fresh observer inspected eight. These are model/image reviews, with no human participants or measured reader emotion. See `final-review.json` and `reviews.json`. Internal critic scores do not override fresh blind or owner feedback.

## Verification

| Check | Result | Artifact |
| --- | --- | --- |
| client | 129 passed / 0 failed | [evidence](checks/client.log) |
| functions | 37 passed / 0 failed | [evidence](checks/functions-test.log) |
| rules | 16 passed / 0 failed | [evidence](checks/rules.log) |
| mcpIntegration | 18 passed / 0 failed | [evidence](checks/mcp-integration.log) |
| browser | 115 passed / 0 failed | [evidence](checks/browser.log) |
| cloud | 11 passed / 0 failed | [evidence](checks/cloud.log) |
| evidence | 26 passed / 0 failed | [evidence](checks/evidence.log) |
| focusedBrowser | 52 passed / 0 failed | [evidence](checks/focused-browser.log) |
| typecheck | PASS, exit 0 | [evidence](checks/typecheck-final.log) |
| build | PASS, exit 0 | [evidence](checks/build-final.log) |
| pinned page-flip packaging | PASS, four files verified | [evidence](checks/build-final.log) |

Focused browser cases are a subset of the full browser suite, not additional unique tests. Normal unit invocation skips emulator-only cases; Rules and actual OAuth/MCP integration run separately. Source/quote offsets, every meaningful rich-text character, native scrolling/bookmarks, same-tone colors, page-turn/resizing projection, writer edits/stale state, Night, forced colors, accessible names/contrast and no-source-mutation are exercised. The annotation for a visible second document is not fetched or inferred; the test proves only the active-document request occurs.

Final captures bind complete src TS/TSX/CSS plus fixture fingerprints before/after. manifest.json binds all current source paths, selected artifacts and retained historical evidence. Earlier manifests/renders remain immutable historical records; their old source bytes and visual scores are not asserted as current. Existing Actions gates and deployment pipeline remain in place.

## Limits

- Fresh blind scores are not unanimously ≥8: cool-color distinction remains 7 in several desktop judgments; one 320px opening legend judgment is 6. Raw criticism is retained; internal critic scores do not override it.
- Three or more visible feelings may require All feelings to name every color; the compact preview is explicitly partial.
- The default 320px writer remains compact with inherited title/tool chrome; Heartbeat costs approximately one line versus OFF, and focused writing recovers it.
- Chromium viewport/emulator evidence and native-model still-image judgments do not establish physical-device comfort, color-vision accessibility or human/owner acceptance. Hosted checks exercise the public shell/auth boundary, not a production Auth bypass.

This evidence establishes synthetic browser behavior and native-model/parent image review. Hosted public-shell/discovery and build parity are verified after release through the existing pipeline; authenticated real-owner comfort and physical-device acceptance are not inferred. Exact commit and Actions links are reported with delivery.
