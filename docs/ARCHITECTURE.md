# Noveliaa architecture — writing plus private plugin

The author owns the editable manuscript. Immutable originals and revisions stay
separate from that surface. Living Atlas supplies optional links and context;
Quiet Folio supplies focused writing. The owner approved a full private ChatGPT
plugin on 25 October 2026 and reports Blaze/Functions enabled. Shared editions
and feedback remain deferred. Existing Firestore writing and save timing stay
unchanged; the plugin adds a separate, scoped collaboration boundary.

## Writing and device persistence

React and Tiptap render versioned rich-text JSON. Titles and collections are
optional. Links store stable document IDs within one universe; backlinks, Atlas
and search derive from available device writing. Nothing invents a story schema.

`WritingEngine` keeps typing in memory and resets independent idle timers after
an actual content change. After **10 seconds without an edit**, a strict-durability
IndexedDB transaction replaces this engine's mutable recovery draft. It does not
create a permanent revision or enqueue a Firestore SDK write. Navigation, sign-out
and backgrounding perform an immediate **local-only** safety save. Device failure
keeps the current text exportable and never earns a save acknowledgement.

After **60 seconds without an edit**, automatic cloud work checkpoints the latest
writing into an immutable revision and durable outbox, then uploads it. Neither
continued typing nor reconnecting starts an upload early. Manual sync, explicit
history/recovery and archive export are version boundaries; opening history and
exporting never upload early themselves. An old asynchronous save cannot mark
newer typing saved. Returning exactly to the checkpoint discards only this writer's
superseded mutable draft and creates no new revision.

Draft keys are separate per engine/tab. Restart promotes surviving recovery drafts
into durable revisions, preserving simultaneous variants. IndexedDB version 2
adds the draft store without rewriting existing originals, revisions or outbox
operations. All earlier immutable history remains. The sync indicator is a small
static accessible button; details and manual sync are available on tap. Fresh
devices open the latest available page; returning devices remember their page.
See [the save and sync contract](SYNC.md) for lifecycle limits and verification.

First-line indentation is optional per top-level paragraph (`firstLineIndent:
true`), toggled in the formatting toolbar. Enter inherits it; the author can
toggle the next paragraph off. No spaces or tabs are inserted. HTML retains the
2em style; text and Markdown retain the exact words. Missing attributes in older
revisions remain missing, preserving their hashes. Lists, quotes and headings
keep their own layout. Desktop collection movement uses a themed keyboard
listbox; phones use the native selection control.

## Spark cloud persistence and trust boundary

### Collection names

A confirmed rename updates the existing collection identity and queues a durable
metadata intent in the account/workspace IndexedDB preferences transaction. The
optional `nameVersion` contains a unique proposal ID and monotonically increasing
generation; old records and archives without it remain supported. Existing
collections are create-only in ordinary catalog uploads. A dedicated expected-
version transaction writes the changed name; unrelated stale uploads cannot put
the old name back. Competing renames retain the local intent and expose explicit
local/remote name choices. Clean listener updates adopt names silently. A normal
successful rename writes one collection document and creates no text revision.

### Library and private Read mode

`Library` presents locally available pages/collections in the main workspace;
sidebar shortcuts remain bounded. Inbox is still derived from null collection
membership. Browsing/filtering does not add a Firestore query per action.

`Reader` uses a cloned local snapshot of the exact rich-text documents, their
authored order and origin labels. DOM text remains selectable and semantic;
CSS multicolumn fragmentation provides one leaf on narrow screens and optional
facing leaves on wide screens. Typography and viewport changes recalculate the
layout around a passage/offset anchor. Local bookmarks carry a body fingerprint
only for resume invalidation, never integrity, canon or approval. A changed body
or missing source resets the stale anchor explicitly. The last reading scope and
position are isolated by account, workspace and universe. Collection bookmarks
use collection identity, so adding a page does not alone discard the bookmark.

Read mode keeps incoming source changes separate from the current frozen reading
session. Opening it performs a local-only recovery flush. Page turns, appearance
and bookmarks do not call cloud writes or create manuscript revisions. Optional
paper-turn motion is a restrained visual leaf/shadow effect; reduced motion and
the reader preference disable it. Export remains in the sidebar. This is private
author rereading; shared approved editions and feedback remain deferred.

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

Automatic uploads follow the **60-second trailing idle deadline**. Every edit
resets the deadline. Existing pending revisions remain immutable and upload in
ancestry order. A manual cloud check can upload immediately; backgrounding saves
only locally, and reconnecting respects the deadline. Wait for Synced before
relying on another device; browser shutdown cannot guarantee cloud delivery.

Firestore uses its persistent IndexedDB cache with multi-tab coordination. Three
long-lived `onSnapshot` subscriptions cover heads, universes and collections,
plus the separate access listener. Cached/optimistic snapshots cannot earn a
cloud receipt, and unchanged confirmed metadata does not trigger hydration.
Missing referenced records are fetched and verified by ID. Full branch history
and originals load on explicit history/archive requests. Cold head ancestry is
still loaded and validated. Verified local bytes are reused; new uploads still
require server readback.

A clean device automatically adopts descendant heads, including its selected
page. Selection alone is never a conflict. Dirty text, durable pending operations
and divergent branches stay protected. Old false conflict flags clear only
inside the same IndexedDB transaction that proves safe head adoption, with no
pending operation. Actual alternatives remain in immutable history.

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
outbox and device checkpoint. Initial subscriptions read current heads and organization; later events stream
changed records. Explicit history/export loads the full branch history. Cold
head-ancestry loading and very large library pagination remain future work. Each
cloud revision retains its integrity cost (typically five document writes for a
small new single-chunk revision on an existing page); local recovery updates do
not create cloud revisions. Idle listeners create no writes. Persistent reconnects beyond 30 minutes can be
billed as a fresh query. See [Firebase persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
and [listener pricing](https://firebase.google.com/docs/firestore/pricing).

## Recovery and operating limits

The service worker precaches public code, styles and fonts as a coherent app
version. It never caches private API responses. Public SDK configuration and a
previously verified account's access flag permit offline reopening on that device;
these are not cloud grants and do not bypass Rules when online.

Device checkpoints, immutable cloud revisions and downloadable complete archives
provide Phase 1 recovery. Scheduled independent backups, PITR, protected backup
buckets and a verified 24-hour disaster RPO are **not shipped**. Existing
Functions/Storage backup and callable sources remain reference work; the new
entrypoint exports only `noveliaaMcp`. See [Firebase operations](FIREBASE.md) and
[current evidence](PHASE1_RESULTS.md).

## Private ChatGPT plugin

`plugin/noveliaa` packages three skills (explore writing, story research,
collaborate on writing) with OAuth/DCR MCP configuration. A single stateless
Streamable HTTP Function at the existing Hosting `/mcp` path supplies six tools.
Discovery is public schema only; every private tool requires an author-issued
OAuth grant, current account access, current workspace generation and selected
universes. Read-only is the default consent; proposals are an optional permission.
The grant covers future cloud-saved pages in the selected universes. Tokens
have a one-hour access lifetime and rotating refresh families lasting up to 90
days. Author revocation, refresh replay or workspace reset invalidates access.

Reads verify chunk SHA-256, manifest sizes, bounded decompression, canonical
snapshot hash and editor/text projection before returning source text. Search
scans ten pages per explicit call with a cursor, avoiding a new indexing worker.
No per-keystroke Function calls or new writer listeners are introduced.

`submit_record` performs one new immutable collaboration document write after
checking the grant and source. Identical idempotent retry performs no record
write. Writing blobs, originals, heads and revisions are never written by MCP.
Every record remains AI-origin/unverified and names its exact revision/hash.
Author reviewed/dismissed decisions append a separate event and update a review
projection (two writes for a new decision, none for an identical repeat).
Review is not canon approval; applying any text remains a manual author action.

`/api/integrations/connect` requests nonempty universe selection and optional writeback. The
Firebase Google author identity and HttpOnly same-site `__session` cookie bind
the consent to this browser/request. Hosting forwards only that cookie. The
same-origin `/api/integrations/review` UI can revoke, review, dismiss and export collaboration
records separately from the existing writing archive. Client Firestore Rules
deny OAuth and collaboration namespaces; the API verifies the author independently.

OAuth discovery advertises `/api/oauth/authorize`. These canonical API-prefixed
navigation paths bypass the previous writing service worker's cached shell while
preserving its offline writing behavior. `/authorize`, `/connect` and `/connections`
remain compatibility aliases. Hosting serves the two integration UI paths before
the Function rewrites; other integration API paths reach the Function.

No server-side AI inference, new Storage bucket, scheduled backup, shared
reader, publication or feedback system is activated. The Function scales to
zero, max two instances; the existing weekly aggregate Firestore audit includes
its usage. The weekly job also reclaims expired pending requests, codes and
token metadata in fixed OAuth namespaces (bounded 1,000 each); consent grants,
client registrations, proposals and author evidence remain preserved. Expiry is
enforced on every request independently of this cleanup. See
[plugin contract](design/PLUGIN_CONNECTION.md) and retained tests.
