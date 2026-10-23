import { type CloudAdapter, type Collection, type Original, type Origin, type Revision, type RichNode, type WorkspaceSnapshot, type WorkspaceState, type WritingDocument, emptyBody, textBody, plainText, linkIds } from '../domain/model';
import { assertBody, sha256, stableStringify, toBase64, validateSnapshot } from '../domain/codec';
import { DeviceDatabase, type PendingOperation } from '../storage/database';
import { decodeArchive, encodeArchive, escapeHtml } from '../storage/archive';
import { renderHtml, renderMarkdown } from '../domain/render';

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
const blank = (accountId: string): WorkspaceSnapshot => ({ schemaVersion: 1, accountId, documents: [], revisions: [], originals: [], universes: [], collections: [], receipts: [] });
export class WritingEngine {
  private state: WorkspaceState;
  private db?: DeviceDatabase;
  private listeners = new Set<() => void>();
  private dirty = new Map<string, number>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private tail: Promise<unknown> = Promise.resolve();
  private syncPromise?: Promise<void>;
  private syncing = false;
  private pending: PendingOperation[] = [];
  private cloudHeads = new Map<string, string | null>();
  private channel?: BroadcastChannel;
  private disposed = false;
  private localConflicts = new Set<string>();
  private initializePromise?: Promise<void>;
  private hasPulledCloud = false;
  constructor(readonly accountId: string, readonly cloud: CloudAdapter | null) {
    this.state = { ...blank(accountId), ready: false, localOnly: !cloud, activeUniverseId: '', activeDocumentId: null, saveState: 'local', error: null, pendingCount: 0, online: typeof navigator === 'undefined' || navigator.onLine !== false };
  }
  getSnapshot = (): WorkspaceState => this.state;
  subscribe = (callback: () => void): (() => void) => { this.listeners.add(callback); return () => this.listeners.delete(callback); };
  private publish(patch: Partial<WorkspaceState> = {}): void {
    this.state = { ...this.state, ...patch, pendingCount: this.pending.length };
    this.state.saveState = this.state.error ? 'error' : this.dirty.size ? 'saving' : this.pending.some(x => x.status === 'conflict') || this.localConflicts.size ? 'conflict' : this.syncing ? 'syncing' : this.pending.length || !this.cloud ? 'local' : 'synced';
    this.listeners.forEach(callback => callback());
  }
  private fail(error: unknown): void { this.publish({ error: (error instanceof Error ? error.message : String(error)) + ' Your open text is still available. Export text if saving cannot be restored.' }); }
  clearError = (): void => { this.publish({ error: null }); };
  initialize(): Promise<void> { return this.initializePromise ??= this.open(); }
  private async open(): Promise<void> {
    try {
      this.db = await DeviceDatabase.open(this.accountId);
      let disk = await this.db.snapshot();
      this.pending = await this.db.all<PendingOperation>('outbox');
      this.localConflicts = new Set(await this.db.conflicts());
      if (!disk.universes.length && this.cloud && this.state.online) {
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
          const remote = await Promise.race([this.cloud.load(), new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Cloud library is taking longer to open. Writing can continue on this device.')), 2500); })]);
          await validateSnapshot(remote);
          remote.documents.forEach(doc => this.cloudHeads.set(doc.id, doc.headRevisionId));
          await this.db.merge(remote, new Set()); disk = await this.db.snapshot(); this.hasPulledCloud = true;
        } catch (error) { this.fail(error); } finally { clearTimeout(deadline); }
      }
      if (!disk.universes.length) {
        disk.universes = [{ id: uuid(), name: 'My writing', createdAt: now() }];
        await this.db.catalog(disk);
      }
      const preferences = await this.db.getPreference<{ universeId: string; documentId: string | null }>('navigation');
      const activeUniverseId = disk.universes.some(x => x.id === preferences?.universeId) ? preferences!.universeId : disk.universes[0].id;
      const activeDocumentId = disk.documents.some(x => x.id === preferences?.documentId && x.universeId === activeUniverseId && !x.trashed) ? preferences!.documentId : null;
      this.publish({ ...disk, ready: true, activeUniverseId, activeDocumentId });
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('noveliaa:' + this.accountId);
        this.channel.onmessage = () => { void this.refreshDisk().catch(error => this.fail(error)); };
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('online', this.online); window.addEventListener('offline', this.offline);
        document.addEventListener('visibilitychange', this.visibility);
        window.addEventListener('beforeunload', this.beforeUnload);
      }
      if (this.cloud && this.state.online) void this.sync(false);
    } catch (error) {
      const universe = { id: uuid(), name: 'My writing', createdAt: now() };
      this.publish({ ready: true, universes: this.state.universes.length ? this.state.universes : [universe], activeUniverseId: this.state.activeUniverseId || universe.id }); this.fail(error);
    }
  }
  private beforeUnload = (event: BeforeUnloadEvent): void => { if (this.dirty.size) { event.preventDefault(); event.returnValue = ''; } };
  private visibility = (): void => { if (document.visibilityState === 'hidden') void this.flush().catch(error => this.fail(error)); };
  private online = (): void => { this.publish({ online: true }); void this.sync(); };
  private offline = (): void => { this.publish({ online: false }); };
  private async refreshDisk(): Promise<void> {
    if (!this.db || this.disposed) return;
    const disk = await this.db.snapshot();
    const diskPending = await this.db.all<PendingOperation>('outbox');
    const known = new Set(disk.revisions.map(x => x.id));
    const fresh = this.state.revisions.filter(x => !known.has(x.id));
    const freshIds = new Set(fresh.map(x => x.id));
    this.pending = [...diskPending, ...this.pending.filter(x => freshIds.has(x.revision.id) && !diskPending.some(y => y.operationId === x.operationId))];
    const local = new Map(this.state.documents.map(x => [x.id, x]));
    const documents = disk.documents.map(doc => {
      const ours = local.get(doc.id);
      if (ours && (this.dirty.has(doc.id) || freshIds.has(ours.headRevisionId ?? '') || (this.state.activeDocumentId === doc.id && ours.headRevisionId !== doc.headRevisionId))) {
        if (ours.headRevisionId !== doc.headRevisionId && !freshIds.has(ours.headRevisionId ?? '')) { this.localConflicts.add(doc.id); void this.db!.markConflict(doc.id); }
        return ours;
      }
      return doc;
    });
    for (const doc of this.state.documents) if (!documents.some(x => x.id === doc.id) && (this.dirty.has(doc.id) || freshIds.has(doc.headRevisionId ?? ''))) documents.push(doc);
    this.publish({ ...disk, ...this.retainedRecords(disk), documents });
  }
  private broadcast(): void { this.channel?.postMessage({ changed: true }); }
  private retainedRecords(disk: WorkspaceSnapshot): Pick<WorkspaceSnapshot, 'revisions' | 'originals' | 'universes' | 'collections' | 'receipts'> {
    // None of these records is deleted by device/cloud refresh. Include records
    // created after a read began, especially originals referenced by fresh text.
    const union = <T extends { id: string }>(incoming: T[], current: T[]): T[] => [...new Map([...current, ...incoming].map(item => [item.id, item])).values()];
    return { revisions: union(disk.revisions, this.state.revisions), originals: union(disk.originals, this.state.originals), universes: union(disk.universes, this.state.universes), collections: union(disk.collections, this.state.collections), receipts: [...new Map([...this.state.receipts, ...disk.receipts].map(item => [item.revisionId + ':' + item.level, item])).values()] };
  }
  private async remember(): Promise<void> { await this.db?.setPreference('navigation', { universeId: this.state.activeUniverseId, documentId: this.state.activeDocumentId }); }
  async createDocument(options: { title?: string; body?: RichNode; collectionId?: string | null; origin?: Origin; sourceOriginalIds?: string[] } = {}): Promise<string> {
    const time = now(); const body = options.body ?? emptyBody(); assertBody(body);
    const doc: WritingDocument = { id: uuid(), universeId: this.state.activeUniverseId, title: options.title ?? '', body, plainText: plainText(body), collectionId: options.collectionId ?? null, trashed: false, order: this.state.documents.filter(x => x.universeId === this.state.activeUniverseId).length, origin: options.origin ?? 'author', sourceOriginalIds: options.sourceOriginalIds ?? [], createdAt: time, updatedAt: time, headRevisionId: null };
    this.dirty.set(doc.id, 1); this.publish({ documents: [...this.state.documents, doc], activeDocumentId: doc.id, error: null });
    try { await this.persist(doc.id); await this.remember(); } catch (error) { this.fail(error); }
    return doc.id;
  }
  updateDocument(id: string, patch: Partial<Pick<WritingDocument, 'title' | 'body' | 'collectionId' | 'trashed' | 'order'>>): void {
    const doc = this.state.documents.find(x => x.id === id); if (!doc) return;
    try {
      if (patch.body) {
        assertBody(patch.body);
        for (const target of linkIds(patch.body)) if (!this.state.documents.some(x => x.id === target && x.universeId === doc.universeId)) throw new Error('A document link must stay inside this writing world.');
      }
      if (patch.collectionId && !this.state.collections.some(x => x.id === patch.collectionId && x.universeId === doc.universeId)) throw new Error('Choose a collection in this writing world.');
      const next = { ...doc, ...patch, body: patch.body ? clone(patch.body) : doc.body, plainText: patch.body ? plainText(patch.body) : doc.plainText, updatedAt: now() };
      this.dirty.set(id, (this.dirty.get(id) ?? 0) + 1);
      this.publish({ documents: this.state.documents.map(x => x.id === id ? next : x), error: null });
      clearTimeout(this.timers.get(id));
      this.timers.set(id, setTimeout(() => { void this.persist(id).catch(error => this.fail(error)); }, 300));
    } catch (error) { this.fail(error); }
  }
  private persist(id: string, restore?: Revision): Promise<void> {
    clearTimeout(this.timers.get(id)); this.timers.delete(id);
    const job = this.tail.catch(() => {}).then(async () => {
      if (!this.dirty.has(id) && !restore) return;
      if (!this.db) throw new Error('Device storage is unavailable.');
      const generation = this.dirty.get(id);
      const doc = clone(this.state.documents.find(x => x.id === id)!); if (!doc) return;
      const previous = doc.headRevisionId;
      const { headRevisionId: _, ...snapshot } = doc;
      const parents = [...new Set([previous, ...(restore && this.cloudHeads.get(id) ? [this.cloudHeads.get(id)!] : [])].filter((x): x is string => !!x))];
      const revision: Revision = { id: uuid(), documentId: doc.id, universeId: doc.universeId, snapshot, contentHash: await sha256(stableStringify(snapshot)), parentIds: parents, createdAt: now(), ...(restore ? { restoredFrom: restore.id } : {}) };
      const operation: PendingOperation = { operationId: revision.id, expectedHeadId: restore ? this.cloudHeads.get(id) ?? previous : previous, revision, status: 'pending' };
      const committed = { ...doc, headRevisionId: revision.id };
      const conflict = await this.db.checkpoint(committed, revision, operation, previous);
      this.pending.push(operation);
      if (conflict) this.localConflicts.add(id);
      if (generation === this.dirty.get(id)) this.dirty.delete(id);
      this.publish({ documents: this.state.documents.map(x => x.id === id ? { ...x, headRevisionId: revision.id } : x), revisions: [...this.state.revisions, revision], receipts: [...this.state.receipts, { revisionId: revision.id, level: 'local', at: now() }], error: null });
      this.broadcast();
      if (this.cloud && this.state.online && !this.syncing) void this.sync(false);
    });
    this.tail = job; return job;
  }
  async flush(): Promise<void> { try { for (const id of [...this.dirty.keys()]) await this.persist(id); await this.tail; } catch (error) { this.fail(error); throw error; } }
  async selectDocument(id: string): Promise<void> {
    await this.flush(); const doc = this.state.documents.find(x => x.id === id); if (!doc) return;
    this.publish({ activeUniverseId: doc.universeId, activeDocumentId: id }); await this.remember();
  }
  async createUniverse(name: string): Promise<void> {
    if (!name.trim()) return; await this.flush(); const universe = { id: uuid(), name: name.trim(), createdAt: now() };
    const universes = [...this.state.universes, universe]; await this.db?.catalog({ universes, collections: this.state.collections });
    this.publish({ universes, activeUniverseId: universe.id, activeDocumentId: null }); await this.remember(); this.broadcast();
  }
  async selectUniverse(id: string): Promise<void> { if (!this.state.universes.some(x => x.id === id)) return; await this.flush(); this.publish({ activeUniverseId: id, activeDocumentId: null }); await this.remember(); }
  async createCollection(name: string): Promise<void> {
    if (!name.trim()) return;
    const collection: Collection = { id: uuid(), universeId: this.state.activeUniverseId, name: name.trim(), order: this.state.collections.length };
    const collections = [...this.state.collections, collection]; await this.db?.catalog({ universes: this.state.universes, collections });
    this.publish({ collections }); this.broadcast(); if (this.cloud) void this.sync();
  }
  async restoreRevision(id: string): Promise<void> {
    await this.flush();
    if (this.cloud && this.state.online) await this.pullCloud();
    const revision = this.state.revisions.find(x => x.id === id); if (!revision) throw new Error('Revision not found.');
    const doc = this.state.documents.find(x => x.id === revision.documentId)!;
    const next = { ...clone(revision.snapshot), updatedAt: now(), headRevisionId: doc.headRevisionId };
    this.dirty.set(doc.id, 1); this.publish({ documents: this.state.documents.map(x => x.id === doc.id ? next : x), activeDocumentId: doc.id, activeUniverseId: doc.universeId, error: null });
    await this.persist(doc.id, revision);
    // Previous conflict branches stay in immutable history; selecting one is a new author action.
    await this.db?.clearConflicts(doc.id);
    this.pending = this.pending.filter(x => !(x.revision.documentId === doc.id && x.status === 'conflict'));
    this.localConflicts.delete(doc.id); this.publish(); await this.remember();
  }
  private async pullCloud(): Promise<void> {
    if (!this.cloud || !this.db) return;
    const remote = await this.cloud.load(); await validateSnapshot(remote);
    this.hasPulledCloud = true;
    remote.documents.forEach(doc => this.cloudHeads.set(doc.id, doc.headRevisionId));
    const preserve = new Set([...this.dirty.keys(), ...this.pending.map(x => x.revision.documentId)]);
    // Avoid replacing an actively edited document behind its caret when another device advances it.
    const current = this.state.documents.find(x => x.id === this.state.activeDocumentId);
    const other = remote.documents.find(x => x.id === current?.id);
    const ancestors = new Set<string>(); const queue = current?.headRevisionId ? [current.headRevisionId] : [];
    while (queue.length) { const id = queue.pop()!; if (ancestors.has(id)) continue; ancestors.add(id); queue.push(...(this.state.revisions.find(x => x.id === id)?.parentIds ?? [])); }
    if (current && other && current.headRevisionId !== other.headRevisionId) {
      preserve.add(current.id);
      if (!other.headRevisionId || !ancestors.has(other.headRevisionId)) { this.localConflicts.add(current.id); await this.db!.markConflict(current.id); }
    }
    await this.db!.merge(remote, preserve);
    const disk = await this.db!.snapshot();
    const documents = disk.documents.map(doc => this.dirty.has(doc.id) || this.pending.some(x => x.revision.documentId === doc.id) ? this.state.documents.find(x => x.id === doc.id) ?? doc : doc);
    for (const doc of this.state.documents) if (!documents.some(x => x.id === doc.id) && (this.dirty.has(doc.id) || this.pending.some(x => x.revision.documentId === doc.id))) documents.push(doc);
    this.publish({ ...disk, ...this.retainedRecords(disk), documents });
  }
  sync = (refresh = true): Promise<void> => {
    if (!this.cloud || !this.db || !this.state.online) return Promise.resolve();
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.synchronize(refresh).catch(error => this.fail(error)).finally(() => {
      this.syncing = false; this.syncPromise = undefined; this.publish();
      if (!this.disposed && !this.state.error && this.pending.some(x => x.status === 'pending') && this.state.online) queueMicrotask(() => { void this.sync(false); });
    });
    return this.syncPromise;
  };
  private async synchronize(refresh: boolean): Promise<void> {
    this.syncing = true; this.publish();
    if (refresh || !this.hasPulledCloud) await this.pullCloud();
    // Do not call flush here: checkpoint scheduling can start sync while its own tail is finishing.
    await this.cloud!.putCatalog(this.state.universes, this.state.collections);
    await this.cloud!.registerDocuments?.(this.state.documents.map(({ id, universeId }) => ({ id, universeId })));
    for (const original of this.state.originals) await this.cloud!.putOriginal(original);
    // IndexedDB returns UUID-key order after restart, not revision ancestry order.
    const remaining = new Map(this.pending.map(x => [x.operationId, x]));
    const operations: PendingOperation[] = [];
    while (remaining.size) {
      const ready = [...remaining.values()].filter(x => x.revision.parentIds.every(parent => !remaining.has(parent)) && (this.cloud!.registerDocuments || linkIds(x.revision.snapshot.body).every(target => target === x.revision.documentId || this.cloudHeads.has(target) || ![...remaining.values()].some(y => y.revision.documentId === target))));
      if (!ready.length) throw new Error('Pending revision history is inconsistent. No changes were discarded.');
      ready.sort((a, b) => a.revision.createdAt.localeCompare(b.revision.createdAt) || a.operationId.localeCompare(b.operationId));
      ready.forEach(x => { operations.push(x); remaining.delete(x.operationId); });
    }
    let conflicted = false;
    for (const operation of operations) {
      if (operation.status === 'conflict') continue;
      // A source may have been imported after this sync began. Stage its exact bytes
      // and catalog before the dependent revision, never a stale captured source list.
      await this.cloud!.putCatalog(this.state.universes, this.state.collections);
      await this.cloud!.registerDocuments?.(this.state.documents.map(({ id, universeId }) => ({ id, universeId })));
      for (const originalId of operation.revision.snapshot.sourceOriginalIds) {
        const original = this.state.originals.find(x => x.id === originalId);
        if (!original) throw new Error('Source original is unavailable. The local revision is retained.');
        await this.cloud!.putOriginal(original);
      }
      const result = await this.cloud!.commit({ operationId: operation.operationId, expectedHeadId: operation.expectedHeadId, revision: operation.revision });
      this.cloudHeads.set(operation.revision.documentId, result.headRevisionId);
      await this.db!.acknowledge(operation.revision.id, result.status === 'conflict');
      if (result.status === 'conflict') {
        conflicted = true;
        this.pending = this.pending.map(x => x.operationId === operation.operationId ? { ...x, status: 'conflict' } : x); this.localConflicts.add(operation.revision.documentId);
      } else {
        this.pending = this.pending.filter(x => x.operationId !== operation.operationId);
        this.publish({ receipts: [...this.state.receipts.filter(x => !(x.revisionId === operation.revision.id && x.level === 'cloud')), { revisionId: operation.revision.id, level: 'cloud', at: now() }] });
      }
    }
    if (conflicted) await this.pullCloud();
    // Full-archive restoration is an explicit author action. If replay retained a
    // branch or advanced a different head, select the archived text with a NEW,
    // expected-head revision; original IDs and all branches remain recoverable.
    const archiveHeads = await this.db!.getPreference<{ documentId: string; revisionId: string }[]>('archiveHeads');
    if (archiveHeads?.length) {
      for (const target of archiveHeads) {
        const selected = this.state.revisions.find(x => x.id === target.revisionId);
        if (!selected) throw new Error('The selected archive revision is unavailable.');
        // A later author checkpoint supersedes the earlier import selection.
        if (this.state.documents.find(x => x.id === target.documentId)?.headRevisionId !== target.revisionId || this.dirty.has(target.documentId)) continue;
        if (this.cloudHeads.get(target.documentId) !== target.revisionId) {
          const doc = this.state.documents.find(x => x.id === target.documentId)!;
          this.dirty.set(doc.id, 1);
          this.publish({ documents: this.state.documents.map(x => x.id === doc.id ? { ...clone(selected.snapshot), updatedAt: now(), headRevisionId: doc.headRevisionId } : x) });
          await this.persist(doc.id, selected);
          await this.db!.clearConflicts(doc.id); this.localConflicts.delete(doc.id);
          this.pending = this.pending.filter(x => !(x.revision.documentId === doc.id && x.status === 'conflict'));
        }
      }
      await this.db!.setPreference('archiveHeads', []);
    }
    this.publish({ error: null }); this.broadcast();
  }
  async exportArchive(): Promise<Blob> { await this.flush(); const { ready: _, localOnly: __, activeUniverseId: ___, activeDocumentId: ____, saveState: _____, error: ______, pendingCount: _______, online: ________, ...snapshot } = this.state; return encodeArchive(clone(snapshot)); }
  async importArchive(file: File): Promise<void> {
    await this.flush(); const snapshot = await decodeArchive(await file.text());
    if (!this.db) throw new Error('Device storage unavailable.');
    await this.db.enqueueArchive({ ...snapshot, accountId: this.accountId });
    this.pending = await this.db.all<PendingOperation>('outbox'); const disk = await this.db.snapshot();
    this.publish({ ...disk, activeUniverseId: disk.universes[0]?.id ?? '', activeDocumentId: disk.documents.find(x => !x.trashed)?.id ?? null, error: null }); await this.remember(); this.broadcast(); if (this.cloud) void this.sync();
  }
  async importText(file: File, origin: Origin = 'unknown'): Promise<string> {
    if (file.size > 16 * 1024 * 1024) throw new Error('Text imports are limited to 16 MiB. The source file was not changed.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text: string; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('Only UTF-8 text is supported. The original file remains unchanged.'); }
    const original: Original = { id: uuid(), universeId: this.state.activeUniverseId, name: file.name, bytesBase64: toBase64(bytes), sha256: await sha256(bytes), origin, verification: 'unverified', sourceReference: 'Explicit file import: ' + file.name, createdAt: now() };
    if (origin === 'imported_chat') {
      const matches = [...text.matchAll(/^(You said:|User:|ChatGPT said:|Assistant:)\s*$/gm)];
      original.speakerSegments = [];
      if (!matches.length || matches[0].index! > 0) original.speakerSegments.push({ role: 'unknown', start: 0, end: matches[0]?.index ?? text.length });
      matches.forEach((match, i) => original.speakerSegments!.push({ role: /^(You|User)/.test(match[1]) ? 'user' : 'assistant', start: match.index!, end: matches[i + 1]?.index ?? text.length }));
    }
    if (!this.db) throw new Error('Device storage unavailable.'); await this.db.putOriginal(original);
    this.publish({ originals: [...this.state.originals, original] });
    return this.createDocument({ title: file.name.replace(/\.(txt|md)$/i, ''), body: textBody(text), origin, sourceOriginalIds: [original.id] });
  }
  async exportDocument(id: string, format: 'txt' | 'html' | 'md'): Promise<Blob> {
    const doc = this.state.documents.find(x => x.id === id); if (!doc) throw new Error('Document not found.');
    if (format === 'html') return new Blob(['<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(doc.title || 'Untitled') + '</title></head><body><h1>' + escapeHtml(doc.title || 'Untitled') + '</h1>' + renderHtml(doc.body) + '</body></html>'], { type: 'text/html;charset=utf-8' });
    return new Blob([format === 'md' ? (doc.title ? '# ' + doc.title.replace(/[\\`*_[\]<>#~]/g, '\\$&') + '\n\n' : '') + renderMarkdown(doc.body) : doc.plainText], { type: 'text/plain;charset=utf-8' });
  }
  dispose(): void {
    this.disposed = true; this.channel?.close();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.online); window.removeEventListener('offline', this.offline); document.removeEventListener('visibilitychange', this.visibility); window.removeEventListener('beforeunload', this.beforeUnload);
    }
    this.timers.forEach(clearTimeout); this.timers.clear(); this.db?.close();
  }
}
