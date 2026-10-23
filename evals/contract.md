# Structural evidence contract

Version 1 is a normalized test projection. An adapter may map any product schema into it, but must keep original IDs, bytes, provenance and revision references. Do not rewrite app behavior merely to fit this checker. Store one JSON bundle with the arrays below and its referenced files in the same directory tree; use relative paths, no symlinks escaping that tree. The checker reads files only and never extracts archives or calls a service.

Top-level fields:

- schema_version: 1; dataset_kind: runtime or synthetic; app_revision: exact candidate identifier; author_id: verified identity from the test; behavior_disabled: boolean.
- originals, revisions, proposals, decisions, assets, editions, feedback, consents, behavior, save_receipts: arrays of uniquely identified objects. The after bundle needs at least one original, revision, proposal, decision, edition, feedback and receipt. Assets may be absent in a text-first edition. If behavior_disabled is false, include an exercised consent/event pair; opt-out runtime coverage must still be tested separately.
- Every record has a nonempty id. All story-bearing records carry universe_id.

| Array | Required fields beyond id |
|---|---|
| originals | universe_id, path, sha256, origin, verification, source_reference. Known origin labels: author, recovered_original, remembered_reconstruction, imported_chat, ai, mixed, unknown. Verification is verified, unverified or mixed; it never establishes authorship by itself. |
| revisions | universe_id, document_id, parent_ids (array), source_original_ids (array), origin, path, sha256. Optional proposal_id, restored_from. Files are exact UTF-8 plain-text projections of revision content; rich-text structure/format fidelity needs the additional A08 oracle. |
| proposals | universe_id, kind: proposal, origin: ai, client_id, source_revision_ids (nonempty array), path, sha256. This limited projection covers text proposals, not every kind of AI output; A16/A25 cover discussion provenance. |
| decisions | actor_id, kind, target_id, target_sha256. Kinds: accept_proposal, canon, approve_asset, approve_edition. accept_proposal additionally has base_revision_id and result_revision_id. These records are evidence inputs, not authenticated by the checker. |
| assets | universe_id, path, sha256. Assets may be empty. A shipped asset needs a matching author approval by digest. |
| editions | universe_id, path, sha256. The file is a UTF-8 JSON manifest with id, universe_id, revision_refs and asset_refs, each reference containing id and sha256, plus any presentation settings included in approval. At least one revision is required. All bytes/settings are bound by the manifest hash. |
| feedback | universe_id, edition_id, revision_id, passage_id, kind: reader_response or author_observation, quote. Quote is nonempty text in that exact revision. Passage ID correctness/unique anchoring still requires A27; substring existence alone is insufficient. |
| consents | session_id, edition_id, purpose: behavior, granted_at_utc, optional withdrawn_at_utc and expires_at_utc. |
| behavior | session_id, edition_id, consent_id, kind: pause/revisit/skip/exit, at_utc, received_at_utc. Both timestamps must fall within the recorded consent interval. No emotional labels. |
| save_receipts | revision_id, level: local or cloud. The independent input oracle must cover every acknowledged revision. A receipt in a file does not establish crash durability by itself; A02/A04/A05 must actually run. |

Example independent oracle, captured before importing/typing and held separately from app exports:

~~~json
{
  "schema_version": 1,
  "originals": {"original-1": "<sha256 of supplied bytes>"},
  "saved_revisions": {"revision-1": "<sha256 of expected UTF-8 saved text>"}
}
~~~

The before bundle is a separate prior export. Its original/revision/proposal/decision/asset/edition records must remain identical by ID in the after bundle. Restore must add a revision whose bytes and origin match its restored source. Proposed feedback deletion/retention does not require preserving feedback in this before/after invariant.

The checker rejects incomplete profiles, duplicates, path escape, dangling/cyclic revision references, cross-universe relations, unapproved/mismatched assets or editions, falsified origin on accepted AI text, missing saved checkpoints and consent violations. It compares original bytes against the external oracle, not only self-supplied checksums.

Limits: it cannot authenticate decisions, discover omitted data not represented in the oracle/before bundle, establish complete endpoint authorization, identify a real human's intent, validate a stable passage ID's meaning, or prove the absence of network telemetry. A malicious adapter could fabricate evidence. Retain independent request logs, crash/recovery captures, manifests, participant verdicts and runtime denial tests. Passing the projection is one structural check, never a product/security certification.
