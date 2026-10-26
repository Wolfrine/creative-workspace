# Noveliaa private plugin — approved 25 October 2026

The owner approved a complete private ChatGPT plugin, including MCP and bundled
skills, and reports that Firebase is now on Blaze with Functions enabled. This
supersedes the Spark-only restriction for this integration. Shared editions,
publication and reader feedback remain deferred. Deliver on main through Actions.

## Boundary

One stateless HTTP Function on the existing Noveliaa project serves OAuth and
MCP. Reuse PTI's SDK OAuth/PKCE pattern, adapted to Noveliaa's current Firestore
chunk store. Do not activate the old Storage callable or scheduled backup code.
Tokens are hashed, refresh tokens rotate, workspace reset invalidates grants,
and every tool checks current owner, grant, universe scope and permission.

Read scope is selected universes (including future pages in those universes).
Consent says this explicitly; no universes are preselected. Proposal permission
is optional. MCP cannot modify writing, originals, canon, approval or publication.
Discussion/proposal records are immutable, AI-origin and unverified, with exact
revision/hash anchors and idempotent receipts. Author decisions are separate
records, never edits to the original proposal or source. This release supports
review/dismiss and export; applying a proposal to writing is a deliberate manual
author action. No automatic replacement or background AI processing.

The private full plugin uses a registered ChatGPT App dependency in `.app.json`,
retaining its existing plugin ID, skills, prompts and privacy. A ZIP containing raw
`mcp.json` declarations is Desktop only, including HTTPS servers; the registered
App is needed for ChatGPT web/mobile. OAuth is configured through ChatGPT's Add
custom MCP server flow: DCR, S256, base read scope, default read/proposal scopes.
No universes are preselected and proposal permission remains optional at consent.
See [official packaging guidance](https://learn.chatgpt.com/docs/enterprise/plugin-management#desktop-only-plugins).

## Author UI / accepted Living Atlas direction

Use standalone `/api/integrations/connect?request=...` consent and
`/api/integrations/review` review pages,
reachable from the writer side menu. Retain the current paper, green, serif and
quiet spacing. The primary objects are permitted writing and returned proposals.
Eye path: requested access → selected universes/optional writeback → consent;
review: unverified proposal → exact source reference → author decision.

Critical dimensions, declared before scoring:
- Agency: scope and write permission visible before consent, cancellation easy.
- Reading clarity: long plain-text proposals and source references remain legible
  at desktop and 390px mobile; provenance is visible near each proposal.
- Restraint: no chat imitation, duplicate navigation or competing primary actions;
  the quiet writer stays unchanged except one side-menu destination.
- State continuity: pending, denied/expired, empty, revoked and long-content states
  have a clear recovery action; no clipped controls or horizontal page overflow.

Use distinct designer, critic and parent QA per Central 0.1.0, base
ba1235fe7b220842778414f3f70fca38e7df4c53. Retain five substantive state/visual review
cycles, critic-first judgments and actual desktop/mobile captures. Human attention
and author acceptance are not inferred from those captures.

## Frontend API contract

All integration API data requests use the signed-in Firebase bearer token, JSON,
same-origin fetch, no-store. Errors `{error:string}`; status 401/403/400/409.
- GET `/api/integrations/consent?request=...`: `{clientName,requestedWrite,universes:[{id,name}]}`.
- POST `/api/integrations/consent`: `{requestId,universeIds:string[],allowProposals:boolean}` → `{redirect}`. No implicit author approval.
- GET `/api/integrations`: `{grants:[{id,clientName,universeNames,allowProposals,createdAt,revoked}],records:[{id,kind,title,body,createdAt,origin:'ai',verification:'unverified',anchor:{documentId,revisionId,contentHash,title},decision:null|'reviewed'|'dismissed'}]}`. Bounded latest 50; `before` cursor supported for older records.
- POST `/api/integrations/revoke`: `{grantId}` → `{ok:true}`.
- POST `/api/integrations/decision`: `{recordId,decision:'reviewed'|'dismissed'}` → `{ok:true}`. Marking reviewed does not approve canon.
- GET `/api/integrations/export`: complete collaboration archive, including all
  immutable records and decisions, version/schema and content digests. Separate
  from the existing writing archive; label both exports clearly.

Consent requires server-set HttpOnly same-site `__session` cookie (Firebase Hosting
forwards this cookie), verified against the pending request. Keep it out of JS.
No MCP tokens, private keys or credentials in browser storage or plugin files.

The two UI navigation paths are served as the application shell before API
rewrites. OAuth discovery uses `/api/oauth/authorize`; legacy `/authorize`,
`/connect` and `/connections` remain aliases. API-prefixed navigation avoids the
old installed writing worker's stale shell without forcing an active writer to
reload. The retained legacy-worker browser check verifies this at desktop/mobile.

## Evaluation

Test OAuth wrong account, origin/CSRF, PKCE, code replay, resource binding,
refresh rotation/replay, revoked/reset grants, narrowed scopes; MCP tools over
actual HTTP; chunk/revision hash verification; out-of-scope and trashed writing;
writeback replay and stale anchors; no source mutation; author review and export.
Use synthetic emulator writing only. Production probes are read-only discovery.
Verify exact hosted files, OAuth discovery/401, Functions identity and plugin
archive contents. Creation/installation/consent/tool execution are distinct states.
