# Phase 1 design record

**Object:** a private author's working notebook. The first action is capture;
organization is optional. Intended eye path: title/current prose, reachable save
state, then optional connections. At first glance prose should dominate; within
one second the current document/save state should be legible; within five seconds
capture, focus and actual page relationships should be discoverable. These are
review prompts, not measured human attention.

Owner direction remains Living Atlas with Quiet Folio; the retained prototype
images were inspected by designer, critic and lead. The research and
[human rubric](../../evals/human.md) define the observable dimensions before
scoring: prose prominence, readable type/density, ownership/save clarity, useful
explicit spatial links, and responsive focus/restraint. Graph nodes must represent
real links and have equivalent list actions. Required states include desktop/phone
writing, focus, empty, Atlas, history, import, save failure and conflict; 320px and
short 390×480 screens reveal recovery/keyboard-space risks.

Central visual-design-director **0.1.0** was loaded from its packaged snapshot
(base `ba1235fe`, package digest beginning `750394b`). Designer
`writing_interface`, independent critic `visual_critic`, and lead/QA `/root` were
separate roles. Agents inherited the session model; no model override or randomly
timed stronger-model pass was performed or claimed. This is an explicit process
gap against that conditional capability branch of Central's workflow, so this record
does not certify every formal Central process requirement.

| Round | Meaningful implementation/verification | Independent verdict | Separate QA / next correction |
|---|---|---|---|
| 1 | First actual writing/Atlas/recovery interior | [7.1](critic-round-1.md) | Contrast failed; metadata, mobile chrome and toolbar needed work |
| 2 | Readable metadata, compact phone writing, reachable link action, wrapped map titles | [7.9](critic-round-2.md) | Normal-state axe clean; add actual failure/conflict/narrow/short states |
| 3 | Exact text comparison, revision identification, recovery actions and actual failure/conflict renders | [7.8](critic-round-3.md) | Lead personally inspected desktop/phone/history/error/short; overlap and short-space blockers found |
| 4 | Bounded history/opaque footer, short writer and formatting popover | [8.0 overall, critical dimensions failed](critic-round-4.md) | Narrow history still showed almost no prose |
| 5 | Compact mobile revision selector, full preview/bottom, lower-caret writing, origin chooser and shelf performance | [8.0 overall, responsive failed](critic-round-5.md) | Lead personally inspected; DOM-expanded popover was not painted in capture; no pass inferred from bounds |
| 6 | Place mobile formatting before paint with layout effect; verify actual pointer access and clickable undo/redo | [8.2, every dimension ≥8](critic-round-6.md) | Lead final pixel review and 14 browser flows pass; no observed regression |

Round 5 QA recapture is the same candidate and does not count as another cycle.
The round-6 manifest is the current source/fixture identity; earlier manifests
explicitly identify smaller source inventories. The critic independently verified
all 24 final production build hashes. No hosted/production behavior is inferred.
Git source line endings were normalized before the final handoff and the same
round-6 states recaptured; this mechanical evidence refresh adds no design cycle.

After seeing the critic's final assessment, the lead personally viewed round-6
desktop/phone writing, Atlas, short lower-caret/painted popup, narrow recovered
text bottom and failure state, and compared unchanged states with prior renders.
Lead scores: hierarchy **8.5**, type/density **8.2**, ownership/state **8.2**,
spatial usefulness **8.0**, responsiveness **8.0**, overall **8.3**. Prose owns the
canvas; optional links have clear text routes; failure/restore choices preserve
writing agency; narrow recovery and the actual lower line remain accessible.

**Current verdict:** visually reviewed and QA checked candidate; owner acceptance
not reviewed, formal Central certification not asserted because of the capability
process gap above. Physical keyboard/IME, real author meaning/recovery confidence,
assistive technology and production account behavior remain open. The independent
critic's unavailable direct CUA surface is disclosed; it inspected actual rendered
pixels and build identities while the lead separately ran browser interaction QA.
