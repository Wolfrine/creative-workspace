import { Timestamp } from 'firebase-admin/firestore';
// Fixed namespaces only. Never traverse/delete writing, originals, proposals,
// consent grants, registered clients or author decisions. Expiry already denies
// access synchronously; this bounded weekly sweep only reclaims expired tokens.
export async function cleanupExpiredOAuth(db, at = new Date()) {
  const counts = {};
  for (const kind of ['pending', 'codes', 'access', 'refresh', 'spent']) {
    let removed = 0;
    for (let batchNumber = 0; batchNumber < 5; batchNumber++) {
      const found = await db.collection(`_noveliaaMcp/${kind}/oauthItems`).where('expireAt', '<', Timestamp.fromDate(at)).limit(200).get();
      if (found.empty) break;
      const batch = db.batch(); found.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit(); removed += found.size;
      if (found.size < 200) break;
    }
    counts[kind] = { removed, reachedWeeklyBound: removed === 1000 };
  }
  return { at: at.toISOString(), namespaces: counts, scope: 'Expired OAuth token/code metadata only. Author content, collaboration and consent evidence preserved.' };
}
