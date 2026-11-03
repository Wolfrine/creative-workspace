import { describe, expect, it } from 'vitest';
import { stableStringify } from '../domain/codec';
import { plainText, type Revision, type WritingDocument } from '../domain/model';
import { eligibleHeartbeat, heartbeatCoverage, heartbeatRegions, heartbeatRevision, heartbeatTextLeaves, isHeartbeatRest, type HeartbeatAnnotation, type HeartbeatBeat } from './model';

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
  it('accepts historical empty beats but classifies nonempty writing as sparse, and rejects long labels', () => {
    const quiet = annotation(); quiet.beats = []; expect(eligibleHeartbeat(quiet, document, revision, revision.contentHash)).toBe(true);
    expect(heartbeatCoverage(document.plainText, quiet.beats).status).toBe('sparse');
    const verbose = annotation(); verbose.beats[0].foreground = 'This sentence is an emotional description'; expect(eligibleHeartbeat(verbose, document, revision, revision.contentHash)).toBe(false);
  });
  it('maps source offsets through nested lists, hard breaks and combining characters exactly', () => {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'é' }, { type: 'hardBreak' }, { type: 'text', text: '🙂' }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'एक' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'three' }] }] }] }] };
    const text = plainText(body); for (const leaf of heartbeatTextLeaves(body)) expect(text.slice(leaf.start, leaf.end)).toBe(leaf.text);
    expect(heartbeatTextLeaves(body).map(leaf => leaf.text)).toEqual(['é', '🙂', 'एक', 'two', 'three']);
  });
});

describe('Heartbeat explicit continuity and natural feeling regions', () => {
  const beat = (text: string, start = 0, end = text.length, change: Partial<HeartbeatBeat> = {}): HeartbeatBeat => ({ ...annotation().beats[0], start, end, quote: text.slice(start, end), ...change });
  it('counts meaningful UTF-16 units exactly, including punctuation, astral and combining characters', () => {
    const text = 'A🙂 \r\nB!';
    const beats = [beat(text, 0, 3), beat(text, 6, 8)];
    expect(heartbeatCoverage(text, beats)).toEqual({ contract: 'noveliaa-heartbeat-continuity-1', status: 'continuous', sourceCharacters: 8, meaningfulCharacters: 5, coveredMeaningfulCharacters: 5, uncoveredMeaningfulCharacters: 0 });
    expect(heartbeatCoverage(text, beats.slice(0, 1))).toEqual({ contract: 'noveliaa-heartbeat-continuity-1', status: 'sparse', sourceCharacters: 8, meaningfulCharacters: 5, coveredMeaningfulCharacters: 3, uncoveredMeaningfulCharacters: 2 });
    expect(heartbeatCoverage(text, [beat(text, 0, 3), beat(text, 6, 7)]).status).toBe('sparse');
    expect(heartbeatCoverage('e\u0301', [beat('e\u0301')]).meaningfulCharacters).toBe(2);
    expect(heartbeatCoverage('e\u0301', [beat('e\u0301', 0, 1)]).status).toBe('sparse');
    expect(heartbeatRegions(text, beats).map(region => [region.start, region.end])).toEqual([[0, 3], [6, 8]]);
  });
  it('never upgrades missing interpretations to neutral, including forged metadata or whitespace-only text', () => {
    const legacy = annotation(); legacy.beats = [];
    legacy.coverage = { contract: 'noveliaa-heartbeat-continuity-1', status: 'continuous', sourceCharacters: 0, meaningfulCharacters: 0, coveredMeaningfulCharacters: 0, uncoveredMeaningfulCharacters: 0 };
    expect(heartbeatCoverage(document.plainText, legacy.beats).status).toBe('sparse');
    expect(heartbeatCoverage(' \r\n', []).status).toBe('sparse');
    expect(heartbeatCoverage('', [])).toEqual({ contract: 'noveliaa-heartbeat-continuity-1', status: 'empty', sourceCharacters: 0, meaningfulCharacters: 0, coveredMeaningfulCharacters: 0, uncoveredMeaningfulCharacters: 0 });
    expect(heartbeatRegions(document.plainText, annotation().beats)).toEqual([]);
  });
  it('holds a feeling throughout a factual section and treats deliberate neutral rest as explicit coverage', () => {
    const text = 'A table stood by the wall. Three chairs faced it. The window was shut.';
    const held = beat(text, 0, text.length, { foreground: 'Contained unease', trajectory: 'hold', tone: 'cool' });
    const rest = { ...held, foreground: 'Rest', trajectory: 'quiet' as const, tone: 'neutral' as const };
    expect(heartbeatRegions(text, [held])).toEqual([{ start: 0, end: text.length, foreground: held.foreground, undertone: held.undertone, tone: 'cool', weight: 3, trajectory: 'hold', beatIndexes: [0] }]);
    expect(heartbeatCoverage(text, [rest]).status).toBe('continuous');
    expect(isHeartbeatRest(rest)).toBe(true);
    expect(isHeartbeatRest(held)).toBe(false);
    expect(isHeartbeatRest({ tone: 'neutral', trajectory: 'hold' })).toBe(false);
  });
  it('merges identical adjacent feeling tuples even when quote limits require multiple source beats', () => {
    const text = 'a'.repeat(2100), beats = [beat(text, 0, 2000), beat(text, 2000, 2100)];
    const original = structuredClone(beats);
    const regions = heartbeatRegions(text, beats);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ start: 0, end: 2100, beatIndexes: [0, 1] });
    expect(beats).toEqual(original);
    for (const change of [{ foreground: 'Resolve' }, { undertone: undefined }, { tone: 'warm' as const }, { weight: 4 }, { trajectory: 'hold' as const }]) expect(heartbeatRegions(text, [beats[0], { ...beats[1], ...change }])).toHaveLength(2);
    expect(heartbeatCoverage(text, [beat(text)]).status).toBe('invalid');
  });
  it('fails closed on malformed payloads without throwing, filling holes or manufacturing valid coverage', () => {
    const original = annotation();
    for (const beats of [null, {}, [null], Array(1), [original.beats[0], original.beats[0]], [{ ...original.beats[0], quote: 'wrong' }], [{ ...original.beats[0], weight: 6 }], [{ ...original.beats[0], unknown: true }], [{ ...original.beats[0], reasoning: '' }], [{ ...original.beats[0], end: 3, quote: document.plainText.slice(2, 3) }]]) {
      expect(heartbeatCoverage(document.plainText, beats)).toMatchObject({ status: 'invalid', coveredMeaningfulCharacters: 0 });
      expect(eligibleHeartbeat({ ...original, beats } as HeartbeatAnnotation, document, revision, revision.contentHash)).toBe(false);
    }
  });
});
