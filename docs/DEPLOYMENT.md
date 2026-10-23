# Noveliaa Firebase release — 23 October 2026

The owner authorized deployment through GitHub Actions and reviews the hosted
app. Local previews are development/test surfaces. **No app has been published.**

## Verified destination and actual runs

| Item | Observed value |
|---|---|
| Firebase project | `noveliaa`, number `278082781314`, display name `Noveliaa` |
| Existing Hosting site | `projects/noveliaa/sites/noveliaa`, default site |
| Hosting API's default URL | **https://noveliaa.web.app** |
| Existing Actions identity | `firebase-adminsdk-fbsvc@noveliaa.iam.gserviceaccount.com` |
| Credential route | Existing `FIREBASE_SERVICE_ACCOUNT`, consumed only by Google's authentication Action |
| Web app registration | Registered by the authorized release: `1:278082781314:web:9a4b7acef07fa8e4dfb49b`, display name `Noveliaa` |
| Authentication | `CONFIGURATION_NOT_FOUND`; Google provider configuration absent |
| Firestore | Fresh check: native `(default)` database exists in `asia-south1`, created `2026-10-23T16:47:33.855769Z`; readable through the existing Actions key |
| Storage | Bucket list returned no items |
| Billing | Permission denied; plan and billing linkage unknown |
| Public Hosting check | HTTP 404; not a usable review link yet |

**Current result after the owner added Service Usage Viewer:** the permission is
verified and the [standard Hosting CLI dry run passes](https://github.com/Wolfrine/creative-workspace/actions/runs/39989576581/attempts/2)
(job `120545866065`, CLI 15.34.1). This was a dry run, not publication.
The [resumed release](https://github.com/Wolfrine/creative-workspace/actions/runs/39991129209)
registered the Web App above. The [supported Google sign-in CLI attempt](https://github.com/Wolfrine/creative-workspace/actions/runs/39991936827)
then failed at Firebase's provisioning API because the deployment identity lacks
`serviceusage.services.enable`. The prior attempt hit a transient npm registry
`ECONNRESET`; the retried run completed dependency/test steps and reached Firebase.

The checked-in `deployment/firebase.auth.json` enables only Google sign-in and
uses the verified Noveliaa domains. The release skips initial Auth provisioning
when Google sign-in is already enabled, preserving existing provider settings.
The SDK config now names `noveliaa.firebasestorage.app`, but that is not evidence
the bucket exists: the real Storage list is empty, and release validation now
checks the actual bucket's metadata before configuring the author.

The [comprehensive read-only audit](https://github.com/Wolfrine/creative-workspace/actions/runs/39979368724)
succeeded. The [release attempt](https://github.com/Wolfrine/creative-workspace/actions/runs/39979048780)
passed client/backend/evidence checks and authenticated, then stopped on
`serviceusage.services.get` before creating an app, author, allowlist or release.
The [full CI run](https://github.com/Wolfrine/creative-workspace/actions/runs/39979059134)
also passed its build, emulator and browser checks. These tests use synthetic
material; they do not establish authenticated production behavior.

The owner's screenshot shows the same Admin SDK account used by Actions. After
the owner created Firestore, [fresh read-only run 39990565880](https://github.com/Wolfrine/creative-workspace/actions/runs/39990565880)
(job `120540930363`, checked `2026-10-23T16:53:57.573Z`) successfully read the new
database using the existing key. In that same run, the Hosting service inspection
still returned HTTP 403, `Permission denied to get service [firebasehosting.googleapis.com]`,
and `testIamPermissions` still omitted `serviceusage.services.get`.
Thus the earlier Firestore-unavailable observation is superseded by a real,
readable database, while the independent Hosting access failure remains.

The existing private key authenticates successfully. Creating Firestore later
does not require regenerating that key. IAM roles govern what the authenticated
service account can do; the screenshot's key-generation panel does not display
those project roles. See [Google's service-account model](https://docs.cloud.google.com/iam/docs/service-account-overview).

An earlier release attempt used the invalid permission name
`firebasehosting.versions.create`. It was corrected to `firebasehosting.sites.update`
using the [official Hosting permission reference](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasehosting)
and the pinned Firebase CLI deployment implementation. That correction exposed the
actual access gap above. Missing local CLI login is not the blocker.

## Comparison with working PTI and GTOP releases

The owner requested this comparison after the first setup report. Both repositories
were inspected directly; neither was changed.

| Reference | Inspected implementation and actual outcome |
|---|---|
| [PTI workflow](https://github.com/Wolfrine/PTI/blob/main/.github/workflows/firebase-deploy.yml) | Writes the existing `FIREBASE_SERVICE_ACCOUNT` to a temporary ADC file inside Actions, then runs Firebase CLI. [Run 39768690142](https://github.com/Wolfrine/PTI/actions/runs/39768690142), job `119791103117`, used CLI **15.34.1** and successfully released both default and One Piece Hosting sites. Optional MCP Functions were skipped because their separate API-key secret was absent. |
| [GTOP workflow](https://github.com/Wolfrine/gtop-app/blob/main/.github/workflows/firebase-deploy.yml) | Uses `FirebaseExtended/action-hosting-deploy@v0` with `firebaseServiceAccount` from the same secret name. Its Action invokes Firebase CLI. [Run 38210443615](https://github.com/Wolfrine/gtop-app/actions/runs/38210443615), job `114689130853`, successfully promoted Hosting. Its backend workflow was skipped for that frontend release; existing backend readiness/rules were verified separately. |
| [GTOP backend workflow](https://github.com/Wolfrine/gtop-app/blob/main/.github/workflows/firebase-v2-backend.yml) | Uses Google's auth Action with the same secret and a separate protected backend release. Hosting and backend deployment scopes are explicit. |

Noveliaa then repeated PTI's credential-file pattern with its own existing repo
secret, verified the credential's project ID is exactly `noveliaa`, built the app,
and ran **the same CLI version, 15.34.1**, without any custom release preflight:

```text
npx firebase deploy --project noveliaa --only hosting --dry-run --non-interactive
```

[Run 39989576581](https://github.com/Wolfrine/creative-workspace/actions/runs/39989576581),
job `120537535792`, failed with Firebase CLI's own response:

```text
Request to https://serviceusage.googleapis.com/v1/projects/noveliaa/services/firebasehosting.googleapis.com
had HTTP Error: 403, Permission denied to get service [firebasehosting.googleapis.com]
```

This confirms the secret exists and authenticates, and the failure survives removal
of the custom preflight and use of PTI's working credential route. It does not
establish the contents or role grants of either other repository's secret.
Identically named secrets are not evidence of identical Google IAM grants.
The temporary Noveliaa credential was removed by the job's cleanup step; no key
or access token was printed or copied into the repository.

The owner supplied `serviceusage.services.get` with
[Service Usage Viewer](https://docs.cloud.google.com/iam/docs/roles-permissions/serviceusage),
and the standard CLI check now passes. Auth initialization, application Storage,
Functions access and billing remain separate prerequisites below.

## Permission audit

The audit calls `testIamPermissions`; it does not grant roles. Project-level
permissions returned as granted:

```text
datastore.indexes.list
firebase.clients.create
firebasehosting.sites.update
firebaserules.releases.update
firebaserules.rulesets.create
serviceusage.services.get
```

Requested permissions absent from the response:

```text
serviceusage.services.enable
cloudfunctions.functions.list
cloudfunctions.functions.create
cloudfunctions.functions.get
cloudfunctions.functions.update
cloudfunctions.functions.delete
cloudfunctions.operations.get
cloudfunctions.functions.setIamPolicy
iam.serviceAccounts.actAs
run.services.setIamPolicy
datastore.indexes.create
datastore.indexes.update
datastore.indexes.delete
firebaserules.releases.create
```

This is an observed permission test, not a complete IAM policy or a prescription
to grant every permission project-wide. `actAs` may be scoped to the selected
runtime/build service accounts and needs a resource-specific check after those
accounts are chosen. Firebase CLI requests the index permissions even though this
release targets Firestore Rules. Service enablement is needed only for bootstrap
when APIs are disabled; the prepared release script does not enable them.

## One-time owner setup

1. In [project settings](https://console.firebase.google.com/project/noveliaa/settings/general),
   confirm the project above and intended Google account. The release binding
   currently proposes `schttewary@gmail.com`, from the connected GitHub owner
   profile; no Firebase author account exists yet. A different author must be
   bound explicitly before release.
2. Inspect [billing](https://console.firebase.google.com/project/noveliaa/usage/details).
   Decide any billing linkage/upgrade in the console. Cloud Storage requires
   Blaze under [Firebase's current policy](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
   This run could not determine the existing plan and made no billing changes.
3. Initialize [Authentication](https://console.firebase.google.com/project/noveliaa/authentication/providers)
   and enable Google sign-in. Authorize `noveliaa.web.app` and
   `noveliaa.firebaseapp.com` as applicable. Keep author access enforced by the
   server UID allowlist; enabling a provider does not grant workspace access.
4. The native `(default)` [Firestore database](https://console.firebase.google.com/project/noveliaa/firestore)
   is now verified in `asia-south1` (Mumbai). Verify its private/production Rules.
   Initialize/verify the default [Storage bucket](https://console.firebase.google.com/project/noveliaa/storage)
   with private/production Rules and choose its location before creation.
   `asia-south1` is also the proposed Functions region; the bucket location
   remains unknown. Do not infer it from the database or Functions setting.
5. In [project IAM](https://console.cloud.google.com/iam-admin/iam?project=noveliaa),
   review the remaining known deployment access for the existing Actions account:

   | Purpose | Predefined role and scope |
   |---|---|
   | Initial API setup required by the Auth provisioning API | **Service Usage Admin** (`roles/serviceusage.serviceUsageAdmin`), project; bootstrap access can be removed by the owner after required APIs are configured, retaining Viewer |
   | Deploy the five trusted writing callables | **Cloud Functions Admin** (`roles/cloudfunctions.admin`), project |
   | Create the initial private Firestore/Storage Rules releases | **Firebase Rules Admin** (`roles/firebaserules.admin`), project |
   | Deploy using the selected runtime/build identities | **Service Account User** (`roles/iam.serviceAccountUser`), scoped to those service accounts; do not infer the identities before provisioning |

   See the official [Functions deployment guide](https://firebase.google.com/docs/projects/iam/permissions#functions),
   [Rules role](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaserules),
   and [Service Usage role](https://docs.cloud.google.com/iam/docs/roles-permissions/serviceusage).
   This covers observed missing deployment capabilities, not a guarantee that
   runtime/build identities are already provisioned. Independently verify the
   runtime's Firestore/Storage access and the build service agents. Index-write
   permissions in the CLI's generic permission probe are not a request to deploy
   indexes or grant unrelated index administration. No project Owner/Editor role
   or credential sharing is needed for this proposal.
6. Rerun metadata preflight, then **Deploy Noveliaa to Firebase** from the approved
   branch. Workflow dispatch is available once the workflow is on the default
   branch; the current development branch also has a narrowly scoped push trigger
   for deployment workflow/binding changes. The release validates the exact project,
   site, Web App, Google sign-in, database, bucket and author UID, builds, deploys
   private Rules and five writing callables, then publishes Hosting.

After successful release, verify the actual Firebase app at desktop/mobile sizes,
sign-in and production synchronization without importing a real manuscript as
test data. Report authenticated/offline, physical-device and author acceptance
separately. Do not present an HTTP response or a setup gate as a working app.

## Source and evidence preservation

`.firebaserc`, `firebase.json`, `deployment/firebase-binding.json`,
`.github/workflows/firebase-deploy.yml` and the two Functions release/preflight
scripts contain the concrete release path. No UI source changed during this
follow-up. [Candidate verification](evidence/phase1/deployment/candidate-verification.json)
confirmed 31 unchanged runtime/config source files, all 18 retained visual renders
and all 24 rebuilt production files. Only the explicit Hosting-site binding differs
from the original visual candidate's runtime/config inventory.

Production publication, authenticated offline cold start, production IAM/CORS,
separate backup identity/bucket/retention, scheduled backups and disaster recovery
remain unverified. The workflow excludes scheduled backup deployment until its
separate prerequisites are provisioned. No production login bypass, manuscript
seed, IAM expansion, billing upgrade or retention lock was performed.
