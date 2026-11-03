import test from 'node:test';
import assert from 'node:assert/strict';
import { heartbeatCoverage, validateHeartbeat } from '../src/integration-heartbeat.mjs';

const source = 'A quiet shore. 🌙\nThen the bell rang.';
const input = () => ({ documentId: 'scene', revisionId: 'r1', contentHash: 'a'.repeat(64), idempotencyKey: 'heartbeat-unit-0001',
  provider: 'Synthetic provider', model: 'Synthetic model', contextNote: 'A possible reading of the exact passage, without earlier context.',
  beats: [{ start: 0, end: 14, quote: source.slice(0, 14), foreground: 'Quiet anticipation', undertone: 'Unease', weight: 2, trajectory: 'build', tone: 'cool', reasoning: 'The quiet shore holds attention before the bell.' }] });

test('heartbeat accepts exact UTF-16 source, optional undertone and empty pages without inferring rest', () => {
  assert.deepEqual(validateHeartbeat(input(), source), input());
  assert.deepEqual(validateHeartbeat({ ...input(), beats: [] }, '' ).beats, []);
  const value = input(); delete value.beats[0].undertone;
  assert.equal(validateHeartbeat(value, source).beats[0].undertone, undefined);
});

test('coverage requires every meaningful UTF-16 source unit; only whitespace gaps are exempt', () => {
  const text = 'A🙂 \r\nB!';
  const beats = [{ ...input().beats[0], start: 0, end: 3, quote: text.slice(0, 3) }, { ...input().beats[0], start: 6, end: 8, quote: text.slice(6, 8) }];
  assert.deepEqual(heartbeatCoverage(text, beats), { contract: 'noveliaa-heartbeat-continuity-1', status: 'continuous', sourceCharacters: 8, meaningfulCharacters: 5, coveredMeaningfulCharacters: 5, uncoveredMeaningfulCharacters: 0 });
  assert.deepEqual(heartbeatCoverage(text, beats.slice(0, 1)), { contract: 'noveliaa-heartbeat-continuity-1', status: 'sparse', sourceCharacters: 8, meaningfulCharacters: 5, coveredMeaningfulCharacters: 3, uncoveredMeaningfulCharacters: 2 });
  const missingPunctuation = [{ ...input().beats[0], start: 0, end: 3, quote: text.slice(0, 3) }, { ...input().beats[0], start: 6, end: 7, quote: 'B' }];
  assert.equal(heartbeatCoverage(text, missingPunctuation).status, 'sparse');
  assert.equal(heartbeatCoverage(text, []).status, 'sparse');
  assert.equal(heartbeatCoverage(' \r\n', []).status, 'sparse');
  assert.deepEqual(heartbeatCoverage('', []), { contract: 'noveliaa-heartbeat-continuity-1', status: 'empty', sourceCharacters: 0, meaningfulCharacters: 0, coveredMeaningfulCharacters: 0, uncoveredMeaningfulCharacters: 0 });
});

test('coverage preserves explicit neutral rests and held regions without sentence inflation', () => {
  const text = 'A table stood by the wall. Three chairs faced it. The window was shut.';
  const hold = { ...input().beats[0], start: 0, end: text.length, quote: text, foreground: 'Contained unease', trajectory: 'hold', tone: 'cool' };
  const neutral = { ...hold, foreground: 'Rest', trajectory: 'quiet', tone: 'neutral' };
  for (const beat of [hold, neutral]) {
    const valid = validateHeartbeat({ ...input(), beats: [beat] }, text);
    assert.equal(valid.beats.length, 1);
    assert.equal(heartbeatCoverage(text, valid.beats).status, 'continuous');
  }
  const sparse = heartbeatCoverage(text, [{ ...hold, end: 7, quote: text.slice(0, 7) }]);
  assert.equal(sparse.status, 'sparse');
  assert(sparse.uncoveredMeaningfulCharacters > 0);
  const long = 'a'.repeat(2100), split = [
    { ...hold, start: 0, end: 2000, quote: long.slice(0, 2000) },
    { ...hold, start: 2000, end: 2100, quote: long.slice(2000) }
  ];
  assert.equal(heartbeatCoverage(long, validateHeartbeat({ ...input(), beats: split }, long).beats).status, 'continuous');
  assert.throws(() => validateHeartbeat({ ...input(), beats: [{ ...hold, start: 0, end: long.length, quote: long }] }, long), /Invalid heartbeat/);
});

test('coverage treats malformed or overlapping payloads as invalid rather than partial continuity', () => {
  const valid = input().beats[0];
  for (const beats of [null, {}, [null], [valid, valid], [{ ...valid, quote: 'wrong' }], [{ ...valid, weight: 6 }], [{ ...valid, unknown: true }], [{ ...valid, reasoning: '' }]]) {
    const result = heartbeatCoverage(source, beats);
    assert.equal(result.status, 'invalid');
    assert.equal(result.coveredMeaningfulCharacters, 0);
    assert.equal(result.uncoveredMeaningfulCharacters, result.meaningfulCharacters);
  }
});

test('heartbeat strictly rejects unknown fields, invalid enums, weights, attribution and long labels', () => {
  const cases = [
    { ...input(), approved: true }, { ...input(), provider: ' ' }, { ...input(), model: '' }, { ...input(), contextNote: ' ' },
    { ...input(), beats: [{ ...input().beats[0], canon: true }] },
    ...[{ foreground: 'one two three four' }, { foreground: ' ' }, { undertone: 'four words are invalid' }, { weight: 0 }, { weight: 6 }, { weight: 2.5 },
      { trajectory: 'panic' }, { tone: '#ffffff' }, { reasoning: ' ' }].map(change => ({ ...input(), beats: [{ ...input().beats[0], ...change }] }))
  ];
  for (const value of cases) assert.throws(() => validateHeartbeat(value, source), /Invalid heartbeat annotation/);
});

test('heartbeat rejects stale quotes, invalid ranges, disorder, overlap and whitespace-only anchors', () => {
  const cases = [
    [{ ...input().beats[0], quote: 'Not the source' }], [{ ...input().beats[0], start: -1 }], [{ ...input().beats[0], end: source.length + 1 }],
    [{ ...input().beats[0], start: 5, end: 5, quote: 'a' }], [{ ...input().beats[0], start: 0.1 }],
    [...input().beats, { ...input().beats[0] }], [{ ...input().beats[0], start: 0, end: 1, quote: ' ' }]
  ];
  for (const beats of cases) assert.throws(() => validateHeartbeat({ ...input(), beats }, source), /heartbeat/i);
  const second = { ...input().beats[0], start: 18, end: source.length, quote: source.slice(18) };
  assert.equal(validateHeartbeat({ ...input(), beats: [...input().beats, second] }, source).beats.length, 2);
  assert.throws(() => validateHeartbeat({ ...input(), beats: [second, ...input().beats] }, source), /ordered/);
});

test('heartbeat rejects either UTF-16 surrogate split while accepting whole astral characters', () => {
  const start = source.indexOf('🌙'), beat = { ...input().beats[0], start, end: start + 2, quote: '🌙' };
  assert.equal(validateHeartbeat({ ...input(), beats: [beat] }, source).beats[0].quote, '🌙');
  for (const [from, end] of [[start, start + 1], [start + 1, start + 2]]) {
    assert.throws(() => validateHeartbeat({ ...input(), beats: [{ ...beat, start: from, end, quote: source.slice(from, end) }] }, source), /UTF-16/);
  }
});

test('heartbeat bounds beat count and serialized UTF-8 payload independently of field limits', () => {
  assert.throws(() => validateHeartbeat({ ...input(), beats: Array.from({ length: 81 }, () => input().beats[0]) }, source), /Invalid heartbeat/);
  const quote = '界'.repeat(1500), large = quote.repeat(25);
  const beats = Array.from({ length: 25 }, (_, index) => ({ ...input().beats[0], start: index * 1500, end: (index + 1) * 1500, quote }));
  assert.throws(() => validateHeartbeat({ ...input(), beats }, large), /96 KiB/);
});
