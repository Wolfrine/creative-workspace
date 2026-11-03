import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { WorkspaceSnapshot } from '../../src/domain/model';
import type { HeartbeatAnnotation, HeartbeatBeat } from '../../src/heartbeat/model';

/** Synthetic counterpart for public evidence, informed by a privately read
 * four-paragraph author scene. No original wording, names, film or manuscript
 * identifiers are included. This is AI fiction, unverified and never canon. */
export const continuityParagraphs = [
  'Late afternoon light rested on the tram windows. Leena watched the river turn silver as the concert hall drew nearer. She had waited months for this evening, yet the easy journey let her enjoy the waiting. For once, excitement did not require her to hurry.',
  'As a child she had wanted to conduct an orchestra after hearing a recording called The Glass Garden. She remembered finding a borrowed copy and playing it again and again through one short winter. The dates, the shelf and the small player were ordinary details, but they still held the scale of that early wanting. She had not followed much music before it. Afterwards, she could recall the opening almost without trying.',
  'She met Ren at an evening class. They had used the same library for years without speaking, and only the shared lessons brought them together. They became friends. Later she learned that his aunt kept a lending room for old recordings, and possibilities began to open. Her nearby shop had carried little beyond familiar local songs. The performances she hoped to hear were always missing. Eventually she had stopped asking, although the wish had not entirely gone.',
  'Now she was making lists again. She did not want every conversation with Ren to become another request, so she cut a long catalogue down to five recordings and then to three. They spoke of other things while he checked. Two weeks passed before he learned that two titles could not be found. The news narrowed her plans without erasing them. At last the remaining recording arrived in its plain paper sleeve. It was a small thing to carry home, but she carried it carefully.',
];
export const continuityText = continuityParagraphs.join('\n');
export const continuityTitle = 'The long-awaited evening';
export const continuityDocumentId = 'continuity-synthetic-scene';
const canonical = (value: any): string => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function continuityWorkspace(text = continuityText): WorkspaceSnapshot {
  const date = '2026-11-03T00:00:00.000Z';
  const body = { type: 'doc', content: text.split('\n').map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) };
  const snapshot = { id: continuityDocumentId, universeId: 'continuity-world', title: continuityTitle, body, plainText: text, collectionId: null, trashed: false, order: 0, origin: 'ai' as const, sourceOriginalIds: [], createdAt: date, updatedAt: date };
  const revision = { id: 'continuity-revision', documentId: snapshot.id, universeId: snapshot.universeId, parentIds: [], snapshot, contentHash: hash(canonical(snapshot)), createdAt: date };
  return { schemaVersion: 1, accountId: 'synthetic-continuity-evaluation', universes: [{ id: snapshot.universeId, name: 'Synthetic reading study', createdAt: date }], collections: [], documents: [{ ...snapshot, headRevisionId: revision.id }], revisions: [revision], originals: [], receipts: [{ revisionId: revision.id, level: 'local', at: date }] };
}
export function continuityAnnotation(workspace = continuityWorkspace()): HeartbeatAnnotation {
  const revision = workspace.revisions[0], text = revision.snapshot.plainText;
  const cuts = [0, text.indexOf('\n') + 1, text.indexOf('\n', text.indexOf('\n') + 1) + 1, text.indexOf('Her nearby shop'), text.indexOf('Now she'), text.indexOf('Two weeks passed'), text.indexOf('At last'), text.length];
  const feelings: Pick<HeartbeatBeat, 'foreground' | 'undertone' | 'tone' | 'weight' | 'trajectory' | 'reasoning'>[] = [
    { foreground: 'Eager calm', undertone: 'Anticipation', tone: 'warm', weight: 3, trajectory: 'build', reasoning: 'The approaching evening is eagerly awaited while the easy journey allows calm enjoyment.' },
    { foreground: 'Fond longing', undertone: 'Absorption', tone: 'tender', weight: 3, trajectory: 'hold', reasoning: 'Remembered repetition sustains childhood attachment; factual details hold that established longing.' },
    { foreground: 'Renewed curiosity', undertone: 'Friendship', tone: 'wonder', weight: 3, trajectory: 'build', reasoning: 'Friendship creates a new possibility, without treating the friendship as merely a transaction.' },
    { foreground: 'Disappointment', undertone: 'Unspent desire', tone: 'somber', weight: 2, trajectory: 'hold', reasoning: 'Unavailable performances explain reduced asking; the wish persists beneath that restraint.' },
    { foreground: 'Tempered eagerness', undertone: 'Consideration', tone: 'cool', weight: 3, trajectory: 'hold', reasoning: 'Planning revives while the character protects the friendship from repeated demands.' },
    { foreground: 'Frustration', undertone: 'Remaining hope', tone: 'tense', weight: 2, trajectory: 'hold', reasoning: 'Delay and missing titles narrow the plan but do not erase the continuing wish.' },
    { foreground: 'Quiet reward', undertone: 'Relief', tone: 'warm', weight: 2, trajectory: 'release', reasoning: 'The small arrival pays off the remembered effort without implying the larger ambition is resolved.' },
  ];
  return { id: 'synthetic-continuity-analysis', schema: 'noveliaa-heartbeat-1', anchor: { documentId: revision.documentId, revisionId: revision.id, contentHash: revision.contentHash, title: revision.snapshot.title }, attribution: { provider: 'Synthetic evaluation', model: 'Reference fixture' }, contextNote: 'Invented four-paragraph counterpart for rendering and continuity checks. No real manuscript or measured reader response.', beats: feelings.map((feeling, index) => ({ ...feeling, start: cuts[index], end: cuts[index + 1], quote: text.slice(cuts[index], cuts[index + 1]) })), origin: 'ai', verification: 'unverified', createdAt: '2026-11-03T00:00:00.000Z' };
}
export async function seedContinuityWorkspace(page: Page, notebook: string, text = continuityText): Promise<WorkspaceSnapshot> {
  const url = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.searchParams.get('local') !== '1' || url.searchParams.get('notebook') !== notebook) throw new Error('Isolated loopback DEV notebook required.');
  const snapshot = continuityWorkspace(text), payload = { format: 'noveliaa-writing-archive', schemaVersion: 1, exportedAt: '2026-11-03T00:00:00.000Z', snapshot };
  const archive = JSON.stringify({ ...payload, sha256: hash(canonical(payload)) });
  await page.evaluate(async input => {
    const engine = (window as any).__NOVELIAA_TEST__;
    if (!engine?.getSnapshot().localOnly || engine.getSnapshot().documents.length) throw new Error('Only an empty isolated device fixture may be seeded.');
    await engine.importArchive(new File([input.archive], 'synthetic-continuity.json', { type: 'application/json' }));
    await engine.selectDocument(input.documentId);
  }, { archive, documentId: continuityDocumentId });
  return snapshot;
}
