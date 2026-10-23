// Default: verify a downloaded backup without credentials or side effects.
// --restore-emulator writes only to an empty local emulator namespace.
import { readFile } from 'node:fs/promises';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { verifyBackup } from '../src/backup.mjs';
const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('--'));
if (!file) throw new Error('Usage: node scripts/restore-backup.mjs ARCHIVE.json [--restore-emulator]');
const archive = verifyBackup(await readFile(file));
if (!args.includes('--restore-emulator')) {
  console.log(JSON.stringify({ status: 'verified-only', accountId: archive.accountId, revisions: archive.workspace.revisions.length, originals: archive.workspace.originals.length, createdAt: archive.createdAt }));
} else {
  const localHost = host => /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host || '');
  if (!localHost(process.env.FIRESTORE_EMULATOR_HOST) || !localHost(process.env.FIREBASE_STORAGE_EMULATOR_HOST)) throw new Error('Restore requires loopback Firestore AND Storage emulators. Production restore is intentionally unavailable.');
  const app = initializeApp({ projectId: 'demo-noveliaa', storageBucket: 'demo-noveliaa.appspot.com' });
  const db = getFirestore(app); const bucket = getStorage(app).bucket();
  const root = db.collection('noveliaaWorkspaces').doc(archive.accountId);
  for (const name of Object.keys(archive.workspace)) if (!(await root.collection(name).limit(1).get()).empty) throw new Error('Restore target must be empty.');
  const remap = new Map();
  for (const row of [...archive.workspace.revisions, ...archive.workspace.originals]) {
    if (remap.has(row.blob.sha256)) continue;
    const object = bucket.file(row.blob.path);
    await object.save(Buffer.from(archive.blobs[row.blob.sha256], 'base64'), { resumable: false, preconditionOpts: { ifGenerationMatch: 0 } });
    const [metadata] = await object.getMetadata();
    remap.set(row.blob.sha256, { ...row.blob, generation: String(metadata.generation) });
  }
  // Immutable records first, heads last. No access/reader grants are restored.
  for (const name of ['meta', 'documentIdentities', 'originals', 'revisions', 'operations', 'documents']) for (const row of archive.workspace[name] ?? []) {
    const { _id, ...data } = row;
    if (data.blob) data.blob = remap.get(data.blob.sha256);
    await root.collection(name).doc(_id || row.id).create(data);
  }
  console.log(JSON.stringify({ status: 'restored-local-emulators', accountId: archive.accountId, revisions: archive.workspace.revisions.length, originals: archive.workspace.originals.length }));
}
