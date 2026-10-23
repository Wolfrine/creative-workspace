# Noveliaa

**Phase 1 implemented and visually checked • GitHub Actions deployment blocked by Firebase setup/access**

A private, author-led workspace for writing stories, collaborating with external AI through plugin/MCP, preparing approved reader experiences, and gathering meaningful peer reactions.

- [Product intent (working draft)](INTENT.md)
- [Instructions for Codex and other development agents](AGENTS.md)
- [Minimal harness objective](.harness/objective.md)
- [Research and architecture review](docs/research/noveliaa-review-2026-10-23.md)
- [Automated and human evaluations](evals/README.md)
- [Visual prototypes and owner preference](design/prototypes/README.md)

Phase 1 provides untitled capture, a quiet rich-text editor, collections, explicit links/backlinks and Living Atlas, local search, immutable device checkpoints/outbox, expected-head cloud commits, recovery and portable exports. Exact imported bytes and provenance stay separate from editable writing. There is no embedded AI, reader publication or feedback collection.

Use Node 22.12+ (tested with Node 24.19), Python 3.11+ and Java 21 for emulators:

```sh
npm ci
npm --prefix functions ci
npm run dev
```

Open `http://127.0.0.1:5817/?local=1` for a **development-only device notebook** with synthetic material you supply. It saves in this browser's IndexedDB and has no cloud access. This entry point is compiled out of production. Normal access requires Firebase Google sign-in and a server-side configured author allowlist; see [Firebase setup and backup boundaries](docs/FIREBASE.md). Do not put a real manuscript in a test notebook.

```sh
npm test
npm --prefix functions test
npm run build
npm run test:evidence
npm run test:rules
npm run test:browser
```

Browser checks start local dev/production-preview servers and require `npx playwright install chromium`. `npm run test:crash` and `npm run profile:writing` require the development server. Authenticated callable tests use the isolated emulator configuration documented in [docs/FIREBASE.md](docs/FIREBASE.md).

[Phase 1 results and remaining gates](docs/PHASE1_RESULTS.md) distinguish synthetic runtime evidence, agent visual review, human acceptance and production checks. Owner review takes place on Firebase, not localhost. The verified site is **https://noveliaa.web.app**; it is not live yet. The [deployment report and one-time setup steps](docs/DEPLOYMENT.md) record the actual Actions failure and missing project permissions. The GitHub secret is never printed or copied into this repository.
