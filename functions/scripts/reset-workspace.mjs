// Explicit owner-authorized, one-time destructive reset. This is an Actions
// administration script, never an application endpoint or a Functions deploy.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
const kinds = ['universes', 'collections', 'documentIdentities', 'documents', 'revisions', 'originals', 'operations', 'chunks', 'blobs'];

export async function resetWorkspace({ db, auth, binding, request, verifiedProject, expectedRequestId }) {
  if (!verifiedProject || binding.projectId !== verifiedProject || db.projectId !== verifiedProject) throw new Error('Reset project binding mismatch.');
  if (!validId(request.requestId) || request.requestId !== expectedRequestId || request.action !== 'reset-entire-workspace' || request.approved !== true || request.commitMarker !== '[workspace-reset:' + request.requestId + ']') throw new Error('Explicit reset request binding is missing or invalid.');
  if (typeof request.ownerEmail !== 'string' || request.ownerEmail.toLowerCase() !== binding.authorEmail?.toLowerCase()) throw new Error('Reset owner email differs from the verified project binding.');
  // The user record must already exist. Reset does not create, delete, disable,
  // or change an account, provider, allowlist owner, credential or Auth session.
  const author = await auth.getUserByEmail(request.ownerEmail);
  if (!validId(author.uid) || author.email?.toLowerCase() !== request.ownerEmail.toLowerCase()) throw new Error('Reset owner account cannot be verified.');
  const accessRef = db.doc('noveliaaConfig/access');
  const receiptRef = db.doc('noveliaaOperations/workspaceReset-' + request.requestId);
  const receipt = await db.runTransaction(async transaction => {
    const [access, prior] = await Promise.all([transaction.get(accessRef), transaction.get(receiptRef)]);
    if (!access.exists || access.data().ownerUid !== author.uid) throw new Error('Reset owner UID differs from the active allowlist.');
    const active = access.data().workspaceId ?? author.uid;
    if (!validId(active) || request.requestId === author.uid) throw new Error('Unsafe workspace reset identity.');
    if (prior.exists) {
      const value = prior.data();
      const expectedRetired = [...new Set([value.oldWorkspaceId, author.uid])];
      if (value.requestId !== request.requestId || value.ownerUid !== author.uid || value.projectId !== verifiedProject || active !== request.requestId || !validId(value.oldWorkspaceId) || value.oldWorkspaceId === active || !Array.isArray(value.retiredWorkspaceIds) || JSON.stringify(value.retiredWorkspaceIds) !== JSON.stringify(expectedRetired)) throw new Error('Reset receipt or current workspace has changed.');
      return value;
    }
    if (active === request.requestId) throw new Error('Workspace was rotated without its reset receipt.');
    const retiredWorkspaceIds = [...new Set([active, author.uid])];
    const value = { requestId: request.requestId, projectId: verifiedProject, ownerUid: author.uid, workspaceId: request.requestId, oldWorkspaceId: active, retiredWorkspaceIds, status: 'rotated' };
    // Rotate and record the exact deletion roots atomically. Old clients lose
    // Rules access before deletion begins and cannot resurrect retired writes.
    transaction.update(accessRef, { workspaceId: request.requestId });
    transaction.create(receiptRef, { ...value, rotatedAt: FieldValue.serverTimestamp() });
    return value;
  });
  const results = [];
  for (const workspaceId of receipt.retiredWorkspaceIds) {
    const active = await accessRef.get();
    if (active.data()?.ownerUid !== author.uid || active.data()?.workspaceId !== request.requestId || workspaceId === request.requestId) throw new Error('Active workspace changed; no further deletion was attempted.');
    const root = db.doc('noveliaaWorkspaces/' + workspaceId);
    const counts = receipt.results?.find(value => value.workspaceId === workspaceId)?.observedBeforeDelete ?? Object.fromEntries(await Promise.all(kinds.map(async kind => [kind, (await root.collection(kind).count().get()).data().count])));
    await db.recursiveDelete(root);
    const remaining = await root.listCollections();
    if ((await root.get()).exists || (await Promise.all([...new Set([...kinds, ...remaining.map(collection => collection.id)])].map(async kind => !(await root.collection(kind).limit(1).get()).empty))).some(Boolean)) throw new Error('Retired workspace deletion was incomplete; rerun this same request.');
    results.push({ workspaceId, observedBeforeDelete: counts, verifiedEmpty: true });
  }
  await db.runTransaction(async transaction => {
    const active = await transaction.get(accessRef);
    if (active.data()?.ownerUid !== author.uid || active.data()?.workspaceId !== request.requestId) throw new Error('Active workspace changed before reset confirmation.');
    transaction.update(receiptRef, { status: 'complete', completedAt: FieldValue.serverTimestamp(), results });
  });
  return { requestId: request.requestId, workspaceId: request.requestId, status: 'complete', authenticationPreserved: true, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
  const request = JSON.parse(await readFile('deployment/workspace-reset-request.json', 'utf8'));
  if (process.env.GITHUB_ACTIONS !== 'true' || binding.projectId !== 'noveliaa' || binding.hostingSite !== 'noveliaa' || binding.url !== 'https://noveliaa.web.app' || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Production reset requires GitHub Actions and the exact verified Noveliaa binding.');
  const app = initializeApp({ credential: applicationDefault(), projectId: binding.projectId });
  const result = await resetWorkspace({ db: getFirestore(app), auth: getAuth(app), binding, request, verifiedProject: process.env.VERIFIED_PROJECT, expectedRequestId: process.env.WORKSPACE_RESET_REQUEST_ID });
  await mkdir('.local', { recursive: true });
  await writeFile('.local/workspace-reset-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  console.log('Workspace reset complete; request=' + result.requestId + '; authentication preserved; retired roots verified empty=' + result.results.length + '.');
  for (const retired of result.results) console.log('Retired root deletion verified: ' + retired.workspaceId + '; prior record counts: ' + Object.entries(retired.deletedKnownDocuments).map(([kind, count]) => kind + '=' + count).join(', ') + '; remaining=0.');
}
