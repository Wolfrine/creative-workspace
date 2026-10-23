# Independent visual critique — round 3

**Candidate:** `94e831e2402d1c0df1dc96d690e798b10225903570a6be5c543009759f0829e6`, `docs/evidence/phase1/round-3/manifest.json`. Synthetic material through the real device engine; no Firebase project. Central v0.1.0. No lead scores supplied. Verdict: **unverified; two bounded visual blockers**.

Personally inspected the changed desktop history comparison; 320×700 writing; 390×480 expanded formatting; desktop/mobile save-failure and conflict renders. Ordinary writing/Atlas/focus renders have identical hashes to round 2; the prior judgment applies to those unchanged states. Error strings identify synthetic injected faults. Root describes an actual IndexedDB fault/two-tab conflict capture; screenshot review does not independently prove persistence semantics. Direct CUA browser access remains unavailable; no physical keyboard evidence is claimed.

## Concrete findings

1. **History comparison text collides with its own footer.** In `desktop-history.png`, the prose reaches beneath “Text comparison only…” and the hash/restore footer; text is visibly cut at the modal bottom. This is recovery work, so every word needs an unobstructed scroll region. Fix modal sizing/scroll containment, reserve a distinct footer region, and verify both column ends at long length. The new counts, excerpts and highlighted comparison are useful; retain them.
2. **The short viewport leaves only about two lines of prose.** In `short-writing-formatting.png`, body begins around y328 and its writing region ends near y386; the expanded toolbar, title, app bars, footer and navigation occupy the rest of 480px. This is not a physical keyboard result, but it exposes the compositional risk for keyboard-height space. Prioritize the editor while typing: collapse nonessential navigation/chrome or allow title/metadata to scroll away; verify an actual active lower paragraph remains visible with formatting open and closed.
3. The 320px normal-height render is readable and has no four-column compression. Save wording wraps clearly. Real save-failure and preserved-conflict banners provide plain next actions without replacing the manuscript. These are substantive improvements in state coverage.

| Critical dimension | Score / 10 | Reason |
|---|---:|---|
| Writing hierarchy | 8.1 | Desktop and normal mobile retain manuscript dominance; short viewport is the exception called out separately. |
| Typography and density | 8.0 | Readable prose/metadata palette retained; comparison highlights preserve legibility. |
| Ownership and state clarity | 7.7 | Failure clearly offers “Export open text”; conflict says both versions are safe and offers history. History orientation improved through seconds/count/excerpt, but the comparison/footer collision obstructs the recovery task. |
| Spatial usefulness | 8.0 | Explicit-link map/list unchanged from the reviewed round-2 state. |
| Responsive focus and restraint | 7.0 | 320px writing is sound; 390×480 expanded formatting allocates too little visible working space. Mobile error/conflict banners remain readable and appropriately distinct. |
| Overall | **7.8** | More truthful coverage revealed bounded defects; a passed scan cannot hide them. |

## Layer decisions and next cycle

- **Retain** main composition, normal phone type scale, meaningful graph, quiet materials and the new useful history distinctions/highlights.
- **Refine** modal scroll boundaries and short-height editing composition. **Replace neither direction nor typography.** These are localized working-state problems, not evidence against Living Atlas/Quiet Folio.
- Serif/cream craft: **justified** by the writing task; visible prose remains the product object.
- Comparison panels: **justified**, because they show a real text difference; currently **defective in scroll containment**, not in the two-column concept.
- Repeated app chrome on small heights: **defective** where it leaves only two writing lines. Preserve the semantic controls through a compact treatment rather than stacking every desktop region.

For round 4, show unobstructed long comparison ends on desktop/mobile; show a lower active paragraph in a short mobile viewport, with expanded formatting and in focus mode. Parent/QA must independently verify scroll/focus behavior. Root's axe result remains separate. No acceptance or owner approval is established.
