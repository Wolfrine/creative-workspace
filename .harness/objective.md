# Project objective — Noveliaa

**Owner intent:** Build a private author-first writing workspace that preserves raw creative control, supports externally connected AI collaboration, prepares an approved reading experience, and gathers respectful peer reactions.

**Stage:** Owner-approved Phase 1 development, evaluation and deployment through GitHub Actions (23 October 2026). Verify the existing Firebase app/site and use its live URL for owner review. Phases 2–4 remain unapproved.

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

Keep the existing Firebase project on **Spark**. Use its existing GitHub Actions
secret for Hosting and Firestore Rules; do not request Functions, Storage, Blaze
or API-enablement access for Phase 1. Verify matching Web App/site, Google
provider and author UID. Independent scheduled backups are deferred; device
recovery, immutable cloud history and downloadable archives are current recovery.
Complete hosted, physical-device and author writing/recovery acceptance. External
connector permissions, reader publication and consent belong to later phases.

**Detailed intent:** [INTENT.md](../INTENT.md). **Current evidence:** [Phase 1 results](../docs/PHASE1_RESULTS.md).
