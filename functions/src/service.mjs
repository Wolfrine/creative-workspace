import { createHash } from 'node:crypto';

export class ServiceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export const stableStringify = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new ServiceError('invalid-argument', message); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
const origins = new Set(['author', 'recovered_original', 'remembered_reconstruction', 'imported_chat', 'ai', 'mixed', 'unknown']);
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function authorize(uid, ownerUid) {
  if (!uid) throw new ServiceError('unauthenticated', 'Sign in to synchronize writing.');
  if (!ownerUid || uid !== ownerUid) throw new ServiceError('permission-denied', 'This account is not the configured author.');
}
function keys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('Unsupported data fields; the source was not changed.');
}
export function plainText(node) {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(plainText).join(['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type) ? '\n' : '');
}
export function validateBody(node, depth = 0, state = { count: 0, links: [] }) {
  if (++state.count > 200000 || depth > 30) fail('Writing structure exceeds the supported limit.');
  keys(node, ['type', 'text', 'attrs', 'marks', 'content']);
  if (!['doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'hardBreak', 'horizontalRule', 'codeBlock'].includes(node.type)) fail('Unsupported editor schema; original preserved.');
  if (depth === 0 && node.type !== 'doc') fail('Writing must have a document root.');
  if (node.type === 'text' && (typeof node.text !== 'string' || !node.text.length)) fail('Invalid text node.');
  if (node.text !== undefined && (node.type !== 'text' || typeof node.text !== 'string')) fail('Invalid text node.');
  if (node.attrs) {
    keys(node.attrs, node.type === 'heading' ? ['level'] : node.type === 'orderedList' ? ['start', 'type'] : node.type === 'codeBlock' ? ['language'] : []);
    if (node.type === 'heading' && ![1, 2, 3].includes(node.attrs.level)) fail('Unsupported heading level.');
    if (node.type === 'orderedList' && (!Number.isInteger(node.attrs.start) || node.attrs.start < 1)) fail('Invalid list start.');
    if (node.type === 'orderedList' && node.attrs.type != null && !['1', 'a', 'A', 'i', 'I'].includes(node.attrs.type)) fail('Unsupported numbered-list style.');
    if (node.type === 'codeBlock' && node.attrs.language != null && typeof node.attrs.language !== 'string') fail('Invalid code language.');
  }
  if (node.type === 'heading' && !node.attrs) fail('Heading level is required.');
  if (node.marks) {
    if (!Array.isArray(node.marks) || !['text', 'hardBreak'].includes(node.type)) fail('Invalid text formatting.');
    for (const mark of node.marks) {
      keys(mark, ['type', 'attrs']);
      if (!['bold', 'italic', 'underline', 'strike', 'code', 'link'].includes(mark.type)) fail('Unsupported formatting.');
      if (mark.type === 'link') {
        keys(mark.attrs, ['href', 'target', 'rel', 'class', 'title']);
        const href = mark.attrs.href;
        if (typeof href !== 'string' || !/^(https?:\/\/|mailto:|noveliaa:\/\/document\/)/i.test(href)) fail('Unsupported link.');
        for (const key of ['target', 'rel', 'class', 'title']) if (mark.attrs[key] != null && typeof mark.attrs[key] !== 'string') fail('Invalid link attributes.');
        if (href.startsWith('noveliaa://document/')) { const target = href.slice(20); if (!id(target)) fail('Invalid internal link.'); state.links.push(target); }
      } else if (mark.attrs) keys(mark.attrs, []);
    }
  }
  if (node.content !== undefined && !Array.isArray(node.content)) fail('Invalid writing structure.');
  const blocks = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule'];
  const allowedChildren = ['doc', 'blockquote'].includes(node.type) ? blocks : ['paragraph', 'heading'].includes(node.type) ? ['text', 'hardBreak'] : ['bulletList', 'orderedList'].includes(node.type) ? ['listItem'] : node.type === 'listItem' ? blocks : node.type === 'codeBlock' ? ['text'] : [];
  if ((node.content ?? []).some(child => !allowedChildren.includes(child?.type))) fail('Invalid editor node nesting.');
  if (['doc', 'blockquote', 'bulletList', 'orderedList'].includes(node.type) && !node.content?.length) fail('Incomplete writing structure.');
  if (node.type === 'listItem' && node.content?.[0]?.type !== 'paragraph') fail('List item must start with a paragraph.');
  if (node.type === 'codeBlock' && node.content?.some(child => child.marks?.length)) fail('Unsupported code formatting.');
  for (const child of node.content ?? []) validateBody(child, depth + 1, state);
  return state.links;
}
export function validateRevision(revision) {
  keys(revision, ['id', 'documentId', 'universeId', 'parentIds', 'snapshot', 'contentHash', 'createdAt', 'restoredFrom']);
  if (![revision.id, revision.documentId, revision.universeId].every(id) || !date(revision.createdAt)) fail('Invalid revision identity.');
  if (!Array.isArray(revision.parentIds) || revision.parentIds.length > 10 || !revision.parentIds.every(id) || new Set(revision.parentIds).size !== revision.parentIds.length) fail('Invalid revision parents.');
  const snapshot = revision.snapshot;
  keys(snapshot, ['id', 'universeId', 'title', 'body', 'plainText', 'collectionId', 'trashed', 'order', 'origin', 'sourceOriginalIds', 'createdAt', 'updatedAt']);
  if (snapshot.id !== revision.documentId || snapshot.universeId !== revision.universeId || typeof snapshot.title !== 'string' || snapshot.title.length > 10000 || typeof snapshot.plainText !== 'string' || typeof snapshot.trashed !== 'boolean' || !Number.isFinite(snapshot.order) || !origins.has(snapshot.origin) || !date(snapshot.createdAt) || !date(snapshot.updatedAt)) fail('Invalid writing snapshot.');
  if (snapshot.collectionId !== null && !id(snapshot.collectionId)) fail('Invalid collection.');
  if (!Array.isArray(snapshot.sourceOriginalIds) || !snapshot.sourceOriginalIds.every(id)) fail('Invalid original references.');
  const links = validateBody(snapshot.body);
  if (plainText(snapshot.body) !== snapshot.plainText) fail('Text projection differs from the preserved writing.');
  if (sha256(stableStringify(snapshot)) !== revision.contentHash) fail('Revision content digest mismatch.');
  if (revision.restoredFrom !== undefined && !id(revision.restoredFrom)) fail('Invalid restored source.');
  return links;
}
export function validateCatalog(universes, collections) {
  if (!Array.isArray(universes) || !Array.isArray(collections) || universes.length > 1000 || collections.length > 10000) fail('Invalid workspace catalog.');
  const ids = new Set();
  for (const universe of universes) {
    keys(universe, ['id', 'name', 'createdAt']);
    if (!id(universe.id) || ids.has(universe.id) || typeof universe.name !== 'string' || universe.name.length > 10000 || !date(universe.createdAt)) fail('Invalid universe.');
    ids.add(universe.id);
  }
  const collectionIds = new Set();
  for (const collection of collections) {
    keys(collection, ['id', 'universeId', 'name', 'order']);
    if (!id(collection.id) || collectionIds.has(collection.id) || !ids.has(collection.universeId) || typeof collection.name !== 'string' || collection.name.length > 10000 || !Number.isFinite(collection.order)) fail('Invalid collection.');
    collectionIds.add(collection.id);
  }
}
/** @param {string} uid @param {import('../../src/domain/model').CommitOperation & {blob: object}} input */
export async function commitOperation(uid, input, deps) {
  authorize(uid, deps.ownerUid);
  keys(input, ['operationId', 'expectedHeadId', 'revision', 'blob']);
  if (!id(input.operationId) || (input.expectedHeadId !== null && !id(input.expectedHeadId))) fail('Invalid save operation.');
  const links = validateRevision(input.revision);
  const canonical = stableStringify(input.revision);
  const fingerprint = sha256(stableStringify({ operationId: input.operationId, expectedHeadId: input.expectedHeadId, revision: input.revision }));
  const blob = await deps.verifyBlob(uid, input.blob, Buffer.from(canonical));
  return deps.transaction(async tx => {
    const previous = await tx.get('operations', input.operationId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new ServiceError('already-exists', 'Operation ID already holds different writing.');
      return previous.result;
    }
    const revision = input.revision;
    const catalog = await tx.get('meta', 'catalog');
    if (!catalog?.universes.some(universe => universe.id === revision.universeId)) fail('Universe is not in this workspace.');
    if (revision.snapshot.collectionId && !catalog.collections.some(collection => collection.id === revision.snapshot.collectionId && collection.universeId === revision.universeId)) fail('Collection belongs to another universe.');
    const head = await tx.get('documents', revision.documentId);
    if (head && head.universeId !== revision.universeId) fail('Document belongs to another universe.');
    const identity = await tx.get('documentIdentities', revision.documentId);
    if (identity && identity.universeId !== revision.universeId) fail('Document identity belongs to another universe.');
    const existing = await tx.get('revisions', revision.id);
    if (existing) throw new ServiceError('already-exists', 'Revision ID is immutable.');
    for (const parentId of revision.parentIds) {
      const parent = await tx.get('revisions', parentId);
      if (!parent || parent.documentId !== revision.documentId || parent.universeId !== revision.universeId) fail('Revision parent is absent or belongs to other writing.');
    }
    if (input.expectedHeadId && !revision.parentIds.includes(input.expectedHeadId)) fail('Expected head must be a preserved parent.');
    if (!input.expectedHeadId && revision.parentIds.length) fail('New writing cannot claim unrelated parents.');
    for (const originalId of revision.snapshot.sourceOriginalIds) {
      const original = await tx.get('originals', originalId);
      if (!original || original.universeId !== revision.universeId) fail('Source original is absent or belongs to another universe.');
    }
    for (const target of links) {
      if (target === revision.documentId) continue;
      const linked = await tx.get('documents', target);
      const registered = linked ?? await tx.get('documentIdentities', target);
      if (!registered || registered.universeId !== revision.universeId) fail('Linked writing is absent or belongs to another universe.');
    }
    if (revision.restoredFrom) {
      const source = await tx.get('revisions', revision.restoredFrom);
      if (!source || source.documentId !== revision.documentId || source.universeId !== revision.universeId || source.origin !== revision.snapshot.origin || source.bodyHash !== sha256(stableStringify(revision.snapshot.body)) || stableStringify(source.sourceOriginalIds) !== stableStringify(revision.snapshot.sourceOriginalIds)) fail('Restoration must preserve source text and provenance.');
    }
    const conflict = (head?.headRevisionId ?? null) !== input.expectedHeadId;
    const result = { status: conflict ? 'conflict' : 'synced', headRevisionId: conflict ? head?.headRevisionId ?? null : revision.id };
    tx.create('revisions', revision.id, { id: revision.id, documentId: revision.documentId, universeId: revision.universeId, parentIds: revision.parentIds, contentHash: revision.contentHash, bodyHash: sha256(stableStringify(revision.snapshot.body)), createdAt: revision.createdAt, origin: revision.snapshot.origin, sourceOriginalIds: revision.snapshot.sourceOriginalIds, blob });
    if (!conflict) tx.set('documents', revision.documentId, { id: revision.documentId, universeId: revision.universeId, headRevisionId: revision.id });
    tx.create('operations', input.operationId, { fingerprint, result, revisionId: revision.id, actorUid: uid, committedAt: deps.now() });
    return result;
  });
}
export async function registerDocuments(uid, input, deps) {
  authorize(uid, deps.ownerUid);
  keys(input, ['documents']);
  if (!Array.isArray(input.documents) || input.documents.length > 10000) fail('Invalid writing identities.');
  const ids = new Set();
  for (const document of input.documents) {
    keys(document, ['id', 'universeId']);
    if (!id(document.id) || !id(document.universeId) || ids.has(document.id)) fail('Invalid or duplicate writing identity.');
    ids.add(document.id);
  }
  return deps.transaction(async tx => {
    const catalog = await tx.get('meta', 'catalog');
    const additions = [];
    for (const document of input.documents) {
      if (!catalog?.universes.some(universe => universe.id === document.universeId)) fail('Writing identity universe is absent.');
      const registered = await tx.get('documentIdentities', document.id);
      const committed = await tx.get('documents', document.id);
      if ([registered, committed].some(existing => existing && existing.universeId !== document.universeId)) throw new ServiceError('already-exists', 'A writing identity cannot move between universes.');
      if (!registered) additions.push(document);
    }
    // Identity registration contains no text, head or generated placeholder.
    // All graph members can be registered before restoring mutually linked roots.
    for (const document of additions) tx.create('documentIdentities', document.id, document);
    return { ok: true };
  });
}
export async function putCatalog(uid, input, deps) {
  authorize(uid, deps.ownerUid);
  keys(input, ['universes', 'collections']);
  validateCatalog(input.universes, input.collections);
  return deps.transaction(async tx => {
    const previous = await tx.get('meta', 'catalog');
    // Catalog updates may add/rename/reorder, but may never silently orphan existing writing.
    if (previous) {
      for (const universe of previous.universes) if (!input.universes.some(item => item.id === universe.id)) fail('A universe cannot be removed by catalog synchronization.');
      for (const collection of previous.collections) if (!input.collections.some(item => item.id === collection.id && item.universeId === collection.universeId)) fail('A collection cannot be removed or moved by catalog synchronization.');
    }
    tx.set('meta', 'catalog', { ...input, updatedAt: deps.now() });
    return { ok: true };
  });
}
export async function putOriginal(uid, input, deps) {
  authorize(uid, deps.ownerUid);
  keys(input, ['original', 'blob']);
  const original = input.original;
  keys(original, ['id', 'universeId', 'name', 'sha256', 'origin', 'verification', 'sourceReference', 'createdAt', 'speakerSegments']);
  if (!id(original.id) || !id(original.universeId) || typeof original.name !== 'string' || !origins.has(original.origin) || !['verified', 'unverified', 'mixed'].includes(original.verification) || typeof original.sourceReference !== 'string' || !date(original.createdAt) || !/^[a-f0-9]{64}$/.test(original.sha256)) fail('Invalid original metadata.');
  if (original.speakerSegments !== undefined && (!Array.isArray(original.speakerSegments) || original.speakerSegments.some(segment => !['user', 'assistant', 'unknown'].includes(segment.role) || !Number.isInteger(segment.start) || !Number.isInteger(segment.end) || segment.start < 0 || segment.end < segment.start))) fail('Invalid speaker provenance.');
  const blob = await deps.verifyBlob(uid, input.blob, undefined, original.sha256);
  const fingerprint = sha256(stableStringify(original));
  return deps.transaction(async tx => {
    const catalog = await tx.get('meta', 'catalog');
    if (!catalog?.universes.some(universe => universe.id === original.universeId)) fail('Original universe is absent.');
    const previous = await tx.get('originals', original.id);
    if (previous) {
      if (previous.fingerprint !== fingerprint || previous.blob.sha256 !== blob.sha256) throw new ServiceError('already-exists', 'Original material is immutable.');
      return { ok: true };
    }
    tx.create('originals', original.id, { ...original, blob, fingerprint });
    return { ok: true };
  });
}
