import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHeartbeat } from '../src/integration-heartbeat.mjs';

const source = 'A quiet shore. 🌙\nThen the bell rang.';
const input = () => ({ documentId: 'scene', revisionId: 'r1', contentHash: 'a'.repeat(64), idempotencyKey: 'heartbeat-unit-0001',
  provider: 'Synthetic provider', model: 'Synthetic model', contextNote: 'A possible reading of the exact passage, without earlier context.',
  beats: [{ start: 0, end: 14, quote: source.slice(0, 14), foreground: 'Quiet anticipation', undertone: 'Unease', weight: 2, trajectory: 'build', tone: 'cool', reasoning: 'The quiet shore holds attention before the bell.' }] });

test('heartbeat accepts exact UTF-16 source, optional undertone and empty quiet pages', () => {
  assert.deepEqual(validateHeartbeat(input(), source), input());
  assert.deepEqual(validateHeartbeat({ ...input(), beats: [] }, '' ).beats, []);
  const value = input(); delete value.beats[0].undertone;
  assert.equal(validateHeartbeat(value, source).beats[0].undertone, undefined);
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
