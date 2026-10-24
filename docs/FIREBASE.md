# Firebase Phase 1 — keep Spark

The production target is project **noveliaa**, number **278082781314**, Web App
**1:278082781314:web:9a4b7acef07fa8e4dfb49b**, Hosting site **noveliaa** and
**https://noveliaa.web.app**. Firestore `(default)` is native mode in
**asia-south1**. These identities were verified through GitHub Actions.

The owner requires **Spark**. Phase 1 uses Google Authentication, Firestore and
Hosting. Functions, Storage, scheduled backups and paid recovery products are
excluded. The existing `FIREBASE_SERVICE_ACCOUNT` stays in repository secrets;
the release uses `google-github-actions/auth@v2`. Never copy its key into source,
read it into a chat, print it, or request a replacement merely to fix setup.

## One-time author setup

Enable Google under [Noveliaa Authentication → Sign-in method](https://console.firebase.google.com/project/noveliaa/authentication/providers).
If Authentication is new, select Get started first, enable Google, choose the
support email and save. This works on Spark. No Functions/Storage roles or Blaze
approval are requested. Initial Auth provisioning through the deployment CLI was
removed because it attempted API enablement unnecessarily.

The Actions release verifies the exact Web App/site binding and Google provider,
preserves authorized domains while ensuring the two Noveliaa domains are present,
resolves the configured author email to an Auth UID and creates
`noveliaaConfig/access` only when absent. It refuses to replace another owner UID.
The existing binding identifies `schttewary@gmail.com`; only that resolved UID
gets workspace access. Provider enablement alone grants no writing access.

The browser verifies access through Rules before opening the workspace. A wrong
account sees an access explanation. On previously verified devices, offline
access reopens only that account's private device copy. Server authorization
still applies when connectivity returns. Signing out preserves the account's
device database and flushes pending typing first.

## Persistence and boundaries

All writing resides under `noveliaaWorkspaces/{uid}`. Owner-only Rules permit the
specific Phase 1 collections. Chunk and original/revision/operation records are
immutable. Expected-head transactions preserve conflicts and prevent standalone
head repointing. Full source validation runs in the adapter before ingestion;
see the explicit [trust boundary](ARCHITECTURE.md).

No Storage URLs or external machine writers exist in the runtime. A generated
SDK config may contain a storageBucket string; that does not create or use a
bucket. The public web API key is normal client configuration, not an Admin key.

Firestore's current free allowance is 1 GiB stored data, 50,000 document reads
and 20,000 writes per day. Initial metadata listeners read heads/history; each new
revision writes chunks, a manifest, metadata, a receipt and possibly a head.
Persistent multi-tab cache and long-lived listeners avoid recurring full-library
GETs; unchanged verified revision/original bytes are reused. Clean devices adopt
new heads automatically. Dirty/outbox branches retain expected-head protection.
Device checkpoints stay at 300 ms; automatic cloud drain starts about one minute
after the oldest pending checkpoint. Manual sync/reconnect/tab hiding can drain
sooner. Compression and digest deduplication reduce repeated bytes, and no-op
edits create no revision. Delaying uploads does not discard saved history or
promise fewer writes per distinct revision. Exhausted quota
interrupts sync without acknowledging or discarding pending local revisions.
Server-confirmed metadata alone earns cloud receipts. An immutable cache does
not continuously audit administrator rewrites that bypass Rules; fresh-device
integrity tests still reject corrupt server bytes. Cloud backups, PITR and
managed restores require billing and are deferred under
the owner's Spark decision. [Official quota and backup policy](https://firebase.google.com/docs/firestore/pricing).

## Development verification

Node 22.12+ (CI uses 24), Python 3.11+ and Java 21:

```sh
npm ci
npm --prefix functions ci
npx playwright install chromium
npm test
npm run build
npm run test:evidence
npm run test:rules
npm run test:cloud
npm run test:browser
```

`firebase.spark-test.json` starts only loopback Auth **19099** and Firestore
**18080** for `demo-noveliaa`. `test:rules` uses the real Rules engine and Spark
adapter. `test:cloud` uses real Auth-emulator tokens in the actual browser app:
cloud receipt, second-device restore, offline checkpoint/reconnect, exact source
download, unverified conversation provenance, revision restore and archive export.
Its helper is outside the app import graph, rejects production/non-loopback
targets and is never a production login bypass. No tests seed live manuscripts.

Legacy `firebase.test.json`, Storage Rules, callable/backup sources and their
earlier test results remain reference evidence. They are not deployed, required
for Spark CI, or proof of the current adapter. Independent scheduled backup and
physical-device/owner acceptance remain open.
