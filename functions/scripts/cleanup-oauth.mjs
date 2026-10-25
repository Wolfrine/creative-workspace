import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { cleanupExpiredOAuth } from '../src/integration-cleanup.mjs';
const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
if (process.env.VERIFIED_PROJECT !== 'noveliaa' || binding.projectId !== 'noveliaa') throw new Error('OAuth cleanup target mismatch.');
const result = await cleanupExpiredOAuth(getFirestore(initializeApp({ credential: applicationDefault(), projectId: binding.projectId })));
await mkdir('.local', { recursive: true }); await writeFile('.local/oauth-cleanup.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
