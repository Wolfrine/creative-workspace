# Independent visual critique — round 4

**Candidate:** `730eda82c6441bc527b9268e92936dc0ec7fa3830504cde8dee446d8fa1d8a46`, `docs/evidence/phase1/round-4/manifest.json`. Synthetic material through the device engine, no Firebase project. Central v0.1.0. Critic scores precede lead scores. Verdict: **unverified; narrow history needs another refinement**.

Personally viewed desktop history, new 320×700 history, 390×480 expanded formatting, mobile failure/conflict and desktop conflict. Normal writing, Atlas and focus hashes match previously inspected renders. Direct CUA browser access remains unavailable; screenshots do not establish software-keyboard behavior or a physical-phone pass.

## Findings and scores

- Desktop history now reserves an opaque footer and explanatory note. Prose stops at a clear contained boundary rather than running behind the restore action. Retain this fix.
- Short-height writing materially improves: navigation/footer no longer consume the bottom of the viewport; about 200px of prose is visible with the formatting popover open. The popover occupies title space rather than adding another full-width row. The screenshot does not show an identifiable active caret/lower paragraph, so caret preservation still needs QA rather than visual inference.
- **320px history has almost no prose visible.** The modal shows title, explanation, a 140px horizontal revision list, preview title, compare control and count summary; “SELECTED VERSION” sits around y540 directly above the fixed note/footer. No actual compared prose is visible. A writer cannot inspect a revision comfortably through this sliver even though the footer collision is resolved.

| Critical dimension | Score / 10 | Visible reason |
|---|---:|---|
| Writing hierarchy | 8.2 | Normal working interior retains prose dominance; short editor recovers meaningful space. |
| Typography and density | 8.0 | Normal and error-state prose/labels remain clear; comparison palette is readable. |
| Ownership and state clarity | 7.8 | Failure/conflict next actions and desktop comparison are clear. The narrow revision preview gives almost no access to the evidence needed before restoring. |
| Spatial usefulness | 8.0 | Explicit graph/list relationships retained; no invented content. |
| Responsive focus and restraint | 7.6 | Short writer is substantially better. Narrow history still stacks too much non-prose chrome, making recovery inspection difficult. |
| Overall | **8.0** | A good direction with one localized critical-state blocker; overall cannot override the failing dimensions. |

## Round 5 correction

Recompose narrow history rather than shrinking prose: use a compact revision selector or a separately opened revision list, shorten the persistent explanation, and let preview heading/context scroll when needed. At 320×700, keep the restore action distinct while giving actual revision prose a substantial continuous readable region (roughly 200px or more). Show both a normal preview and comparison after selecting an older revision, including the bottom of the preview. Preserve desktop containment.

Then capture short-height typing with a visible active lower line and confirm the line remains reachable after opening/closing additional formatting and entering/leaving focus. This is a browser QA task, not a claim that screenshots prove IME/phone behavior.

## Layer and generic-risk decisions

- **Retain** materials/type, normal editor, compact mobile formatting, desktop modal containment and honest failure/conflict states.
- **Refine** narrow history navigation/composition. No design-direction replacement is warranted: responsive writing materially improved and the remaining defect is specific to one recovery modal.
- Warm paper/serif pairing: **justified** by readable author prose, not generic ornament.
- Floating formatting: **justified** at short height because it preserves prose space; keyboard/focus access must remain separately verified.
- Stacked desktop sections on mobile history: **defective**. The revision list and explanation consume the region needed to inspect exact writing. Compact navigation is the appropriate response, not smaller text.

No final agent-reviewed status is established. Physical-phone/H03 author recovery and owner acceptance remain human gates; axe results remain separate QA evidence.
