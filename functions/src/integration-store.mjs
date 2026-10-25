import { createHash, randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
export const secret = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const now = () => Math.floor(Date.now() / 1000);
export const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
export const stable = value => Array.isArray(value) ? '[' + value.map(v => stable(v === undefined ? null : v)).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);

// Only token/code hashes are paths. No raw bearer tokens are stored or logged.
// OAuth metadata is isolated from author writing and denied by client Rules.
export class IntegrationStore {
  constructor(db) { this.db = db; }
  ref(kind, key) { return this.db.doc(`_noveliaaMcp/${kind}/oauthItems/${digest(key)}`); }
  value(value) { return { ...JSON.parse(JSON.stringify(value)), ...(Number.isFinite(value.expiresAt) ? { expireAt: Timestamp.fromMillis(value.expiresAt * 1000) } : {}) }; }
  async get(kind, key) { return (await this.ref(kind, key).get()).data(); }
  async put(kind, key, value) { await this.ref(kind, key).set(this.value(value)); }
  async consume(kind, key, validate, writes) {
    return this.db.runTransaction(async tx => {
      const source = this.ref(kind, key), value = (await tx.get(source)).data();
      validate(value);
      tx.delete(source);
      for (const write of writes) tx.set(this.ref(write.kind, write.key), this.value(write.value));
      return value;
    });
  }
  async owner(uid, authenticatedAt) {
    const access = (await this.db.doc('noveliaaConfig/access').get()).data();
    if (!access || access.ownerUid !== uid || !validId(access.workspaceId ?? uid)) throw new Error('Author access required.');
    return { uid, workspaceId: access.workspaceId ?? uid, authenticatedAt };
  }
}
