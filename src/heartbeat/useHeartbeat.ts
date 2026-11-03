import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Revision, WritingDocument } from '../domain/model';
import { sha256 } from '../domain/codec';
import { firebaseAuth } from '../cloud/firebase';
import { eligibleHeartbeat, heartbeatRevision, heartbeatSource, type HeartbeatAnnotation, type HeartbeatResponse } from './model';

export interface HeartbeatState { status: 'off' | 'loading' | 'ready' | 'empty' | 'stale' | 'error'; annotation?: HeartbeatAnnotation; message?: string; refresh(): void }
export function useHeartbeat(document: WritingDocument, revisions: Revision[], enabled: boolean, localPreview: boolean): HeartbeatState {
  // Off means no manuscript digest, API request or decoration work while typing.
  const source = useMemo(() => enabled ? heartbeatSource(document) : '', [enabled, document]);
  const revision = useMemo(() => enabled ? heartbeatRevision(document, revisions, source) : undefined, [enabled, document.id, document.headRevisionId, revisions, source]);
  const key = `${document.id}:${document.headRevisionId}:${source}`;
  const [result, setResult] = useState<{ key: string; status: HeartbeatState['status']; annotation?: HeartbeatAnnotation; message?: string }>({ key: '', status: 'off' });
  const [refreshCount, setRefreshCount] = useState(0);
  const refresh = useCallback(() => setRefreshCount(value => value + 1), []);
  useEffect(() => { if (!enabled) return; const focus = () => refresh(); window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled || !revision) return;
    const controller = new AbortController(); let alive = true;
    setResult({ key, status: 'loading' });
    void (async () => {
      try {
        const hash = await sha256(source);
        if (!alive) return;
        if (hash !== revision.contentHash) { setResult({ key, status: 'stale' }); return; }
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (!localPreview) {
          const user = firebaseAuth()?.currentUser;
          if (!user) throw new Error('Sign in to view private Heartbeat annotations.');
          headers.Authorization = 'Bearer ' + await user.getIdToken();
        } else if (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('A signed-in author session is required.');
        const params = new URLSearchParams({ documentId: document.id, revisionId: revision.id, contentHash: hash });
        const response = await fetch('/api/integrations/heartbeat?' + params, { headers, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        const data = await response.json().catch(() => null) as HeartbeatResponse | null;
        if (!response.ok) throw new Error('Private annotations are unavailable. Your writing is safe.');
        if (!alive) return;
        if (data?.schema !== 'noveliaa-heartbeat-1' || !Array.isArray(data.annotations)) throw new Error('These annotations could not be verified.');
        if (!data.sourceIsCurrent) { setResult({ key, status: 'stale' }); return; }
        const annotation = data.annotations.filter(item => eligibleHeartbeat(item, document, revision, hash)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        setResult({ key, status: annotation ? 'ready' : 'empty', annotation });
      } catch (error) { if (alive) setResult({ key, status: 'error', message: error instanceof Error ? error.message : 'Heartbeat is unavailable. Your writing is safe.' }); }
    })();
    return () => { alive = false; controller.abort(); };
    // The full snapshot key guards local changes before any digest/network work.
  }, [key, source, revision?.id, revision?.contentHash, enabled, localPreview, refreshCount]);
  if (!enabled) return { status: 'off', refresh };
  if (!revision) return { status: 'stale', refresh };
  if (result.key !== key) return { status: 'loading', refresh };
  return { ...result, refresh };
}
