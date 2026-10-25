# Noveliaa repository instructions

## Development location

The verified owning Windows checkout is
`F:/Workspace/Programs/Independent-Products/Noveliaa`. All new development source,
scripts, build/test output, reports and scratch must stay on F. The earlier
C-drive chat checkout is a retained recovery copy and must not be extended.
Dot-source `. ./.harness/dev-environment.ps1` before Windows commands to keep
Node, browser/emulator caches, temporary profiles and Python bytecode on F.
Codex/Windows-managed application state and installed platform binaries remain
in their required platform locations. Linux GitHub Actions runners retain the
existing deployment workflow; deliver directly from `main`.

Read [INTENT.md](INTENT.md) and [.harness/objective.md](.harness/objective.md) first. The owner approved **Phase 1 development and Firebase deployment on 23 October 2026** and **a full private ChatGPT plugin with MCP and skills on 25 October 2026**. Deploy through GitHub Actions using the existing Firebase identity, verify the matching app/project/site, check the hosted UI, and share its live URL. The owner does not review localhost. Shared editions and feedback remain unapproved.

**Work and deploy directly from `main` by default.** The owner explicitly set
this rule for every agent on 24 October 2026. Do not create a feature branch,
worktree or PR unless the owner specifies that workflow. Run the required checks
before pushing; use the existing GitHub Actions release from `main`. Preserve
unique work before removing completed branches/PRs. This does not approve later
product phases or override a plan-only request.

**The owner reports Blaze and Functions enabled (25 October 2026).** This
supersedes the earlier Spark-only constraint for the plugin integration. Keep
the current Firestore writing adapter, Google Authentication and existing
Actions identity. Deploy only `noveliaaMcp` from `functions/src/mcp-entry.mjs`;
the older Storage callables/scheduled backup remain unshipped reference work.
Never request replacement keys or speculative roles; investigate actual failures
and PTI's working deployment before reporting a concrete permission blocker.

## Current assignment: implement and evaluate Phase 1

1. Inspect the actual repository and relevant writing/story projects. Verify evidence and separate known facts from assumptions.
2. Build capture, freeform writing, optional organization, stable links/search, durable offline checkpoints, revision recovery and export. Follow Living Atlas with Quiet Folio writing. The owner approved collection renaming, dedicated Library views and private author Read mode on 25 October 2026; see `docs/design/LIBRARY_READER.md`. Collections stay flat. The private plugin approval and boundary are in `docs/design/PLUGIN_CONNECTION.md`; shared reader editions and feedback remain deferred. Use the repository's evaluations and retain actual desktop/mobile and integrity evidence.
3. Reuse existing work selectively; do not change NovaSaga, Novel-Encyclopedia, StoryForge or any other repository without a separate request.

## Non-negotiable creative safeguards

- The author's exact writing is immutable as evidence; changes are versioned and reviewable. AI suggestions must never overwrite source or silently become canon.
- Record provenance: original/recovered, remembered reconstruction, new author material, imported chat, AI proposal, author approval and publication revision.
- External AI clients connect through a properly authorized plugin/MCP interface; no embedded LLM chat or required model API key in the authoring app.
- The reader experience is prepared from approved material **before** peer feedback. Consent-based interaction data is not an emotion detector.
- Keep a usable simple writing experience, private access, backups/export and revision recovery at the center.
- Never expose, log, fetch or commit Firebase service account credentials. The user reports a GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT`; its contents are not required for planning. Verify non-secret project configuration later.

## Workflow and review

- State scope and risks before edits; keep documents concise and linked to evidence.
- For task-relevant UI/design, harness or causal-analysis work, load the corresponding Wolfrine Central plugin skill (`central:visual-design-director`, `central:harness-setup`/`central:harness-review`, or `central:sefpo`). Record an actual release/version only if verified; do not invent it. If the plugin is unavailable, ask for the relevant source or disclose the limitation.
- Any proposed AI-driven content transformation, media generation or publication requires author review. Keep alternative proposals separate.
- Before claiming completion, verify observable behavior and describe what was actually tested.
