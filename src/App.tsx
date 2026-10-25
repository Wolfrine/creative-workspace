import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check, CheckCheck, Circle, ChevronDown, ChevronRight, CircleAlert, Cloud, CloudOff, Download, FileText, Folder, History, Inbox, Leaf, Link2, List, LoaderCircle, LogOut, Maximize2, Menu, Minimize2, Network, PanelRightClose, PanelRightOpen, Plus, Search, Settings2, ShieldCheck, Trash2, Upload, WifiOff, X } from 'lucide-react';
import type { Collection, Origin, RichNode, Session, WorkspaceController, WritingDocument } from './domain/model';
import { linkIds, wordCount } from './domain/model';
import Writer from './components/Writer';
import Modal from './components/Modal';
import RevisionComparison from './components/RevisionComparison';
import DocumentShelfRow from './components/DocumentShelfRow';
import Library, { CollectionActions } from './components/Library';
import Reader from './components/Reader';
import { readingSnapshot, validReadingScope, type ReadingScope, type ReadingSnapshot } from './reader/reading';
import './styles.css';

type View = 'writing' | 'inbox' | 'atlas' | 'trash' | 'library';
type Dialog = 'history' | 'conflicts' | 'data' | 'universe' | 'collection' | 'rename' | 'type' | 'source' | 'sync' | null;
const titleOf = (document: WritingDocument) => document.title || 'Untitled';
const dateOf = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const timeOf = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const preciseTimeOf = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
const originLabels = { author: 'Author writing', recovered_original: 'Recovered original', remembered_reconstruction: 'Remembered reconstruction', imported_chat: 'Imported conversation', ai: 'AI-origin · unverified', mixed: 'Mixed origin', unknown: 'Origin unverified' };
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
function safeName(value: string) { return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 90) || 'Untitled'; }
function preference(key: string, fallback: string) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }

export default function App({ workspace, session }: { workspace: WorkspaceController; session: Session }) {
  const { state } = workspace;
  const [view, setView] = useState<View>('writing');
  const [collection, setCollection] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [contextOpen, setContextOpen] = useState(() => window.matchMedia('(min-width: 1101px)').matches);
  const [mobileNav, setMobileNav] = useState(false);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width:650px)').matches);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [reading, setReading] = useState<ReadingSnapshot | null>(null);
  const [pinned, setPinned] = useState<string[]>(() => { try { const value = JSON.parse(preference(`noveliaa.pins.${session.uid}.${session.workspaceId || 'local'}`, '[]')); return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []; } catch { return []; } });
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [importOrigin, setImportOrigin] = useState<Origin>('unknown');
  const [busy, setBusy] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyDocumentId, setHistoryDocumentId] = useState<string | null>(null);
  const [pendingChoices, setPendingChoices] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const [fontSize, setFontSize] = useState(() => Math.max(16, Math.min(28, Number(preference('noveliaa.typeSize', '20')) || 20)));
  const [typeface, setTypeface] = useState(() => preference('noveliaa.typeface', 'serif'));
  const [spacing, setSpacing] = useState(() => Math.max(1.4, Math.min(2.2, Number(preference('noveliaa.lineHeight', '1.85')) || 1.85)));
  const [focusNew, setFocusNew] = useState<string | null>(null);
  const selections = useRef(new Map<string, { from: number; to: number }>());
  const scrollPositions = useRef(new Map<string, number>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const latestState = useRef(state);
  latestState.current = state;
  const linkCache = useRef(new WeakMap<RichNode, string[]>());
  const shelfOpenRef = useRef<(document: WritingDocument) => void>(() => {});
  const onShelfOpen = useCallback((document: WritingDocument) => shelfOpenRef.current(document), []);
  const documents = useMemo(() => state.documents.filter(d => d.universeId === state.activeUniverseId), [state.documents, state.activeUniverseId]);
  const liveDocuments = useMemo(() => documents.filter(d => !d.trashed), [documents]);
  const selectedDocument = documents.find(d => d.id === state.activeDocumentId && !d.trashed);
  const active = selectedDocument && (view === 'inbox' ? selectedDocument.collectionId === null : view === 'writing' && collection ? selectedDocument.collectionId === collection : true) ? selectedDocument : undefined;
  const conflictIds = state.conflictedDocumentIds ?? [];
  const activeConflicted = Boolean(active && conflictIds.includes(active.id));
  const otherConflictIds = conflictIds.filter(id => id !== active?.id);
  const conflictDocuments = state.documents.filter(document => conflictIds.includes(document.id));
  const historyDocument = historyDocumentId ? state.documents.find(document => document.id === historyDocumentId) : active;
  const historyConflicted = Boolean(historyDocument && conflictIds.includes(historyDocument.id));
  const universe = state.universes.find(u => u.id === state.activeUniverseId);
  const collections = state.collections.filter(c => c.universeId === state.activeUniverseId).sort((a, b) => a.order - b.order);
  const shortcutCollections = [...collections.filter(item => pinned.includes(item.id)), ...collections.filter(item => !pinned.includes(item.id)).slice(-3)].slice(0, 5);
  const activeWordCount = useMemo(() => wordCount(active?.plainText || ''), [active?.plainText]);
  const revisions = useMemo(() => state.revisions.filter(r => r.documentId === historyDocument?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.revisions, historyDocument?.id]);
  const selectedRevision = revisions.find(r => r.id === historyId) ?? revisions.find(r => r.id === historyDocument?.headRevisionId) ?? revisions[0];
  const selectedCurrent = Boolean(selectedRevision && selectedRevision.id === historyDocument?.headRevisionId);
  const cachedLinks = (body: RichNode) => { let result = linkCache.current.get(body); if (!result) { result = linkIds(body); linkCache.current.set(body, result); } return result; };
  const outgoingIds = active ? cachedLinks(active.body) : [];
  const outgoing = liveDocuments.filter(d => outgoingIds.includes(d.id));
  const incoming = active ? liveDocuments.filter(d => d.id !== active.id && cachedLinks(d.body).includes(active.id)) : [];
  const visibleDocuments = useMemo(() => documents.filter(d => view === 'trash' ? d.trashed : !d.trashed)
    .filter(d => searching || view === 'atlas' || (view === 'inbox' ? d.collectionId === null : !collection || d.collectionId === collection))
    .filter(d => !query || `${d.title}\n${d.plainText}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => a.order - b.order || b.updatedAt.localeCompare(a.updatedAt)), [documents, view, collection, query, searching]);
  const shelfDocuments = searching ? visibleDocuments : [...visibleDocuments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 7);

  useEffect(() => { if (searching) queryRef.current?.focus(); }, [searching]);
  useEffect(() => { if (dialog) setMobileNav(false); if (dialog === 'data') setImportOrigin('unknown'); }, [dialog]);
  useEffect(() => { const media = window.matchMedia('(max-width:650px)'); const change = () => setCompact(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  useEffect(() => { const media = window.matchMedia('(min-width: 1101px)'); const change = () => setContextOpen(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  useEffect(() => {
    if (!mobileNav || !compact) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    const available = () => [...(sidebar?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select') ?? [])].filter(element => element.getClientRects().length > 0);
    (searching ? queryRef.current : sidebar?.querySelector<HTMLElement>('.new-thought'))?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = available(); const first = elements[0]; const last = elements[elements.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !sidebar?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !sidebar?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [mobileNav, searching, compact]);
  useEffect(() => { try { localStorage.setItem('noveliaa.typeSize', String(fontSize)); localStorage.setItem('noveliaa.typeface', typeface); localStorage.setItem('noveliaa.lineHeight', String(spacing)); } catch { /* Optional display preferences must never block writing when storage is denied. */ } }, [fontSize, typeface, spacing]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearching(true); setMobileNav(true); }
      if (event.key === 'Escape') { setFocused(false); setMobileNav(false); document.querySelectorAll('.collection-actions[open],.library-row-menu[open]').forEach(element => element.removeAttribute('open')); }
    };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, []);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollPositions.current.get(state.activeDocumentId || '') || 0; }, [state.activeDocumentId, view]);
  useEffect(() => { const input = titleRef.current; if (input) { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; } }, [active?.title, active?.id, view]);
  useEffect(() => { if (dialog === 'history') document.querySelectorAll('.revision-texts').forEach(element => { element.scrollTop = 0; }); }, [historyId, compare, dialog]);
  useEffect(() => { setPendingChoices(previous => { const remaining = previous.filter(id => conflictIds.includes(id)); return remaining.length === previous.length ? previous : remaining; }); }, [state.conflictedDocumentIds]);
  useEffect(() => {
    const input = titleRef.current; if (!input?.parentElement) return;
    let width = 0; let alive = true;
    const fit = () => { if (alive) { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; } };
    const observer = new ResizeObserver(entries => { const next = entries[0]?.contentRect.width || 0; if (Math.abs(next - width) > 1) { width = next; fit(); } });
    observer.observe(input.parentElement);
    void document.fonts.ready.then(fit);
    return () => { alive = false; observer.disconnect(); };
  }, [active?.id, view]);

  const inform = (message: string, error = false) => { setNotice(message); setNoticeError(error); };
  const act = async (action: () => Promise<unknown>, success?: string) => { setBusy(true); inform(''); try { await action(); if (success) inform(success); } catch (error) { inform(error instanceof Error ? error.message : 'This action could not finish. Your writing remains available.', true); } finally { setBusy(false); } };
  const openDocument = async (id: string) => { await workspace.selectDocument(id); setView('writing'); setCollection(null); setMobileNav(false); setSearching(false); setQuery(''); };
  const openHistory = (id: string, compareVersions = false) => { setHistoryDocumentId(id); setHistoryId(null); setCompare(compareVersions); inform(''); setDialog('history'); void act(() => workspace.loadHistory()); };
  const confirmChoice = () => {
    if (!historyDocument || !selectedRevision) return;
    const documentId = historyDocument.id; const revisionId = selectedRevision.id;
    const wasConflicted = historyConflicted;
    void act(async () => {
      await workspace.restoreRevision(revisionId);
      if (wasConflicted) setPendingChoices(previous => previous.includes(documentId) ? previous : [...previous, documentId]);
      setHistoryId(null);
      await workspace.sync();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (latestState.current.error) return;
      if (latestState.current.conflictedDocumentIds.includes(documentId)) {
        inform('Your choice is saved on this device. Cloud confirmation is still pending; every version remains available.');
      } else {
        setDialog(null);
        inform(wasConflicted && !latestState.current.localOnly ? 'Your choice is confirmed by the cloud. Every earlier version remains in history.' : 'Writing restored as a new revision. Every earlier version remains in history.');
      }
    });
  };
  shelfOpenRef.current = document => { if (document.trashed) inform('Restore this page from Trash to continue writing.'); else void act(() => openDocument(document.id)); };
  const newDocument = () => act(async () => { const id = await workspace.createDocument({ collectionId: view === 'writing' || view === 'library' ? collection : null }); setFocusNew(id); setView('writing'); setMobileNav(false); setSearching(false); setQuery(''); });
  const navigate = (next: View, collectionId: string | null = null) => {
    if ((view === 'writing' || view === 'inbox') && next !== view) void act(() => workspace.flush());
    setView(next); setCollection(collectionId); setQuery(''); setSearching(false);
    if (next === 'atlas' || next === 'trash') setMobileNav(false);
    if (next === 'inbox' || next === 'writing') {
      const eligible = liveDocuments.filter(d => next === 'inbox' ? d.collectionId === null : !collectionId || d.collectionId === collectionId).sort((a, b) => a.order - b.order);
      if (!eligible.some(d => d.id === state.activeDocumentId) && eligible[0]) void act(() => workspace.selectDocument(eligible[0].id));
    }
  };
  const move = (direction: -1 | 1) => {
    if (!active) return;
    const ordered = [...liveDocuments].sort((a, b) => a.order - b.order || b.updatedAt.localeCompare(a.updatedAt));
    const index = ordered.findIndex(d => d.id === active.id); const target = ordered[index + direction]; if (!target) return;
    // Fractional positions avoid relying on dense or unique pre-existing order values.
    const position = direction === -1 ? (ordered[index - 2]?.order ?? target.order - 2) + (target.order - (ordered[index - 2]?.order ?? target.order - 2)) / 2 : target.order + ((ordered[index + 2]?.order ?? target.order + 2) - target.order) / 2;
    workspace.updateDocument(active.id, { order: position });
  };
  const rename = (item: Collection) => { setRenaming(item.id); setName(item.name); inform(''); setDialog('rename'); };
  const pin = (id: string) => { if (!pinned.includes(id) && pinned.length >= 5) { inform('You can pin five collection shortcuts. Unpin one to make room.'); return; } setPinned(previous => { const next = previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]; try { localStorage.setItem(`noveliaa.pins.${session.uid}.${session.workspaceId || 'local'}`, JSON.stringify(next)); } catch { /* Optional shortcut only. */ } return next; }); };
  const namedAction = async () => { const trimmed = name.trim(); if (!trimmed) return; await act(async () => { if (dialog === 'universe') await workspace.createUniverse(trimmed); else if (dialog === 'rename' && renaming) await workspace.renameCollection(renaming, trimmed); else await workspace.createCollection(trimmed); setDialog(null); setName(''); }); };
  const readerScopeKey = `noveliaa.reader.scope.${state.accountId}:${session.workspaceId || 'local'}:${state.activeUniverseId}`;
  const read = (items = active ? [active] : [], title = active ? titleOf(active) : 'Your writing', chosenScope?: ReadingScope) => { if (!items.length) { navigate('library'); return; } void act(async () => { await workspace.flush(); const currentItems = items.map(item => latestState.current.documents.find(document => document.id === item.id) || item).filter(item => !item.trashed && item.universeId === state.activeUniverseId); if (!currentItems.length) { navigate('library'); return; } const scope = chosenScope || { type: 'document', id: currentItems[0].id }; const snapshot = readingSnapshot(currentItems, title); snapshot.key = `${state.accountId}:${session.workspaceId || 'local'}:${state.activeUniverseId}:${scope.type}:${scope.id}`; try { localStorage.setItem(readerScopeKey, JSON.stringify(scope)); } catch { /* Only IDs are optional device preferences. */ } setReading(snapshot); setMobileNav(false); setFocused(false); }); };
  const resumeRead = () => { let scope: ReadingScope | null = null; try { scope = validReadingScope(JSON.parse(localStorage.getItem(readerScopeKey) || 'null')); } catch { /* Start with current writing when a preference is unavailable. */ } if (scope?.type === 'collection') { const currentCollection = collections.find(item => item.id === scope!.id); const items = liveDocuments.filter(item => item.collectionId === scope!.id).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)); if (currentCollection && items.length) { read(items, currentCollection.name, scope); return; } } else if (scope?.type === 'document') { const item = liveDocuments.find(document => document.id === scope!.id); if (item) { read([item], titleOf(item), scope); return; } } read(); };
  const leaveReader = (id?: string) => { setReading(null); if (id) void act(async () => { await openDocument(id); requestAnimationFrame(() => document.querySelector<HTMLElement>('.manuscript')?.focus()); }); };
  const exportArchive = () => act(async () => download(await workspace.exportArchive(), `Noveliaa-${new Date().toISOString().slice(0, 10)}.json`), 'Archive downloaded with all locally available writing and history. Keep a copy somewhere you trust.');
  const exportWriting = (format: 'txt' | 'html' | 'md') => active && act(async () => download(await workspace.exportDocument(active.id, format), `${safeName(titleOf(active))}.${format}`), 'Writing exported.');
  const pageSaveState = state.saveState === 'conflict' && !activeConflicted ? 'local' : state.saveState;
  const saveLabels = { waiting: 'Changes waiting for device save', local: state.localOnly ? 'Saved on this device' : 'Saved on this device; cloud save pending', syncing: 'Saving to cloud', synced: 'Synced', conflict: active && pendingChoices.includes(active.id) ? 'Choice awaiting sync' : 'Review this page', error: 'Save needs attention' };
  const SaveIcon = pageSaveState === 'synced' ? CheckCheck : pageSaveState === 'waiting' ? Circle : pageSaveState === 'syncing' ? Cloud : pageSaveState === 'error' || pageSaveState === 'conflict' ? CircleAlert : Check;
  const viewLabel = searching ? 'Search your writing' : view === 'library' ? 'Library' : view === 'inbox' ? 'Inbox' : view === 'atlas' ? 'Living Atlas' : view === 'trash' ? 'Recently set aside' : collection ? collections.find(c => c.id === collection)?.name || 'Writing' : 'All writing';
  const css = { '--prose-size': `${fontSize}px`, '--prose-leading': spacing, '--prose-font': typeface === 'serif' ? "'Literata Variable', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif" : "'DM Sans Variable', ui-sans-serif, system-ui, sans-serif" } as CSSProperties;

  if (!state.ready) return <div className="loading-screen" role="status"><Leaf size={25} strokeWidth={1.3} /><p>Opening your writing space…</p></div>;

  if (reading) return <Reader snapshot={reading} availableDocumentIds={liveDocuments.map(item => item.id)} onClose={() => leaveReader()} onEdit={id => leaveReader(id)} changed={reading.documents.some(item => { const current = state.documents.find(document => document.id === item.id); return !current || JSON.stringify(current.body) !== JSON.stringify(item.body) || current.title !== item.title; })} />;

  return <div className={`app ${focused ? 'is-focused' : ''} ${mobileNav ? 'nav-is-open' : ''}`} style={css}>
    <a href="#writing-area" className="skip-link">Skip to writing</a>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside ref={sidebarRef} className="sidebar" aria-label="Writing navigation" inert={compact && !mobileNav}>
      <a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('writing'); }}><span className="brand-mark"><Leaf size={23} strokeWidth={1.3} /></span>Noveliaa<span className="brand-dot">.</span></a>
      <div className="universe-picker"><label className="eyebrow" htmlFor="universe">YOUR WORKSPACE</label><div><select id="universe" aria-label="Story universe" value={state.activeUniverseId} onChange={event => act(() => workspace.selectUniverse(event.target.value))}>{state.universes.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><button className="icon-button" aria-label="New universe" title="New universe" onClick={() => { setName(''); setDialog('universe'); }}><Plus size={16} /></button></div></div>
      <button className="new-thought" onClick={newDocument} disabled={busy}><Plus size={18} />New thought<span className="new-thought-shortcut">↗</span></button>
      <nav className="main-nav">
        <button className={view === 'inbox' && !searching ? 'active' : ''} onClick={() => navigate('inbox')}><Inbox size={18} /><span>Inbox</span><small>{liveDocuments.filter(d => !d.collectionId).length || ''}</small></button>
        <button className={view === 'writing' && !collection && !searching ? 'active' : ''} onClick={() => navigate('writing')}><BookOpen size={18} /><span>Continue writing</span></button>
        <button className={view === 'library' ? 'active' : ''} onClick={() => { navigate('library'); setMobileNav(false); }}><Folder size={18} /><span>Library</span></button>
        <button className={view === 'atlas' && !searching ? 'active' : ''} onClick={() => navigate('atlas')}><Network size={18} /><span>Living Atlas</span></button>
        <button className={searching ? 'active' : ''} onClick={() => { setSearching(true); setQuery(''); }}><Search size={18} /><span>Search</span><kbd>⌘ K</kbd></button>
      </nav>
      <div className="collection-heading"><span className="eyebrow">COLLECTIONS</span><button className="icon-button" aria-label="New collection" onClick={() => { setName(''); setDialog('collection'); }}><Plus size={15} /></button></div>
      <nav className="collection-nav" aria-label="Collections">{shortcutCollections.map(c => <div className="collection-shortcut" key={c.id}><button className={collection === c.id ? 'active' : ''} onClick={() => { navigate('library', c.id); setMobileNav(false); }}><Folder size={15} /><span>{c.name}</span><small>{liveDocuments.filter(d => d.collectionId === c.id).length || ''}</small></button><CollectionActions collection={c} pinned={pinned.includes(c.id)} onPin={pin} onRename={rename} /></div>)}{!collections.length && <p className="collection-hint">Room to organize, when you're ready.</p>}{collections.length > shortcutCollections.length && <button className="all-collections" onClick={() => { navigate('library'); setMobileNav(false); }}>All collections<ArrowRight size={13} /></button>}</nav>
      <div className="document-shelf">
        <div className="shelf-heading"><span className="eyebrow">{view === 'trash' ? 'TRASH' : searching ? 'RESULTS' : collection ? 'IN THIS COLLECTION' : view === 'inbox' ? 'UNSORTED THOUGHTS' : 'YOUR PAGES'}</span><span>{visibleDocuments.length}</span></div>
        {searching && <label className="search-field shelf-search"><Search size={15} /><input ref={queryRef} aria-label="Search writing" placeholder="Title or a phrase…" value={query} onChange={event => setQuery(event.target.value)} /><button className="icon-button" aria-label="Close search" onClick={() => { setSearching(false); setQuery(''); }}><X size={14} /></button></label>}
        {searching && <p className="offline-coverage">Searches writing saved on this device, in this universe.</p>}
        <div className="document-list">{shelfDocuments.map(d => <DocumentShelfRow key={d.id} document={d} selected={active?.id === d.id} onOpen={onShelfOpen} />)}{!visibleDocuments.length && <p className="shelf-empty">{searching ? 'No matching pages in this universe.' : 'Nothing here yet.'}</p>}</div>{!searching && visibleDocuments.length > shelfDocuments.length && <button className="sidebar-library-link" onClick={() => { navigate('library', collection); setMobileNav(false); }}>Browse all {visibleDocuments.length} pages<ArrowRight size={13} /></button>}
      </div>
      <footer className="sidebar-footer"><div className="utility-nav"><button onClick={() => navigate('trash')} className={view === 'trash' ? 'active' : ''}><Trash2 size={16} />Trash</button><button onClick={() => setDialog('data')}><Download size={16} />Import & export</button></div><button className="account" onClick={() => setDialog('data')}><span className="avatar">{session.displayName?.slice(0, 1).toUpperCase() || 'N'}</span><span><strong>{session.displayName || 'Your workspace'}</strong><small>{session.localOnly ? 'Private on this device' : 'Private writing space'}</small></span><ShieldCheck size={16} /></button></footer>
    </aside>
    <div className="workspace" inert={mobileNav && compact}>
      {session.localOnly && <aside className="device-preview-note" aria-label="Device preview connection status"><CloudOff size={12} /><span>Device preview · cloud not connected</span><small>Saved in this browser only</small></aside>}
      <header className="workspace-header">
        <div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>{focused ? <span className="focus-label"><Leaf size={15} />Quiet Folio</span> : <><span className="breadcrumb-universe">{universe?.name || 'Your workspace'}</span><ChevronRight className="breadcrumb-chevron" size={14} /><span>{viewLabel}</span></>}</div>
        <div className="header-actions"><button type="button" className={`save-status icon-button status-${pageSaveState}`} aria-label={saveLabels[pageSaveState]} title={saveLabels[pageSaveState]} onClick={() => { inform(''); setDialog('sync'); }}><SaveIcon size={17} aria-hidden="true" /></button>{otherConflictIds.length > 0 && <button className="other-conflicts" aria-label={`Review ${otherConflictIds.length} other ${otherConflictIds.length === 1 ? 'page' : 'pages'} with saved versions`} title="Other pages have saved versions to review" onClick={() => { inform(''); setDialog('conflicts'); }}><History size={16} /><span>{otherConflictIds.length} to review</span><strong aria-hidden="true">{otherConflictIds.length}</strong></button>}{!state.online && <span className="offline-badge" title="Offline"><WifiOff size={14} /><span>Offline</span></span>}<button className="icon-button" aria-label={focused ? 'Leave focus mode' : 'Enter focus mode'} title={focused ? 'Leave focus mode · Esc' : 'Focus on writing'} onMouseDown={event => event.preventDefault()} onClick={() => setFocused(!focused)}>{focused ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button></div>
      </header>
      {(state.error || notice) && <div className={`notice ${state.error || noticeError ? 'notice-error' : ''}`} role={state.error || noticeError ? 'alert' : 'status'}><CircleAlert size={17} /><span>{state.error || notice}</span>{active && (state.error || noticeError) && <button className="notice-action" onClick={() => exportWriting('txt')}><Download size={14} />Export open text</button>}<button className="icon-button" aria-label="Dismiss message" onClick={() => { workspace.clearError(); inform(''); }}><X size={16} /></button></div>}
      {(state.collectionConflicts || []).map(conflict => <div className="collection-conflict-notice" key={conflict.collectionId} role="alert"><p>Another device also renamed this collection. Which name would you like?</p><div><button disabled={busy} onClick={() => act(() => workspace.resolveCollectionRename(conflict.collectionId, 'local'))}>Keep “{conflict.localName}”</button><button disabled={busy} onClick={() => act(() => workspace.resolveCollectionRename(conflict.collectionId, 'remote'))}>Use “{conflict.remoteName}”</button></div></div>)}
      {active && activeConflicted && <div className="conflict-notice" role="alert"><span>{pendingChoices.includes(active.id) ? 'Your choice is saved here. Cloud confirmation is still pending.' : 'This page has different saved versions. Choose the writing to keep.'}</span><button onClick={() => openHistory(active.id, true)}>Compare history<ArrowRight size={15} /></button></div>}
      <main id="writing-area" className="workspace-main" tabIndex={-1}>
        {view === 'library' ? <Library documents={liveDocuments} collections={collections} collectionId={collection} pinned={pinned} onPin={pin} onCollection={id => setCollection(id)} onOpen={id => void act(() => openDocument(id))} onRead={read} onRename={rename} onCreate={() => { setName(''); setDialog('collection'); }} onNew={newDocument} onMove={(id, collectionId) => workspace.updateDocument(id, { collectionId })} />
        : view === 'atlas' ? <section className="atlas-view"><div className="view-heading"><div><p className="eyebrow">THE THREADS BETWEEN YOUR PAGES</p><h1>Living Atlas<span>.</span></h1><p>Follow the connections you've made. Let your world take shape.</p></div><button className="secondary-button" onClick={newDocument}><Plus size={17} />New thought</button></div><div className="atlas-layout"><div className="atlas-map"><div className="map-caption"><Network size={15} />{active ? `Around “${titleOf(active)}”` : 'Your connections'}</div>{active ? <ConnectionMap document={active} outgoing={outgoing} incoming={incoming} onOpen={id => act(() => openDocument(id))} large /> : <div className="atlas-empty"><Network size={36} strokeWidth={1} /><h2>Connections begin with a page.</h2><p>Write a little, then link a passage to another thought.</p><button className="primary-button" onClick={newDocument}>Begin writing<ArrowRight size={16} /></button></div>}<div className="map-key"><span /><span>Explicit links in your writing</span></div></div><div className="atlas-index"><h2>Your pages</h2><p className="subtle">A list you can follow with a keyboard, too.</p>{liveDocuments.map(d => <button key={d.id} onClick={() => act(() => openDocument(d.id))}><FileText size={17} /><span><strong>{titleOf(d)}</strong><small>{linkIds(d.body).length} outgoing · {liveDocuments.filter(other => linkIds(other.body).includes(d.id)).length} backlinks</small></span><ArrowUpRight size={17} /></button>)}</div></div></section>
        : view === 'trash' ? <section className="library-view"><div className="view-heading"><div><p className="eyebrow">STILL RECOVERABLE</p><h1>Set aside, never lost<span>.</span></h1><p>Restore a page to continue where you left off. Its history stays with it.</p></div></div><div className="trash-list">{documents.filter(d => d.trashed).map(d => <article key={d.id}><FileText size={20} /><div><h2>{titleOf(d)}</h2><p>{d.plainText.slice(0, 140) || 'An unwritten thought'}</p><small>Last changed {dateOf(d.updatedAt)}</small></div><button className="secondary-button" onClick={() => { workspace.updateDocument(d.id, { trashed: false }); inform(`“${titleOf(d)}” restored to your writing.`); }}>Restore<History size={16} /></button></article>)}{!documents.some(d => d.trashed) && <div className="empty-trash"><Trash2 size={31} strokeWidth={1} /><h2>Nothing set aside.</h2><p>Pages moved to Trash remain recoverable here.</p><button className="text-button" onClick={() => navigate('writing')}>Back to writing<ArrowRight size={16} /></button></div>}</div></section>
        : active ? <div className={`writing-layout ${!contextOpen ? 'context-closed' : ''}`}>
          <section className="writing-pane" aria-label="Current writing">
            <h1 className="visually-hidden">{titleOf(active)}</h1>
            <div className="document-topline"><div className="document-location"><FileText size={14} /><CollectionPicker collections={collections} value={active.collectionId} onMove={collectionId => workspace.updateDocument(active.id, { collectionId })} /></div><div className="document-actions"><button className="icon-button" aria-label="Read this page" title="Read this page" onClick={() => read()}><BookOpen size={18} /></button><button className="icon-button" aria-label="Writing appearance" title="Writing appearance" onClick={() => setDialog('type')}><Settings2 size={17} /></button><button className="icon-button" aria-label="Revision history" title="Revision history" onClick={() => openHistory(active.id)}><History size={18} /></button><button className="icon-button" aria-label={contextOpen ? 'Hide connections' : 'Show connections'} title={contextOpen ? 'Hide connections' : 'Show connections'} onClick={() => setContextOpen(!contextOpen)}>{contextOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}</button></div></div>
            <div ref={scrollRef} className="manuscript-scroll" onScroll={event => scrollPositions.current.set(active.id, event.currentTarget.scrollTop)}>
              <div className="manuscript-page"><div className="page-kicker"><span>{collections.find(c => c.id === active.collectionId)?.name || 'A THOUGHT IN PROGRESS'}</span><span className="page-rule" /></div><textarea ref={titleRef} className="manuscript-title" rows={1} aria-label="Writing title" placeholder="Untitled" value={active.title} onChange={event => workspace.updateDocument(active.id, { title: event.target.value.replace(/\n/g, ' ') })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); document.querySelector<HTMLElement>('.manuscript')?.focus(); } }} />
                <Writer key={active.id} document={active} documents={liveDocuments} selections={selections.current} focusMode={focused} focusOnMount={focusNew === active.id} onAutoFocused={() => setFocusNew(null)} onChange={body => workspace.updateDocument(active.id, { body })} onNavigate={id => { if (liveDocuments.some(d => d.id === id)) void act(() => openDocument(id)); else inform('That linked page is in Trash or is unavailable in this universe.'); }} />
              </div>
            </div>
            <footer className="writing-footer"><span>{activeWordCount.toLocaleString()} {activeWordCount === 1 ? 'word' : 'words'}</span><button onClick={() => setDialog('source')} className="origin-button"><ShieldCheck size={13} />{originLabels[active.origin]}</button><span className="footer-right">{state.localOnly ? <><CloudOff size={13} />On this device</> : <><Cloud size={13} />Private workspace</>}</span></footer>
          </section>
          {contextOpen && <aside className="context-panel" aria-label="Writing context"><header><div><Leaf size={16} /><h2>Connections</h2></div><button className="icon-button" aria-label="Close connections" onClick={() => setContextOpen(false)}><X size={17} /></button></header><div className="context-scroll"><p className="context-intro">A little context. Room to wander.</p><ConnectionMap document={active} outgoing={outgoing} incoming={incoming} onOpen={id => act(() => openDocument(id))} /><section className="linked-section"><div className="section-label"><h3>LINKED FROM THIS PAGE</h3><span>{outgoing.length}</span></div>{outgoing.map(d => <button className="context-note" key={d.id} onClick={() => act(() => openDocument(d.id))}><span><FileText size={15} /><strong>{titleOf(d)}</strong><ArrowUpRight size={15} /></span><p>{d.plainText.slice(0, 145) || 'A thought waiting to be written.'}</p></button>)}{!outgoing.length && <p className="connection-empty">Link a word or passage to another page with <Link2 size={13} /> in the editor.</p>}</section><section className="linked-section"><div className="section-label"><h3>BACKLINKS</h3><span>{incoming.length}</span></div>{incoming.map(d => <button className="backlink-row" key={d.id} onClick={() => act(() => openDocument(d.id))}><FileText size={14} /><span>{titleOf(d)}</span><ArrowUpRight size={14} /></button>)}{!incoming.length && <p className="connection-empty">Pages that link here will appear here.</p>}</section><button className="atlas-open" onClick={() => navigate('atlas')}><Network size={16} />Explore Living Atlas<ArrowRight size={15} /></button><div className="page-tools"><span className="eyebrow">THIS PAGE</span><div><button onClick={() => move(-1)}><ArrowUp size={14} />Move earlier</button><button onClick={() => move(1)}><ArrowDown size={14} />Move later</button><button onClick={() => { workspace.updateDocument(active.id, { trashed: true }); inform('Page moved to Trash. Its writing and history are preserved.'); }}><Trash2 size={14} />Move to Trash</button></div></div></div><footer><ShieldCheck size={14} /><span>Your words. Your world.</span></footer></aside>}
        </div>
        : <section className="first-page"><div className="first-page-line" /><Leaf size={30} strokeWidth={1.1} /><p className="eyebrow">NO NEED TO KNOW WHERE IT GOES YET</p><h1>A place for<br />the first line<span>.</span></h1><p>A scene, a passing thought, a world taking shape.<br />Start with the words. The rest can come later.</p><button className="primary-button" onClick={newDocument}><Plus size={18} />Begin writing</button><button className="text-button" onClick={() => setDialog('data')}><Upload size={15} />Bring something you've written</button><div className="first-page-note"><ShieldCheck size={15} />Private, recoverable, and always yours.</div></section>}
      </main>
      <nav className="mobile-bottom" aria-label="Quick navigation"><button className={view === 'inbox' ? 'active' : ''} onClick={() => { navigate('inbox'); setMobileNav(true); }}><Inbox size={19} /><span>Inbox</span></button><button className={view === 'library' ? 'active' : ''} onClick={() => { navigate('library'); setMobileNav(false); }}><Folder size={19} /><span>Library</span></button><button className="mobile-new" aria-label="New thought" onClick={newDocument}><Plus size={22} /></button><button className={view === 'atlas' ? 'active' : ''} onClick={() => navigate('atlas')}><Network size={19} /><span>Atlas</span></button><button onClick={resumeRead}><BookOpen size={19} /><span>Read</span></button></nav>
    </div>

    {dialog === 'conflicts' && <Modal title="Pages to review" onClose={() => setDialog(null)} message={state.error || notice} messageError={Boolean(state.error) || noticeError}>
      <div className="conflict-pages"><p className="dialog-intro">These pages have different saved versions. Open a page's own history to choose the writing to keep. Every earlier version stays available.</p>
        <div className="conflict-page-list">{conflictDocuments.map(document => <button key={document.id} onClick={() => openHistory(document.id, true)}><FileText size={18} /><span><strong>{titleOf(document)}</strong><small>{state.universes.find(u => u.id === document.universeId)?.name || 'Story universe'}{document.trashed ? ' · In Trash' : ''}{pendingChoices.includes(document.id) ? ' · Choice awaiting sync' : ''}</small></span><ArrowRight size={17} /></button>)}</div>
        {conflictIds.length > conflictDocuments.length && <p className="conflict-retrieving">A page is still being retrieved. Check cloud sync to load its history.</p>}
        {!conflictIds.length && <p className="quiet-empty">Every page's saved versions have been reviewed.</p>}
        <button className="secondary-button" disabled={busy || !state.online || state.localOnly} onClick={() => act(() => workspace.sync())}><Cloud size={16} />Check cloud sync</button>
      </div>
    </Modal>}
    {dialog === 'history' && <Modal title="Your writing history" wide onClose={() => setDialog(null)} message={state.error || notice} messageError={Boolean(state.error) || noticeError}>
      <p className="dialog-intro">Every saved version is a way back. Restoring creates a new revision and keeps the versions in between.</p>
      <p className="history-page-context"><FileText size={14} /><strong>{historyDocument ? titleOf(historyDocument) : 'Page unavailable'}</strong><span>{state.universes.find(u => u.id === historyDocument?.universeId)?.name}{historyDocument?.trashed ? ' · In Trash' : ''}</span></p>
      <div className="history-layout">
        {compact && <div className="mobile-revision-controls"><label><span className="visually-hidden">Saved revision</span><select aria-label="Saved revision" value={selectedRevision?.id || ''} onChange={event => setHistoryId(event.target.value)}>{revisions.map((revision, index) => <option key={revision.id} value={revision.id}>{revision.id === historyDocument?.headRevisionId ? 'Current' : `Version ${revisions.length - index}`} · {wordCount(revision.snapshot.plainText)} words · {new Date(revision.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</option>)}</select></label><label className="check-label"><input type="checkbox" aria-label="Compare current" checked={compare} onChange={event => setCompare(event.target.checked)} />Compare</label></div>}
        <nav className="revision-list" aria-label="Saved revisions">{revisions.map((revision, index) => <button key={revision.id} className={selectedRevision?.id === revision.id ? 'selected' : ''} onClick={() => setHistoryId(revision.id)}><History size={15} /><span><strong>{preciseTimeOf(revision.createdAt)}</strong><small>{revision.id === historyDocument?.headRevisionId ? 'Current version' : revision.restoredFrom ? 'Restored version' : `Saved version ${revisions.length - index}`} · {wordCount(revision.snapshot.plainText)} words</small><em className="revision-excerpt">{revision.snapshot.plainText.replace(/\s+/g, ' ').slice(0, 74) || 'Blank page'}</em></span></button>)}</nav>
        <div className="revision-preview">{selectedRevision && historyDocument ? <>
          <div className="revision-heading"><div><h3 title={selectedRevision.snapshot.title || 'Untitled'}>{selectedRevision.snapshot.title || 'Untitled'}</h3><small>{preciseTimeOf(selectedRevision.createdAt)} · {wordCount(selectedRevision.snapshot.plainText)} words{selectedCurrent ? ' · Current writing' : ''}</small></div>{!compact && <label className="check-label"><input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)} />Compare current</label>}</div>
          {compare ? <RevisionComparison selected={selectedRevision.snapshot.plainText} current={historyDocument.plainText} differences={[...(selectedRevision.snapshot.title !== historyDocument.title ? ['The titles differ.'] : []), ...(JSON.stringify(selectedRevision.snapshot.body) !== JSON.stringify(historyDocument.body) && selectedRevision.snapshot.plainText === historyDocument.plainText ? ['The saved formatting differs.'] : []), ...(selectedRevision.snapshot.collectionId !== historyDocument.collectionId ? ['The collection differs.'] : [])]} /> : <div className="revision-texts"><div><pre className="revision-prose">{selectedRevision.snapshot.plainText || 'This version is a blank page.'}</pre></div></div>}
          <div className="revision-bottom"><code title="Saved content fingerprint">{selectedRevision.contentHash.slice(0, 18)}…</code><button className="primary-button" disabled={busy || selectedCurrent && !historyConflicted} onClick={confirmChoice}>{busy ? <LoaderCircle size={16} className="spin" /> : selectedCurrent && historyConflicted ? <Check size={16} /> : <History size={16} />}{selectedCurrent && historyConflicted ? 'Keep current writing' : 'Restore this version'}</button></div>
        </> : <p className="quiet-empty">{historyDocument ? 'Your first saved checkpoint will appear here.' : 'This page is unavailable in this workspace. Close history and check cloud sync.'}</p>}</div>
      </div>
    </Modal>}
    {(dialog === 'universe' || dialog === 'collection' || dialog === 'rename') && <Modal title={dialog === 'universe' ? 'A new story universe' : dialog === 'rename' ? 'A new name, the same collection' : 'A collection for your writing'} onClose={() => setDialog(null)} message={state.error || notice} messageError={Boolean(state.error) || noticeError}><form className="name-form" onSubmit={event => { event.preventDefault(); void namedAction(); }}><p className="dialog-intro">{dialog === 'universe' ? 'A separate home for a different world. Writing and search stay within each universe.' : dialog === 'rename' ? 'Your pages, links and writing history stay together.' : 'Give a few pages a home. You can move writing in or out whenever you like.'}</p><label>{dialog === 'universe' ? 'Universe name' : 'Collection name'}<input autoFocus maxLength={100} value={name} onFocus={event => { if (dialog === 'rename') event.currentTarget.select(); }} onChange={event => setName(event.target.value)} placeholder={dialog === 'universe' ? 'A world of your own' : 'Scenes, fragments, places…'} /></label><button className="primary-button" type="submit" disabled={!name.trim() || busy}>{dialog === 'rename' ? <Check size={16} /> : <Plus size={16} />}{dialog === 'universe' ? 'Create universe' : dialog === 'rename' ? 'Save name' : 'Create collection'}</button></form></Modal>}
    {dialog === 'type' && <Modal title="Make room for your words" onClose={() => setDialog(null)} message={state.error || notice} messageError={Boolean(state.error) || noticeError}><div className="type-settings"><label>Typeface<select value={typeface} onChange={event => setTypeface(event.target.value)}><option value="serif">Literary serif</option><option value="sans">Clear sans serif</option></select></label><label>Text size <span>{fontSize}px</span><input type="range" min="16" max="28" step="1" value={fontSize} onChange={event => setFontSize(Number(event.target.value))} /></label><label>Line spacing <span>{spacing.toFixed(2)}</span><input type="range" min="1.4" max="2.2" step="0.05" value={spacing} onChange={event => setSpacing(Number(event.target.value))} /></label><p className="type-sample">A line becomes a thought.<br />A thought becomes a world.</p><p className="subtle">These reading preferences stay on this device. Your writing is unchanged.</p></div></Modal>}
    {dialog === 'source' && active && <Modal title="Where this writing began" onClose={() => setDialog(null)} message={state.error || notice} messageError={Boolean(state.error) || noticeError}><div className="source-details"><p className="source-origin"><ShieldCheck size={18} />{originLabels[active.origin]}</p><dl><dt>Created</dt><dd>{timeOf(active.createdAt)}</dd><dt>Last changed</dt><dd>{timeOf(active.updatedAt)}</dd><dt>Document identity</dt><dd><code>{active.id}</code></dd></dl><p className="dialog-intro">Writing changes are kept as revisions. Restoring a version preserves the path you took to get here.</p>{active.sourceOriginalIds.map(id => state.originals.find(o => o.id === id)).filter(Boolean).map(original => original && <article className="original-record" key={original.id}><strong>{original.name}</strong><span>{original.verification} · {originLabels[original.origin]}</span><code>SHA-256 {original.sha256}</code>{original.sourceReference && <p>{original.sourceReference}</p>}{original.speakerSegments && <details className="source-role-map"><summary>Imported speaker attribution</summary><p>Explicit labels from the source. They do not establish authorship or verification. Positions use UTF-16 source characters.</p><ul>{original.speakerSegments.map((segment, index) => <li key={index}><strong>{segment.role === 'assistant' ? 'Assistant · unverified' : segment.role === 'user' ? 'User-labeled turn' : 'Unknown speaker'}</strong><span>{segment.start}–{segment.end}</span></li>)}</ul></details>}<button className="secondary-button" onClick={() => { const raw = atob(original.bytesBase64); download(new Blob([Uint8Array.from(raw, character => character.charCodeAt(0))]), original.name); }}><Download size={15} />Download exact original</button></article>)}</div></Modal>}
    {dialog === 'sync' && <Modal title="Writing sync" onClose={() => setDialog(null)} message={state.error || notice} messageError={Boolean(state.error) || noticeError}><div className="sync-details"><p className="sync-detail-state">{saveLabels[pageSaveState]}</p><p>Writing saves on this device after 10 seconds without an edit. Cloud saving starts after 60 seconds without an edit.</p><p>Leaving the page or putting the app in the background saves a device recovery copy. Cloud saving keeps its one-minute pause.</p>{!state.online && <p>Offline. Your device copy will wait for a connection.</p>}<button className="secondary-button" disabled={!state.online || busy || state.localOnly} onClick={() => act(() => workspace.sync(), 'Cloud synchronization checked.')}><Cloud size={16} />Sync now</button></div></Modal>}
    {dialog === 'data' && <Modal title="Your writing, in your hands" onClose={() => setDialog(null)} message={state.error || notice} messageError={Boolean(state.error) || noticeError}><div className="data-tools"><p className="dialog-intro">Keep a complete copy, bring in an original, or take a single page with you.</p><section><h3><Download size={18} />Keep a complete archive</h3><p>All locally available universes, pages, saved revisions, links and exact imported originals. Fetches cloud history when available and includes work waiting to sync.</p><button className="primary-button" onClick={exportArchive} disabled={busy}><Download size={16} />Download workspace archive</button></section>{active && <section><h3>Export “{titleOf(active)}”</h3><div className="export-formats"><button className="secondary-button" onClick={() => exportWriting('txt')}>Plain text</button><button className="secondary-button" onClick={() => exportWriting('md')}>Markdown</button><button className="secondary-button" onClick={() => exportWriting('html')}>HTML</button></div></section>}<section><h3><Upload size={18} />Bring your writing here</h3><p>Text and Markdown become an editable page. The original file is preserved byte for byte; its origin remains unverified.</p><label className="import-origin">Origin of this file<select value={importOrigin} onChange={event => setImportOrigin(event.target.value as Origin)}><option value="unknown">Unknown / not yet reviewed</option><option value="recovered_original">Recovered original writing</option><option value="remembered_reconstruction">Remembered reconstruction</option><option value="imported_chat">Imported conversation</option><option value="ai">AI-generated material</option><option value="mixed">Mixed origins</option></select></label><p className="origin-explanation">This label does not verify or approve the material. Exact original bytes are preserved.</p><label className="secondary-button file-button"><Upload size={16} />Import text or Markdown<input type="file" accept=".txt,.md,.markdown,.log,text/plain,text/markdown" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void act(async () => { const id = await workspace.importText(file, importOrigin); await openDocument(id); setDialog(null); inform('Writing imported. The exact original is preserved in page provenance.'); }); event.target.value = ''; }} /></label><div className="restore-guidance"><strong>Full restore needs an empty workspace</strong><p>Existing writing is never overwritten by an archive. To recover a page here, use its revision history.</p></div><label className="archive-import file-button"><History size={16} />Restore a Noveliaa archive<input type="file" accept=".json,application/json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void act(async () => { await workspace.importArchive(file); setDialog(null); inform('Archive restored. Original records and revision history are preserved.'); }); event.target.value = ''; }} /></label><small className="subtle">Archive restoration validates its format and integrity before changing this workspace.</small></section><section className="session-section"><div><ShieldCheck size={17} /><span>{state.localOnly ? 'This session is saved on this browser and device.' : 'Your account has a private, separate writing store on this device.'}</span></div><p>Export before clearing browser data. Downloaded copies remain wherever you keep them.</p>{!state.localOnly && state.pendingCount > 0 && <p className="pending-session-note">{state.pendingCount} saved {state.pendingCount === 1 ? 'revision is' : 'revisions are'} waiting for cloud sync. Export an archive before switching devices. Signing out keeps this account's private copy on this browser.</p>}{!state.localOnly && <button className="secondary-button" onClick={() => act(async () => { await workspace.flush(); await session.signOut(); })}><LogOut size={16} />Save & sign out</button>}<button className="text-button" disabled={!state.online || busy || state.localOnly} onClick={() => act(() => workspace.sync(), 'Cloud synchronization checked.')}><Cloud size={15} />Check cloud sync</button></section></div></Modal>}
  </div>;
}

function ConnectionMap({ document: current, outgoing, incoming, onOpen, large = false }: { document: WritingDocument; outgoing: WritingDocument[]; incoming: WritingDocument[]; onOpen(id: string): void; large?: boolean }) {
  const connections = [...outgoing, ...incoming.filter(d => !outgoing.some(target => target.id === d.id))].slice(0, 4);
  return <div className={`connection-map ${large ? 'large-map' : ''} ${connections.length ? '' : 'empty-map'}`} aria-label={`Explicit connections around ${titleOf(current)}`}>
    {connections.length > 0 && <svg className="connection-lines" viewBox="0 0 300 240" preserveAspectRatio="none" aria-hidden="true">{connections.map((target, index) => <path key={target.id} d={`M 150 60 C 150 112 ${connections.length === 1 ? 150 : index % 2 ? 225 : 75} 112 ${connections.length === 1 ? 150 : index % 2 ? 225 : 75} ${index < 2 ? 155 : 218}`} />)}</svg>}
    <div className="map-center"><FileText size={16} /><span>{titleOf(current)}</span><small>THIS PAGE</small></div>
    {connections.length > 0 ? <div className={`map-nodes nodes-${connections.length}`}>{connections.map(target => <button className="map-node" key={target.id} onClick={() => onOpen(target.id)}><span className="map-dot" /><FileText size={14} /><strong>{titleOf(target)}</strong><small>{outgoing.some(d => d.id === target.id) ? 'Linked page' : 'Links here'}</small></button>)}</div> : <p className="map-first-link"><span />The first thread starts with a link.</p>}
    {outgoing.length + incoming.filter(d => !outgoing.some(target => target.id === d.id)).length > 4 && <span className="map-more">More connections in the list below</span>}
  </div>;
}

function CollectionPicker({ collections, value, onMove }: { collections: Collection[]; value: string | null; onMove(id: string | null): void }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const options = [{ id: '', name: 'Inbox · unsorted' }, ...collections];
  const selected = Math.max(0, options.findIndex(option => option.id === (value || '')));
  useEffect(() => { setCursor(selected); setOpen(false); }, [value, selected]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const media = window.matchMedia('(max-width:650px)');
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', outside); media.addEventListener('change', close);
    return () => { document.removeEventListener('pointerdown', outside); media.removeEventListener('change', close); };
  }, [open]);
  useEffect(() => { if (open) document.getElementById(`${id}-option-${cursor}`)?.scrollIntoView({ block: 'nearest' }); }, [cursor, open, id]);
  const choose = (index: number) => { const option = options[index]; if (option && option.id !== (value || '')) onMove(option.id || null); setOpen(false); trigger.current?.focus(); };
  return <div className="collection-picker" ref={ref}>
    <button ref={trigger} className="collection-trigger" type="button" role="combobox" aria-label="Move writing to collection" aria-describedby={`${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-option-${cursor}` : undefined} onClick={() => { setCursor(selected); setOpen(!open); }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setCursor(previous => open ? (previous + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : selected); setOpen(true); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setCursor(event.key === 'Home' ? 0 : options.length - 1); setOpen(true); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (open) choose(cursor); else { setCursor(selected); setOpen(true); } }
      else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      else if (event.key === 'Tab') setOpen(false);
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); const at = performance.now();
        const text = (at - typed.current.at < 800 ? typed.current.text : '') + event.key.toLocaleLowerCase();
        typed.current = { text, at };
        const start = open ? cursor + 1 : selected;
        const indices = options.map((_, index) => (start + index) % options.length);
        const match = indices.find(index => options[index].name.toLocaleLowerCase().startsWith(text));
        if (match !== undefined) setCursor(match); setOpen(true);
      }
    }}><span id={`${id}-value`}>{options[selected]?.name}</span><ChevronDown size={13} aria-hidden="true" /></button>
    <select className="collection-native" aria-label="Move writing to collection" value={value || ''} onChange={event => onMove(event.target.value || null)}>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
    {open && <div id={`${id}-list`} className="collection-options" role="listbox" aria-label="Collections"><p aria-hidden="true">MOVE THIS PAGE</p>{options.map((option, index) => <button id={`${id}-option-${index}`} type="button" key={option.id} role="option" aria-selected={selected === index} className={`${cursor === index ? 'is-highlighted' : ''} ${selected === index ? 'is-selected' : ''}`} tabIndex={-1} onPointerMove={() => setCursor(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>{option.id ? <Folder size={15} aria-hidden="true" /> : <Inbox size={15} aria-hidden="true" />}<span>{option.name}</span>{selected === index && <Check size={15} aria-hidden="true" />}</button>)}</div>}
  </div>;
}
