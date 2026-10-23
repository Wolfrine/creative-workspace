# Noveliaa repository instructions

Read [INTENT.md](INTENT.md) and [.harness/objective.md](.harness/objective.md) first. The owner approved **Phase 1 development and Firebase deployment on 23 October 2026**. Deploy through GitHub Actions using the existing Firebase identity, verify the matching app/project/site, check the hosted UI, and share its live URL. The owner does not review localhost. Later stages remain unapproved.

**Keep Firebase on Spark**, as explicitly required by the owner. Phase 1 deploys
Hosting and Firestore Rules and uses Google Authentication. Do not request Blaze,
Functions/Storage deployment roles, API enablement or replacement keys for this
release. The earlier callable/backup architecture is unshipped reference work;
the current adapter and evidence are in `src/cloud/spark.ts` and
`docs/evidence/phase1/spark`. Normal console Google-provider enablement may still
need the owner. Verify current state before repeating any setup request.

## Current assignment: implement and evaluate Phase 1

1. Inspect the actual repository and relevant writing/story projects. Verify evidence and separate known facts from assumptions.
2. Build capture, freeform writing, optional organization, stable links/search, durable offline checkpoints, revision recovery and export. Follow Living Atlas with Quiet Folio writing; defer external AI, reader editions and feedback. Use the repository's evaluations and retain actual desktop/mobile and integrity evidence.
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
