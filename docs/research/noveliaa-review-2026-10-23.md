# Noveliaa research and architecture review

23 October 2026 · Research proposal for Codex and the author · No application implementation or development approval.

**Recommendation:** retain the small Firebase application and external AI boundary, but make recoverable writing the first deliverable. Use Living Atlas for contextual connections, a Quiet Folio style focused editor for sustained writing, and a Workbench view only for deliberate review. Their value must be demonstrated with actual writing tasks, not inferred from the concept boards.

## Evidence and scope

Reviewed creative-workspace at commit cf18fae44127ec64a798ca28d01615966dc3ef07: five planning files; no app, editor, security rules, deployment configuration or runnable product tests. Read the [Space root](https://chatgpt.com/space/page_6ad9dd6e8bd08191b61c4bede08773ff), intent, repository snapshot, [architecture plan](https://chatgpt.com/space/page_6adb401a6e8c8191938924d0579291f3) and gallery. The plan was Page sequence 0 at this review's read; the root was sequence 2. GitHub remains the development source of truth. Differences between its open decisions and the Space plan's chosen defaults need reconciliation, not silent promotion to approved requirements.

Personally inspected the Living Atlas, Quiet Folio and Story Workbench image pixels. Their SHA-256 identifiers are respectively dc8b2498ee78e66937b268c30211d0300a369087b50f09224e8abab06e5ae873, 66a16f508bc182d1ad83006930ca42c8c629a803bfebc5df5cd074f5ab6ed9b3 and 579a9bd7d3ba25935e242e8680d29073fee7bb620b4f16413fd730d43568abcd. These are exploratory images, with placeholder words and device staging; they prove neither touch usability nor visual acceptance. Night Atelier was retained in the gallery but not visually assessed in this review.

Sampled the beginning and ending of the supplied Wolfrie.txt (91,518 bytes; SHA-256 9691274071a0c8d5f594dda894c90ba83bdda4e3609f7f9fe2a3795324f9dc52). It contains user/assistant turns, image-generation placeholders and a later assistant-written story summary. Uploading it does not make every passage author-written or canon. Preserve the original bytes; keep parsed speaker attribution and any summary as separate, reviewable derivatives. No manuscript was imported or copied into this repository.

Central visual-design-director was loaded in review-only scope. Release metadata at Wolfrine/Central commit 653247d6e4601b136fcbb51306c9a72c29e691e7 declares v0.1.0, base ba1235fe7b220842778414f3f70fca38e7df4c53 and packaged skill digest 750394b5b522a01ccb5d951725b7f2e05b48ad383d3f762fe9e6648f7fde1aa2. Metadata is linked in [sources](sources.md); it is not a new Noveliaa acceptance verdict. No implementation cycles, independent critic scores, participant sessions or runtime acceptance occurred.

## What is worth learning from other products

Primary documentation establishes mechanisms, not proof that these products are best for this author. The following are reference candidates with unusually relevant mechanisms. All Noveliaa implications below are recommendations to test.

| Reference | Useful mechanism and why it matters | Apply selectively |
|---|---|---|
| Scrivener [S1] | Sections can be written out of order, arranged in an outline/corkboard, and viewed beside research; snapshots support experimentation. Organization acts on writing already present. | Keep scenes independently addressable and give them multiple views. Do not require synopses, cards or a chapter tree before capture. |
| Ulysses [S2–S3] | Inbox sheets coexist with project organization; local backups and exportable backups have distinct roles. | Let fragments acquire structure later. Expose recovery in the writing context; cloud synchronization alone is insufficient. |
| Obsidian [S4] | Backlinks and a local graph reveal explicit connections around a note. | Use stable IDs and a local, filtered connection view with a list equivalent. A global network is not automatically useful navigation. |
| Google Docs [S5] | Suggestions are visibly separate changes, accepted or rejected by a reviewer. | Offer a source/proposal diff. Noveliaa must enforce a stricter server boundary: an AI client never acquires approval power. |
| Novlr [S6–S7] | Beta readers cannot edit writing and do not see each other's independent feedback; versions have an identifiable preview/restore flow. | Separate reader responses from manuscript editing and avoid social priming before feedback. Do not copy live manuscript sharing as the edition model. |
| Readwise Reader [S8] | Reader-controlled typography and themes adapt long reading to devices and preferences. | Make reading comfortable before adding effects. Preserve position across font changes and interruption. |
| SBS The Boat and ink/Inky [S9–S10] | The Boat composes artwork, text and sound around a particular story; Inky connects source writing with a playable preview. | Borrow deliberate pacing and source-to-preview traceability. Do not turn every novel into scrollytelling, branching fiction or an asset-production pipeline. |

Doshi and Hauser's short-story experiment reports improved individual evaluations alongside reduced collective diversity with AI ideas [S11]. It does not establish the effect on this author's long novels. It supports testing voice preservation and retaining alternatives, rather than equating polished AI prose with a better story.

## Architecture decisions to retain and change

| Priority | Assessment of the proposed plan | Recommended decision and evidence gate |
|---|---|---|
| P0 | React/TypeScript/Vite, Tiptap and Firebase are plausible, not yet validated. Framework choice is less consequential than editor and persistence behavior. | Keep the proposal provisional. After approval, prove IME, paste, undo, large scenes, mobile keyboard and schema round trips before building the shell. No stack rewrite is justified by this review. [S12] |
| P0 | Firestore persistence plus an expected-base check recognizes conflicts but leaves local acknowledgement and recovery underspecified. | Write an immutable local checkpoint/outbox before saying “Saved on this device”; show “Synced” only after server acknowledgement. Unique revisions plus a server transaction promote a head only against its expected base. Conflicts preserve both branches. Offline capture must not wait for a transaction that cannot run offline. [S13–S15] |
| P0 | “One portable source” needs a defined format and completeness boundary. | Use versioned editor JSON for supported editing semantics, alongside byte-exact original imports. Export originals, revisions, decisions, proposals, links and assets with hashes and schema versions. A readable text/HTML export is a convenience derivative, not a replacement archive. Reject unsupported schema versions without dropping nodes. [S12] |
| P0 | Immutable evidence is appropriate; freezing the editing surface would obstruct authorship. | Keep current drafts freely editable, originals and committed revisions immutable. A restore creates a new revision. Editing a draft, designating canon, approving assets and releasing an edition are separate operations. Approval never changes origin. |
| P0 | Scoped MCP is the right boundary; generic owner-scoped CRUD is too broad. | Expose read/search, discussion append and proposal submission only. Pin the source revisions actually returned. Bind tokens to this resource, check grants on every route, reject forged actor fields, revoke grants and make repeated writes idempotent. Source text is data, including text that asks an agent to approve or publish. [S16–S17] |
| P0 | Edition manifests correctly separate a reader release from a moving manuscript. | Author approval must bind exact manuscript, presentation and asset hashes. Stage blob uploads first; finalize references only after successful verification because Storage and Firestore are not one atomic store. Later edits produce another edition. Publication need not imply that every included sentence is designated world canon. |
| P0 | Private links and private media require the same enforcement. | A bearer link can be forwarded; label that clearly. Prefer authenticated invitations for sensitive previews. For immediately revocable new requests, authorize media through the server; long-lived download URLs undermine that promise. Already delivered/downloaded content cannot be recalled. Avoid token-bearing logs, referrers, public bundles and shared caches. [S18] |
| P0 | Daily backups and 30-day retention do not define a recovery promise. | Distinguish device recovery, synchronized revision recovery, and disaster recovery. Propose zero loss of acknowledged checkpoints under ordinary restart, daily disaster backup RPO up to 24 hours, and a measured restore target initially 60 minutes. Offline-only data is not in cloud backups. Test an isolated restore with the original app unavailable; include blob versions and protection from routine destructive credentials. These are proposed budgets. |
| P1 | Search and World views could grow into another taxonomy-heavy wiki. | Begin with Inbox, recent writing, title/body search and explicit links. Treat indexes, backlinks and graph layouts as rebuildable projections. Choose corpus size and offline search semantics explicitly. Firestore Enterprise now has indexed text search; that is not permission to assume the proposed database edition or offline pipeline support. A small local index may be simpler initially. [S13, S19] |
| P1 | Single author does not mean single writer instance. | Test two tabs and two offline devices now. Keep branch-preserving conflict resolution; defer CRDT/live co-authoring until simultaneous editing is an actual need. CRDT merging would not decide meaning or canon. |
| P1 | Consent off by default is good; TTL and voice details remain incomplete. | Separate deliberate feedback, optional behavior and author observations. Stop capture and discard unsent optional events on withdrawal; enforce consent again on ingestion. Suppress expired behavior immediately; TTL alone deletes asynchronously. Specify physical purge and backup retention honestly. Defer voice until the text feedback loop is proven. [S20] |

## Design and workflow judgment

Living Atlas's strongest image mechanism is the connection between a scene and nearby world notes. Keep that relationship available without forcing a large graph onto the writing surface. Quiet Folio contributes manuscript prominence and a calmer context pane. Workbench contributes explicit scene order and review context, but its four adjacent columns would squeeze real paragraphs.

The boards contain very short copy, small status text and no open mobile keyboard. The phone “Save to Inbox” action must not be the sole persistence trigger. Test a long untitled fragment, failed sync, two identically named scenes, a stale proposal, broken media, font loading failure, dark/light reading, and a long Hindi/English passage. Keep capture, writing and search usable without World classification. List/card navigation and non-drag controls must cover every graph/reorder action.

Use actual unframed viewport renders when judging hierarchy and type; the plants, desks, notebooks and device mockups are not software. Do not assign a numerical beauty score to these boards. [Human evaluations](../../evals/human.md) define observable critical dimensions before future scoring.

Reader preparation should be a checkpoint, not a compulsory production pipeline. The author may approve a coherent scene for critique without generating illustrations or completing a novel. A text-first private edition is a valid reader experience. Test richer presentation against it with different but matched excerpts and counterbalanced order; repeat-reading effects and 3–5 friendly peers prevent strong causal claims.

Feedback should ask what a reader remembers or where meaning became unclear, preferably after a scene or on request. Never turn dwell time into “sad,” “bored” or an automatic rewrite. Anchor responses to an immutable edition and passage ID plus quote/context; preserve unmatched anchors rather than attaching them to a convenient new passage. [S21]

## Recommended handoff to Codex

1. Reconcile the Space defaults with INTENT's open decisions. Record proposed choices for checkpoint acknowledgement, archive format, private link semantics, retention and Firestore edition. Do not treat this report as author approval.
2. After explicit development approval, demonstrate capture → offline restart → two-device conflict → original recovery → export/isolated restore. This is the first implementation gate.
3. Carry one author scene through a real external discussion, accepted and rejected proposals, then an explicitly approved, text-first edition and one real peer response.
4. Add contextual Atlas navigation only when it improves retrieval without slowing capture; expand imagery, motion and voice after fidelity and reading comfort pass.
5. Run every applicable P0 automated case, the separate human gates and the author review. Keep blocked/not-run distinct from pass. The executable checks here validate evidence structure and detect regressions; they cannot establish runtime security or literary quality.

Start with [evaluation instructions](../../evals/README.md), [automated cases](../../evals/automated.md) and [human cases](../../evals/human.md). The existing reference repositories were read only at the pinned paths in [sources](sources.md); no reuse or migration is authorized.
