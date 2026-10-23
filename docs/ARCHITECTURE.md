# Phase 1 architecture — Spark

The author owns the editable manuscript. Immutable originals and revisions stay
separate from that surface. Living Atlas supplies optional links and context;
Quiet Folio supplies focused writing. External AI, reader editions and feedback
remain deferred. The owner requires the Firebase project to stay on **Spark**.

## Writing and device persistence

React and Tiptap render versioned rich-text JSON. Titles and collections are
optional. Links store stable document IDs within one universe; backlinks, Atlas
and search derive from available device writing. Nothing invents a story schema.

`WritingEngine` keeps typing immediate. After a 300 ms pause, one strict-durability
IndexedDB transaction writes the immutable revision, current head, local receipt
and outbox operation. Only completion earns the device-save label. Failure leaves
open text exportable. Navigation and sign-out flush pending edits; dirty close
attempts trigger the browser warning. Tabs preserve divergent versions instead
of resolving meaning automatically. Fresh devices open the latest available page;
returning devices remember their last-opened page.

## Spark cloud persistence and trust boundary

The production client uses **Authentication + Firestore + Hosting**. No Functions
or Storage deployment, API enablement, scheduled job or billing upgrade is needed.
Google sign-in verifies the configured human author's UID through Firestore Rules.
Account device stores remain separate, including pending work after sign-out.

`src/cloud/spark.ts` implements the existing cloud adapter. Catalog entries are
individual records; updates cannot erase concurrent catalog additions or move an
identity between universes. Document-ID registrations contain no invented text.
Originals and canonical revision JSON become digest-addressed Firestore blobs.
Each blob is optionally gzip-compressed, divided into at most 192 KiB chunks,
and stored with an immutable manifest. Rules compute each chunk's SHA-256.
The client reconstructs bytes, bounds decompression, checks the complete digest
and validates revision/provenance structure before merging into IndexedDB.

An expected-head Firestore transaction atomically creates the immutable revision
and idempotent operation receipt. It advances the head only if the expected
predecessor still matches. Losing revisions remain in history. A changed replay
under an existing operation ID fails. A stale optimistic transaction rejected by
Rules is retried only after a server read proves that its observed head changed.
Only an acknowledged transaction earns “Synced”; queued SDK writes do not.

Rules deny other users, anonymous access, evidence updates/deletes, standalone
head rollback, later-phase paths and client allowlist edits. They enforce chunk
hashes, identity boundaries and atomic head/revision/operation linkage. **Full
rich-text semantics, cross-chunk digest and provenance validation run in the
client.** Phase 1 trusts its single human author. These Rules are not an external
AI writeback contract; machine writers need a separately reviewed later-phase
boundary. Project administrators still possess administrative powers.

## Exact evidence and portability

Imported UTF-8 files retain their exact bytes and SHA-256 with unverified origin.
The editable derivative normalizes CRLF to LF without rewriting wording; Markdown
import remains literal text. Conversation speaker labels are source offsets,
not verified attribution. No Phase 1 approval/canon operation exists.

Restore creates a new revision and retains intervening versions. A full JSON
archive contains editor schema, organization, links, originals, heads, every
revision and receipts, including pending work. Validation checks digests,
ancestry, links and provenance before an atomic import into an empty notebook.
Plain text, Markdown and HTML are readable derivatives.

Limits: 16 MiB per text import, 32 MiB uncompressed per cloud blob, 64 MiB per
portable JSON archive, 200,000 editor nodes and depth 30. Exceeding a cloud limit
leaves the complete device record exportable and reports failure. History is
never silently pruned. Larger complete-history moves require a larger portable
format. Firestore's free quota also bounds this design; quota failure retains the
outbox and device checkpoint. Cloud loading currently reads the complete library
and history, so large-library pagination remains future work.

## Recovery and operating limits

The service worker precaches public code, styles and fonts as a coherent app
version. It never caches private API responses. Public SDK configuration and a
previously verified account's access flag permit offline reopening on that device;
these are not cloud grants and do not bypass Rules when online.

Device checkpoints, immutable cloud revisions and downloadable complete archives
provide Phase 1 recovery. Scheduled independent backups, PITR, protected backup
buckets and a verified 24-hour disaster RPO are **not shipped** on Spark. Existing
Functions/Storage backup and callable sources are retained reference work only;
`firebase.json` excludes them. See [Firebase operations](FIREBASE.md) and
[current evidence](PHASE1_RESULTS.md).
