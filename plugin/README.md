# Noveliaa private plugin

Portable source lives in `noveliaa/`: three reusable skills, a Streamable HTTP
MCP connection, OAuth discovery/DCR configuration and existing Noveliaa branding.
No tokens or service account keys belong in this package.

The server is the single `noveliaaMcp` Firebase Function on `noveliaa`, reached
through `https://noveliaa.web.app/mcp`. Install the private plugin in ChatGPT,
then complete Google sign-in and choose universes on Noveliaa's consent page.
No universe is selected by default. Sharing includes future cloud-saved pages
in those universes. Proposal writeback is optional. Revoke in AI connections.

Records are immutable, AI-origin, unverified and anchored to an exact revision
and content hash. Mark reviewed or dismissed in the author UI; neither action
changes the original or makes it canon. Export collaboration separately from
the writing archive. This release has no shared reader or publication tools.

MCP reads cloud-confirmed revisions. Local recovery drafts are not exposed. Wait
for the normal sixty-second cloud save or use explicit Sync in writing before
asking ChatGPT to read a very recent change. Closing the writing page saves a
local recovery copy; its automatic cloud timer resumes when writing reopens.

The Function runs in Mumbai, scales to zero and is limited to two instances,
one active request per instance to bound memory for large source verification.
Search reads a maximum ten source pages per batch; it does not scan the whole
workspace in the background. Submission creates one collaboration document;
an identical retry creates none. Weekly aggregate usage review remains active.

Build/validate the archive with `python scripts/package-plugin.py`; the resulting
ZIP goes to `.local/plugin-package/`, outside the package directory. Upload once
through Plugin Creator after the live server is verified. Retain the returned
private plugin/release IDs; update that plugin rather than creating duplicates.
