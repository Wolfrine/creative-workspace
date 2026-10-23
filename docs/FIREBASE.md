# Firebase Phase 1: Actions release prepared, cloud setup blocked

The repository contains a private Firebase adapter, owner-only callable services,
Rules, read-only metadata and deployment workflows, and a daily backup
implementation. GitHub Actions verified project `noveliaa`, number
`278082781314`, display name `Noveliaa`, and its existing default Hosting site
`noveliaa`, URL **https://noveliaa.web.app**. `.firebaserc` and `hosting.site`
are now bound to that verified project/site. The app is not live: release
preflight fails before mutation on missing `serviceusage.services.get`.
See [live metadata, permission evidence and setup steps](DEPLOYMENT.md).

The supplied Rules are a complete deny-by-default policy for a dedicated
Noveliaa project. If preflight identifies a shared project, inspect its deployed
Rules first and prepare a separately reviewed integration. Do not replace
unrelated product access policies by deploying these files unchanged.

## Author access and configuration

1. The **Firebase metadata preflight (read only)** workflow has run successfully.
   Repeat it after project setup changes. It consumes the existing
   `FIREBASE_SERVICE_ACCOUNT` through Google's authentication action and prints
   only public project/app/site settings, projected owner configuration and
   permission-test results. Do not open or print
   that secret. The workflow does not deploy, enable APIs, change IAM or billing.
2. Verify the chosen project, database location, primary bucket, Google sign-in
   provider, authorized domains and Functions region (`asia-south1` is the
   initial code default, not a claim about the existing project).
3. Supply public client settings using `VITE_FIREBASE_CONFIG` (JSON, see
   `.env.example`) or Firebase Hosting's `/__/firebase/init.json`. Production
   without complete configuration shows the application's setup gate. Verified
   public web configuration is cached locally so an offline restart does not
   need Hosting discovery; this cache contains no credentials or manuscript.
4. The Actions release script resolves the author account from the administrator's
   deployment binding and sets `NOVELIAA_OWNER_UID` plus Firestore
   `noveliaaConfig/access` to the same UID. It refuses to overwrite a different
   existing allowlist. The current candidate email comes from the connected
   GitHub owner's profile; verify it is the intended Google sign-in account
   before completing setup. Runtime authorization checks UID, never a
   client-submitted email. Unset or mismatched settings fail closed; direct
   clients cannot read/write the config document.
5. Set `NOVELIAA_STORAGE_BUCKET` when the Admin app's default bucket is absent.
   Verify Storage CORS permits the exact approved app origin for authenticated
   SDK byte reads. Do not create public buckets or long-lived download URLs.

The cloud API is limited to `loadWorkspace`, `saveCatalog`,
`registerDocumentIdentities`, `preserveOriginal` and `commitWriting`. No
external-AI, canon, publication, reader or feedback
endpoints exist. Client Rules deny all direct Firestore writes. Server Admin SDK
operations independently validate the authenticated author because they bypass
those Rules. All application records live beneath
`noveliaaWorkspaces/{uid}`; no PTI `/users` namespace is reused.

## Preserved writing and synchronization

The client uploads bytes to a digest-addressed, create-only staging object.
`commitWriting` reads that exact generation, calculates SHA-256 itself, compares
the full canonical revision JSON, then creates and verifies an immutable final
blob. A Firestore transaction records the revision and operation only after
verification. It promotes the document head only if the supplied expected head
still matches. A losing revision remains reachable through history.

The idempotency fingerprint covers the canonical operation ID, expected head and
complete revision. Identical retries return the first result; changing any of
that content under the same operation ID fails. A source original's metadata
and bytes are immutable. Client Storage writes cannot overwrite or delete
staging/final objects. Incomplete/unreferenced uploads are not writing heads;
there is no automatic garbage collection in Phase 1.

Catalog synchronization cannot remove an existing universe or collection or
move it between universes. Concurrent catalog additions must be reconciled by
the client; the server rejects an update that would orphan an existing entry.
Link targets must be committed or explicitly registered in the same universe.
Registration preserves only the immutable document-ID/universe-ID mapping; it
creates no writing, revision, placeholder text or head. This supports portable
archives whose first revisions link to one another. The workspace loader still
returns only documents with committed writing heads. Identity registrations are
included in disaster backups.

## Backups and isolated restore

`dailyWritingBackup` is scheduled at 02:00 Asia/Kolkata. It reads catalog,
documents, revisions, originals and operations within one read-only Firestore
transaction, then downloads immutable blob generations, verifies every digest,
creates a self-contained JSON archive, writes it create-only and verifies its
readback. The initial safety limit is **64 MiB of unencoded blob bytes**;
exceeding it fails visibly rather than producing an incomplete backup.

The function refuses to write backups unless all of the following exist:

- `NOVELIAA_BACKUP_SERVICE_ACCOUNT`, a separately provisioned runtime identity.
- `NOVELIAA_BACKUP_BUCKET`, a bucket distinct from application storage.
- Backup bucket retention of at least 30 days, checked at runtime.

An administrator must independently verify least-privilege IAM: ordinary commit
functions must have no access to delete backup objects or reduce backup-bucket
retention. The backup identity needs source read access and destination
create/read access, without delete/retention-policy administration. Configure
the approved retention/lifecycle policy outside application code. A bucket lock
is irreversible and requires explicit approval; this repository does not enable
one or assert that IAM/retention protection already exists. The backup function
contains no deletion path. It does not promise exact deletion at 30 days.

Offline-only checkpoints are absent from cloud disaster backups. Downloadable
workspace exports remain necessary. A 24-hour RPO and 60-minute restore are
evaluation budgets, not validated production guarantees.

Verify a downloaded backup without credentials or writes:

```powershell
node functions/scripts/restore-backup.mjs C:\path\backup.json
```

For an isolated restore, start loopback Firestore/Storage emulators for
`demo-noveliaa`, set both emulator host variables, then append
`--restore-emulator`. The tool rejects non-loopback targets and nonempty target
collections, uploads source bytes first, remaps emulator generations, and
creates immutable records before heads. It does not restore access config or
reader grants. Production restore is intentionally unavailable in this tool.

## Verification commands and limits

Use Node 22.12+ (CI uses Node 24) and Java 21:

```powershell
npm --prefix functions ci
npm --prefix functions test
npm run test:rules
$env:NOVELIAA_OWNER_UID = 'emulator-author'
$env:NOVELIAA_STORAGE_BUCKET = 'demo-noveliaa.appspot.com'
npm run test:cloud
```

`firebase.test.json` uses loopback-only isolated ports: Firestore 18080, Storage
19199, Authentication 19099 and Functions 15001. The development adapter uses
the same Auth/Functions/Storage ports when `VITE_FIREBASE_EMULATORS=true`.

`functions/test/service.test.mjs` exercises trusted-service behavior with a
transactional in-memory repository and synthetic writing. `tests/rules.test.mjs`
exercises actual Firestore/Storage emulator denial and owner controls plus the
real Admin SDK transaction/blob path and an isolated backup restore. Emulator
tests do not establish production project mapping, deployed function identity,
IAM, CORS, storage retention or successful cloud backup scheduling. Keep those
release checks visibly blocked until performed against the approved project.

`test:cloud` runs the real HTTP callable boundary against Authentication,
Functions, Firestore and Storage emulators, including authorization denials and
valid owner controls. The development run used Node 24.19.0; the configured
production Functions runtime is Node 22, which has not been deployed or tested
in production. Scheduled backup invocation remains untested; the backup archive
and isolated restore implementation is tested separately.
