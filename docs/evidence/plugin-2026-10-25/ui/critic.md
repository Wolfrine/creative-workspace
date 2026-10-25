# Private plugin UI — independent visual critique

Reviewer: `/root/plugin_critic`; application implementation belongs to
`/root/plugin_ui`. No application code is edited by this reviewer.

Direction: bounded refinement of accepted Living Atlas, with Quiet Folio reading.
Central release `0.1.0`, base `ba1235fe7b220842778414f3f70fca38e7df4c53`.
Reviewed contract: `docs/design/PLUGIN_CONNECTION.md`. Current owner approval is
for a full private plugin; this record cannot establish author acceptance.

## Baseline inspected as actual pixels

- `docs/evidence/phase1/reader-ux-2026-10-25/cycle-5/pages-detailed-1440.png`
- `docs/evidence/phase1/reader-ux-2026-10-25/cycle-5/pages-detailed-390.png`
- `docs/evidence/phase1/reader-ux-2026-10-25/cycle-5/writing-start-1440.png`
- `docs/evidence/phase1/reader-ux-2026-10-25/cycle-5/writing-start-390.png`

The accepted baseline puts the working text before chrome, uses warm paper and
quiet green boundaries, and places provenance immediately below the writing
object. Desktop spaciousness translates to narrow mobile content without
repeating desktop navigation. Retain those mechanisms. The existing writer's
“Connections” pane means page links; the new plugin destination should name
external access clearly to avoid conflating the two concepts.

## Scoring contract

Scores below must come from personally viewed, state-identified screenshots,
before parent scores. Critical dimensions are Agency, Reading clarity,
Restraint and State continuity. Every dimension and overall must independently
reach 8/10, with no unresolved blocker, for agent-reviewed status. Tests and
cycle count do not raise visual scores. Static captures do not prove motion,
human attention or physical-device acceptance.

Current verdict: **agent-reviewed by independent critic** for the Cycle 5/final UI
candidate below; overall release acceptance still requires the parent's separate
QA/checkpoints and production verification. This is not author acceptance.

## Cycle record

### Cycle 1 — initial scope and returned proposal

Personally viewed four actual PNGs in `ui/cycle-1/`:
`consent-1440.png`, `consent-390.png`, `review-1440.png`, `review-390.png`.
Routes `/connect?local=1&request=synthetic` and `/connections?local=1`;
viewports 1440×1000 and 390×844. Per-capture JSON declares synthetic API fixtures
and `Integrations.tsx` SHA `aadceaa0f6748d60863c61b1df499491a8b2b0d7d56c496a9c8e763fc27d1e84`.
This hash alone does not cover CSS/router dependencies; requested a broader
source binding in later cycles.

| Dimension | Score | Visible reason |
| --- | ---: | --- |
| Agency | 8.0 | Read universe choices start empty; future-page scope and optional proposals are adjacent to checkboxes; refusal is visible. |
| Reading clarity | 7.5 | Mobile consent heading visibly joins “whatleaves”; review body has a long, small desktop measure; source navigation is missing. |
| Restraint | 8.2 | Warm paper, typographic hierarchy and quiet ruled records preserve baseline; there is one clear consent action. |
| State continuity | 7.5 | The proposal identifies its source and decision boundaries, but current-source navigation is absent and mobile access management is below the entire proposal without a jump. |
| Overall | 7.8 | Promising accepted-direction refinement, blocked by the mobile heading defect and incomplete source/access navigation. |

Three generic risks assessed: (1) scope sheet card is justified by the security
decision; (2) correspondence records use rules rather than indiscriminate cards,
resolved; (3) promotional heading occupies substantial mobile space, refine its
compactness without replacing the direction. Retain type family, colour and
paper; refine responsive spacing, body measure and navigation. No imagery or
motion needs adding.

Strongest baseline gap: accepted writing exposes its linked material directly;
the proposal source currently only names a page. Highest correction: fix the
joined mobile heading, then expose explicit current-source navigation and a
mobile access-management jump. Pending/error, expired, revoked and long-reference
states are unobserved and remain unverified. Scores sent to designer before any
parent scores were seen. Tests do not affect these scores.

### Cycle 2 — narrowed scope and long source/proposal

Personally viewed `ui/cycle-2/consent-refined-390.png`,
`scope-selected-1440.png`, `long-source-1440.viewport.png`,
`long-source-390.viewport.png`, `long-source-390.record-source.png`,
`long-source-390.record-reference.png`, and the complete
`long-source-390.png` at original resolution. Same routes/viewports as cycle 1;
all are explicitly synthetic. Capture JSON now hashes UI, CSS, API client,
AppHost, App, global styles and library-reader styles, with source snapshots.
Source digest: `e61377960c4c57cbfff6463a9e22a7a158ec2169e739630f0af9b3b28294cc45`.

| Dimension | Score | Visible reason |
| --- | ---: | --- |
| Agency | 8.3 | Narrow selection enables the single consent action; proposal permission stays unchecked; mobile exposes Manage access before long material. |
| Reading clarity | 8.2 | Mobile heading whitespace is corrected; 16px bounded prose, wrapped long source title and full reference IDs remain legible without horizontal clipping. |
| Restraint | 8.2 | Source action and access shortcut fit quietly into the existing hierarchy; no new competing cards or chat chrome. |
| State continuity | 8.1 | Changed source is labeled and offers Open current page; full hash remains inspectable; long proposal ends in distinct review/dismiss controls. |
| Overall | 8.2 | The observed working states now meet the visual bar; remaining sparse/error/revocation coverage is not inferred. |

Three generic risks: (1) promotional intro now has corrected compact mobile
typography, resolved for this screen; (2) narrow source panel is justified by
provenance, retained; (3) technical references are progressively disclosed,
resolved rather than occupying the reading surface. Retain type, colour,
composition and navigation; no replacement requested. Strongest remaining
reference gap is evidence breadth, rather than an observed style defect.

Highest next task: inspect real pending, expired/denied, empty and revoked states
at both widths. The full long screenshot includes a focused skip-link overlay
midway because its viewport was scrolled during a full-page capture; asked
designer to identify this as keyboard-focus evidence or clear focus for ordinary
baseline. This is not evidence of a persistent overlay in ordinary reading.
No current visual blocker on states personally seen. Critic scores delivered
before parent scores.

### Cycle 3 — independent decisions, preserved records and revoked access

Personally viewed complete `ui/cycle-3/decisions-revoked-1440.png` and
`decisions-revoked-390.png` at original resolution, including the lower grant
section. `/connections?local=1`, 1440×1000 and 390×844; same source digest
`e61377960c4c57cbfff6463a9e22a7a158ec2169e739630f0af9b3b28294cc45` as
cycle 2, meaningful additional decision/revocation state. Synthetic discussion
and proposal explicitly labeled; archive download feedback is visible.

| Dimension | Score | Visible reason |
| --- | ---: | --- |
| Agency | 8.3 | Reviewed and dismissed outcomes remain distinct from approval; revoked access is identified beside client name. |
| Reading clarity | 8.2 | Source references, body paragraphs and decision labels remain separated and readable at both widths. |
| Restraint | 8.2 | Decision controls are replaced by quiet status lines; archive feedback does not dominate the material. |
| State continuity | 8.4 | All material preserves both decisions and their sources; To review count becomes zero; grant survives as visibly revoked evidence. |
| Overall | 8.3 | State transition remains coherent and preserves the accepted reading hierarchy. |

Three generic risks: (1) success badge as fake approval is resolved by “Reviewed ·
still unverified”; (2) dismiss-as-deletion is resolved by the preserved record and
archive label; (3) revoked item as dead card is justified by access history.
Retain composition, type and colour. Refine revoked permission wording:
the present “Read · discussions & proposals” below a Revoked badge can imply
active authority; “Previously allowed” or “Access ended” would clarify it.

No observed visual blocker. Error, expired, empty and offline states remain
unobserved. Focused skip-link still appears at top of these full-page captures;
designer will clear focus for ordinary final baseline and retain keyboard QA
separately. Scores sent critic-first; parent checkpoint requested for this round.

### Cycle 4 — sparse, pending, expired and offline states

Personally viewed seven actual PNGs in `ui/cycle-4/`:
`no-universes-1440.png`, `no-universes-390.png`, `empty-1440.png`,
`empty-390.png`, `expired-390.png`, `pending-390.png`, `offline-390.png`.
Same consent/review routes and desktop/mobile viewports; synthetic fixture
labels and cleared ordinary-reading focus are explicit. Source digest:
`3cafb8a2135c795bf01a6e18561a89fcb6cb9601ef2f8be9776193cbc59985e4`.

| Dimension | Score | Visible reason |
| --- | ---: | --- |
| Agency | 8.2 | No-scope and offline consent cannot proceed; refusal/back navigation remains legible; explanatory copy names the next recovery step. |
| Reading clarity | 8.3 | Pending text, expired warning and offline banner are legible, fit their containers and keep the same visual language. |
| Restraint | 8.2 | Empty material uses a single quiet illustration/text object; no fake activity or extra dashboard chrome. |
| State continuity | 8.4 | Pending explicitly says no writing shared; expiry directs restart; offline explains reconnection rather than pretending unknown records are empty. |
| Overall | 8.3 | Observed sparse/failure states preserve clarity and consent boundaries without visual clutter. |

Three generic risks: (1) empty-state artwork is only a meaningful document icon,
justified; (2) loading imitation is resolved with plain status text; (3) alert
colour is limited to failure/offline meaning, justified. Retain colour, type,
spacing and composition. Optional refinement: disable or omit proposal permission
when zero universes exist, since the choice cannot grant useful access.

No visual blocker in observed states. Not yet viewed: desktop expired, pending,
offline counterparts; retryable API-error/wrong-account/denied cases. Requested
desktop/error coverage in the final cycle or an explicit remaining limitation.
Later revoked-copy change is not claimed as inspected from these earlier
captures. Scores delivered before parent scores.

### Cycle 5 — final typed correspondence and narrow-screen pass

Personally viewed the corrected geometry captures:
`ui/cycle-5/review-final-1440.top.png`, complete `review-final-390.png`,
`review-final-320.top.png`, and `consent-final-390.png`.
The candidate displays separate Proposal, Research, Critique and Discussion
labels, all AI-origin/unverified. Consent fixture deliberately selects one
universe and enables proposals; earlier default captures show both off.
Source digest: `e6c6230c1f3395c1192edbbf1199e53e3531fcdf0a14d2d6b60006547ab9d0ea`.

| Dimension | Score | Visible reason |
| --- | ---: | --- |
| Agency | 8.4 | Deliberately chosen universe and optional proposal permission are visible beside consent; returned material retains author-only review actions. |
| Reading clarity | 8.4 | Larger bounded prose, darker small labels and wrapped headings preserve reading order at desktop, 390px and 320px. |
| Restraint | 8.2 | Typed records are quiet ruled correspondence; repeated source references carry useful provenance rather than decorative card chrome. |
| State continuity | 8.4 | Current-page navigation, mobile access shortcut, exact references and explicit unverified labels persist through multiple record types. |
| Overall | 8.4 | The observed final candidate meets every predeclared critical visual dimension without a remaining visual blocker. |

Three generic risks: (1) type labels as fake verification are resolved by nearby
AI-origin/unverified; (2) repeated records are justified by genuinely different
returned artifacts; (3) narrow mobile heading/toolbar wraps are natural and do
not clip controls. Retain all accepted layers; no new imagery or motion needed.
The intended eye path remains returned idea → preserved source → deliberate
author decision. This is a review hypothesis, not human attention evidence.

Capture correction: early Cycle 5 attempts showed a hidden fixed-position
skip-link in the body of a scrolled full-page screenshot, even after blur.
The capture helper now scrolls to zero before ordinary full-page evidence and
retains the scrolled viewport separately. The corrected actual pixels above
contain no such overlay. This was an evidence-geometry artifact, not a proven
persistent UI bug. Parent checkpoint requested after critic-first scores.

### Final same-source confirmation

After the full set finished regenerating, personally viewed the actual current
PNG files in `ui/final/`:

- `decisions-revoked-1440.png`, `decisions-revoked-390.png`
- `error-1440.png`, `error-390.png`
- `denied-1440.png`, `denied-390.png`
- `expired-1440.png`, `expired-390.png`
- `pending-1440.png`, `pending-390.png`
- `offline-1440.png`, `offline-390.png`

Each current capture metadata reports source digest
`e6c6230c1f3395c1192edbbf1199e53e3531fcdf0a14d2d6b60006547ab9d0ea`,
matching corrected Cycle 5. PowerShell inspection of the final JSON collection
returned that single unique source digest. Revised revoked details visibly say
“Previously allowed”; the historical read/proposal permissions no longer appear
active. All reviewed final full-page captures are free of the earlier hidden
fixed-element artifact. Error recovery remains visually clear at both widths.

Read the retained `ui/final/browser-results.json`: `expected: 7`,
`unexpected: 0`, `skipped: 0`, `flaky: 0`. This is inspected QA evidence produced
by the designer's run; the critic did not rerun the suite. It does not increase
the visual scores. Final critic scores remain Agency 8.4, Reading clarity 8.4,
Restraint 8.2, State continuity 8.4, overall 8.4.

No unresolved visual blocker in the inspected consent/review states. All
writing, clients, records and access responses in this evidence are synthetic;
no production author data was inspected or altered by the critic. Production
Google/OAuth consent, installation into ChatGPT, real physical-device acceptance
and author approval are separate, unverified claims in this critic lane. Parent
must retain its independent QA and rounds 3/5/final checkpoint judgment.

### Mechanical truthfulness copy repair — cloud-saved scope

After the five rounds, the parent authorized a small wording correction: MCP
reads cloud-saved revisions and cannot inspect an unsynced device draft. Earlier
`ui/final/` evidence cited above is preserved under `ui/final-before-cloud-copy/`;
the cycle records remain unchanged. This focused repair does not restart or
manufacture a design cycle.

Personally viewed these new actual `ui/final/` captures:
`consent-390.png`, `consent-1440.png`, `review-1440.top.png`,
`review-390.top.png`, `long-source-390.record-source.png`,
`long-source-1440.record-source.png`.
New source digest from their capture metadata:
`f094e443319631003a11cf3a9b79a0d4a5fb58a8f2828685724a7223c93f1b85`.

The consent explanation visibly includes “existing and future cloud-saved
pages”; matching and changed source labels now explicitly refer to the latest
cloud-saved revision. Longer wording wraps naturally at desktop and 390px with
no clipped source label, displaced action or horizontal overflow visible. The
provenance/source hierarchy and current-page action remain clear.

No new visual blocker. Independent scores remain unchanged: Agency 8.4,
Reading clarity 8.4, Restraint 8.2, State continuity 8.4, overall 8.4. This
mechanical copy correction does not increase visual scores. Inspected the new
retained browser-results: 8 expected, 0 unexpected/skipped/flaky. The final
capture JSON collection has 28 proofs and one unique source digest matching
the new value above. Those test results do not substitute for the pixel checks.

### Mechanical routing repair — prior service-worker compatibility

The parent changed canonical consent/review routes to
`/api/integrations/connect` and `/api/integrations/review`, retaining the legacy
aliases. This addresses prior deployed navigation caching; it changes no style
or visible copy and does not create another design cycle. The previous complete
final set is retained under `ui/final-before-legacy-cache/`.

Personally viewed the current `ui/final/consent-390.png`,
`review-1440.top.png` and `review-390.top.png` as actual pixels. Capture metadata
names the new canonical routes and source digest
`305ad579e68d4f53a769ceb5b8c93655e1eb702d166b8467287d8345861f1d9b`.
The consent hierarchy, scoped choices, cloud-saved source label and review
controls remain visually unchanged and unclipped at the inspected desktop and
mobile widths. No new visual blocker. Independent scores remain Agency 8.4,
Reading clarity 8.4, Restraint 8.2, State continuity 8.4, overall 8.4.

Inspected the current retained browser-results: 8 expected, 0 unexpected,
0 skipped/flaky. All 28 current final capture JSON proofs share the new digest.
The parent owns the real old-service-worker behavior tests and deployment/API
enablement; this pixel check does not claim those passed or that the plugin is
deployed/installed. Historical five-round evidence is retained without rewriting.
