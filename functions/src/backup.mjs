import { sha256, stableStringify, ServiceError, validateRevision } from './service.mjs';

const reject = message => { throw new ServiceError('data-loss', message); };
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
export async function createBackup({ accountId, workspace, readBlob, createdAt = new Date().toISOString() }) {
  const blobs = {};
  let size = 0;
  for (const row of [...workspace.revisions, ...workspace.originals]) {
    const reference = row.blob;
    if (!reference || !/^[a-f0-9]{64}$/.test(reference.sha256) || reference.path !== `noveliaaWorkspaces/${accountId}/blobs/${reference.sha256}` || !reference.generation) reject('Incomplete backup blob reference.');
    if (blobs[reference.sha256]) continue;
    const bytes = await readBlob(reference);
    size += bytes.length;
    if (size > 64 * 1024 * 1024) reject('Backup exceeds the initial 64 MiB unencoded limit; operator intervention required.');
    if (sha256(bytes) !== reference.sha256 || bytes.length !== reference.size) reject('Backup source blob digest mismatch.');
    blobs[reference.sha256] = bytes.toString('base64');
  }
  const payload = { schemaVersion: 1, kind: 'noveliaa-disaster-backup', accountId, createdAt, workspace, blobs };
  const archive = { ...payload, sha256: sha256(stableStringify(payload)) };
  const bytes = Buffer.from(stableStringify(archive));
  verifyBackup(bytes);
  return bytes;
}
export function verifyBackup(bytes) {
  let archive;
  try { archive = JSON.parse(bytes.toString('utf8')); } catch { reject('Backup is not valid JSON.'); }
  const { sha256: digest, ...payload } = archive;
  if (archive.schemaVersion !== 1 || archive.kind !== 'noveliaa-disaster-backup' || !validId(archive.accountId) || sha256(stableStringify(payload)) !== digest) reject('Backup schema or manifest digest mismatch.');
  const { workspace, blobs } = archive;
  const requiredTables = ['meta', 'documents', 'revisions', 'originals', 'operations'];
  const tables = [...requiredTables, 'documentIdentities'];
  if (!workspace || !requiredTables.every(key => Array.isArray(workspace[key])) || Object.keys(workspace).some(key => !tables.includes(key) || !Array.isArray(workspace[key])) || !blobs) reject('Backup inventory incomplete.');
  for (const table of Object.keys(workspace)) {
    const ids = workspace[table].map(row => row._id ?? row.id);
    if (!ids.every(validId) || new Set(ids).size !== ids.length) reject('Backup record identifiers are invalid.');
  }
  const catalog = workspace.meta.find(row => row._id === 'catalog' || row.id === 'catalog');
  for (const identity of workspace.documentIdentities ?? []) if (!validId(identity.id) || !catalog?.universes.some(universe => universe.id === identity.universeId)) reject('Backup writing identity is invalid.');
  const revisions = new Map(workspace.revisions.map(row => [row.id, row]));
  if (revisions.size !== workspace.revisions.length) reject('Duplicate revisions in backup.');
  for (const row of [...workspace.revisions, ...workspace.originals]) {
    const reference = row.blob;
    const encoded = blobs[reference?.sha256];
    if (typeof encoded !== 'string' || reference.path !== `noveliaaWorkspaces/${archive.accountId}/blobs/${reference.sha256}` || !reference.generation) reject('Backup source blob missing.');
    const content = Buffer.from(encoded, 'base64');
    if (sha256(content) !== reference.sha256 || content.length !== reference.size) reject('Backup source bytes corrupt.');
  }
  const originals = new Map(workspace.originals.map(row => [row.id, row]));
  for (const original of workspace.originals) if (original.sha256 !== original.blob.sha256) reject('Backup original digest disagrees with its source bytes.');
  for (const metadata of workspace.revisions) {
    let revision;
    try { revision = JSON.parse(Buffer.from(blobs[metadata.blob.sha256], 'base64').toString('utf8')); validateRevision(revision); }
    catch { reject('Backup revision body is invalid.'); }
    if (revision.id !== metadata.id || revision.documentId !== metadata.documentId || revision.universeId !== metadata.universeId || revision.contentHash !== metadata.contentHash || stableStringify(revision.parentIds) !== stableStringify(metadata.parentIds)) reject('Backup revision metadata disagrees with preserved writing.');
    for (const source of revision.snapshot.sourceOriginalIds) if (originals.get(source)?.universeId !== revision.universeId) reject('Backup original reference is absent or from another universe.');
  }
  for (const head of workspace.documents) {
    const revision = revisions.get(head.headRevisionId);
    if (!revision || revision.documentId !== head.id || revision.universeId !== head.universeId) reject('Backup head is inconsistent.');
  }
  for (const revision of workspace.revisions) for (const parent of revision.parentIds ?? []) {
    const source = revisions.get(parent);
    if (!source || source.documentId !== revision.documentId || source.universeId !== revision.universeId) reject('Backup revision ancestry is incomplete.');
  }
  return archive;
}
