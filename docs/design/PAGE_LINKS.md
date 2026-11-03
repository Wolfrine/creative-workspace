# Private page links

Owner request, 3 November 2026: locate each page by collection/title URL and let
an authorized external AI fetch that URL without looking up a document ID.

Canonical author route:
`https://noveliaa.web.app/u/{universeId}/{collection-slug}/{title-slug}/{documentId}`.
Universe and document IDs are immutable. Unicode names normalize to bounded
slugs; blank titles use `untitled`, uncollected writing uses `inbox`. Duplicate
names cannot collide. Slugs are advisory: old names/moves still resolve the same
ID and replace the address with current metadata. A mismatched universe fails.
The existing root `?page=ID` locator remains supported. No migration or alias
records, route queries, new listener, polling or per-view cloud writes are used.

Normal author authentication remains the gate. Route resolution waits for the
existing cloud hydration, hides unrelated selected prose while pending, and
never falls back to another page for invalid, missing or trashed references.
Browser back/forward resolves the same way and closes the prior page's transient
history dialog or frozen Reader session before resolving the target. Selecting pages uses the existing
local draft flush; autosave timing, revision retention and Heartbeat are retained.
After an authorized workspace reset an old document URL is unavailable; going
to the app root deliberately opens the new workspace.

Copy page link is the quiet chain icon alongside the existing page actions in
Writing and the Reader header. It copies the current visible Reader document,
using current metadata even when the reading snapshot is frozen. Clipboard
failure offers a selected read-only URL field. Copying grants no access and
does not force a cloud upload: unsynced writing must reach normal cloud save
before an external client can retrieve its newest revision.

`fetch_page({pageUrl: "PASTED_URL"})` parses the immutable IDs on the server and
uses the existing live grant, universe, revision and SHA-256 validation. Existing
`documentId` calls still work; clients with cached schemas may pass the pasted
URL in that string field. Supplying both fields requires matching identities.
Only HTTPS URLs on `noveliaa.web.app` or `noveliaa.firebaseapp.com` are accepted;
credentials, other hosts, paths, traversal, conflicting query IDs and fragments
are rejected. Anonymous requests are challenged, revoked grants fail, and
out-of-grant writing stays inaccessible. URLs are never fetched by the server.

List/search/fetch return `pageUrl` from the metadata already read. The server
does not additionally fetch the collection catalog; collected-page URLs use a
collection-ID fallback, then the author app canonicalizes their collection name.
Historical revision responses locate the current document while retaining the
requested revision/hash. Grants are not widened, and no security rule changes.

Bounded Central refinement: packaged Central 0.2.3, base
`d097786cf3d6c5a2859439112afdd39538316567`. Retain Quiet Folio typography,
sage/paper palette, prose capacity, Heartbeat and established navigation. Add
one utility icon, plus failure-only dialog. No direction reset. Critical visible
conditions: prose area unchanged, copy controls fit and retain keyboard access,
no horizontal overflow at 1440/390/320, actionable copy failure. Parent implements
and checks QA; independent read-only critic views matched renders and live states.
Synthetic fixture screenshots are not owner writing or owner visual acceptance.

Evidence: [source-bound candidate](../evidence/page-links-2026-11-03/manifest.json),
[independent critique](../evidence/page-links-2026-11-03/critic-review.md).
