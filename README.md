# Noveliaa

An author-first writing workspace: effortless capture, quiet rich-text writing,
optional organization, stable links and Living Atlas, reliable device saves,
immutable revision history, exact originals and portable export.

Phase 1 uses **Firebase Spark**: Authentication, Firestore and Hosting. The owner
reviews **https://noveliaa.web.app** after an authorized **GitHub Actions** release.
The existing repository secret is used; Functions, Storage and Blaze are excluded.
See [actual deployment status](docs/DEPLOYMENT.md) before calling the app live.

- [Intent](INTENT.md), [agent instructions](AGENTS.md), [objective](.harness/objective.md)
- [Architecture and trust boundary](docs/ARCHITECTURE.md), [Firebase operations](docs/FIREBASE.md)
- [Research](docs/research/noveliaa-review-2026-10-23.md), [evaluations](evals/README.md)
- [Design choice](design/prototypes/README.md), [results and remaining gates](docs/PHASE1_RESULTS.md)

Living Atlas is primary; Quiet Folio supports focused writing. Story Workbench,
external AI collaboration, reader editions and feedback remain later phases.
Imported and AI material remain unverified; the app never silently approves canon.

Use Node 22.12+ (CI 24), Python 3.11+ and Java 21:

```sh
npm ci
npm --prefix functions ci
npm run dev
```

`http://127.0.0.1:5817/?local=1` is an isolated **development-only** device notebook.
Use synthetic text. Production compiles this entry point out and requires the
configured author's Google sign-in. Local previews are not the owner's review path.

```sh
npm test
npm run build
npm run test:evidence
npm run test:rules
npx playwright install chromium
npm run test:cloud
npm run test:browser
```

Spark emulator/browser checks use only loopback `demo-noveliaa`. Original visual,
crash and performance evidence remains preserved; current Spark evidence is
separately identified. `functions/` retains unshipped callable/backup reference
work and the Admin SDK used by Actions setup and emulator tests. No Function is
configured for deployment.
