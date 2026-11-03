import { z } from 'zod';
import { digest, now, stable } from './integration-store.mjs';
import { READ, PROPOSE } from './integration-oauth.mjs';

export const HEARTBEAT_SCHEMA = 'noveliaa-heartbeat-1';
export const HEARTBEAT_INFERENCE = 'AI interpretation; not measured emotion or author intent.';
const identity = z.string().regex(/^[A-Za-z0-9_-]{1,150}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = max => z.string().min(1).max(max).refine(value => value.trim().length > 0, 'Text cannot be blank.');
const label = text(48).refine(value => value.trim() === value && value.split(/\s+/u).length <= 3, 'Labels must contain one to three words.');
export const heartbeatInputShape = {
  documentId: identity, revisionId: identity, contentHash: hash,
  idempotencyKey: z.string().min(16).max(120).regex(/^[A-Za-z0-9_-]+$/),
  provider: text(80), model: text(120), contextNote: text(1200),
  beats: z.array(z.strictObject({
    start: z.number().int().min(0).max(32000000), end: z.number().int().min(1).max(32000000), quote: text(2000),
    foreground: label, undertone: label.optional(), weight: z.number().int().min(1).max(5),
    trajectory: z.enum(['build', 'hold', 'shift', 'release', 'quiet']),
    tone: z.enum(['warm', 'cool', 'tense', 'tender', 'somber', 'wonder', 'neutral']), reasoning: text(1200)
  })).max(80)
};
export const heartbeatInput = z.strictObject(heartbeatInputShape);
export const heartbeatReadInput = z.strictObject({ documentId: identity, revisionId: identity, contentHash: hash });
export class HeartbeatError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new HeartbeatError(message, status); };
const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) fail('Invalid heartbeat annotation: ' + result.error.issues.map(issue => issue.path.join('.') + ' ' + issue.message).join('; ').slice(0, 240));
  return result.data;
};
const isBoundary = (source, index) => index === 0 || index === source.length || !(source.charCodeAt(index - 1) >= 0xd800 && source.charCodeAt(index - 1) <= 0xdbff && source.charCodeAt(index) >= 0xdc00 && source.charCodeAt(index) <= 0xdfff);
export function validateHeartbeat(value, plainText) {
  const input = parse(heartbeatInput, value);
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 96 * 1024) fail('Heartbeat annotation exceeds the 96 KiB limit.');
  let previousEnd = 0;
  for (const beat of input.beats) {
    if (beat.start < previousEnd || beat.end <= beat.start || beat.end > plainText.length || !isBoundary(plainText, beat.start) || !isBoundary(plainText, beat.end) || plainText.slice(beat.start, beat.end) !== beat.quote) fail('Heartbeat spans must be ordered, nonoverlapping UTF-16 ranges with an exact source quote.');
    previousEnd = beat.end;
  }
  return input;
}
const ownerMatches = (config, owner) => config?.ownerUid === owner.uid && (config.workspaceId ?? owner.uid) === owner.workspaceId;
const grantMatches = (grant, owner, universeId, expected) => !!grant && typeof grant.id === 'string' && grant.uid === owner.uid && grant.workspaceId === owner.workspaceId
  && !grant.revoked && Number.isFinite(grant.expiresAt) && grant.expiresAt > now() && grant.allowProposals === true
  && Array.isArray(grant.scopes) && grant.scopes.includes(READ) && grant.scopes.includes(PROPOSE)
  && Array.isArray(grant.universeIds) && grant.universeIds.includes(universeId)
  && (!expected || grant.id === expected.id && grant.clientId === expected.clientId);
const entries = (root, documentId, revisionId) => root.collection('heartbeatAnnotations').doc(documentId).collection('revisions').doc(revisionId).collection('entries');

// The source bytes are verified by WritingAccess. Only these separate annotation
// and receipt paths are ever written; writing, canon and publication are untouched.
export async function submitHeartbeat({ access, store }, grant, value) {
  const shaped = parse(heartbeatInput, value);
  const source = await access.page(grant, shaped.documentId, shaped.revisionId);
  if (source.currentRevisionId !== shaped.revisionId || source.revision.contentHash !== shaped.contentHash) fail('Writing changed. Fetch its current exact revision before annotating.', 409);
  const input = validateHeartbeat(shaped, source.revision.snapshot.plainText);
  const root = access.root(grant), id = digest(grant.id + ':' + input.idempotencyKey), fingerprint = digest(stable(input));
  const receiptRef = root.collection('heartbeatReceipts').doc(id), annotationRef = entries(root, input.documentId, input.revisionId).doc(id);
  return store.db.runTransaction(async tx => {
    const [config, fresh, previous, head, revision, universe] = await tx.getAll(store.db.doc('noveliaaConfig/access'), store.ref('grants', grant.id), receiptRef,
      root.collection('documents').doc(input.documentId), root.collection('revisions').doc(input.revisionId), root.collection('universes').doc(source.revision.universeId));
    if (!ownerMatches(config.data(), grant) || !grantMatches(fresh.data(), grant, source.revision.universeId, grant) || !universe.exists) fail('Connection changed. Reconnect before submitting a heartbeat.', 403);
    if (head.data()?.headRevisionId !== input.revisionId || head.data()?.universeId !== source.revision.universeId || revision.data()?.documentId !== input.documentId || revision.data()?.universeId !== source.revision.universeId || revision.data()?.contentHash !== input.contentHash) fail('Writing changed. Fetch its current exact revision before annotating.', 409);
    if (previous.exists) {
      if (previous.data().fingerprint !== fingerprint) fail('Idempotency key was already used for different content.', 409);
      return { ...previous.data().receipt, replayed: true };
    }
    const annotation = {
      id, schema: HEARTBEAT_SCHEMA, documentId: input.documentId, universeId: source.revision.universeId,
      anchor: { documentId: input.documentId, revisionId: input.revisionId, contentHash: input.contentHash, title: source.revision.snapshot.title || 'Untitled' },
      attribution: { provider: input.provider, model: input.model }, contextNote: input.contextNote, beats: input.beats,
      origin: 'ai', verification: 'unverified', inference: HEARTBEAT_INFERENCE, grantId: grant.id, clientName: fresh.data().clientName,
      createdAt: new Date().toISOString()
    };
    const receipt = { id, schema: HEARTBEAT_SCHEMA, verification: 'unverified', sourceIsCurrent: true, createdAt: annotation.createdAt };
    tx.create(annotationRef, annotation);
    tx.create(receiptRef, { fingerprint, receipt, annotationPath: annotationRef.path });
    return { ...receipt, replayed: false };
  });
}

export async function readHeartbeat({ access, store }, owner, value) {
  const input = parse(heartbeatReadInput, value), root = access.root(owner);
  const unavailable = { schema: HEARTBEAT_SCHEMA, annotations: [], sourceIsCurrent: false };
  // Verify the immutable bytes as well as metadata. In particular, a trashed
  // snapshot must never become visible solely because its head id still matches.
  const preflight = (await root.collection('documents').doc(input.documentId).get()).data();
  let sourceAvailable = false;
  if (preflight?.headRevisionId === input.revisionId) {
    try {
      const source = await access.page({ ...owner, universeIds: [preflight.universeId] }, input.documentId, input.revisionId);
      sourceAvailable = source.currentRevisionId === input.revisionId && source.revision.contentHash === input.contentHash;
    } catch (error) {
      if (error.message !== 'Trashed writing is not shared with this connection.') throw error;
    }
  }
  return store.db.runTransaction(async tx => {
    const [config, head, revision] = await tx.getAll(store.db.doc('noveliaaConfig/access'), root.collection('documents').doc(input.documentId), root.collection('revisions').doc(input.revisionId));
    if (!ownerMatches(config.data(), owner)) fail('Writing workspace changed. Reopen this page.', 403);
    const current = head.data(), source = revision.data();
    if (!sourceAvailable || !current || current.headRevisionId !== input.revisionId || source?.documentId !== input.documentId || source.universeId !== current.universeId || source.contentHash !== input.contentHash) return unavailable;
    const [universe, found] = await Promise.all([tx.get(root.collection('universes').doc(current.universeId)), tx.get(entries(root, input.documentId, input.revisionId).orderBy('createdAt', 'desc').limit(50))]);
    if (!universe.exists) return unavailable;
    const candidates = found.docs.map(doc => doc.data()).filter(record => record.schema === HEARTBEAT_SCHEMA && record.anchor?.documentId === input.documentId && record.anchor.revisionId === input.revisionId && record.anchor.contentHash === input.contentHash && record.universeId === current.universeId && typeof record.grantId === 'string');
    const ids = [...new Set(candidates.map(record => record.grantId))];
    const grants = ids.length ? await tx.getAll(...ids.map(id => store.ref('grants', id))) : [];
    const active = new Map(ids.map((id, index) => [id, grants[index].data()]));
    const latest = candidates.find(record => grantMatches(active.get(record.grantId), owner, current.universeId) && active.get(record.grantId).id === record.grantId);
    const { grantId, universeId, ...safe } = latest ?? {};
    return { schema: HEARTBEAT_SCHEMA, annotations: latest ? [safe] : [], sourceIsCurrent: true };
  });
}
