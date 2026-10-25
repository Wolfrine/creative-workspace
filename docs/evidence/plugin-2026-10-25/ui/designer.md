# Noveliaa plugin author UI — designer handoff

Bounded refinement of accepted Living Atlas / Quiet Folio, using Central 0.1.0
(`ba1235fe7b220842778414f3f70fca38e7df4c53`), designer guide and
ui-visual-verifier. The parent owns final QA and delivery; the independent critic
owns [critic.md](critic.md). No designer self-awarded acceptance is implied.

The author chooses permitted universes on `/api/integrations/connect`, then reads
returned material and manages/revokes access on `/api/integrations/review`.
Legacy `/connect` and `/connections` aliases remain supported. The writer gains one **AI
connections** side-menu item. This wording distinguishes external AI access from
the writer's existing page-link Connections panel. There is no embedded chat or
source-replacement action.

## Retained cycles

1. **Scope + returned-material baseline:** actual desktop/mobile consent and one
   proposal; no preselected scopes, proposal permission off. Critic found the
   mobile hidden line break joined two words, missing source navigation and
   difficult access management after a long mobile proposal.
2. **Source and scope refinement:** repaired the visible word join; added
   explicitly labelled Open current page and a mobile Manage access jump;
   increased desktop prose size and shortened its measure. Verified long title,
   full revision/hash reference wrapping, stale-source label and plain-text
   treatment of script-shaped content. Narrow-scope allow/deny flows passed.
3. **Decisions + revocation:** actual reviewed, dismissed, revoked and archive
   download states. Decisions preserve unverified material. Critic requested
   clearly past-tense revoked permission copy; current UI says Previously allowed.
4. **State continuity:** actual empty, no-universes, pending, expired, denied,
   retryable API error and offline states. Unknown offline/error data is never
   labelled an empty workspace. Retry recovery was exercised. Permission controls
   do not appear when no universe exists.
5. **Final author journey:** discussion, proposal, research and critique labels,
   bounded older-record pagination, selected optional proposal permission,
   1440/390/320px layouts, real local cross-universe source navigation and
   unchanged documents/revisions/originals. Axe found five low-contrast secondary
   label styles; those were darkened and serious/critical violations now pass.

Historical cycles retain their own captures/source identifiers. Ordinary-reading
full-page captures are now taken from scroll zero; this avoids Chromium projecting
an offscreen fixed skip link into tall screenshots. Viewport/top/region captures
are retained separately. This capture artifact was not called an app focus bug.

## Current exact candidate

All 28 capture proofs in `final/` bind the same seven UI source/CSS dependency
hashes, with exact source snapshots beside them:

`305ad579e68d4f53a769ceb5b8c93655e1eb702d166b8467287d8345861f1d9b`

A final mechanical truthfulness repair clarifies that consent covers cloud-saved
pages and that source freshness compares cloud revisions, not an unsynced device
draft. Earlier complete final evidence is preserved in `final-before-cloud-copy/`;
the five original cycles also remain intact. No controls, behavior or styling
changed in this copy repair.

A subsequent mechanical route compatibility repair uses canonical consent/review
paths containing `api`, so the previously deployed service worker does not serve
its old cached writer for those navigation requests. Client aliases and management
links were updated; legacy bookmarks still work once the current app is loaded.
Backend/Hosting/real old-worker behavior is tested by the parent. This UI lane
tested both canonical routes, legacy aliases, all four production authentication
gates and canonical review-to-source navigation. No CSS or visible copy changed.
The preceding exact final set is preserved in `final-before-legacy-cache/`.

All owned source uses LF bytes. The final fresh build passed, producing
`index-BLiK8Lvq.js` and `index-C3_Wr6Dc.css` (the parent may subsequently rebuild
for release). No manuscript, original or sync-timer change is made by these screens.

## Verification and limits

- `final/browser-results.json`: all eight browser tests passed, covering the five
  cycles, ten-universe/read-only scope constraint, real local source navigation
  and production guards against the fresh build. Canonical and legacy consent
  and review routes with `?local=1` remain author-auth gated and make no private
  integration API request before sign-in.
- `production-guard/browser-results.json` retains the earlier separate guard
  result; current source acceptance uses the eight-test report in `final/`.
- Accessibility: no serious/critical Axe violations at 1440, 390 and 320px in the
  final review state or at 390px in selected consent.
- The designer personally viewed accepted writer/library baselines, initial
  consent/review, refined long source/consent, and final actual desktop/mobile
  review images. Independent critique and parent checkpoints remain separate.

The rendered collaboration content is **synthetic** and API interception is used;
no production author's manuscript was read or seeded. The real local writing
engine was used for source navigation/integrity checks. Backend emulator/OAuth
security evidence, deployed authenticated behavior, actual ChatGPT installation
and human/physical-device acceptance belong to the parent's delivery evidence.

Lifecycle note sent to parent: full navigation from writer to Connections saves
the device draft but closes that page's writer engine; a pending cloud outbox can
wait until writing reopens. This does not lose source data or mislabel it cloud
saved. Any different lifecycle behavior must preserve the approved ten/sixty-second
idle timing and should be verified separately.
