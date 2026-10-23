import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { authorize, commitOperation, putCatalog, putOriginal, registerDocuments, ServiceError, sha256 } from './service.mjs';
import { createBackup, verifyBackup } from './backup.mjs';
import { createFirebaseDependencies, readWorkspace } from './firebase-store.mjs';

initializeApp();
const db = getFirestore();
const settings = { region: process.env.NOVELIAA_REGION || 'asia-south1', memory: '512MiB', timeoutSeconds: 120, maxInstances: 5 };
const ownerUid = () => process.env.NOVELIAA_OWNER_UID || '';
const primaryBucket = () => getStorage().bucket(process.env.NOVELIAA_STORAGE_BUCKET || undefined);

async function provisioned(uid) {
  authorize(uid, ownerUid());
  const access = await db.doc('noveliaaConfig/access').get();
  if (access.data()?.ownerUid !== ownerUid()) throw new ServiceError('failed-precondition', 'Owner access configuration is not ready. Local writing remains available.');
}
function deps(uid) {
  return createFirebaseDependencies({ uid, ownerUid: ownerUid(), db, bucket: primaryBucket() });
}
const callable = handler => onCall(settings, async request => {
  try {
    const uid = request.auth?.uid;
    await provisioned(uid);
    return await handler(uid, request.data);
  } catch (error) {
    if (error instanceof ServiceError) throw new HttpsError(error.code, error.message);
    if (error instanceof HttpsError) throw error;
    // Never log manuscripts, source bytes, request bodies or access tokens.
    console.error('Noveliaa operation failed', { code: String(error.code || 'internal') });
    throw new HttpsError('internal', 'Cloud operation failed. Your local writing remains available; retry or export.');
  }
});
export const commitWriting = callable((uid, input) => commitOperation(uid, input, deps(uid)));
export const saveCatalog = callable((uid, input) => putCatalog(uid, input, deps(uid)));
export const registerDocumentIdentities = callable((uid, input) => registerDocuments(uid, input, deps(uid)));
export const preserveOriginal = callable((uid, input) => putOriginal(uid, input, deps(uid)));

export const loadWorkspace = callable(async uid => {
  const data = await readWorkspace(db, uid);
  return { schemaVersion: 1, accountId: uid, catalog: data.meta.find(item => item._id === 'catalog') ?? { universes: [], collections: [] }, heads: data.documents, revisions: data.revisions, originals: data.originals };
});

// A separate deployment identity and backup bucket are prerequisites. This function does
// not grant roles, create buckets, enable billing, delete backups or set retention policy.
export const dailyWritingBackup = onSchedule({
  ...settings, schedule: 'every day 02:00', timeZone: 'Asia/Kolkata', timeoutSeconds: 540,
  ...(process.env.NOVELIAA_BACKUP_SERVICE_ACCOUNT ? { serviceAccount: process.env.NOVELIAA_BACKUP_SERVICE_ACCOUNT } : {}),
}, async () => {
  if (!process.env.NOVELIAA_BACKUP_SERVICE_ACCOUNT || !process.env.NOVELIAA_BACKUP_BUCKET) throw new Error('Backup disabled: separate identity and protected bucket must be configured.');
  const uid = ownerUid();
  await provisioned(uid);
  const bucket = primaryBucket();
  if (bucket.name === process.env.NOVELIAA_BACKUP_BUCKET) throw new Error('Backup bucket must be separate from application storage.');
  const backupBucket = getStorage().bucket(process.env.NOVELIAA_BACKUP_BUCKET);
  const [backupMetadata] = await backupBucket.getMetadata();
  if (Number(backupMetadata.retentionPolicy?.retentionPeriod || 0) < 30 * 24 * 60 * 60) throw new Error('Backup disabled: at least 30 days of bucket retention must be configured and independently reviewed.');
  const workspace = await readWorkspace(db, uid);
  const bytes = await createBackup({ accountId: uid, workspace, readBlob: async reference => {
    const [body] = await bucket.file(reference.path, { generation: reference.generation }).download(); return body;
  } });
  const digest = sha256(bytes);
  const name = `noveliaa/${uid}/${new Date().toISOString().replace(/[:.]/g, '-')}-${digest}.json`;
  const destination = backupBucket.file(name);
  await destination.save(bytes, { resumable: false, contentType: 'application/json', preconditionOpts: { ifGenerationMatch: 0 }, metadata: { metadata: { sha256: digest } } });
  const [readback] = await destination.download();
  verifyBackup(readback);
  if (sha256(readback) !== digest) throw new Error('Backup readback digest mismatch.');
  console.info('Noveliaa backup verified', { bytes: bytes.length, sha256: digest });
});
