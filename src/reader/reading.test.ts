import { describe, expect, it } from 'vitest';
import { boundAnchor, readingSnapshot, safeReaderHref, readingBookmark, resumeReading, readerPageStart, validReadingScope } from './reading';
import { emptyBody, textBody, type WritingDocument } from '../domain/model';

const page = (id: string, text: string): WritingDocument => ({ id, title: id, universeId: 'world', body: textBody(text), plainText: text, collectionId: null, trashed: false, order: 1, origin: 'ai', sourceOriginalIds: ['exact-original'], createdAt: '2026-10-25', updatedAt: '2026-10-25', headRevisionId: 'head' });
describe('Private reader projections', () => {
  it('freezes exact supported writing and provenance without retaining live source objects', () => {
    const source = page('first', 'हिंदी e\u0301 🙂\nAn exact line.'); const second = page('second', 'Last.'); const trashed = { ...page('trash', 'Hidden'), trashed: true };
    const frozen = readingSnapshot([second, source, trashed], 'Author chosen title');
    expect(frozen.documents.map(item => item.id)).toEqual(['second', 'first']); expect(frozen.documents[1]).toEqual(source);
    source.title = 'Edited later'; source.body = emptyBody(); source.sourceOriginalIds.push('new');
    expect(frozen.documents[1].title).toBe('first'); expect(frozen.documents[1].plainText).toBe('हिंदी e\u0301 🙂\nAn exact line.'); expect(frozen.documents[1].origin).toBe('ai'); expect(frozen.documents[1].sourceOriginalIds).toEqual(['exact-original']);
  });
  it('clamps stale or malformed resume anchors to available passages and text', () => {
    const documents = [page('first', 'one\ntwo')];
    expect(boundAnchor({ documentId: 'missing', passage: 900, offset: 900 }, documents)).toEqual({ documentId: 'first', passage: 1, offset: 3 });
    expect(boundAnchor({ documentId: 'first', passage: -1, offset: -4 }, documents)).toEqual({ documentId: 'first', passage: 0, offset: 0 });
    expect(boundAnchor({ passage: NaN, offset: {} }, documents)).toEqual({ documentId: 'first', passage: 0, offset: 0 });
  });
  it('retains safe links while refusing executable or relative links', () => {
    for (const href of ['https://example.com/a', 'http://example.com', 'mailto:writer@example.com', 'noveliaa://document/uuid-safe_42']) expect(safeReaderHref(href)).toBe(href);
    for (const href of ['javascript:alert(1)', 'data:text/html,test', '//example.com', 'noveliaa://document/a/other', null]) expect(safeReaderHref(href)).toBeUndefined();
  });
  it('keeps every odd/even spread aligned and reachable without repeating the preceding page', () => {
    for (const total of [1, 2, 3, 4, 5, 6, 15, 16]) {
      const seen: number[] = []; for (let index = 0; index < total; index += 2) seen.push(readerPageStart(index, total, 2));
      expect(new Set(seen).size).toBe(seen.length); expect(seen[seen.length - 1]).toBe(Math.floor((total - 1) / 2) * 2);
      expect(readerPageStart(total + 40, total, 2)).toBe(seen[seen.length - 1]); expect(readerPageStart(-1, total, 2)).toBe(0);
    }
  });
  it('resumes the passage only for the same exact body; changed writing resets explicitly', () => {
    const original = page('first', 'First paragraph\nSecond paragraph');
    const bookmark = readingBookmark({ documentId: 'first', passage: 1, offset: 5 }, [original]);
    expect(resumeReading(bookmark, [original])).toEqual({ anchor: { documentId: 'first', passage: 1, offset: 5 }, reset: false });
    const changed = { ...original, body: textBody('An inserted opening\nFirst paragraph\nSecond paragraph') };
    expect(resumeReading(bookmark, [changed])).toEqual({ anchor: { documentId: 'first', passage: 0, offset: 0 }, reset: true });
    expect(JSON.stringify(bookmark)).not.toContain('paragraph');
  });
  it('retains only validated scope IDs and resets removed source anchors', () => {
    expect(validReadingScope({ type: 'collection', id: 'safe-id', title: 'Not persisted' })).toEqual({ type: 'collection', id: 'safe-id' });
    expect(validReadingScope({ type: 'unknown', id: 'safe' })).toBeNull(); expect(validReadingScope({ type: 'document', id: 'bad/id' })).toBeNull();
    const original = page('first', 'Same words'); const other = page('second', 'Same words');
    const bookmark = readingBookmark({ documentId: original.id, passage: 0, offset: 5 }, [original]);
    expect(resumeReading(bookmark, [other])).toEqual({ anchor: { documentId: 'second', passage: 0, offset: 0 }, reset: true });
  });
});
