# Noveliaa deployment — GitHub Actions, Spark

Owner review uses **https://noveliaa.web.app**, the existing Firebase site for
project `noveliaa` (278082781314), Web App
`1:278082781314:web:9a4b7acef07fa8e4dfb49b`. Localhost is development evidence
only. Deployment is already authorized; the owner requires Spark.

**October 24 refinement release: implemented on `main`, publication blocked.**
Commit `ae09cd8f636d985c5a3ec7a7b40fc2dc405e915a` contains the tested refinements.
The [deployment Action](https://github.com/Wolfrine/creative-workspace/actions/runs/40086703018)
and [CI Action](https://github.com/Wolfrine/creative-workspace/actions/runs/40086702833)
stopped before checkout. GitHub's visible job annotation says: “The job was not
started because recent account payments have failed or your spending limit needs
to be increased. Please check the 'Billing & plans' section in your settings”.
A single deployment retry also stopped before any step. After the owner reported
the account restriction resolved, deployment attempts 3 and 4 and CI attempt 2
again stopped before checkout. The latest annotation at 11:02 UTC still repeats
the same account restriction; see [attempt 4](https://github.com/Wolfrine/creative-workspace/actions/runs/40086703018/job/120855526488).
No new Firebase release
occurred. The live site still serves the previous successful release.

The human owner must resolve the GitHub account payment/spending-limit block;
no financial setting was changed. Then rerun the existing Action, verify Rules
readback, all configured hosted asset digests and desktop/mobile hosted renders.
Firebase remains Spark; the pipeline, secret and target are unchanged.
[Blocker evidence](evidence/phase1/refinement-release-2026-10-24/status.json)
includes the exact run/commit and a retained screenshot of the annotation.

**Main-first delivery (owner instruction, 24 October 2026):** Every agent works,
commits and deploys directly from `main` unless the owner explicitly specifies
another workflow. Feature branches, worktrees and PRs are not the default review
path. The production workflow accepts pushes only from `main` and rejects
non-main manual dispatch through its job condition. Required tests and the
existing Actions secret remain unchanged. The owner accepted the deployed UI.
The complete Phase 1 history was fast-forwarded into `main`; GitHub marked
[PR #1](https://github.com/Wolfrine/creative-workspace/pull/1) merged. After verifying
the remote branch had no commits outside `main`, `codex/noveliaa-phase-1` was
deleted remotely and locally. The repository now has **one branch (`main`) and
zero open PRs**. The global Codex instructions and explicit memory note carry the
same default across agents and repositories unless the owner gives an exception.

The [first main release](https://github.com/Wolfrine/creative-workspace/actions/runs/40067371140)
passed on `9b8055f`: all application checks, Rules source readback and all 24
hosted-file comparisons succeeded. [Release and inventory proof](evidence/phase1/main-release.json)
is retained in-repo. Optional Actions artifact upload hit GitHub's storage quota;
it did not block publication or verification. No application or Rules source
changed during the branch-policy correction.

**Live and verified on 23 October 2026.** The first successful Spark release
[39998452937](https://github.com/Wolfrine/creative-workspace/actions/runs/39998452937)
passed all application checks, configured the private author, released Rules with
matching source readback, published Hosting and matched all **24** hosted files
to that run's configured build. No Functions, Storage or billing upgrade occurred.
The [bounded-installer release 40000001285](https://github.com/Wolfrine/creative-workspace/actions/runs/40000001285)
also passed, with the same Rules source digest and 24 verified hosted files.
The [independent live inventory](evidence/phase1/spark-hosted/files.json) and
[desktop/mobile check](evidence/phase1/spark-hosted/visual-check.json) retain the
actual URL/App ID, file digests, denied unsigned read and offline public-shell
reload. The live Google sign-in screen was visually inspected at 1440×1000,
390×844 and 320×640, with zero reported desktop/mobile axe violations. Authenticated
writing/sync/recovery passed the emulators; the human owner's production Google
session and physical-phone acceptance remain separate.

## Release path

[Deploy Noveliaa to Firebase](../.github/workflows/firebase-deploy.yml) uses the
existing `FIREBASE_SERVICE_ACCOUNT` secret. Before cloud changes it runs unit,
Rules/emulator, authenticated browser, local-writing browser and evidence checks.
The current [October 24 refinement manifest](evidence/phase1/refinement-2026-10-24/manifest.json)
binds the reviewed source and actual renders. Earlier Spark and visual evidence
remain intact. Browser runs write temporary reports under `.local` so CI does
not overwrite retained historical proof.

This release adds paragraph formatting metadata while preserving old revision
hashes. After publication, close and reopen Noveliaa on each device once, after
Synced, so the waiting service worker can activate the complete new app. Open
writers intentionally keep their coherent old version until closed. No source
text or original-file migration is performed.

`prepare-spark-release.mjs` verifies the project, exact Web App and site, native
database, Google provider and private author UID. It preserves existing domains,
links the verified Web App when needed, and refuses to overwrite another author.
It supplies public client configuration to the build. After the actual emulator
checks, Firebase's supported Admin SDK releases `firestore.rules`, then verifies
the current release and exact source digest by readback. Hosting uses the working
standard CLI path:

```sh
node functions/scripts/deploy-spark-rules.mjs
npx firebase deploy --project noveliaa --only hosting --non-interactive
```

`verify-hosted.mjs` compares every published file's SHA-256 to that run's build,
then verifies `/__/firebase/init.json` matches the exact project and App ID. A
successful HTTP response alone is not release acceptance. Actual desktop/mobile
hosted inspection and the owner's Google sign-in remain separate checks.

## Setup status and correction

The same existing account's standard Hosting dry run
[passed](https://github.com/Wolfrine/creative-workspace/actions/runs/39989576581/attempts/2).
The default native Firestore database exists in Mumbai (`asia-south1`), and the
Web App is registered. Creating Firestore later did not invalidate the key.

Earlier release attempts chose Functions and Storage, then requested Blaze and
additional deployment roles. That was the wrong Phase 1 architecture for the
owner's Spark requirement. Those dependencies and the Auth CLI provisioning step
have been removed. Do not repeat those role/billing requests.

Google provider enablement is now confirmed by both the owner and Actions
metadata. The first Spark release passed all tests and configured the author,
but the CLI's optional Rules `projects:test` simulator call returned 403. The
supported [Admin SDK Rules release](https://firebase.google.com/docs/rules/manage-deploy)
uses the existing account's creation/update permissions after local emulator
testing, and verifies deployed source readback. No additional role is requested.
The release makes no IAM, billing, API-enablement or bucket changes.

The second runner's system-package refresh stalled before publication, then
resumed and completed successfully. A one-time guarded recovery workflow left
both runs alone after they advanced beyond that stage; the temporary workflow
has been removed. Browser setup now downloads Chromium with a four-minute bound
using the hosted runner's existing libraries. All browser tests remain required.
Optional artifact upload explicitly includes its selected hidden `.local` paths;
essential evidence is also retained in the repository.

The read-only metadata workflow projects only the Spark target and relevant
permissions. No credentials, OAuth tokens or manuscript content enter its logs.

## Evidence and release limits

Original visual rounds and Functions tests remain historical evidence. Spark
changes have a separate source/render manifest under `evidence/phase1/spark`;
the old candidate digest does not cover the new cloud adapter. The release
build embeds verified public Firebase settings, so its file hashes are recorded
by the actual hosted verification rather than borrowed from an unconfigured
local build.

Production author sign-in, authenticated offline cold start, physical mobile
keyboards/IME and the author's writing/recovery session are distinct acceptance
gates. No production Auth bypass or synthetic manuscript is deployed. Cloud
history is not an independent disaster backup; downloadable archives are the
current portable recovery path. Scheduled protected backups remain deferred.
