# Noveliaa deployment — GitHub Actions, Spark

Owner review uses **https://noveliaa.web.app**, the existing Firebase site for
project `noveliaa` (278082781314), Web App
`1:278082781314:web:9a4b7acef07fa8e4dfb49b`. Localhost is development evidence
only. Deployment is already authorized; the owner requires Spark.

## Release path

[Deploy Noveliaa to Firebase](../.github/workflows/firebase-deploy.yml) uses the
existing `FIREBASE_SERVICE_ACCOUNT` secret. Before cloud changes it runs unit,
Rules/emulator, authenticated browser, local-writing browser and evidence checks.
The retained Spark manifest binds the reviewed source and actual renders.

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
