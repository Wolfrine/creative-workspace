import { type Collection, type RichNode, type WorkspaceSnapshot, plainText, linkIds } from './model';

export function assertCollectionMetadata(value: Collection): void {
  const validId = (id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(id);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['id', 'universeId', 'name', 'order', 'nameVersion'].includes(key)) || !validId(value.id) || !validId(value.universeId) || typeof value.name !== 'string' || value.name.length > 10000 || !Number.isFinite(value.order)) throw new Error('Invalid collection metadata. Nothing was changed.');
  const version = value.nameVersion;
  if (version !== undefined && (!version || typeof version !== 'object' || Array.isArray(version) || Object.keys(version).sort().join(',') !== 'generation,id' || !validId(version.id) || !Number.isSafeInteger(version.generation) || version.generation < 1)) throw new Error('Invalid collection name version. Nothing was changed.');
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(item => stableStringify(item === undefined ? null : item)).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined).map(key => JSON.stringify(key) + ':' + stableStringify((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
export async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function toBase64(bytes: Uint8Array): string {
  let result = ''; for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
export function fromBase64(value: string): Uint8Array {
  const decoded = atob(value); return Uint8Array.from(decoded, char => char.charCodeAt(0));
}
const nodes = new Set(['doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'hardBreak', 'horizontalRule']);
const marks = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'link']);
export function assertBody(body: RichNode): void {
  let count = 0;
  const fields = (value: object, allowed: string[]) => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unsupported editor fields. Nothing was changed.'); };
  const walk = (node: RichNode, depth: number, parentType?: string) => {
    if (!node || !nodes.has(node.type) || depth > 30 || ++count > 200_000) throw new Error('Unsupported editor structure. The original is preserved; nothing has been imported.');
    fields(node, ['type', 'text', 'attrs', 'marks', 'content']);
    if (node.type === 'text' && (typeof node.text !== 'string' || !node.text.length) || node.text !== undefined && node.type !== 'text') throw new Error('Invalid text node.');
    if (node.attrs) {
      fields(node.attrs, node.type === 'paragraph' ? ['firstLineIndent'] : node.type === 'heading' ? ['level'] : node.type === 'orderedList' ? ['start', 'type'] : node.type === 'codeBlock' ? ['language'] : []);
      if (node.type === 'paragraph' && node.attrs.firstLineIndent !== undefined && (node.attrs.firstLineIndent !== true || parentType !== 'doc')) throw new Error('First-line indentation is supported only on body paragraphs. Nothing was changed.');
      if (node.type === 'orderedList' && (!Number.isInteger(node.attrs.start) || Number(node.attrs.start) < 1 || node.attrs.type != null && !['1', 'a', 'A', 'i', 'I'].includes(String(node.attrs.type)))) throw new Error('Unsupported numbered-list attributes.');
      if (node.type === 'codeBlock' && node.attrs.language != null && typeof node.attrs.language !== 'string') throw new Error('Unsupported code language.');
    }
    if (node.type === 'heading' && ![1, 2, 3].includes(node.attrs?.level as number)) throw new Error('Unsupported heading level.');
    if (node.marks && (!Array.isArray(node.marks) || !['text', 'hardBreak'].includes(node.type))) throw new Error('Unsupported formatting structure.');
    for (const mark of node.marks ?? []) {
      fields(mark, ['type', 'attrs']);
      if (!marks.has(mark.type)) throw new Error('Unsupported formatting. Import cancelled without changing your writing.');
      if (mark.type === 'link') {
        fields(mark.attrs!, ['href', 'target', 'rel', 'class', 'title']);
        const href = mark.attrs?.href;
        if (typeof href !== 'string') throw new Error('Invalid link.');
        if (!/^(https?:\/\/|mailto:|noveliaa:\/\/document\/)/i.test(href)) throw new Error('Unsupported link protocol.');
        if (href.startsWith('noveliaa://document/') && !/^[A-Za-z0-9_-]{1,150}$/.test(href.slice(20))) throw new Error('Invalid internal link.');
        for (const key of ['target', 'rel', 'class', 'title']) if (mark.attrs?.[key] != null && typeof mark.attrs[key] !== 'string') throw new Error('Invalid link attributes.');
      } else if (mark.attrs) fields(mark.attrs, []);
    }
    if (node.content !== undefined && !Array.isArray(node.content)) throw new Error('Invalid writing structure.');
    const blocks = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule'];
    const children = ['doc', 'blockquote'].includes(node.type) ? blocks : ['paragraph', 'heading'].includes(node.type) ? ['text', 'hardBreak'] : ['bulletList', 'orderedList'].includes(node.type) ? ['listItem'] : node.type === 'listItem' ? blocks : node.type === 'codeBlock' ? ['text'] : [];
    if ((node.content ?? []).some(child => !children.includes(child?.type))) throw new Error('Unsupported editor nesting.');
    if (['doc', 'blockquote', 'bulletList', 'orderedList'].includes(node.type) && !node.content?.length || node.type === 'listItem' && node.content?.[0]?.type !== 'paragraph') throw new Error('Incomplete editor structure.');
    if (node.type === 'codeBlock' && node.content?.some(child => child.marks?.length)) throw new Error('Unsupported code formatting.');
    (node.content ?? []).forEach(child => walk(child, depth + 1, node.type));
  };
  if (body?.type !== 'doc') throw new Error('Unsupported editor document.');
  walk(body, 0);
}
export async function validateSnapshot(data: WorkspaceSnapshot): Promise<void> {
  if (!data || data.schemaVersion !== 1 || !data.accountId) throw new Error('Unsupported archive version. Nothing was changed.');
  const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
  const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const keys = (value: object, allowed: string[]) => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unsupported archive fields. Nothing was changed.'); };
  keys(data, ['schemaVersion', 'accountId', 'universes', 'collections', 'documents', 'revisions', 'originals', 'receipts']);
  if (!validId(data.accountId)) throw new Error('Invalid archive account identity.');
  for (const key of ['universes', 'collections', 'documents', 'revisions', 'originals', 'receipts'] as const) {
    if (!Array.isArray(data[key])) throw new Error('Incomplete archive: ' + key);
    if (key !== 'receipts') {
      const values = data[key] as { id: string }[];
      if (new Set(values.map(x => x.id)).size !== values.length || values.some(x => !/^[A-Za-z0-9_-]{1,150}$/.test(x.id))) throw new Error('Duplicate or invalid archive IDs.');
    }
  }
  const worlds = new Set(data.universes.map(x => x.id));
  const collections = new Map(data.collections.map(x => [x.id, x]));
  const docs = new Map(data.documents.map(x => [x.id, x]));
  const revisions = new Map(data.revisions.map(x => [x.id, x]));
  const originals = new Map(data.originals.map(x => [x.id, x]));
  const origins = new Set(['author', 'recovered_original', 'remembered_reconstruction', 'imported_chat', 'ai', 'mixed', 'unknown']);
  if (data.universes.length > 1000 || data.collections.length > 10000) throw new Error('Archive catalog exceeds the supported limit.');
  for (const universe of data.universes) {
    keys(universe, ['id', 'name', 'createdAt']);
    if (typeof universe.name !== 'string' || universe.name.length > 10000 || !date(universe.createdAt)) throw new Error('Invalid universe metadata.');
  }
  for (const collection of data.collections) {
    assertCollectionMetadata(collection);
    if (!worlds.has(collection.universeId)) throw new Error('Invalid collection metadata.');
  }
  const checkWriting = (writing: Omit<WorkspaceSnapshot['documents'][number], 'headRevisionId'>) => {
    keys(writing, ['id', 'universeId', 'title', 'body', 'plainText', 'collectionId', 'trashed', 'order', 'origin', 'sourceOriginalIds', 'createdAt', 'updatedAt']);
    if (!validId(writing.id) || !validId(writing.universeId) || typeof writing.title !== 'string' || writing.title.length > 10000 || typeof writing.plainText !== 'string' || typeof writing.trashed !== 'boolean' || !Number.isFinite(writing.order) || !date(writing.createdAt) || !date(writing.updatedAt) || !origins.has(writing.origin) || writing.collectionId !== null && !validId(writing.collectionId) || !Array.isArray(writing.sourceOriginalIds) || !writing.sourceOriginalIds.every(validId)) throw new Error('Invalid writing metadata. Nothing was changed.');
  };
  for (const original of data.originals) {
    keys(original, ['id', 'universeId', 'name', 'bytesBase64', 'sha256', 'origin', 'verification', 'sourceReference', 'createdAt', 'speakerSegments']);
    if (typeof original.name !== 'string' || typeof original.bytesBase64 !== 'string' || typeof original.sourceReference !== 'string' || !date(original.createdAt) || !/^[a-f0-9]{64}$/.test(original.sha256)) throw new Error('Invalid original metadata.');
    if (original.speakerSegments !== undefined && (!Array.isArray(original.speakerSegments) || original.speakerSegments.some(segment => !['user', 'assistant', 'unknown'].includes(segment.role) || !Number.isInteger(segment.start) || !Number.isInteger(segment.end) || segment.start < 0 || segment.end < segment.start))) throw new Error('Invalid speaker provenance.');
    if (!worlds.has(original.universeId) || !origins.has(original.origin) || !['verified', 'unverified', 'mixed'].includes(original.verification) || !original.sourceReference) throw new Error('Invalid original provenance.');
    if (await sha256(fromBase64(original.bytesBase64)) !== original.sha256) throw new Error('Original bytes failed verification: ' + original.name);
  }
  for (const revision of data.revisions) {
    keys(revision, ['id', 'documentId', 'universeId', 'parentIds', 'snapshot', 'contentHash', 'createdAt', 'restoredFrom']);
    if (!date(revision.createdAt) || !validId(revision.documentId) || !validId(revision.universeId) || revision.restoredFrom !== undefined && !validId(revision.restoredFrom)) throw new Error('Invalid revision metadata.');
    checkWriting(revision.snapshot);
    const doc = docs.get(revision.documentId);
    if (!doc || revision.universeId !== doc.universeId || revision.snapshot.id !== doc.id || revision.snapshot.universeId !== doc.universeId) throw new Error('Revision references another document or universe.');
    assertBody(revision.snapshot.body);
    if (!origins.has(revision.snapshot.origin) || plainText(revision.snapshot.body) !== revision.snapshot.plainText) throw new Error('Revision text or origin is inconsistent.');
    if (await sha256(stableStringify(revision.snapshot)) !== revision.contentHash) throw new Error('Revision failed verification: ' + revision.id);
    if (!Array.isArray(revision.parentIds) || revision.parentIds.length > 10 || !revision.parentIds.every(validId) || new Set(revision.parentIds).size !== revision.parentIds.length) throw new Error('Invalid revision parents.');
    for (const parentId of revision.parentIds) {
      const parent = revisions.get(parentId);
      if (!parent || parent.documentId !== doc.id || parent.universeId !== doc.universeId) throw new Error('Broken revision history.');
    }
    for (const originalId of revision.snapshot.sourceOriginalIds) if (originals.get(originalId)?.universeId !== doc.universeId) throw new Error('Broken original reference.');
    for (const target of linkIds(revision.snapshot.body)) if (docs.get(target)?.universeId !== doc.universeId) throw new Error('Link crosses universes or points to a missing document.');
    if (revision.restoredFrom) {
      const source = revisions.get(revision.restoredFrom);
      if (!source || source.documentId !== doc.id || source.snapshot.origin !== revision.snapshot.origin || stableStringify(source.snapshot.body) !== stableStringify(revision.snapshot.body) || stableStringify(source.snapshot.sourceOriginalIds) !== stableStringify(revision.snapshot.sourceOriginalIds)) throw new Error('Restore has changed the source text or origin.');
    }
  }
  const remaining = new Set(revisions.keys()), visited = new Set<string>();
  while (remaining.size) {
    const ready = [...remaining].filter(id => revisions.get(id)!.parentIds.every(parent => visited.has(parent)));
    if (!ready.length) throw new Error('Revision graph contains a cycle.');
    ready.forEach(id => { remaining.delete(id); visited.add(id); });
  }
  for (const doc of data.documents) {
    keys(doc, ['id', 'universeId', 'title', 'body', 'plainText', 'collectionId', 'trashed', 'order', 'origin', 'sourceOriginalIds', 'createdAt', 'updatedAt', 'headRevisionId']);
    const revision = revisions.get(doc.headRevisionId ?? '');
    if (!worlds.has(doc.universeId) || !revision || revision.documentId !== doc.id) throw new Error('Document has no recoverable head revision.');
    const { headRevisionId: _, ...snapshot } = doc;
    checkWriting(snapshot);
    if (stableStringify(snapshot) !== stableStringify(revision.snapshot)) throw new Error('Document disagrees with its head revision.');
    if (doc.collectionId && collections.get(doc.collectionId)?.universeId !== doc.universeId) throw new Error('Document has an invalid collection.');
  }
  for (const receipt of data.receipts) {
    keys(receipt, ['revisionId', 'level', 'at', 'conflict']);
    if (!revisions.has(receipt.revisionId) || !['local', 'cloud'].includes(receipt.level) || !date(receipt.at) || receipt.conflict !== undefined && typeof receipt.conflict !== 'boolean') throw new Error('Save receipt has no revision.');
  }
}
