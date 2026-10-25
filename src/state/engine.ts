import { type CloudAdapter, type Collection, type Original, type Origin, type Revision, type RichNode, type WorkspaceSnapshot, type WorkspaceState, type WritingDocument, emptyBody, textBody, plainText, linkIds } from '../domain/model';
import { assertBody, sha256, stableStringify, toBase64, validateSnapshot } from '../domain/codec';
import { DeviceDatabase, type PendingCollectionRename, type PendingOperation, type RecoveryDraft } from '../storage/database';
import { decodeArchive, encodeArchive, escapeHtml } from '../storage/archive';
import { renderHtml, renderMarkdown } from '../domain/render';

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
const blank = (accountId: string): WorkspaceSnapshot => ({ schemaVersion: 1, accountId, documents: [], revisions: [], originals: [], universes: [], collections: [], receipts: [] });
export const CLOUD_SYNC_DELAY = 60_000;
export const LOCAL_SAVE_DELAY = 10_000;
const ancestorOf = (ancestor: string | null, descendant: string | null, revisions: Revision[]): boolean => {
  if (!ancestor || !descendant) return false;
  const index = new Map(revisions.map(revision => [revision.id, revision]));
  const seen = new Set<string>(), queue = [descendant];
  while (queue.length) { const key = queue.pop()!; if (key === ancestor) return true; if (!seen.has(key)) { seen.add(key); queue.push(...(index.get(key)?.parentIds ?? [])); } }
  return false;
};
export class WritingEngine {
  private state: WorkspaceState;
  private db?: DeviceDatabase;
  private listeners = new Set<() => void>();
  private dirty = new Map<string, number>();
  private generation = 0;
  private writerId = uuid();
  private draftPending = new Set<string>();
  private lastEditAt = 0;
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
  private cloudTimer?: ReturnType<typeof setTimeout>;
  private catalogPending = false;
  private catalogGeneration = 0;
  private catalogChangedAt?: number;
  private collectionRenames: PendingCollectionRename[] = [];
  private stopCloudWatch?: () => void;
  private remoteRefreshRequested = false;
  private refreshPromise?: Promise<void>;
  private cloudReadFailed = false;
  constructor(readonly accountId: string, readonly cloud: CloudAdapter | null) {
    this.state = { ...blank(accountId), ready: false, localOnly: !cloud, activeUniverseId: '', activeDocumentId: null, saveState: 'local', error: null, pendingCount: 0, conflictedDocumentIds: [], collectionConflicts: [], online: typeof navigator === 'undefined' || navigator.onLine !== false };
  }
  getSnapshot = (): WorkspaceState => this.state;
  subscribe = (callback: () => void): (() => void) => { this.listeners.add(callback); return () => this.listeners.delete(callback); };
  private publish(patch: Partial<WorkspaceState> = {}): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch, pendingCount: this.pending.length, conflictedDocumentIds: [...new Set([...this.localConflicts, ...this.pending.filter(operation => operation.status === 'conflict').map(operation => operation.revision.documentId)])] };
    this.state.collectionConflicts = this.collectionRenames.filter(change => change.conflict).map(change => ({ collectionId: change.id, localName: change.collection.name, remoteName: change.conflict!.name }));
    this.state.saveState = this.state.error ? 'error' : this.pending.some(x => x.status === 'conflict') || this.localConflicts.size || this.state.collectionConflicts.length ? 'conflict' : this.dirty.size ? 'waiting' : this.syncing ? 'syncing' : this.pending.length || this.draftPending.size || this.catalogPending || this.collectionRenames.length || !this.cloud ? 'local' : 'synced';
    this.listeners.forEach(callback => callback());
  }
  private fail(error: unknown, cloudRead = false): void { this.cloudReadFailed = cloudRead; this.publish({ error: (error instanceof Error ? error.message : String(error)) + ' Your open text is still available. Export text if saving cannot be restored.' }); }
  clearError = (): void => { this.publish({ error: null }); };
  initialize(): Promise<void> { return this.initializePromise ??= this.open(); }
  private async open(): Promise<void> {
    try {
      this.db = await DeviceDatabase.open(this.accountId, this.cloud?.workspaceId ?? this.accountId);
      if (this.disposed) { this.db.close(); return; }
      let disk = await this.db.snapshot();
      // A recovery draft becomes one durable checkpoint when reopening. Normal
      // ten-second device saves only replace this writer's mutable draft.
      const drafts = (await this.db.all<RecoveryDraft>('drafts')).sort((a, b) => a.editedAt - b.editedAt || a.id.localeCompare(b.id));
      for (const draft of drafts) {
        const doc = draft.document, { headRevisionId, ...snapshot } = doc;
        const revision: Revision = { id: uuid(), documentId: doc.id, universeId: doc.universeId, snapshot, contentHash: await sha256(stableStringify(snapshot)), parentIds: headRevisionId ? [headRevisionId] : [], createdAt: now() };
        await this.db.checkpoint({ ...doc, headRevisionId: revision.id }, revision, { operationId: revision.id, expectedHeadId: headRevisionId, revision, status: 'pending' }, headRevisionId, draft);
      }
      if (drafts.length) disk = await this.db.snapshot();
      this.pending = await this.db.all<PendingOperation>('outbox');
      this.localConflicts = new Set(await this.db.conflicts());
      this.catalogPending = await this.db.getPreference<boolean>('catalogPending') ?? false;
      this.collectionRenames = await this.db.collectionRenames();
      this.catalogChangedAt = await this.db.getPreference<number>('catalogChangedAt');
      this.lastEditAt = Math.max(0, ...this.pending.map(operation => Date.parse(operation.revision.snapshot.updatedAt)), this.catalogChangedAt ?? 0);
      if (this.disposed) return;
    this.stopCloudWatch = this.cloud?.watch?.(() => { if (!this.disposed) { this.remoteRefreshRequested = true; void this.refreshFromCloud(); } }, error => { if (!this.disposed) this.fail(error); });
      if (!disk.universes.length && this.cloud && this.state.online) {
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
          const remote = await Promise.race([this.cloud.load(disk), new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Cloud library is taking longer to open. Writing can continue on this device.')), 2500); })]);
          await validateSnapshot(remote);
          if (this.disposed) return;
          remote.documents.forEach(doc => this.cloudHeads.set(doc.id, doc.headRevisionId));
          await this.db.merge(remote, new Set()); disk = await this.db.snapshot(); this.localConflicts = new Set(await this.db.conflicts()); this.hasPulledCloud = true;
        } catch (error) { if ((error as { code?: string }).code !== 'cloud-dependency-pending') this.fail(error, true); } finally { clearTimeout(deadline); }
      }
      if (this.disposed) return;
      if (!disk.universes.length) {
        disk.universes = [{ id: uuid(), name: 'My writing', createdAt: now() }];
        await this.db.catalog(disk);
      }
      const preferences = await this.db.getPreference<{ universeId: string; documentId: string | null }>('navigation');
      if (this.disposed) return;
      const activeUniverseId = disk.universes.some(x => x.id === preferences?.universeId) ? preferences!.universeId : disk.universes[0].id;
      const activeDocumentId = disk.documents.some(x => x.id === preferences?.documentId && x.universeId === activeUniverseId && !x.trashed) ? preferences!.documentId : disk.documents.filter(x => x.universeId === activeUniverseId && !x.trashed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id ?? null;
      this.publish({ ...disk, ready: true, activeUniverseId, activeDocumentId });
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('noveliaa:' + this.accountId + ':' + (this.cloud?.workspaceId ?? this.accountId));
        this.channel.onmessage = () => { void this.refreshDisk().catch(error => this.fail(error)); };
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('online', this.online); window.addEventListener('offline', this.offline);
        document.addEventListener('visibilitychange', this.visibility);
        window.addEventListener('beforeunload', this.beforeUnload);
      }
      if (this.cloud && this.state.online) {
        if (!this.hasPulledCloud || this.remoteRefreshRequested) { this.remoteRefreshRequested = true; void this.refreshFromCloud(); }
        this.scheduleSync();
      }
    } catch (error) {
      const universe = { id: uuid(), name: 'My writing', createdAt: now() };
      this.publish({ ready: true, universes: this.state.universes.length ? this.state.universes : [universe], activeUniverseId: this.state.activeUniverseId || universe.id }); this.fail(error);
    }
  }
  private beforeUnload = (event: BeforeUnloadEvent): void => { if (this.dirty.size) { event.preventDefault(); event.returnValue = ''; } };
  private visibility = (): void => { if (document.visibilityState === 'hidden') void this.flush().catch(error => this.fail(error)); };
  private online = (): void => { this.publish({ online: true }); this.remoteRefreshRequested = true; void this.refreshFromCloud(); this.scheduleSync(); };
  private offline = (): void => { clearTimeout(this.cloudTimer); this.cloudTimer = undefined; this.publish({ online: false }); };
  private edited(): void { this.lastEditAt = Date.now(); clearTimeout(this.cloudTimer); this.cloudTimer = undefined; this.scheduleSync(); }
  private scheduleSync(): void {
    if (!this.cloud || this.disposed || !this.state.online || this.cloudTimer || this.syncing) return;
    if (!this.dirty.size && !this.draftPending.size && !this.catalogPending && !this.pending.some(operation => operation.status === 'pending')) return;
    const delay = Math.max(0, this.lastEditAt + CLOUD_SYNC_DELAY - Date.now());
    this.cloudTimer = setTimeout(() => { this.cloudTimer = undefined; void this.sync(false); }, delay);
  }
  private async refreshFromCloud(): Promise<void> {
    if (!this.cloud || !this.db || this.disposed || !this.state.ready || !this.state.online || this.syncPromise || this.refreshPromise) return;
    this.remoteRefreshRequested = false;
    this.refreshPromise = this.pullCloud().catch(error => { if ((error as { code?: string }).code !== 'cloud-dependency-pending') this.fail(error, true); }).finally(() => {
      this.refreshPromise = undefined;
      if (!this.disposed && this.remoteRefreshRequested) void this.refreshFromCloud();
    });
    await this.refreshPromise;
  }
  private async refreshDisk(): Promise<void> {
    if (!this.db || this.disposed) return;
    const disk = await this.db.snapshot();
    const diskPending = await this.db.all<PendingOperation>('outbox');
    this.collectionRenames = await this.db.collectionRenames();
    this.catalogPending = await this.db.getPreference<boolean>('catalogPending') ?? this.catalogPending;
    const known = new Set(disk.revisions.map(x => x.id));
    const fresh = this.state.revisions.filter(x => !known.has(x.id));
    const freshIds = new Set(fresh.map(x => x.id));
    this.pending = [...diskPending, ...this.pending.filter(x => freshIds.has(x.revision.id) && !diskPending.some(y => y.operationId === x.operationId))];
    const local = new Map(this.state.documents.map(x => [x.id, x]));
    const documents = disk.documents.map(doc => {
      const ours = local.get(doc.id);
      const revisions = [...disk.revisions, ...this.state.revisions];
      const ahead = ours && ancestorOf(doc.headRevisionId, ours.headRevisionId, revisions);
      if (ours && (this.dirty.has(doc.id) || this.draftPending.has(doc.id) || freshIds.has(ours.headRevisionId ?? '') || ahead)) {
        if (ours.headRevisionId !== doc.headRevisionId && !ahead && !freshIds.has(ours.headRevisionId ?? '')) { this.localConflicts.add(doc.id); void this.db!.markConflict(doc.id); }
        return ours;
      }
      return doc;
    });
    for (const doc of this.state.documents) if (!documents.some(x => x.id === doc.id) && (this.dirty.has(doc.id) || this.draftPending.has(doc.id) || freshIds.has(doc.headRevisionId ?? ''))) documents.push(doc);
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
    this.dirty.set(doc.id, ++this.generation); this.publish({ documents: [...this.state.documents, doc], activeDocumentId: doc.id, error: null }); this.edited();
    try { await this.persist(doc.id); await this.remember(); } catch (error) { this.fail(error); }
    return doc.id;
  }
  updateDocument(id: string, patch: Partial<Pick<WritingDocument, 'title' | 'body' | 'collectionId' | 'trashed' | 'order'>>): void {
    const doc = this.state.documents.find(x => x.id === id); if (!doc) return;
    try {
      if (Object.entries(patch).every(([key, value]) => stableStringify(doc[key as keyof WritingDocument]) === stableStringify(value))) return;
      if (patch.body) {
        assertBody(patch.body);
        for (const target of linkIds(patch.body)) if (!this.state.documents.some(x => x.id === target && x.universeId === doc.universeId)) throw new Error('A document link must stay inside this writing world.');
      }
      if (patch.collectionId && !this.state.collections.some(x => x.id === patch.collectionId && x.universeId === doc.universeId)) throw new Error('Choose a collection in this writing world.');
      const next = { ...doc, ...patch, body: patch.body ? clone(patch.body) : doc.body, plainText: patch.body ? plainText(patch.body) : doc.plainText, updatedAt: now() };
      const base = this.state.revisions.find(revision => revision.id === doc.headRevisionId);
      const { headRevisionId: _, ...candidate } = next;
      if (base && stableStringify({ ...candidate, updatedAt: base.snapshot.updatedAt }) === stableStringify(base.snapshot)) next.updatedAt = base.snapshot.updatedAt;
      this.dirty.set(id, ++this.generation);
      this.publish({ documents: this.state.documents.map(x => x.id === id ? next : x), error: null });
      this.edited();
      clearTimeout(this.timers.get(id));
      this.timers.set(id, setTimeout(() => { void this.saveDraft(id).catch(error => this.fail(error)); }, LOCAL_SAVE_DELAY));
    } catch (error) { this.fail(error); }
  }
  private saveDraft(id: string): Promise<void> {
    clearTimeout(this.timers.get(id)); this.timers.delete(id);
    const job = this.tail.catch(() => {}).then(async () => {
      if (this.disposed || !this.dirty.has(id)) return;
      if (!this.db) throw new Error('Device storage is unavailable.');
      const generation = this.dirty.get(id)!;
      const document = clone(this.state.documents.find(doc => doc.id === id)!);
      const { headRevisionId, ...snapshot } = document;
      if (stableStringify(snapshot) === stableStringify(this.state.revisions.find(revision => revision.id === headRevisionId)?.snapshot)) {
        await this.db.discardDraft(this.writerId + ':' + id, generation);
        if (generation === this.dirty.get(id)) { this.dirty.delete(id); this.draftPending.delete(id); }
        this.publish(); return;
      }
      await this.db.saveDraft({ id: this.writerId + ':' + id, generation, editedAt: this.lastEditAt, document });
      this.draftPending.add(id);
      if (generation === this.dirty.get(id)) this.dirty.delete(id);
      this.publish({ error: null });
    });
    this.tail = job; return job;
  }
  private persist(id: string, restore?: Revision, automatic = false): Promise<void> {
    clearTimeout(this.timers.get(id)); this.timers.delete(id);
    const job = this.tail.catch(() => {}).then(async () => {
      if (this.disposed) return;
      if (!this.dirty.has(id) && !this.draftPending.has(id) && !restore) return;
      if (automatic && Date.now() - this.lastEditAt < CLOUD_SYNC_DELAY) return;
      if (!this.db) throw new Error('Device storage is unavailable.');
      const generation = this.generation;
      const doc = clone(this.state.documents.find(x => x.id === id)!); if (!doc) return;
      const previous = doc.headRevisionId;
      const { headRevisionId: _, ...snapshot } = doc;
      if (!restore && stableStringify(snapshot) === stableStringify(this.state.revisions.find(revision => revision.id === previous)?.snapshot)) {
        await this.db.discardDraft(this.writerId + ':' + id, generation);
        if ((this.dirty.get(id) ?? 0) <= generation) { this.dirty.delete(id); this.draftPending.delete(id); }
        this.publish(); return;
      }
      const parents = [...new Set([previous, ...(restore && this.cloudHeads.get(id) ? [this.cloudHeads.get(id)!] : [])].filter((x): x is string => !!x))];
      const revision: Revision = { id: uuid(), documentId: doc.id, universeId: doc.universeId, snapshot, contentHash: await sha256(stableStringify(snapshot)), parentIds: parents, createdAt: now(), ...(restore ? { restoredFrom: restore.id } : {}) };
      if (this.disposed) return;
      const operation: PendingOperation = { operationId: revision.id, expectedHeadId: restore ? this.cloudHeads.get(id) ?? previous : previous, revision, status: 'pending', ...(restore ? { resolves: this.pending.filter(operation => operation.revision.documentId === id).map(operation => operation.operationId) } : {}) };
      const committed = { ...doc, headRevisionId: revision.id };
      const conflict = await this.db.checkpoint(committed, revision, operation, previous, { id: this.writerId + ':' + id, generation });
      this.pending.push(operation);
      if (conflict) this.localConflicts.add(id);
      if ((this.dirty.get(id) ?? 0) <= generation) { this.dirty.delete(id); this.draftPending.delete(id); }
      this.publish({ documents: this.state.documents.map(x => x.id === id ? { ...x, headRevisionId: revision.id } : x), revisions: [...this.state.revisions, revision], receipts: [...this.state.receipts, { revisionId: revision.id, level: 'local', at: now() }], error: null });
      this.broadcast();
      this.scheduleSync();
    });
    this.tail = job; return job;
  }
  /** Local-only safety save for navigation, backgrounding and sign-out. */
  async flush(): Promise<void> { try { for (const id of [...this.dirty.keys()]) await this.saveDraft(id); await this.tail; } catch (error) { this.fail(error); throw error; } }
  /** Explicit version boundary: cloud upload, archive export or restoration. */
  async checkpoint(automatic = false): Promise<void> { try { for (const id of new Set([...this.dirty.keys(), ...this.draftPending])) await this.persist(id, undefined, automatic); await this.tail; } catch (error) { this.fail(error); throw error; } }
  async selectDocument(id: string): Promise<void> {
    await this.flush(); const doc = this.state.documents.find(x => x.id === id); if (!doc) return;
    this.publish({ activeUniverseId: doc.universeId, activeDocumentId: id }); await this.remember();
  }
  async createUniverse(name: string): Promise<void> {
    if (!name.trim()) return; await this.flush(); const universe = { id: uuid(), name: name.trim(), createdAt: now() };
    const universes = [...this.state.universes, universe]; await this.db?.catalog({ universes, collections: this.state.collections });
    this.publish({ universes, activeUniverseId: universe.id, activeDocumentId: null }); await this.remember(); this.broadcast(); await this.markCatalogPending();
  }
  async selectUniverse(id: string): Promise<void> { if (!this.state.universes.some(x => x.id === id)) return; await this.flush(); this.publish({ activeUniverseId: id, activeDocumentId: null }); await this.remember(); }
  async createCollection(name: string): Promise<void> {
    if (!name.trim()) return;
    const collection: Collection = { id: uuid(), universeId: this.state.activeUniverseId, name: name.trim(), order: this.state.collections.length };
    const collections = [...this.state.collections, collection]; await this.db?.catalog({ universes: this.state.universes, collections });
    this.publish({ collections }); await this.refreshDisk(); this.broadcast(); await this.markCatalogPending();
  }
  async renameCollection(id: string, name: string): Promise<void> {
    if (!this.db) throw new Error('Device storage is unavailable.');
    const collection = this.state.collections.find(item => item.id === id);
    if (!collection) throw new Error('Choose an existing collection. Inbox is permanent and cannot be renamed.');
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 10000 || /[\u0000-\u001f\u007f]/u.test(name)) throw new Error('Enter a collection name without control characters (up to 10,000 characters).');
    if (collection.name === name.trim()) return;
    try { await this.db.queueCollectionRename(collection, name.trim(), uuid()); }
    catch (error) { await this.refreshDisk(); throw error; }
    await this.refreshDisk(); this.broadcast(); await this.markCatalogPending();
  }
  async resolveCollectionRename(id: string, choice: 'local' | 'remote'): Promise<void> {
    if (choice !== 'local' && choice !== 'remote') throw new Error('Choose which collection name to keep.');
    if (!this.db) throw new Error('Device storage is unavailable.');
    await this.db.resolveCollectionRename(id, choice); await this.refreshDisk(); this.broadcast(); await this.markCatalogPending();
  }
  private collectionsForUpload(): Collection[] {
    return this.state.collections.map(collection => this.collectionRenames.find(change => change.id === collection.id)?.expected ?? collection);
  }
  private async markCatalogPending(): Promise<void> {
    this.catalogPending = true; this.catalogGeneration++;
    this.catalogChangedAt = Date.now(); this.edited();
    await this.db?.setPreference('catalogPending', true);
    await this.db?.setPreference('catalogChangedAt', this.catalogChangedAt);
    this.publish(); this.scheduleSync();
  }
  async restoreRevision(id: string): Promise<void> {
    await this.checkpoint();
    if (this.cloud && this.state.online) await this.pullCloud();
    const revision = this.state.revisions.find(x => x.id === id); if (!revision) throw new Error('Revision not found.');
    const doc = this.state.documents.find(x => x.id === revision.documentId)!;
    const next = { ...clone(revision.snapshot), updatedAt: now(), headRevisionId: doc.headRevisionId };
    this.dirty.set(doc.id, ++this.generation); this.publish({ documents: this.state.documents.map(x => x.id === doc.id ? next : x), activeDocumentId: doc.id, activeUniverseId: doc.universeId, error: null }); this.edited();
    await this.persist(doc.id, revision);
    // The choice is durable here immediately. A cloud conflict is retired only
    // after this expected-head choice wins, never before its acknowledgement.
    if (!this.cloud) {
      const head = this.state.documents.find(document => document.id === doc.id)?.headRevisionId;
      const choice = this.pending.find(operation => operation.revision.id === head);
      if (choice && await this.db?.finishResolution(doc.id, choice.revision.id, choice.resolves ?? [])) this.localConflicts.delete(doc.id);
    }
    this.publish(); await this.remember();
  }
  async loadHistory(): Promise<void> { await this.checkpoint(); if (this.cloud && this.state.online) { await this.refreshPromise; await this.pullCloud(true); } }
  private async pullCloud(includeHistory = false): Promise<void> {
    if (!this.cloud || !this.db) return;
    const remote = await this.cloud.load(this.state, { history: includeHistory }); await validateSnapshot(remote);
    if (this.disposed) return;
    this.hasPulledCloud = true;
    const history = [...this.state.revisions, ...remote.revisions];
    remote.documents.forEach(doc => {
      const confirmed = this.cloudHeads.get(doc.id);
      if (!confirmed || !ancestorOf(doc.headRevisionId, confirmed, history)) this.cloudHeads.set(doc.id, doc.headRevisionId);
    });
    const preserve = new Set([...this.dirty.keys(), ...this.draftPending, ...this.pending.map(x => x.revision.documentId)]);
    // Active selection is not a conflicting edit. Clean heads advance quietly;
    // unsent writing is protected by dirty/outbox guards and ancestry in merge.
    if (this.disposed) return;
    await this.db!.merge(remote, preserve);
    if (this.disposed) return;
    const disk = await this.db!.snapshot();
    this.collectionRenames = await this.db.collectionRenames();
    this.localConflicts = new Set(await this.db.conflicts());
    if (this.disposed) return;
    const documents = disk.documents.map(doc => this.dirty.has(doc.id) || this.draftPending.has(doc.id) || this.pending.some(x => x.revision.documentId === doc.id) ? this.state.documents.find(x => x.id === doc.id) ?? doc : doc);
    for (const doc of this.state.documents) if (!documents.some(x => x.id === doc.id) && (this.dirty.has(doc.id) || this.draftPending.has(doc.id) || this.pending.some(x => x.revision.documentId === doc.id))) documents.push(doc);
    const active = documents.find(document => document.id === this.state.activeDocumentId && !document.trashed);
    const nextActive = active?.id ?? documents.filter(document => document.universeId === this.state.activeUniverseId && !document.trashed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id ?? null;
    this.publish({ ...disk, ...this.retainedRecords(disk), documents, activeDocumentId: nextActive, ...(this.cloudReadFailed ? { error: null } : {}) }); this.cloudReadFailed = false;
  }
  sync = (refresh = true): Promise<void> => {
    if (this.disposed || !this.cloud || !this.db || !this.state.online) return Promise.resolve();
    if (this.syncPromise) return this.syncPromise;
    if (!refresh && Date.now() - this.lastEditAt < CLOUD_SYNC_DELAY) { this.scheduleSync(); return Promise.resolve(); }
    clearTimeout(this.cloudTimer); this.cloudTimer = undefined;
    this.syncPromise = (async () => { await this.checkpoint(!refresh); await this.refreshPromise; if (!this.disposed && (refresh || Date.now() - this.lastEditAt >= CLOUD_SYNC_DELAY)) await this.synchronize(refresh); })().catch(error => this.fail(error)).finally(() => {
      this.syncing = false; this.syncPromise = undefined; this.publish();
      if (!this.disposed && !this.state.error) this.scheduleSync();
      if (this.remoteRefreshRequested) void this.refreshFromCloud();
    });
    return this.syncPromise;
  };
  private async synchronize(refresh: boolean): Promise<void> {
    this.syncing = true; this.publish();
    if (refresh || !this.hasPulledCloud) await this.pullCloud();
    if (this.disposed) return;
    const archiveRecovery = await this.db!.getPreference<unknown[]>('archiveHeads');
    if (!this.catalogPending && !this.pending.some(operation => operation.status === 'pending') && !archiveRecovery?.length) return;
    // Do not call flush here: checkpoint scheduling can start sync while its own tail is finishing.
    const catalogGeneration = this.catalogGeneration;
    if (this.catalogPending || this.pending.length) await this.cloud!.putCatalog(this.state.universes, this.collectionsForUpload());
    if (this.disposed) return;
    this.collectionRenames = await this.db!.collectionRenames();
    for (const change of this.collectionRenames) {
      if (change.conflict) continue;
      if (!this.cloud!.renameCollection) throw new Error('This cloud adapter does not support guarded collection renaming. The device name is retained.');
      const result = await this.cloud!.renameCollection(change);
      if (this.disposed) return;
      await this.db!.finishCollectionRename(change, result);
    }
    this.collectionRenames = await this.db!.collectionRenames();
    await this.refreshDisk();
    if (this.catalogGeneration === catalogGeneration) { this.catalogPending = false; this.catalogChangedAt = undefined; await this.db!.setPreference('catalogPending', false); }
    if (this.collectionRenames.some(change => !change.conflict)) { this.catalogPending = true; await this.db!.setPreference('catalogPending', true); }
    await this.cloud!.registerDocuments?.(this.state.documents.map(({ id, universeId }) => ({ id, universeId })));
    if (this.disposed) return;
    // IndexedDB returns UUID-key order after restart, not revision ancestry order.
    const remaining = new Map(this.pending.map(x => [x.operationId, x]));
    const operations: PendingOperation[] = [];
    while (remaining.size) {
      const ready = [...remaining.values()].filter(x => [...x.revision.parentIds, ...(x.resolves ?? [])].every(parent => !remaining.has(parent)) && (this.cloud!.registerDocuments || linkIds(x.revision.snapshot.body).every(target => target === x.revision.documentId || this.cloudHeads.has(target) || ![...remaining.values()].some(y => y.revision.documentId === target))));
      if (!ready.length) throw new Error('Pending revision history is inconsistent. No changes were discarded.');
      ready.sort((a, b) => a.revision.createdAt.localeCompare(b.revision.createdAt) || a.operationId.localeCompare(b.operationId));
      ready.forEach(x => { operations.push(x); remaining.delete(x.operationId); });
    }
    let conflicted = false;
    for (const operation of operations) {
      if (this.disposed) return;
      if (operation.status === 'conflict') continue;
      // A source may have been imported after this sync began. Stage its exact bytes
      // and catalog before the dependent revision, never a stale captured source list.
      await this.cloud!.putCatalog(this.state.universes, this.collectionsForUpload());
      if (this.disposed) return;
      await this.cloud!.registerDocuments?.(this.state.documents.map(({ id, universeId }) => ({ id, universeId })));
      if (this.disposed) return;
      for (const originalId of operation.revision.snapshot.sourceOriginalIds) {
        const original = this.state.originals.find(x => x.id === originalId);
        if (!original) throw new Error('Source original is unavailable. The local revision is retained.');
        await this.cloud!.putOriginal(original);
      }
      if (this.disposed) return;
      const result = await this.cloud!.commit({ operationId: operation.operationId, expectedHeadId: operation.expectedHeadId, revision: operation.revision });
      if (this.disposed) return;
      const confirmed = this.cloudHeads.get(operation.revision.documentId);
      if (!confirmed || !ancestorOf(result.headRevisionId, confirmed, this.state.revisions)) this.cloudHeads.set(operation.revision.documentId, result.headRevisionId);
      await this.db!.acknowledge(operation.revision.id, result.status === 'conflict');
      if (result.status === 'conflict') {
        conflicted = true;
        this.pending = this.pending.map(x => x.operationId === operation.operationId ? { ...x, status: 'conflict' } : x); this.localConflicts.add(operation.revision.documentId);
      } else {
        this.pending = this.pending.filter(x => x.operationId !== operation.operationId);
        if (operation.resolves) {
          const cleared = await this.db!.finishResolution(operation.revision.documentId, operation.revision.id, operation.resolves);
          this.pending = this.pending.filter(item => !(item.revision.documentId === operation.revision.documentId && item.status === 'conflict' && operation.resolves!.includes(item.operationId)));
          if (cleared) this.localConflicts.delete(operation.revision.documentId);
        }
        this.publish({ receipts: [...this.state.receipts.filter(x => !(x.revisionId === operation.revision.id && x.level === 'cloud')), { revisionId: operation.revision.id, level: 'cloud', at: now() }] });
      }
    }
    if (conflicted || operations.some(operation => operation.status === 'pending')) await this.pullCloud();
    // Full-archive restoration is an explicit author action. If replay retained a
    // branch or advanced a different head, select the archived text with a NEW,
    // expected-head revision; original IDs and all branches remain recoverable.
    const archiveHeads = await this.db!.getPreference<{ documentId: string; revisionId: string }[]>('archiveHeads');
    if (archiveHeads?.length) {
      for (const target of archiveHeads) {
        const selected = this.state.revisions.find(x => x.id === target.revisionId);
        if (!selected) throw new Error('The selected archive revision is unavailable.');
        // A later author checkpoint supersedes the earlier import selection.
        if (this.state.documents.find(x => x.id === target.documentId)?.headRevisionId !== target.revisionId || this.dirty.has(target.documentId) || this.draftPending.has(target.documentId)) continue;
        if (this.cloudHeads.get(target.documentId) !== target.revisionId) {
          const doc = this.state.documents.find(x => x.id === target.documentId)!;
          this.dirty.set(doc.id, ++this.generation);
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
  async exportArchive(): Promise<Blob> {
    await this.checkpoint();
    if (this.cloud && this.state.online) { try { await this.loadHistory(); } catch (error) { this.fail(error, true); } }
    // History requests can overlap fresh typing. Export a matching checkpoint,
    // and keep device archives available when the cloud cannot be read.
    await this.checkpoint();
    const { ready: _, localOnly: __, activeUniverseId: ___, activeDocumentId: ____, saveState: _____, error: ______, pendingCount: _______, online: ________, conflictedDocumentIds: _________, collectionConflicts: __________, ...snapshot } = this.state;
    return encodeArchive(clone(snapshot));
  }
  async importArchive(file: File): Promise<void> {
    await this.flush(); const snapshot = await decodeArchive(await file.text());
    if (!this.db) throw new Error('Device storage unavailable.');
    await this.db.enqueueArchive({ ...snapshot, accountId: this.accountId });
    this.collectionRenames = await this.db.collectionRenames(); this.catalogPending = true;
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
    clearTimeout(this.cloudTimer); this.stopCloudWatch?.(); this.stopCloudWatch = undefined;
    this.disposed = true; this.channel?.close();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.online); window.removeEventListener('offline', this.offline); document.removeEventListener('visibilitychange', this.visibility); window.removeEventListener('beforeunload', this.beforeUnload);
    }
    this.timers.forEach(clearTimeout); this.timers.clear(); this.db?.close();
  }
}
