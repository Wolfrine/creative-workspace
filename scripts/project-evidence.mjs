import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// A read-only archive projection. The independent input oracle is captured by
// browser tests before typing/import, never generated from this archive.
const [source, output, candidate = 'uncommitted-local-candidate'] = process.argv.slice(2);
if (!source || !output) throw new Error('Usage: node scripts/project-evidence.mjs archive.json output-directory candidate-id');
const archive = JSON.parse(await readFile(source, 'utf8'));
if (archive.format !== 'noveliaa-writing-archive' || archive.schemaVersion !== 1) throw new Error('Unsupported archive');
const data = archive.snapshot;
await mkdir(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const originals = [], revisions = [];
for (const original of data.originals) {
  const bytes = Buffer.from(original.bytesBase64, 'base64');
  if (hash(bytes) !== original.sha256) throw new Error('Original bytes differ');
  const relative = `original-${original.id}.bin`; await writeFile(path.join(output, relative), bytes);
  originals.push({ id: original.id, universe_id: original.universeId, path: relative, sha256: original.sha256, origin: original.origin, verification: original.verification, source_reference: original.sourceReference });
}
for (const revision of data.revisions) {
  const bytes = Buffer.from(revision.snapshot.plainText, 'utf8'); const relative = `revision-${revision.id}.txt`;
  await writeFile(path.join(output, relative), bytes);
  revisions.push({ id: revision.id, universe_id: revision.universeId, document_id: revision.documentId, parent_ids: revision.parentIds, source_original_ids: revision.snapshot.sourceOriginalIds, origin: revision.snapshot.origin, path: relative, sha256: hash(bytes), ...(revision.restoredFrom ? { restored_from: revision.restoredFrom } : {}) });
}
const bundle = { schema_version: 1, dataset_kind: 'synthetic', execution_kind: 'real browser runtime with invented fixtures', app_revision: candidate, author_id: data.accountId, behavior_disabled: true,
  originals, revisions, proposals: [], decisions: [], assets: [], editions: [], feedback: [], consents: [], behavior: [],
  save_receipts: data.receipts.map(receipt => ({ id: receipt.revisionId + ':' + receipt.level, revision_id: receipt.revisionId, level: receipt.level })) };
await writeFile(path.join(output, 'bundle.json'), JSON.stringify(bundle, null, 2));
console.log(JSON.stringify({ source, output, originals: originals.length, revisions: revisions.length, receipts: bundle.save_receipts.length }));
