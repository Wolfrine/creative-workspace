import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { WritingEngine } from './engine';
import { DeviceDatabase } from '../storage/database';
import { textBody, type CloudAdapter, type WorkspaceSnapshot } from '../domain/model';
import { decodeArchive } from '../storage/archive';
import { sha256, stableStringify } from '../domain/codec';

let engines: WritingEngine[] = [];
async function open(account = 'author-1', cloud: CloudAdapter | null = null) { const engine = new WritingEngine(account, cloud); engines.push(engine); await engine.initialize(); return engine; }
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(() => { engines.forEach(engine => engine.dispose()); engines = []; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Recoverable writing — IndexedDB transaction protocol with fake-indexeddb', () => {
  it('captures an untitled document without a taxonomy and distinguishes local persistence', async () => {
    const engine = await open(); const id = await engine.createDocument();
    engine.updateDocument(id, { body: textBody('A beginning. हिंदी e\u0301 🙂\n\nThe next line.') }); await engine.checkpoint();
    expect(engine.getSnapshot().documents[0].title).toBe('');
    expect(engine.getSnapshot().documents[0].plainText).toBe('A beginning. हिंदी e\u0301 🙂\n\nThe next line.');
    expect(engine.getSnapshot().saveState).toBe('local');
    expect(engine.getSnapshot().receipts.every(x => x.level === 'local')).toBe(true);
  });
  it('recovers every acknowledged checkpoint after closing the database', async () => {
    let engine = await open(); const id = await engine.createDocument();
    const expected = new Map<string, string>();
    for (let i = 0; i < 20; i++) {
      const text = `Checkpoint ${i} — हिंदी e\u0301 🙂\n${'word '.repeat(i + 1)}`;
      engine.updateDocument(id, { body: textBody(text) }); await engine.checkpoint();
      const doc = engine.getSnapshot().documents[0]; expected.set(doc.headRevisionId!, text);
      engine.dispose(); engine = await open();
      expect(engine.getSnapshot().documents[0].plainText).toBe(text);
    }
    for (const [revisionId, text] of expected) expect(engine.getSnapshot().revisions.find(x => x.id === revisionId)?.snapshot.plainText).toBe(text);
  });
  it('never acknowledges failed device writes and keeps current text exportable', async () => {
    const engine = await open(); const id = await engine.createDocument(); const receipts = engine.getSnapshot().receipts.length;
    vi.spyOn(DeviceDatabase.prototype, 'checkpoint').mockRejectedValue(new DOMException('Device storage is full', 'QuotaExceededError'));
    engine.updateDocument(id, { body: textBody('Text that must remain available') });
    await expect(engine.checkpoint()).rejects.toThrow('Device storage is full');
    expect(engine.getSnapshot().receipts).toHaveLength(receipts);
    expect(engine.getSnapshot().saveState).not.toBe('synced');
    expect(await (await engine.exportDocument(id, 'txt')).text()).toBe('Text that must remain available');
  });
  it('retains both tab variants from the same base', async () => {
    const a = await open(); const id = await a.createDocument();
    a.updateDocument(id, { body: textBody('Base') }); await a.checkpoint();
    const b = await open();
    a.updateDocument(id, { body: textBody('First tab') }); b.updateDocument(id, { body: textBody('Second tab') });
    await a.checkpoint(); await b.checkpoint();
    const recovered = await open(); const texts = recovered.getSnapshot().revisions.map(x => x.snapshot.plainText);
    expect(texts).toContain('First tab'); expect(texts).toContain('Second tab');
    expect(b.getSnapshot().saveState).toBe('conflict');
  });
  it('restores into a new revision while preserving intermediate writing and origin', async () => {
    const engine = await open(); const id = await engine.createDocument({ body: textBody('Original paragraph') });
    const first = engine.getSnapshot().documents[0].headRevisionId!;
    engine.updateDocument(id, { title: 'Renamed scene', body: textBody('Experiment, not the original') }); await engine.checkpoint();
    const count = engine.getSnapshot().revisions.length;
    await engine.restoreRevision(first);
    expect(engine.getSnapshot().revisions).toHaveLength(count + 1);
    expect(engine.getSnapshot().documents[0].plainText).toBe('Original paragraph');
    expect(engine.getSnapshot().revisions.some(x => x.snapshot.plainText === 'Experiment, not the original')).toBe(true);
    expect(engine.getSnapshot().revisions.at(-1)?.restoredFrom).toBe(first);
  });
  it('preserves CRLF original bytes and imported AI attribution from its first revision', async () => {
    const engine = await open(); const bytes = 'User:\r\nA doorway.\r\nAssistant:\r\nAn unapproved tower.\r\n';
    const id = await engine.importText(new File([bytes], 'mixed.txt'), 'imported_chat');
    const state = engine.getSnapshot();
    expect(state.originals[0].sha256).toBe(await sha256(bytes));
    expect(state.originals[0].verification).toBe('unverified');
    expect(state.originals[0].speakerSegments?.map(x => x.role)).toEqual(['user', 'assistant']);
    expect(state.revisions.filter(x => x.documentId === id).every(x => x.snapshot.origin === 'imported_chat')).toBe(true);
    expect(atob(state.originals[0].bytesBase64)).toBe(bytes);
  });
  it('supports a 2 MiB source without squeezing it into one Firestore document', async () => {
    const engine = await open(); const text = 'a'.repeat(2 * 1024 * 1024);
    const id = await engine.importText(new File([text], 'large.txt'));
    expect(engine.getSnapshot().documents.find(x => x.id === id)?.plainText.length).toBe(text.length);
    expect(engine.getSnapshot().originals[0].sha256).toBe(await sha256(text));
  });
  it('archives and restores rich text, stable links, sources and all revisions into an empty account', async () => {
    const engine = await open(); const target = await engine.createDocument({ title: 'The house', body: textBody('A note') });
    const source = await engine.createDocument({ body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Visit the house', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'noveliaa://document/' + target } }] }] }] } });
    await engine.importText(new File(['Original\r\nsource'], 'source.txt'), 'recovered_original');
    const archive = await engine.exportArchive(); const parsed = await decodeArchive(await archive.text());
    const restored = await open('isolated-author'); await restored.importArchive(new File([archive], 'backup.json'));
    const byId = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(restored.getSnapshot().documents)).toEqual(byId(parsed.documents));
    expect(byId(restored.getSnapshot().revisions)).toEqual(byId(parsed.revisions));
    expect(byId(restored.getSnapshot().originals)).toEqual(byId(parsed.originals));
    expect(restored.getSnapshot().documents.find(x => x.id === source)?.body).toEqual(parsed.documents.find(x => x.id === source)?.body);
  });
  it('refuses a full restore over existing writing', async () => {
    const engine = await open(); await engine.createDocument({ body: textBody('Never overwrite me') });
    const archive = await engine.exportArchive();
    await expect(engine.importArchive(new File([archive], 'backup.json'))).rejects.toThrow('empty notebook');
    expect(engine.getSnapshot().documents[0].plainText).toBe('Never overwrite me');
  });
  it('rejects archive corruption even with a recomputed outer digest', async () => {
    const engine = await open(); await engine.createDocument({ body: textBody('Retain exact words') });
    const archive = JSON.parse(await (await engine.exportArchive()).text());
    archive.snapshot.revisions[0].snapshot.body.content[0].content[0].text = 'Tampered';
    const { sha256: _, ...payload } = archive; archive.sha256 = await sha256(stableStringify(payload));
    await expect(decodeArchive(JSON.stringify(archive))).rejects.toThrow(/inconsistent|verification/);
  });
  it('rejects unsupported schemas without changing the source notebook', async () => {
    const engine = await open(); const archive = { format: 'noveliaa-writing-archive', schemaVersion: 99 };
    await expect(engine.importArchive(new File([JSON.stringify(archive)], 'future.json'))).rejects.toThrow('Unsupported');
    expect(engine.getSnapshot().documents).toHaveLength(0);
  });
  it('refuses correctly rehashed malformed metadata before persisting it', async () => {
    const source = await open(); await source.createDocument({ body: textBody('Safe text') });
    const archive = JSON.parse(await (await source.exportArchive()).text());
    archive.snapshot.revisions[0].snapshot.title = { wouldCrashRendering: true };
    archive.snapshot.documents[0].title = { wouldCrashRendering: true };
    archive.snapshot.revisions[0].contentHash = await sha256(stableStringify(archive.snapshot.revisions[0].snapshot));
    const { sha256: _, ...payload } = archive; archive.sha256 = await sha256(stableStringify(payload));
    const target = await open('empty-target');
    await expect(target.importArchive(new File([JSON.stringify(archive)], 'malformed.json'))).rejects.toThrow('Invalid writing metadata');
    expect(target.getSnapshot().documents).toHaveLength(0);
    const reopened = await open('empty-target'); expect(reopened.getSnapshot().documents).toHaveLength(0);
  });
  it('keeps account caches separate, including pending text', async () => {
    const author = await open('owner'); await author.createDocument({ body: textBody('PRIVATE-CANARY') });
    const other = await open('other-account');
    expect(other.getSnapshot().documents).toHaveLength(0);
    expect(JSON.stringify(other.getSnapshot())).not.toContain('PRIVATE-CANARY');
  });
  it('rejects cross-universe links without mutating the last saved revision', async () => {
    const engine = await open(); const id = await engine.createDocument({ body: textBody('Source') });
    await engine.createUniverse('Separate world'); const target = await engine.createDocument({ title: 'Other world' });
    const previous = engine.getSnapshot().documents.find(x => x.id === id)!.headRevisionId;
    engine.updateDocument(id, { body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Forbidden', marks: [{ type: 'link', attrs: { href: 'noveliaa://document/' + target } }] }] }] } });
    expect(engine.getSnapshot().error).toContain('inside this writing world');
    expect(engine.getSnapshot().documents.find(x => x.id === id)!.headRevisionId).toBe(previous);
  });
});
