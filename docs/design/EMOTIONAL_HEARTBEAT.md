# Emotional Heartbeat

Implementation and live release were explicitly authorized on 3 November 2026.
This extends the private author workspace and existing proposal permission; it
does not approve shared editions, canon changes or manuscript transformation.
[Feature intent](https://chatgpt.com/space/page_ad597e8d38848191a06a07e4e537838a).

## Delivery checkpoints

1. Inspect the verified F-drive main checkout and capture matched desktop/mobile
   writer and private Read baselines using synthetic writing.
2. Extend MCP with separate, immutable, structured annotations and scoped author
   reads. Test validation, exact anchors, replay, revocation and source integrity.
3. Add an optional writing/Read overlay, short labels, on-demand reasoning and
   compact passage navigation. Hide interpretations immediately on draft changes.
4. Independently critique current renders; parent checks flows, accessibility,
   mobile, regressions and exact-source evidence.
5. Commit/push main after checks; use existing Actions deployment and verify live
   discovery, private-access denial, build identity and desktop/mobile public UI.

## Design contract

Central visual-design-director **0.2.3**, base
`d097786cf3d6c5a2859439112afdd39538316567`, was loaded from the installed plugin.
This is bounded refinement of the accepted Living Atlas / Quiet Folio product.
The lead surface job is **Read**, alongside the existing writing task.

- Retain paper, muted green, serif manuscript, existing navigation, typography
  controls, recoverable writing and quiet off state.
- Refine emotional continuity inspection with a separate visual layer.
- Replace no accepted product surface or writing behavior.
- Explore restrained passage tint plus margin/strip labels, using matched
  synthetic content and viewport sizes before/after.

Critical visual conditions declared before review:

| Dimension | Observable condition |
| --- | --- |
| Manuscript primacy | Prose remains dominant and fully readable; tint is restrained and explanations open only on demand. |
| Emotional nuance | Short foreground/undertone labels, weight and trajectory remain legible without relying on color; quiet passages need no tags. |
| Identity and agency | Existing paper/green/serif identity survives; one explicit off-by-default control removes the entire layer. |
| Responsive clarity | Writer and private Read work at desktop and phone sizes without clipped controls, horizontal overflow or lost source navigation. |

Designer, independent critic and parent QA are separate native agents. The
requested child settings are `gpt-6.1-sol` / `xhigh`; those exact settings were
passed to native spawn calls. Agent visual review is not author acceptance or
measured reader emotion. No generated imagery or reader telemetry is involved.

## Data and permission boundary

To use it, wait for **Synced** (or explicitly check cloud sync), ask a connected
AI with proposal permission to interpret the current page and return a heartbeat,
then enable **Heartbeat** in writing or private Read. Select a short label for
reasoning and **Find this passage**. Refresh checks returned annotations again;
the layer also refreshes on window focus. Turning it off removes the overlay
and stops annotation requests. No analysis runs automatically in Noveliaa.

`submit_heartbeat` supplements the existing six MCP tools. It requires existing
read and optional proposal grants. Writing remains immutable. An analysis has
provider/model attribution (self-reported), available narrative context, and
ordered nonoverlapping UTF-16 spans in the exact `fetch_page` plain text. Each
span carries its exact quote, a one-to-three-word foreground and optional
undertone, weight 1–5, trajectory, fixed tone and on-demand reasoning. Weight is
not confidence. Empty beats are valid; absence of tags is not a defect.

Every write checks current owner/workspace, universe, grant and immutable
revision/hash. A receipt binds identical retries to one append-only annotation;
changed reuse fails. Server-scoped reads show only current, active-grant
annotations. A new manuscript revision or changed local snapshot hides the old
overlay. Quotes alone never authorize reattachment. Firestore clients cannot
read or write annotations directly.

The UI calls these **AI interpretations**, separate from author intent and
actual readers' reported responses. There is no automatic analysis, embedded
chat, model key, source replacement, approval or publication action.

## Acceptance limits

Use synthetic emulator and local-only preview fixtures. Production checks must
not seed, read or modify real manuscripts. Hosted public-shell/discovery checks
and emulator-authenticated UI checks are distinct. Physical-device/IME and a
real author comparing model interpretations with intended feeling remain human
acceptance, not inferred from passing tests or screenshots.
