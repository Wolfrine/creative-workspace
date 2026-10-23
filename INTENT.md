# Noveliaa — creative writing workspace

**Status:** Phase 1 development and Firebase deployment approved by the owner on 23 October 2026. Build and test recoverable, author-first writing using Living Atlas with Quiet Folio. Deploy through GitHub Actions to the verified existing Firebase app/site and provide its live URL after hosted visual checks. External AI collaboration, reader editions and feedback remain later phases.
**Project:** `Wolfrine/creative-workspace` (private). **App name:** Noveliaa (working name).

## Why this exists

The author once developed stories directly in notebooks, then in personally organized folders and files. Writing evolved through chapters, lore and experimentation, with family and friends providing real reactions. Later AI-led attempts turned brief notes into confident but inaccurate structure, changed meaning, scattered discussions and diluted creative control.

**The app must restore direct authorship first.** AI assists with exploration and presentation; it never takes ownership of the story.

## Four connected stages

1. **Write freely.** Start writing immediately—thoughts, fragments, plots, chapters, scenes, characters, lore, universe rules and references. Offer a distraction-free editor, quick Unsorted Inbox, last-opened page, simple formatting, optional folders/collections, wiki-style links/backlinks, search, offline capture, history and export. Never require a story schema before writing.
2. **Collaborate through external AI.** No built-in AI chat or model API key. A permission-scoped plugin/MCP interface lets compatible external AI clients retrieve selected content, discuss, research, critique and return linked records and proposals. Preserve what was actually said, its source/revision and whether a statement is a question, interpretation, assumption or suggestion. Agents ask about ambiguity; they cannot silently rewrite source or approve canon.
3. **Prepare the reader experience.** From **author-approved material**, agents may propose story structure, formatting, illustration, motion and an immersive website/private preview. The author reviews fidelity and explicitly approves changes and assets. Rejected alternatives and original drafts remain recoverable.
4. **Share and learn from peers.** Readers receive an approved, coherent version—not scattered raw notes. Enable simple, non-disruptive reactions (tap, memorable moment, confusion point, optional voice/text). With explicit informed consent, collect limited reading behavior (pauses, revisits, skips, exit) tied to the exact preview version. These signals suggest questions; they do **not** reveal emotions reliably. Keep responses, behavior and the author's in-person observations distinct.

## Invariants

- **Only the author determines canon.** All agent edits are proposals until explicitly reviewed and accepted.
- **Protect exact meaning and provenance.** Distinguish recovered original writing, remembered reconstruction, new author writing, imported chats, AI proposals, approved canon and published editions. Never pass inferred lore off as source fact.
- **One recoverable source of truth.** Maintain revision history, export/backup and links among writing, external discussions, decisions, media and reader responses. Keep unrelated universes separate.
- **Privacy by design.** Private by default; no silent publication or covert camera, microphone or biometric capture. Reader behavior requires consent and a clear way to opt out.
- **Writing before automation.** Do not impose large taxonomies, wiki generation or complicated agent workflows before direct writing is satisfying.

## First useful demonstration

Follow **one author-written scene** through capture → a real external AI discussion with traceable writeback → author-reviewed presentation → private peer reading with lightweight reactions. Show that the original remains untouched, results refer to exact revisions, and the writer can accept, reject or undo suggestions.

## Existing work to inspect, not automatically import

- [NovaSaga](https://github.com/Wolfrine/NovaSaga) — story material and archives; may mix author and AI-shaped content, so provenance/canon must be checked before reuse.
- [Novel-Encyclopedia](https://github.com/Wolfrine/Novel-Encyclopedia) — previous editor/wiki experiment; reference only.
- [StoryForge](https://github.com/Wolfrine/StoryForge) — reader presentation/analytics experiment; assess reusable ideas, avoid runtime dependency by default.

The earlier [Space intent draft](https://chatgpt.com/space/page_6ad9dead8cec8191bd7a0b8236c9855e) records the fuller reasoning. Differences must be reviewed with the author before being treated as decisions.

## Decisions still open

Private sharing beyond the author; later-stage data/attachment schema; plugin/MCP authorization and writeback contract; media review and versioning; reader-consent data retention; whether/how to migrate existing fragments. **The owner requires Spark.** Phase 1 uses Google sign-in, an author UID allowlist enforced by Firestore Rules, immutable Firestore history, device recovery and downloadable archives. Functions, Storage, paid recovery and scheduled independent backups are deferred. Firebase project `noveliaa` (number `278082781314`), Web App `1:278082781314:web:9a4b7acef07fa8e4dfb49b`, native Firestore in Mumbai and Hosting site `noveliaa` / `https://noveliaa.web.app` were verified through GitHub Actions. See [current deployment evidence](docs/DEPLOYMENT.md) for Google-provider setup and actual release status. The existing secret is `FIREBASE_SERVICE_ACCOUNT`; no credentials should be opened or copied into source.

**Codex handoff:** Implement the approved writing phase, preserve provenance and originals, and provide observable test/visual evidence. Flag deployment configuration and decisions that require the owner. Do not infer approval for later stages or publication.
