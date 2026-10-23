# Phase 1 architecture

The editable manuscript belongs to the author. Immutable evidence is separate
from that editing surface. This implementation follows the [intent](../INTENT.md),
[research corrections](research/noveliaa-review-2026-10-23.md) and
[evaluations](../evals/README.md).

## Writing and persistence

React and Tiptap render versioned rich-text JSON. Titles, organization and links
are optional. A link stores a document ID inside its universe, so renaming a page
does not break navigation. Backlinks, Atlas and search are derived views of the
device's available writing; search explicitly describes that coverage.

`WritingEngine` keeps immediate typing in memory. After a 300 ms pause it creates
an immutable revision and, in one strict-durability IndexedDB transaction, writes
the document head, local save receipt and outbox operation. Only transaction
completion earns “Saved on this device.” An error leaves current text exportable
without requiring a successful checkpoint. Navigation/sign-out flush pending
typing; dirty close attempts trigger the browser's unsaved-work warning.

An authenticated adapter stages exact bytes first. The callable checks identity,
schema and digests, verifies immutable blob readback, then uses an expected-head
Firestore transaction. A stale base retains its revision as a conflict branch
without promoting it. Operation IDs make retries idempotent. Only this server
acknowledgement earns “Synced.” Catalog/identity registration contains no invented
manuscript or head. It supports linked archive replay, including mutual links.

Refreshes guard local heads inside the database write transaction and retain
records created while a read was waiting. Conflict markers persist across
restart. Tabs notify each other, but never resolve writing meaning automatically.
Choosing a previous version creates a new revision with preserved body, origin,
source references and ancestry. Restored archive branches receive an explicit
expected-head restoration only if the author has not subsequently edited them.

## Evidence and portability

An imported file is stored byte for byte with SHA-256 and unverified provenance.
Its editable UTF-8 derivative normalizes CRLF to LF; it does not rewrite wording.
Markdown import is literal text in this phase. Explicit imported-chat labels can
produce a speaker map with UTF-16 source positions; labels do not verify identity
or authorship. AI/mixed/unknown material cannot become approved canon through
this app: no approval or canon operation exists in Phase 1.

The JSON archive contains editor schema, universes, collections, current heads,
all revisions, originals and receipts. Validation checks structure, metadata,
digests, graph, links and provenance before an atomic restore into an empty
notebook. A competing tab cannot make that empty check stale. Unsupported schemas
are refused without stripping data. Text, Markdown and HTML are readable
derivatives; rich structure and full history use the archive.

Initial limits are 16 MiB per UTF-8 import, 64 MiB per portable JSON archive,
200,000 editor nodes and depth 30 per document. Oversized archives are refused
before download rather than offering an unrestorable file. History is never
pruned to fit these limits. Growing beyond them needs a larger portable format
before a complete-history move; individual current text/HTML remains exportable.

## Privacy and operational boundaries

Production requires Google sign-in, the configured author UID, and matching
server/Rules allowlists. Unconfigured access fails closed. Account device stores
are separate; a signed-in account change does not reassign pending writing.
Direct Firestore writes, source edits/deletes and later-phase paths are denied.
Admin callables independently enforce permissions. No manuscript or token is
logged. No public download URL is created.

The production service worker precaches a complete version of public code,
styles and fonts before activation. It caches no API/private writing, and an open
writer keeps a coherent app version. Public Firebase configuration is separately
cached for offline reopening. Actual authenticated offline cold start still needs
verification on the approved installation.

Cloud disaster backup is a distinct implementation with a separately provisioned
identity/bucket and verified restore tooling. Device-only writing cannot appear
in a cloud backup. Production IAM, retention, scheduling and RPO remain unverified;
see [Firebase boundaries](FIREBASE.md). There is no deployment workflow, external
AI client, reader edition or feedback/behavior ingestion in this phase.
