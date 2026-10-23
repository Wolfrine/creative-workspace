import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createFirebaseDependencies, readWorkspace } from '../src/firebase-store.mjs';
import { commitOperation, putCatalog, putOriginal, sha256, stableStringify } from '../src/service.mjs';
import { createBackup, verifyBackup } from '../src/backup.mjs';

// Called from the Rules suite, with loopback emulators already running. This is
// the real Admin SDK/Firestore transaction/Storage generation code, not the fake.
export async function runTrustedEmulatorScenario() {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '') || !/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIREBASE_STORAGE_EMULATOR_HOST || '')) throw new Error('Trusted integration is emulator-only.');
  const app = initializeApp({ projectId: 'demo-noveliaa', storageBucket: 'demo-noveliaa.appspot.com' }, `integration-${Date.now()}`);
  const uid = 'trusted-integration'; const db = getFirestore(app); const bucket = getStorage(app).bucket();
  const deps = createFirebaseDependencies({ uid, ownerUid: uid, db, bucket });
  const time = new Date().toISOString();
  const stage = async bytes => {
    const digest = sha256(bytes);
    await bucket.file(`noveliaaWorkspaces/${uid}/staging/${digest}`).save(bytes, { resumable: false, contentType: 'application/octet-stream' });
    return { sha256: digest };
  };
  const revision = (id, parents = [], text = 'Synthetic original\r\nहिन्दी — 👩🏽‍💻') => {
    const snapshot = { id: 'document', universeId: 'universe', title: 'Synthetic test', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, plainText: text, collectionId: null, trashed: false, order: 0, origin: 'recovered_original', sourceOriginalIds: ['original'], createdAt: time, updatedAt: time };
    return { id, documentId: snapshot.id, universeId: snapshot.universeId, parentIds: parents, snapshot, contentHash: sha256(stableStringify(snapshot)), createdAt: time };
  };
  const operation = async (r, head = null, operationId = `op-${r.id}`) => ({ operationId, expectedHeadId: head, revision: r, blob: await stage(Buffer.from(stableStringify(r))) });
  let directory;
  try {
    await putCatalog(uid, { universes: [{ id: 'universe', name: 'Synthetic', createdAt: time }], collections: [] }, deps);
    const raw = Buffer.from('Exact CRLF original\r\nहिन्दी — 👩🏽‍💻\r\n');
    const original = { id: 'original', universeId: 'universe', name: 'synthetic.txt', sha256: sha256(raw), origin: 'recovered_original', verification: 'unverified', sourceReference: 'synthetic emulator fixture', createdAt: time };
    await putOriginal(uid, { original, blob: await stage(raw) }, deps);
    const base = await operation(revision('base'));
    const initial = await commitOperation(uid, base, deps);
    assert.deepEqual(initial, await commitOperation(uid, base, deps));
    const left = await operation(revision('left', ['base'], 'left exact'), 'base');
    const right = await operation(revision('right', ['base'], 'right exact'), 'base');
    const outcomes = await Promise.all([commitOperation(uid, left, deps), commitOperation(uid, right, deps)]);
    assert.deepEqual(outcomes.map(result => result.status).sort(), ['conflict', 'synced']);
    await assert.rejects(commitOperation(uid, await operation(revision('changed-id'), null, 'op-base'), deps), error => error.code === 'already-exists');
    const malformed = await operation(revision('corrupt'));
    await bucket.file(`noveliaaWorkspaces/${uid}/staging/${malformed.blob.sha256}`).save(Buffer.from('not original'), { resumable: false });
    await assert.rejects(commitOperation(uid, malformed, deps), error => error.code === 'invalid-argument');
    const before = await readWorkspace(db, uid);
    assert.equal(before.revisions.length, 3); assert.equal(before.operations.length, 3); assert.equal(before.originals.length, 1);
    const preserved = before.originals[0];
    const [readback] = await bucket.file(preserved.blob.path, { generation: preserved.blob.generation }).download();
    assert.deepEqual(readback, raw);
    const backup = await createBackup({ accountId: uid, workspace: before, readBlob: async reference => (await bucket.file(reference.path, { generation: reference.generation }).download())[0] });
    verifyBackup(backup);
    // Exercise the standalone offline verifier in another Node process. This
    // consumes the archive without the original application's runtime.
    directory = await mkdtemp(join(tmpdir(), 'noveliaa-restore-'));
    const archivePath = join(directory, 'backup.json'); await writeFile(archivePath, backup);
    const run = promisify(execFile);
    const verified = await run(process.execPath, ['functions/scripts/restore-backup.mjs', archivePath], { cwd: process.cwd() });
    assert.equal(JSON.parse(verified.stdout).status, 'verified-only');
    // Empty isolated account namespace; all byte addresses are remapped while
    // the blob bytes and immutable records remain exact.
    const archive = verifyBackup(await readFile(archivePath));
    const restoreUid = `${uid}-restore`; const oldPrefix = `noveliaaWorkspaces/${uid}/`;
    archive.accountId = restoreUid;
    for (const row of [...archive.workspace.revisions, ...archive.workspace.originals]) row.blob.path = row.blob.path.replace(oldPrefix, `noveliaaWorkspaces/${restoreUid}/`);
    const { sha256: _old, ...payload } = archive; archive.sha256 = sha256(stableStringify(payload));
    await writeFile(archivePath, stableStringify(archive));
    const started = Date.now();
    const restored = await run(process.execPath, ['functions/scripts/restore-backup.mjs', archivePath, '--restore-emulator'], { cwd: process.cwd(), env: process.env });
    assert.equal(JSON.parse(restored.stdout).status, 'restored-local-emulators');
    const after = await readWorkspace(db, restoreUid);
    assert.equal(after.revisions.length, before.revisions.length);
    assert.equal(after.documents[0].headRevisionId, before.documents[0].headRevisionId);
    for (const restoredOriginal of after.originals) {
      const [bytes] = await bucket.file(restoredOriginal.blob.path, { generation: restoredOriginal.blob.generation }).download();
      assert.deepEqual(bytes, raw);
    }
    const again = await run(process.execPath, ['functions/scripts/restore-backup.mjs', archivePath, '--restore-emulator'], { cwd: process.cwd(), env: process.env }).catch(error => error);
    assert.match(again.stderr, /target must be empty/);
    return { revisions: before.revisions.length, originals: before.originals.length, conflicts: outcomes.filter(result => result.status === 'conflict').length, restoreMilliseconds: Date.now() - started, archiveSha256: sha256(backup), archiveBytes: backup.length };
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
    await db.terminate(); await deleteApp(app);
  }
}
