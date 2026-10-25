import { gunzipSync } from 'node:zlib';
import { FieldPath } from 'firebase-admin/firestore';
import { digest, stable, validId } from './integration-store.mjs';
import { validateRevision } from './service.mjs';
const MAX = 32 * 1024 * 1024, CHUNK = 192 * 1024;
const fail = message => { throw new Error(message); };
export class WritingAccess {
  constructor(db) { this.db = db; }
  root(grant) { return this.db.collection('noveliaaWorkspaces').doc(grant.workspaceId); }
  async blob(grant, hash) {
    if (!/^[a-f0-9]{64}$/.test(hash)) fail('Invalid source digest.');
    const root = this.root(grant), manifest = (await root.collection('blobs').doc(hash).get()).data();
    if (!manifest || manifest.sha256 !== hash || !Number.isInteger(manifest.size) || manifest.size < 1 || manifest.size > MAX || !Number.isInteger(manifest.encodedSize) || manifest.encodedSize < 1 || manifest.encodedSize > MAX || !['raw', 'gzip'].includes(manifest.encoding) || !Array.isArray(manifest.chunks) || manifest.chunks.length !== Math.ceil(manifest.encodedSize / CHUNK) || manifest.chunks.some(id => !/^[a-f0-9]{64}$/.test(id))) fail('Incomplete source manifest.');
    const parts = await this.db.getAll(...manifest.chunks.map(id => root.collection('chunks').doc(id)));
    const bytes = parts.map((part, i) => {
      const value = part.data(), raw = value?.bytes;
      if (!(raw instanceof Uint8Array) || value.sha256 !== manifest.chunks[i] || raw.length !== Math.min(CHUNK, manifest.encodedSize - i * CHUNK) || digest(raw) !== manifest.chunks[i]) fail('Source chunk integrity failed.');
      return raw;
    });
    const encoded = Buffer.concat(bytes), decoded = manifest.encoding === 'gzip' ? gunzipSync(encoded, { maxOutputLength: manifest.size }) : encoded;
    if (decoded.length !== manifest.size || digest(decoded) !== hash) fail('Source byte integrity failed.');
    return decoded;
  }
  async page(grant, documentId, revisionId) {
    if (!validId(documentId) || revisionId !== undefined && !validId(revisionId)) fail('Invalid writing reference.');
    const root = this.root(grant), head = (await root.collection('documents').doc(documentId).get()).data();
    if (!head || !grant.universeIds.includes(head.universeId)) fail('Writing is unavailable within this connection.');
    const load = async key => {
      const metadata = (await root.collection('revisions').doc(key).get()).data();
      if (!metadata || metadata.id !== key || metadata.documentId !== documentId || metadata.universeId !== head.universeId) fail('Revision is unavailable within this connection.');
      const bytes = await this.blob(grant, metadata.blobHash), revision = JSON.parse(bytes.toString('utf8'));
      if (revision.id !== key || revision.documentId !== documentId || revision.universeId !== head.universeId || revision.snapshot?.id !== documentId || revision.snapshot?.universeId !== head.universeId || revision.contentHash !== metadata.contentHash || digest(stable(revision.snapshot)) !== metadata.contentHash || typeof revision.snapshot.plainText !== 'string') fail('Revision integrity failed.');
      validateRevision(revision);
      return revision;
    };
    const current = await load(head.headRevisionId);
    if (current.snapshot.trashed) fail('Trashed writing is not shared with this connection.');
    const revision = !revisionId || revisionId === current.id ? current : await load(revisionId);
    return { revision, currentRevisionId: current.id };
  }
  async pages(grant, { cursor, limit = 10, query = '' } = {}) {
    if (cursor && !validId(cursor)) fail('Invalid page cursor.');
    const count = Math.min(10, Math.max(1, limit));
    let queryRef = this.root(grant).collection('documents').where('universeId', 'in', grant.universeIds).orderBy(FieldPath.documentId()).limit(count);
    if (cursor) queryRef = queryRef.startAfter(cursor);
    const heads = await queryRef.get(), pages = [];
    for (const head of heads.docs) {
      try {
        const { revision } = await this.page(grant, head.id), s = revision.snapshot;
        const needle = query.toLocaleLowerCase(), index = (s.title + '\n' + s.plainText).toLocaleLowerCase().indexOf(needle);
        if (!needle || index >= 0) pages.push({ documentId: s.id, universeId: s.universeId, title: s.title || 'Untitled', revisionId: revision.id,
          contentHash: revision.contentHash, origin: s.origin, sourceOriginalIds: s.sourceOriginalIds, collectionId: s.collectionId,
          ...(needle ? { excerpt: (s.title + '\n' + s.plainText).slice(Math.max(0, index - 100), index + 500) } : {}) });
      } catch (error) {
        if (error.message !== 'Trashed writing is not shared with this connection.') throw error;
      }
    }
    return { pages, scanned: heads.size, nextCursor: heads.size === count ? heads.docs.at(-1).id : null,
      searchCoverage: 'This batch only. Follow nextCursor to continue; an empty batch is not proof that no match exists.' };
  }
  async links(grant, body) {
    const ids = new Set(), queue = [body]; let visited = 0;
    while (queue.length) {
      if (++visited > 200000) fail('Source structure exceeds its safety bound.');
      const node = queue.pop();
      for (const mark of node?.marks ?? []) {
        const href = mark.attrs?.href;
        if (mark.type === 'link' && typeof href === 'string' && href.startsWith('noveliaa://document/') && validId(href.slice(20))) ids.add(href.slice(20));
      }
      for (const child of node?.content ?? []) queue.push(child);
    }
    const selected = [...ids].slice(0, 20);
    if (!selected.length) return { linkedDocumentIds: [], hasMoreLinks: false };
    const heads = await this.db.getAll(...selected.map(id => this.root(grant).collection('documents').doc(id)));
    return { linkedDocumentIds: heads.filter(head => head.exists && grant.universeIds.includes(head.data().universeId)).map(head => head.id), hasMoreLinks: ids.size > 20,
      note: 'Targets outside the grant are omitted. Fetch each target to verify its current availability and exact revision.' };
  }
  async submit(grant, input, store) {
    const source = await this.page(grant, input.documentId, input.revisionId);
    if (source.revision.contentHash !== input.contentHash) fail('Source hash differs. Fetch the exact writing revision again.');
    const id = digest(grant.id + ':' + input.idempotencyKey), fingerprint = digest(stable(input));
    const collection = this.root(grant).collection('collaboration'), ref = collection.doc(id);
    return this.db.runTransaction(async tx => {
      const [access, activeGrant, previous, current] = await tx.getAll(this.db.doc('noveliaaConfig/access'), store.ref('grants', grant.id), ref,
        this.root(grant).collection('documents').doc(input.documentId));
      const config = access.data(), fresh = activeGrant.data();
      if (config?.ownerUid !== grant.uid || (config.workspaceId ?? grant.uid) !== grant.workspaceId || !fresh || fresh.revoked || fresh.expiresAt <= Date.now() / 1000 || !fresh.allowProposals || !fresh.universeIds.includes(source.revision.universeId)) fail('Connection changed. Reconnect before submitting.');
      if (previous.exists) {
        if (previous.data().fingerprint !== fingerprint) fail('Idempotency key was already used for different content.');
        return { id, verification: 'unverified', replayed: true, reviewUrl: 'https://noveliaa.web.app/api/integrations/review' };
      }
      const record = { id, kind: input.kind, title: input.title, body: input.body,
        origin: 'ai', verification: 'unverified', attribution: 'External client submission; authorship and conversation claims have not been independently verified.',
        anchor: { documentId: input.documentId, revisionId: input.revisionId, contentHash: input.contentHash, title: source.revision.snapshot.title || 'Untitled' },
        universeId: source.revision.universeId, grantId: grant.id, clientName: grant.clientName,
        sourceIsCurrent: current.data()?.headRevisionId === input.revisionId, fingerprint, createdAt: new Date().toISOString() };
      tx.create(ref, record);
      return { id, verification: 'unverified', sourceIsCurrent: record.sourceIsCurrent, replayed: false, reviewUrl: 'https://noveliaa.web.app/api/integrations/review' };
    });
  }
}
