import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { Origin, RichNode, WorkspaceSnapshot, WritingDocument } from '../../src/domain/model';

/**
 * AI-generated fiction written for evaluation only. These are not the owner's manuscripts,
 * recovered canon, published material, or AI approvals. Import only into an
 * isolated loopback DEV notebook. The production app has no fixture bypass.
 */
export const POPULATED_FIXTURE_VERSION = 'three-worlds-2026-10-25-v1';
export const fixtureIds = {
  salt: 'sample-saltwater', signal: 'sample-signal', lantern: 'sample-lantern',
  saltDrafts: 'salt-drafts', saltPeople: 'salt-people', saltScraps: 'salt-scraps', saltEmpty: 'salt-empty',
  signalScenes: 'signal-scenes', signalRules: 'signal-rules', signalPeople: 'signal-people', signalEmpty: 'signal-empty',
  lanternLetters: 'lantern-letters', lanternPlaces: 'lantern-places', lanternFragments: 'lantern-fragments', lanternEmpty: 'lantern-empty',
  tide: 'salt-tide', return: 'salt-return', mira: 'salt-mira', harbour: 'salt-harbour', ledger: 'salt-ledger',
  loose: 'salt-loose', untitled: 'salt-untitled', imported: 'salt-imported', ai: 'salt-ai', trash: 'salt-trash',
  signalScene: 'signal-first-light', relay: 'signal-relay', rule: 'signal-rule', iona: 'signal-iona',
  signalLoose: 'signal-loose', signalWindow: 'signal-window', chat: 'signal-chat',
  letter: 'lantern-letter', station: 'lantern-station', grandmother: 'lantern-grandmother',
  poem: 'lantern-poem', hindi: 'lantern-hindi', lanternLoose: 'lantern-loose', lanternWindow: 'lantern-window',
} as const;

const p = (text: string, attrs?: RichNode['attrs']): RichNode => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text }] });
const linked = (before: string, text: string, target: string, after = ''): RichNode => ({ type: 'paragraph', content: [
  ...(before ? [{ type: 'text', text: before }] : []),
  { type: 'text', text, marks: [{ type: 'link', attrs: { href: 'noveliaa://document/' + target } }] },
  ...(after ? [{ type: 'text', text: after }] : []),
] });
const body = (...content: RichNode[]): RichNode => ({ type: 'doc', content });
const heading = (text: string): RichNode => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
const canonical = (value: any): string => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const plain = (node: RichNode): string => node.type === 'text' ? node.text! : node.type === 'hardBreak' ? '\n' : (node.content || []).map(plain).join(['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type) ? '\n' : '');

// Distinct events and sentences give the reader real passage boundaries and the
// Library useful retrieval targets, rather than thousands of repeated fillers.
const tideParagraphs = [
  'Mira reached the harbour before the baker unlocked his shutters. A white dog slept beside the rope locker, one eye open to the sound of her steps. She had carried the brass key for eleven years without knowing which door it belonged to.',
  'The tide had withdrawn beyond the broken jetty. On the exposed steps, green weed lay like ribbons dropped after a festival. Somewhere below the stonework, water knocked three times and then waited.',
  'She put the ledger on a bollard and unfolded the page her father had left blank. In the margin, a thin line of salt traced the outline of a house. No street in the town ran at that angle.',
  'At the fish stall, old Salim was sharpening a knife he no longer used. He said the north bell had rung during the night. The bell tower had fallen into the sea before Mira was born, but he gave the news as calmly as the weather.',
  'A ferry appeared beyond the outer buoy without making a wake. Its windows reflected a summer sky while rain gathered above the harbour. Mira counted seven passengers and an eighth shadow beside the pilot.',
  'She wanted to go home, boil water, and let the day become ordinary. Instead she opened the envelope again. The ink was still damp where her father had written, Bring the key when the steps return.',
  'The lower gate stood behind stacks of empty crates. Somebody had recently oiled the hinges. A small clean crescent interrupted the rust around the lock, exactly the width of the key in her pocket.',
  'Down on the beach, a child was arranging shells in pairs. Every time the wind moved one, she began the arrangement again. Mira asked who had taught her the game, and the child pointed towards the impossible ferry.',
  'The harbour clock stopped at six seventeen. Workers continued lifting baskets as though nothing had happened. Only the dog rose, shook the sleep from its coat, and followed Mira to the gate.',
  'Behind the gate, the staircase smelled of rain-soaked paper. Twelve steps descended into a room without windows. She could hear gulls from inside the walls, although the ceiling was below the waterline.',
  'A blue cup waited on the table. Its handle had been repaired with copper wire, a repair she remembered making at the age of nine. Beside it lay a ticket dated tomorrow and bearing her old family name.',
  'Mira touched the ticket without picking it up. The paper was warm. Across its reverse, someone had drawn a map of the harbour as it would look after the sea took the market, the pharmacy, and the road to the school.',
  'The dog whined at a closed cupboard. When she opened it, there were no shelves, only a second staircase going up. Light fell from above, yellow and dusty, and she heard her mother calling her in for supper.',
  'She kept one hand on the table until the room stopped tilting. Her mother had been dead for twenty years. A voice could be a memory; the smell of burnt onions rising from that stair was harder to explain.',
  'Outside, the first ferry horn sounded. She counted the notes as Salim had taught her: one for weather, two for delay, three for a traveller who had not decided. The horn held its third note until the cup began to tremble.',
  'Mira found a list under the ticket. It named the people who had left town and never written back. Her father stood halfway down, his name followed by a line that was neither a date nor a place.',
  'At the bottom, in her own handwriting, was a sentence she had never written: A return is not the same as a rescue. She read it twice, then folded the list so that the names could no longer see the room.',
  'The water in the walls rose to the level of her shoulders. It did not enter. For a moment the room felt like a lantern held under a dark river, each seam a fine line of green light.',
  'A woman knocked from the other side of the cupboard. She used the family rhythm, two quick taps and one slow. Mira lifted the latch before she remembered that her mother always knocked differently.',
  'On the upper stair stood the child from the beach, now tall enough to meet her eyes. Shells clicked in the pockets of her coat. She said there was time for one question, provided Mira could bear the answer.',
  'Mira asked who owned the ferry. The woman smiled with an unfamiliar part of her face. No one owns a crossing, she said. Someone merely agrees to remember the people who used it.',
  'A rope snapped outside with the sound of a gunshot. In the sudden silence after it, Mira heard a pencil moving behind the plaster. Someone was adding another name to a list much longer than hers.',
  'She put the key on the table instead of turning it in the cupboard lock. It left a dry outline on the damp wood. The woman on the stair stopped smiling and looked, for the first time, uncertain.',
  'The dog took the ticket in its mouth and carried it to the lower door. Mira laughed then, one startled breath. A room that knew her childhood had failed to predict the practical judgement of a harbour dog.',
  'She followed him up the twelve steps. Dawn had fully arrived. The ferry windows were dark, the seven passengers were gone, and Salim was pouring tea into three chipped glasses.',
  'He did not ask what she had found. He pushed the third glass across the table and put a clean sheet of paper beside it. Mira wrote her own name at the top, leaving room underneath for a question she could choose herself.',
  'The north bell rang once from beneath the sea. This time she heard a crack in the note, a human imperfection. She let it fade before she began the next line.',
  'When the child returned for her shells, Mira gave her the copper wire from the cup. Neither of them explained the exchange. Beyond the outer buoy, the ferry turned towards a horizon where the weather finally matched the sky.',
];

interface Draft { id: string; world: string; title: string; collection: string | null; body: RichNode; origin?: Origin; originals?: string[]; trashed?: boolean }
export async function buildPopulatedWorkspace(): Promise<WorkspaceSnapshot> {
  const x = fixtureIds;
  const createdAt = '2026-10-20T06:00:00.000Z';
  const snapshot: WorkspaceSnapshot = { schemaVersion: 1, accountId: 'synthetic-populated-evaluation', universes: [
    { id: x.salt, name: 'The Saltwater Ledger', createdAt },
    { id: x.signal, name: 'Signal Orchard', createdAt },
    { id: x.lantern, name: 'Paper Lanterns · काग़ज़ की रोशनी', createdAt },
  ], collections: [], documents: [], revisions: [], originals: [], receipts: [] };
  const groups = [
    [x.saltDrafts, x.salt, 'Draft chapters'], [x.saltPeople, x.salt, 'People & places'],
    [x.saltScraps, x.salt, 'Fragments, remembered details, and questions still waiting for an answer'], [x.saltEmpty, x.salt, 'A room for the ending'],
    [x.signalScenes, x.signal, 'Draft chapters'], [x.signalRules, x.signal, 'Signals & field notes'], [x.signalPeople, x.signal, 'People'], [x.signalEmpty, x.signal, 'Possible futures'],
    [x.lanternLetters, x.lantern, 'Letters never sent'], [x.lanternPlaces, x.lantern, 'Places & family'],
    [x.lanternFragments, x.lantern, 'Poems, tiny observations, and things overheard between two stations'], [x.lanternEmpty, x.lantern, 'Next season'],
  ];
  snapshot.collections = groups.map(([id, universeId, name], order) => ({ id, universeId, name, order }));
  const importText = 'Found notebook — attribution not established.\r\nThe blue tile beneath the customs stair was loose.\r\nहवा में नमक था। e\u0301 🙂\r\n';
  const chatText = 'User:\r\nWhat if the last receiver only records silence?\r\nAssistant:\r\nUnapproved possibility: the silence contains a hidden city.\r\n';
  for (const [id, universeId, name, text, origin] of [
    ['sample-original-notebook', x.salt, 'Found harbour notebook.txt', importText, 'unknown'],
    ['sample-original-chat', x.signal, 'Receiver conversation.txt', chatText, 'imported_chat'],
  ] as const) {
    const bytes = Buffer.from(text, 'utf8');
    snapshot.originals.push({ id, universeId, name, bytesBase64: bytes.toString('base64'), sha256: hash(bytes), origin, verification: 'unverified', sourceReference: 'SYNTHETIC evaluation fixture only; no author approval or canon asserted.', createdAt });
  }
  const drafts: Draft[] = [
    { id: x.tide, world: x.salt, title: 'When the steps returned', collection: x.saltDrafts, body: body(heading('Before the first ferry'), ...tideParagraphs.map(text => p(text, { firstLineIndent: true })), linked('Keep the physical setting consistent with ', 'the old harbour', x.harbour, '.')) },
    { id: x.return, world: x.salt, title: 'The third glass', collection: x.saltDrafts, body: body(p('Salim washed the third glass after Mira left. It had belonged to his sister; no one in town remembered that he had once had a sister.'), p('He wrote the repair to the lower gate in his account book as a purchase of lamp oil. Some kinds of kindness survived only if they looked like ordinary expenses.'), linked('Before revising this scene, check ', 'Mira’s unanswered question', x.mira, '.')) },
    { id: x.mira, world: x.salt, title: 'Mira — what she refuses to forget', collection: x.saltPeople, body: body(p('Repairs books for the school. Knows the difference between a damaged page and a missing one. Has kept her father’s brass key, but will not call that hope.'), { type: 'bulletList', content: [ { type: 'listItem', content: [p('Wants an answer that does not require another disappearance.')] }, { type: 'listItem', content: [p('Never says she is afraid of deep water; she checks the weather instead.')] } ] }, linked('Her first deliberate refusal happens in ', 'When the steps returned', x.tide, '.')) },
    { id: x.harbour, world: x.salt, title: 'The old harbour', collection: x.saltPeople, body: body(p('The customs stair has twelve steps at low tide and nine at high tide. The north bell lies below the outer buoy. Market stalls face east; the ferry approaches from the west.'), p('Retrieval marker: the brass key was hidden behind the last blue tile.'), linked('The only ledger that names the missing people is ', 'the ferry ledger', x.ledger, '.')) },
    { id: x.ledger, world: x.salt, title: 'The ferry ledger', collection: x.saltScraps, body: body(heading('Questions, not established rules'), { type: 'orderedList', attrs: { start: 3, type: 'A' }, content: [ { type: 'listItem', content: [p('Who records a traveller who chooses not to cross?')] }, { type: 'listItem', content: [p('Can a name be erased without the person being forgotten?')] } ] }, { type: 'blockquote', content: [p('A return is not the same as a rescue.')] }) },
    { id: x.loose, world: x.salt, title: 'An idea on the bus', collection: null, body: body(p('The dog should make the useful decision while the adults argue about what the ferry means. Keep this as a question until the ending works.')) },
    { id: x.untitled, world: x.salt, title: '', collection: null, body: body(p('A gull walked along the roof as if it had an appointment. Maybe this is an opening, maybe only a sound to keep.')) },
    { id: x.imported, world: x.salt, title: 'Found harbour notebook', collection: x.saltScraps, origin: 'unknown', originals: ['sample-original-notebook'], body: body(...importText.replace(/\r\n/g, '\n').split('\n').map(text => text ? p(text) : { type: 'paragraph' })) },
    { id: x.ai, world: x.salt, title: 'Unreviewed possibility — a second harbour', collection: x.saltScraps, origin: 'ai', body: body(p('UNVERIFIED AI PROPOSAL. A second harbour could exist under the first, with each traveller leaving a memory as fare. This possibility has not been accepted and must not replace the author’s draft.')) },
    { id: x.trash, world: x.salt, title: 'Set aside — the talking compass', collection: x.saltScraps, trashed: true, body: body(p('The compass says the tide has a name. Set aside because the voice makes the mystery too explicit. Preserve this experiment in history.')) },
    { id: x.signalScene, world: x.signal, title: 'First light at Relay Nine', collection: x.signalScenes, body: body(heading('The receiver garden'), p('Iona climbed the service ladder carrying a pear in one hand and a soldering iron in the other. Relay Nine had grown through the branches during the night. Its copper antennae were heavy with dew.'), p('Below her, the station keeper laid empty bowls along the fence. He said they caught the voices the receivers failed to hold. Iona said that was impossible, then moved her own bowl closer to the tallest tree.'), p('At noon the orchard broadcast the sound of rain from a place where it had not rained in thirty years. Every farmer stopped working. No one spoke until the last drop had sounded against the tin roof of a vanished house.'), linked('The equipment’s limits belong in ', 'The law of borrowed signals', x.rule, ', rather than being assumed from this scene.')) },
    { id: x.relay, world: x.signal, title: 'Relay Nine — field sketch', collection: x.signalRules, body: body(p('One mast, three grounding wires, and a ceramic dial marked with seasons instead of frequencies. The service ladder faces the mountain, not the road.'), { type: 'codeBlock', attrs: { language: 'text' }, content: [{ type: 'text', text: 'receiver -> ceramic dial -> storage spool\nno transmission until the operator releases the latch' }] }, linked('The engineer who installed the third ground wire is ', 'Iona', x.iona, '.')) },
    { id: x.rule, world: x.signal, title: 'The law of borrowed signals', collection: x.signalRules, body: body(p('A receiver can preserve a sound but cannot prove where or when it began. This is an author’s working rule, not an instruction to fill gaps in the plot.'), { type: 'bulletList', content: [ { type: 'listItem', content: [p('No message predicts an exact date.')] }, { type: 'listItem', content: [p('A copied voice is not evidence that its speaker is alive.')] } ] }, linked('One scene tests the distinction at ', 'Relay Nine', x.signalScene, '.')) },
    { id: x.iona, world: x.signal, title: 'Iona', collection: x.signalPeople, body: body(p('Former repair apprentice. Trusts measurements more than explanations, except when her brother’s voice appears on a blank spool. She keeps a pear in her coat because the orchard owner insists on paying in fruit.'), linked('Her practical route through the equipment is shown in ', 'the field sketch', x.relay, '.')) },
    { id: x.signalLoose, world: x.signal, title: 'A question about silence', collection: null, body: body(p('What if an empty spool is a deliberate message? Do not solve this yet. First find out what Iona thinks silence is for.')) },
    { id: x.signalWindow, world: x.signal, title: 'The window', collection: x.signalScenes, body: body(p('From the station window, a person can see all seven orchards. The eighth appears only as a gap in the radio noise. Retrieval marker: apricot static.')) },
    { id: x.chat, world: x.signal, title: 'Receiver conversation', collection: null, origin: 'imported_chat', originals: ['sample-original-chat'], body: body(...chatText.replace(/\r\n/g, '\n').split('\n').map(text => text ? p(text) : { type: 'paragraph' })) },
    { id: x.letter, world: x.lantern, title: 'A letter without an address', collection: x.lanternLetters, body: body(p('Dear Amma, the train stopped at the station where you once sold tea. I knew it from the cracked green bench, although every sign had been repainted. I bought two cups out of habit and carried the second until it went cold.'), p('I have not decided whether to send this. A letter needs a place to arrive, and the house in my memory has already lost its front door.'), linked('The station belongs beside ', 'your winter kitchen', x.grandmother, ', even if I never put them in the same story.')) },
    { id: x.station, world: x.lantern, title: 'Platform four, after rain', collection: x.lanternPlaces, body: body(p('A red scarf hangs from the signal box. Rain has collected in the lettering of the platform number. The tea seller turns every cup upside down before opening the stall.'), linked('An unsent description of this place is in ', 'A letter without an address', x.letter, '.')) },
    { id: x.grandmother, world: x.lantern, title: 'Amma’s winter kitchen', collection: x.lanternPlaces, body: body(p('Steel tins above the stove, each holding something different from its label. Orange peel drying on the windowsill. A chair beside the door for visitors who insist they cannot stay.')) },
    { id: x.poem, world: x.lantern, title: 'Between two stations', collection: x.lanternFragments, body: body(p('The fields turn their faces away.'), { type: 'paragraph', content: [{ type: 'text', text: 'One lamp in a passing house' }, { type: 'hardBreak' }, { type: 'text', text: 'holds the shape of somebody waiting.', marks: [{ type: 'italic' }] }] }, { type: 'paragraph' }, p('Do not make every light a promise.')) },
    { id: x.hindi, world: x.lantern, title: 'काग़ज़ की रोशनी', collection: x.lanternFragments, body: body(p('दादी ने कहा, रोशनी को पकड़ने की कोशिश मत करो। बस खिड़की खुली रहने दो।'), p('बारिश के बाद आँगन में मिट्टी की ख़ुशबू थी। मैंने चाय के दो कप रखे, फिर एक वापस अलमारी में रख दिया।'), p('Unicode reference: café / café / क़ / 🙂. Preserve these exact forms.')) },
    { id: x.lanternLoose, world: x.lantern, title: 'A small thing to remember', collection: null, body: body(p('The passenger opposite folded his ticket into a tiny boat and set it on the closed window. Nobody commented. This does not need a plot yet.')) },
    { id: x.lanternWindow, world: x.lantern, title: 'The window', collection: x.lanternPlaces, body: body(p('The kitchen window opens towards the neem tree. Its latch was replaced with a spoon long before anyone remembers. Retrieval marker: spoon-shaped moon.')) },
  ];
  for (const [index, draft] of drafts.entries()) {
    const updatedAt = new Date(Date.parse(createdAt) + (index + 1) * 3_600_000).toISOString();
    const document: WritingDocument = { id: draft.id, universeId: draft.world, title: draft.title, body: draft.body, plainText: plain(draft.body), collectionId: draft.collection, trashed: Boolean(draft.trashed), order: index, origin: draft.origin || 'ai', sourceOriginalIds: draft.originals || [], createdAt, updatedAt, headRevisionId: draft.id + '-r1' };
    const { headRevisionId, ...revisionSnapshot } = document;
    snapshot.documents.push(document);
    snapshot.revisions.push({ id: headRevisionId!, documentId: document.id, universeId: document.universeId, parentIds: [], snapshot: revisionSnapshot, contentHash: hash(canonical(revisionSnapshot)), createdAt: updatedAt });
    snapshot.receipts.push({ revisionId: headRevisionId!, level: 'local', at: updatedAt });
  }
  return snapshot;
}

export async function populatedArchive(): Promise<string> {
  const payload = { format: 'noveliaa-writing-archive', schemaVersion: 1, exportedAt: '2026-10-25T06:00:00.000Z', snapshot: await buildPopulatedWorkspace() };
  return JSON.stringify({ ...payload, sha256: hash(canonical(payload)) });
}

export async function populatedFixtureManifest() {
  const snapshot = await buildPopulatedWorkspace();
  const archive = await populatedArchive();
  return {
    version: POPULATED_FIXTURE_VERSION, synthetic: true, aiGenerated: true, approval: 'unverified',
    productionSeeded: false, archiveSha256: hash(archive), archiveBytes: Buffer.byteLength(archive),
    universes: snapshot.universes.map(universe => ({ id: universe.id, name: universe.name, collections: snapshot.collections.filter(item => item.universeId === universe.id).length, pages: snapshot.documents.filter(item => item.universeId === universe.id && !item.trashed).length })),
    collections: snapshot.collections.map(collection => ({ id: collection.id, name: collection.name, universeId: collection.universeId, pages: snapshot.documents.filter(item => item.collectionId === collection.id && !item.trashed).length })),
    documents: snapshot.documents.map(document => ({ id: document.id, title: document.title, universeId: document.universeId, collectionId: document.collectionId, origin: document.origin, trashed: document.trashed, bodySha256: hash(canonical(document.body)), textSha256: hash(document.plainText), characters: document.plainText.length })),
    originals: snapshot.originals.map(({ id, name, sha256, verification, origin }) => ({ id, name, sha256, verification, origin })),
  };
}

export async function seedPopulatedWorkspace(page: Page, notebook: string): Promise<WorkspaceSnapshot> {
  const url = new URL(page.url());
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.searchParams.get('local') !== '1' || url.searchParams.get('notebook') !== notebook) throw new Error('Synthetic fixture requires its explicitly isolated loopback DEV notebook.');
  const snapshot = await buildPopulatedWorkspace();
  await page.evaluate(async archive => {
    const engine = (window as any).__NOVELIAA_TEST__;
    if (!engine?.getSnapshot().localOnly || engine.getSnapshot().documents.length) throw new Error('Fixture may seed only an empty local-only DEV store.');
    await engine.importArchive(new File([archive], 'synthetic-three-worlds.json', { type: 'application/json' }));
    await engine.selectDocument('salt-tide');
  }, await populatedArchive());
  return snapshot;
}
