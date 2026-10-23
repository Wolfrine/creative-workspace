import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { CloudAdapter, WorkspaceController } from '../domain/model';
import { WritingEngine } from './engine';

export function useWorkspace(accountId: string, cloud: CloudAdapter | null): WorkspaceController {
  const engine = useMemo(() => new WritingEngine(accountId, cloud), [accountId, cloud]);
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  useEffect(() => {
    void engine.initialize();
    // Compiled out of production. Browser tests exercise the real device engine,
    // with no access to a Firebase project or any author's notebook.
    if (import.meta.env.DEV && !cloud && ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('local') === '1') {
      (window as unknown as { __NOVELIAA_TEST__?: WritingEngine }).__NOVELIAA_TEST__ = engine;
    }
    return () => { void engine.flush().finally(() => engine.dispose()); };
  }, [engine, cloud]);
  return useMemo(() => ({ state, createDocument: engine.createDocument.bind(engine), updateDocument: engine.updateDocument.bind(engine), selectDocument: engine.selectDocument.bind(engine), createUniverse: engine.createUniverse.bind(engine), selectUniverse: engine.selectUniverse.bind(engine), createCollection: engine.createCollection.bind(engine), restoreRevision: engine.restoreRevision.bind(engine), sync: engine.sync, flush: engine.flush.bind(engine), exportArchive: engine.exportArchive.bind(engine), importArchive: engine.importArchive.bind(engine), importText: engine.importText.bind(engine), exportDocument: engine.exportDocument.bind(engine), clearError: engine.clearError }), [state, engine]);
}
