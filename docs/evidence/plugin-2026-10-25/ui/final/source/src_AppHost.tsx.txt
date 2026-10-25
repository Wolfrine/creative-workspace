import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import App from './App';
import { createCloudAdapter, initializeFirebaseSession, signInWithGoogle, signOutFirebase, verifyAuthorAccess, watchAuthorAccess } from './cloud/firebase';
import type { Session } from './domain/model';
import { useWorkspace } from './state/useWorkspace';
import './styles.css';
import Integrations from './components/Integrations';

function WritingWorkspace({ session }: { session: Session }) {
  const cloud = useMemo(() => session.localOnly ? null : createCloudAdapter(session.uid, session.workspaceId), [session.uid, session.workspaceId, session.localOnly]);
  const workspace = useWorkspace(session.uid, cloud);
  const protectedSession = { ...session, signOut: async () => { await workspace.flush(); await session.signOut(); } };
  return <App workspace={workspace} session={protectedSession} />;
}
export default function AppHost() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(location.hostname) && params.get('local') === '1') {
      const notebook = (params.get('notebook') || 'preview').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
      setSession({ uid: 'device-preview-' + notebook, displayName: 'Device preview', localOnly: true, signOut: async () => { location.assign(location.pathname); } });
      setLoading(false); return;
    }
    let disposed = false;
    let stop: (() => void) | undefined;
    void initializeFirebaseSession().then(client => {
      if (disposed) return;
      if (!client) { setLoading(false); return; }
      setConfigured(true);
      stop = onAuthStateChanged(client.auth, user => {
        setSession(null);
        if (!user) { setError(''); setLoading(false); return; }
        setLoading(true);
        void verifyAuthorAccess(user.uid).then(workspaceId => {
          if (disposed || client.auth.currentUser?.uid !== user.uid) return;
          setError('');
          setSession({ uid: user.uid, workspaceId, displayName: user.displayName || 'Author', localOnly: false, signOut: signOutFirebase });
          setLoading(false);
        }).catch(problem => { if (disposed || client.auth.currentUser?.uid !== user.uid) return; setSession(null); setError(problem instanceof Error ? problem.message : String(problem)); setLoading(false); });
      }, problem => { setError(problem.message); setLoading(false); });
    }).catch(problem => { setError(problem instanceof Error ? problem.message : String(problem)); setLoading(false); });
    return () => { disposed = true; stop?.(); };
  }, []);
  const signedInUid = session && !session.localOnly ? session.uid : undefined;
  useEffect(() => {
    if (!signedInUid) return;
    return watchAuthorAccess(signedInUid, workspaceId => {
      setSession(previous => previous?.uid === signedInUid && previous.workspaceId !== workspaceId ? { ...previous, workspaceId } : previous);
    }, problem => { setSession(null); setError(problem.message); setLoading(false); });
  }, [signedInUid]);
  const integrationRoute = location.pathname === '/connect' || location.pathname === '/connections';
  if (session) return integrationRoute ? <Integrations key={session.uid + ':' + (session.workspaceId ?? session.uid)} session={session} consent={location.pathname === '/connect'} /> : <WritingWorkspace key={session.uid + ':' + (session.workspaceId ?? session.uid)} session={session} />;
  return <main className="connection-gate">
    <div className="gate-wordmark">Noveliaa<span>✦</span></div>
    <div className="gate-rule" />
    <p className="eyebrow">{integrationRoute ? 'PRIVATE AUTHOR ACCESS' : 'A PLACE FOR YOUR WORDS'}</p>
    <h1>{integrationRoute ? <>Your words.<br />Your permission.</> : <>Your next world<br />begins with a line.</>}</h1>
    <p className="gate-copy">{integrationRoute ? 'Sign in as the author to choose AI access and review returned material. Nothing is shared before you choose.' : 'A private space to gather a thought, follow a connection, and stay with your writing.'}</p>
    {loading ? <p role="status">Opening your writing space…</p> : configured ? <>
      <button className="primary-button gate-button" onClick={() => { setError(''); void signInWithGoogle().then(setSession).catch(problem => setError(problem.message)); }}>Sign in with Google <span aria-hidden="true">↗</span></button>
      <p className="gate-footnote">Private author access. Your words stay yours.</p>
    </> : <div className="setup-notice" role="status"><strong>Private connection awaiting configuration</strong><p>The Firebase project and author access need to be connected before this installation can open a notebook. No writing has been created or sent.</p></div>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <footer>Capture freely. Keep every version. Find your way back.</footer>
  </main>;
}
