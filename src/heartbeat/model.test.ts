import { describe, expect, it } from 'vitest';
import { stableStringify } from '../domain/codec';
import { plainText, type Revision, type WritingDocument } from '../domain/model';
import { eligibleHeartbeat, heartbeatRevision, heartbeatTextLeaves, type HeartbeatAnnotation } from './model';

const document: WritingDocument = { id: 'story', universeId: 'world', title: 'A private scene', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A 🙂 promise.' }] }] }, plainText: 'A 🙂 promise.', collectionId: null, trashed: false, order: 0, origin: 'ai', sourceOriginalIds: [], createdAt: '2026-11-03T00:00:00Z', updatedAt: '2026-11-03T00:00:00Z', headRevisionId: 'revision-1' };
const { headRevisionId: _head, ...snapshot } = document;
const revision: Revision = { id: 'revision-1', documentId: 'story', universeId: 'world', parentIds: [], snapshot, contentHash: 'a'.repeat(64), createdAt: document.updatedAt };
function annotation(): HeartbeatAnnotation { return { id: 'inference', schema: 'noveliaa-heartbeat-1', anchor: { documentId: 'story', revisionId: revision.id, contentHash: revision.contentHash, title: document.title }, attribution: { provider: 'Synthetic', model: 'Fixture' }, contextNote: '', origin: 'ai', verification: 'unverified', createdAt: document.updatedAt, beats: [{ start: 2, end: 4, quote: '🙂', foreground: 'Hope', undertone: 'Doubt', weight: 3, trajectory: 'build', tone: 'tender', reasoning: 'A possible reading.' }] }; }

describe('Heartbeat immutable source and UTF-16 anchors', () => {
  it('requires the entire saved snapshot, even if the source quote is unchanged', () => {
    expect(heartbeatRevision(document, [revision])).toBe(revision);
    for (const changed of [{ ...document, title: 'Renamed' }, { ...document, collectionId: 'elsewhere' }, { ...document, updatedAt: '2026-11-03T00:00:01Z' }, { ...document, headRevisionId: 'revision-2' }]) expect(heartbeatRevision(changed, [revision])).toBeUndefined();
    expect(stableStringify(revision.snapshot)).not.toBe(stableStringify({ ...revision.snapshot, order: 1 }));
  });
  it('accepts a full emoji and rejects wrong identity/hash, overlap or surrogate split', () => {
    expect(eligibleHeartbeat(annotation(), document, revision, revision.contentHash)).toBe(true);
    const wrongRevision = annotation(); wrongRevision.anchor.revisionId = 'other';
    const wrongHash = annotation(); wrongHash.anchor.contentHash = 'b'.repeat(64);
    const split = annotation(); split.beats[0] = { ...split.beats[0], end: 3, quote: document.plainText.slice(2, 3) };
    const overlap = annotation(); overlap.beats.push({ ...overlap.beats[0] });
    for (const invalid of [wrongRevision, wrongHash, split, overlap]) expect(eligibleHeartbeat(invalid, document, revision, revision.contentHash)).toBe(false);
  });
  it('supports a quiet page and rejects obligatory long sentence labels', () => {
    const quiet = annotation(); quiet.beats = []; expect(eligibleHeartbeat(quiet, document, revision, revision.contentHash)).toBe(true);
    const verbose = annotation(); verbose.beats[0].foreground = 'This sentence is an emotional description'; expect(eligibleHeartbeat(verbose, document, revision, revision.contentHash)).toBe(false);
  });
  it('maps source offsets through nested lists, hard breaks and combining characters exactly', () => {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'é' }, { type: 'hardBreak' }, { type: 'text', text: '🙂' }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'एक' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'three' }] }] }] }] };
    const text = plainText(body); for (const leaf of heartbeatTextLeaves(body)) expect(text.slice(leaf.start, leaf.end)).toBe(leaf.text);
    expect(heartbeatTextLeaves(body).map(leaf => leaf.text)).toEqual(['é', '🙂', 'एक', 'two', 'three']);
  });
});
