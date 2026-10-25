# Project objective — Noveliaa

**Owner intent:** Build a private author-first writing workspace that preserves raw creative control, supports externally connected AI collaboration, prepares an approved reading experience, and gathers respectful peer reactions.

**Stage:** Owner-approved Phase 1 development, evaluation and deployment through GitHub Actions (23 October 2026), plus a full private ChatGPT plugin with MCP and skills (25 October 2026). The owner reports Blaze and Functions enabled. Verify the existing Firebase app/site and use its live URL for owner review. Shared reader editions and feedback remain unapproved.

**Delivery default (24 October 2026):** All agents commit and deploy directly
from `main` unless the owner explicitly specifies another workflow. Do not create
feature branches, worktrees or PRs by default. Preserve unique work during cleanup.

**Approved extension (25 October 2026):** Collection renaming, a dedicated
Library and collection views, and a private author-only paginated Read mode
with optional page-turn animation. Read replaces Export in mobile navigation;
Import & export remains in the side menu. Nesting is deferred. This author
rereading tool does not approve publication, shared editions, AI transformations
or peer feedback. See [design contract](../docs/design/LIBRARY_READER.md).

## Constraints

- Simple freeform writing comes first; no forced canon or wiki taxonomy.
- No in-app AI chat/API key. External clients access authorized data via plugin/MCP and write back traceable discussions/proposals.
- AI cannot silently change source, canon or publication.
- Approved presentation precedes peer feedback.
- Consent and privacy govern reader signals; behavior is not an emotion label.
- Preserve exact writing, history, provenance, backups/export and multiple independent story universes.

## Demonstrable success

1. Author captures and retrieves a scene without mandatory setup.
2. External AI reads only an allowed revision, converses outside the app and records linked output without overwriting the scene.
3. Author explicitly approves a version and a proposed presentation.
4. A peer reads that version, leaves effortless feedback, and may consent to limited behavior capture.
5. The author traces every suggestion, visual, reaction and decision to the exact original/revision, or restores earlier material.

## Remaining release decisions

The owner moved the existing Firebase project to **Blaze** and enabled Functions
for the private plugin. Use its existing GitHub Actions secret for Hosting,
Firestore Rules and the single MCP HTTP Function. Do not activate the older
Storage callable/backup reference. Verify matching Web App/site, Google
provider and author UID. Independent scheduled backups are deferred; device
recovery, immutable cloud history and downloadable archives are current recovery.
Complete hosted, physical-device and author writing/recovery acceptance. External
reader publication and reader consent belong to later phases. Plugin consent is
limited to selected universes and optional unverified writeback; see the plugin
design contract.

**Detailed intent:** [INTENT.md](../INTENT.md). **Current evidence:** [Phase 1 results](../docs/PHASE1_RESULTS.md).
