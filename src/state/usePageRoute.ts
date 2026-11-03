import { useEffect, useRef, useState } from 'react';
import type { WorkspaceController, WritingDocument } from '../domain/model';
import { pagePath, parsePageLocation, type PageReference } from '../../functions/src/page-url.mjs';

type Request = { reference?: PageReference; invalid?: boolean };
function currentRequest(): Request | null {
  try { const reference = parsePageLocation(location.pathname, location.search); return reference ? { reference } : null; }
  catch { return { invalid: true }; }
}
/** Routes consume the existing hydrated workspace. No route performs cloud I/O. */
export function usePageRoute(workspace: WorkspaceController, page: WritingDocument | undefined, onResolve: () => void, onRoot: () => void, onNavigate: () => void) {
  const [request, setRequest] = useState<Request | null>(currentRequest);
  const requestRef = useRef(request); requestRef.current = request;
  const callbacks = useRef({ onResolve, onRoot, onNavigate }); callbacks.current = { onResolve, onRoot, onNavigate };
  const selecting = useRef<Request | null>(null);
  const lastId = useRef<string | null>(null);
  const { state } = workspace;
  const target = request?.reference && state.documents.find(item => item.id === request.reference!.documentId);
  const hydrated = state.localOnly || state.cloudHydrated;
  const unavailable = request?.invalid || Boolean(hydrated && request && (!target || target.trashed || request.reference?.universeId && target.universeId !== request.reference.universeId));
  useEffect(() => {
    const pop = () => {
      callbacks.current.onNavigate();
      const next = currentRequest(); requestRef.current = next; setRequest(next);
      if (!next) { lastId.current = null; callbacks.current.onRoot(); }
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (!request || unavailable || !hydrated || !state.ready || !target || selecting.current === request) return;
    selecting.current = request;
    void workspace.selectDocument(target.id).then(() => {
      if (requestRef.current !== request) return;
      lastId.current = target.id; callbacks.current.onResolve();
      requestRef.current = null; setRequest(null);
    }).catch(() => {
      if (requestRef.current === request) setRequest({ invalid: true });
    }).finally(() => { if (selecting.current === request) selecting.current = null; });
  }, [request, unavailable, hydrated, state.ready, target, workspace]);
  useEffect(() => {
    if (!state.ready || request) return;
    const url = new URL(location.href);
    const path = page ? pagePath(page, state.collections.find(item => item.id === page.collectionId && item.universeId === page.universeId)?.name) : '/';
    url.searchParams.delete('page');
    const next = path + url.search;
    if (location.pathname + location.search !== next) {
      const replace = lastId.current === page?.id || lastId.current === null && location.pathname === '/';
      history[replace ? 'replaceState' : 'pushState'](null, '', next);
    }
    lastId.current = page?.id ?? null;
  }, [page, request, state.ready, state.collections]);
  return {
    blocked: Boolean(request),
    message: unavailable ? 'This page link is unavailable. It may be invalid, in Trash, or outside this workspace.' : state.error || !state.online ? 'The linked page cannot be checked yet. Reconnect and let your writing sync.' : 'Opening the linked page after your writing syncs…',
    cancel: () => { requestRef.current = null; setRequest(null); },
  };
}
