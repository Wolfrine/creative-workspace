import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { validateHeartbeat } from '../../../functions/src/integration-heartbeat.mjs';

const source = 'A🙂हिन्दी\r\ne\u0301 quiet';
const base = {
  documentId: 'critic-scene', revisionId: 'critic-r1', contentHash: 'a'.repeat(64),
  idempotencyKey: 'critic-validation-0001', provider: 'Synthetic critic', model: 'validation-only',
  contextNote: 'No author material; synthetic Unicode security fixture.',
  beats: [{ start: 1, end: 3, quote: '🙂', foreground: 'Joy', undertone: 'Dread', weight: 3, trajectory: 'shift', tone: 'warm', reasoning: 'Synthetic mixed interpretation, not a reader response.' }],
};
const output = [];
const pass = (name, fn) => { fn(); output.push({ name, status: 'PASS' }); };
const bad = (name, mutate) => pass(name, () => assert.throws(() => validateHeartbeat(mutate(structuredClone(base)), source)));
pass('valid UTF-16 emoji and mixed labels retain exact bytes', () => assert.deepEqual(validateHeartbeat(base, source), base));
pass('quiet empty beats accepted', () => assert.equal(validateHeartbeat({ ...base, beats: [] }, source).beats.length, 0));
pass('CRLF and combining text retain exact quote', () => {
  const start = source.indexOf('\r');
  assert.equal(validateHeartbeat({ ...base, beats: [{ ...base.beats[0], start, end: source.length, quote: source.slice(start) }] }, source).beats[0].quote, source.slice(start));
});
bad('start inside surrogate rejected even with matching half quote', x => { x.beats[0].start = 2; x.beats[0].quote = source.slice(2, 3); return x; });
bad('end inside surrogate rejected even with matching half quote', x => { x.beats[0].end = 2; x.beats[0].quote = source.slice(1, 2); return x; });
bad('mismatched quote rejected', x => { x.beats[0].quote = 'x'; return x; });
bad('overlap rejected', x => { x.beats.push({ ...x.beats[0] }); return x; });
bad('reverse offsets rejected', x => { x.beats[0].start = 3; x.beats[0].end = 1; return x; });
bad('negative offsets rejected', x => { x.beats[0].start = -1; return x; });
bad('fractional offsets rejected', x => { x.beats[0].start = 1.5; return x; });
bad('out of bounds rejected', x => { x.beats[0].end = source.length + 1; return x; });
bad('forged approval top-level rejected', x => ({ ...x, authorApproved: true }));
bad('forged source text top-level rejected', x => ({ ...x, plainText: 'Replacement' }));
bad('forged nested approval rejected', x => { x.beats[0].approved = true; return x; });
bad('four-word label rejected', x => { x.beats[0].foreground = 'One two three four'; return x; });
bad('blank label rejected', x => { x.beats[0].foreground = ' '; return x; });
bad('weight beyond five rejected', x => { x.beats[0].weight = 6; return x; });
bad('unknown trajectory rejected', x => { x.beats[0].trajectory = 'certain'; return x; });
bad('oversize quote rejected', x => { x.beats[0].quote = 'a'.repeat(2001); return x; });
bad('more than eighty beats rejected', x => { x.beats = Array.from({ length: 81 }, () => x.beats[0]); return x; });
await writeFile(new URL('./validate-attacks.json', import.meta.url), JSON.stringify({ synthetic: true, checks: output }, null, 2));
console.log(JSON.stringify({ result: 'PASS', count: output.length, evidence: '.local/heartbeat/critic/validate-attacks.json' }));
