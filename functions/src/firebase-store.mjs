import { ServiceError, sha256 } from './service.mjs';

export function createFirebaseDependencies({ uid, ownerUid, db, bucket, now = () => new Date().toISOString() }) {
  const root = db.collection('noveliaaWorkspaces').doc(uid);
  return {
    ownerUid, now,
    transaction: callback => db.runTransaction(async transaction => callback({
      get: async (collection, id) => (await transaction.get(root.collection(collection).doc(id))).data(),
      create: (collection, id, data) => transaction.create(root.collection(collection).doc(id), data),
      set: (collection, id, data) => transaction.set(root.collection(collection).doc(id), data),
    })),
    verifyBlob: async (_uid, descriptor, expectedBytes, expectedDigest) => {
      if (!descriptor || Object.keys(descriptor).some(key => key !== 'sha256') || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) throw new ServiceError('invalid-argument', 'Invalid staged blob.');
      const digest = descriptor.sha256;
      const staged = bucket.file(`noveliaaWorkspaces/${uid}/staging/${digest}`);
      const [metadata] = await staged.getMetadata().catch(() => { throw new ServiceError('failed-precondition', 'Staged writing is absent; retry upload.'); });
      if (Number(metadata.size) > 32 * 1024 * 1024) throw new ServiceError('resource-exhausted', 'Source exceeds the supported cloud size; keep the local export.');
      const [bytes] = await bucket.file(staged.name, { generation: metadata.generation }).download();
      if (sha256(bytes) !== digest || (expectedDigest && expectedDigest !== digest) || (expectedBytes && !bytes.equals(expectedBytes))) throw new ServiceError('invalid-argument', 'Staged bytes differ from the source digest.');
      const path = `noveliaaWorkspaces/${uid}/blobs/${digest}`;
      const final = bucket.file(path);
      try { await final.save(bytes, { resumable: false, contentType: expectedBytes ? 'application/json' : 'application/octet-stream', preconditionOpts: { ifGenerationMatch: 0 }, metadata: { metadata: { sha256: digest } } }); }
      catch (error) { if (Number(error.code) !== 412) throw error; }
      const [finalMetadata] = await final.getMetadata();
      const [finalBytes] = await bucket.file(path, { generation: finalMetadata.generation }).download();
      if (sha256(finalBytes) !== digest) throw new ServiceError('data-loss', 'Preserved blob integrity failed; writing was not promoted.');
      return { path, generation: String(finalMetadata.generation), sha256: digest, size: bytes.length };
    },
  };
}
export async function readWorkspace(db, uid) {
  const root = db.collection('noveliaaWorkspaces').doc(uid);
  const names = ['meta', 'documentIdentities', 'documents', 'revisions', 'originals', 'operations'];
  return db.runTransaction(async transaction => {
    const snapshots = await Promise.all(names.map(name => transaction.get(root.collection(name))));
    return Object.fromEntries(snapshots.map((snapshot, index) => [names[index], snapshot.docs.map(doc => ({ ...doc.data(), _id: doc.id }))]));
  }, { readOnly: true });
}
