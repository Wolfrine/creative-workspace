# Installed connector compatibility correction

3 November 2026. Documentation and private plugin skills only, version 0.1.4.
The installed connection still exposes an ID-only fetch_page schema. This does
not prevent URL use: validate the locator, extract documentId, fetch by ID and
check its returned universe against the canonical URL before using any writing.
The server pageUrl endpoint and exact author grants remain unchanged.

Parent-only live verification used list_pages pageUrl and the installed
Noveliaa Connection. Canonical URL ID extraction, followed by fetch_page with
that ID and the listed revisionId, matched documentId, universeId, revisionId
and contentHash exactly; integrity was sha256-verified. Legacy root ?page=ID
parsing followed by the existing ID-only call independently matched the same
four fields. The fetched revision fit one part (nextOffset null); the skills
retain explicit revision/hash and pagination checks for longer text.

Local procedural checks accepted five canonical/Unicode/legacy examples and
rejected twenty wrong-host, malformed-path, traversal, credential, query and ID
examples. The client-side universe check also rejected a deliberately
mismatched URL universe against the verified response, without a broader read.
These malformed examples are synthetic; the successful revision reads were
real authorized read-only calls. No writing, heartbeat, grants or private source
text were changed or copied into this evidence.

All three skill frontmatters and the versioned plugin archive are validated
before release. The retained visual evidence describes the preceding UI
implementation; this correction changes no UI and infers no owner acceptance.
