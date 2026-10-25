import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, FileText, Folder, Inbox, LayoutGrid, List, ListTree, MoreHorizontal, Pencil, Pin, Plus, Search, ShieldCheck } from 'lucide-react';
import type { Collection, WritingDocument } from '../domain/model';
import { wordCount } from '../domain/model';
import { readerOrigin, type ReadingScope } from '../reader/reading';

type Layout = 'tile' | 'list' | 'detailed';
export type LibraryTab = 'pages' | 'collections';
interface Props {
  documents: WritingDocument[]; collections: Collection[]; collectionId: string | null;
  preferenceScope: string; universeName: string; tab: LibraryTab; onTab(tab: LibraryTab): void;
  pinned: string[]; onPin(id: string): void; onCollection(id: string | null): void;
  onOpen(id: string): void; onRead(documents: WritingDocument[], title: string, scope?: ReadingScope): void;
  onRename(collection: Collection): void; onCreate(): void;
  onMove(id: string, collectionId: string | null): void;
}
function savedLayout(key: string): Layout { try { const value = localStorage.getItem(key); return value === 'tile' || value === 'detailed' ? value : 'list'; } catch { return 'list'; } }
const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function Library({ documents, collections, collectionId, preferenceScope, universeName, tab, onTab, pinned, onPin, onCollection, onOpen, onRead, onRename, onCreate, onMove }: Props) {
  const preferenceKey = `noveliaa.library.view.${preferenceScope}`;
  const [layout, setLayout] = useState<Layout>(() => savedLayout(preferenceKey));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState(collectionId ? 'manual' : 'recent');
  const current = collections.find(item => item.id === collectionId);
  const authored = useMemo(() => documents.filter(item => !current || item.collectionId === current.id).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)), [documents, current]);
  const effectiveSort = sort;
  useEffect(() => { setQuery(''); setFilter('all'); setSort(collectionId ? 'manual' : 'recent'); }, [collectionId]);
  const visible = useMemo(() => authored.filter(item => filter === 'all' || (filter === 'inbox' ? !item.collectionId : item.collectionId === filter))
    .filter(item => !query || `${item.title}\n${item.plainText}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => effectiveSort === 'title' ? (a.title || 'Untitled').localeCompare(b.title || 'Untitled') : effectiveSort === 'manual' ? a.order - b.order : b.updatedAt.localeCompare(a.updatedAt)), [authored, filter, query, effectiveSort]);
  const collectionPages = useMemo(() => new Map(collections.map(item => [item.id, documents.filter(document => document.collectionId === item.id).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))])), [documents, collections]);
  const shownCollections = collections.filter(item => !query || item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const showingCollections = tab === 'collections' && !current;
  const changeCollection = (id: string | null) => { setQuery(''); setFilter('all'); setSort(id ? 'manual' : 'recent'); if (!id) onTab('collections'); onCollection(id); };
  const changeLayout = (value: Layout) => { setLayout(value); try { localStorage.setItem(preferenceKey, value); } catch { /* Optional display preference, never manuscript data. */ } };
  return <section className={`library-workspace library-layout-${layout}`} aria-label="Writing library" data-layout={layout}>
    <div className="library-masthead">
      <div>{current ? <button className="library-back" onClick={() => changeCollection(null)}><ArrowLeft size={15} />Collections</button> : <p className="eyebrow">{universeName}</p>}
        <h1>{current?.name || 'Your library'}<span>.</span></h1>
        <p>{current ? `${authored.length} ${authored.length === 1 ? 'page' : 'pages'} · Read in author order.` : 'Thoughts, scenes and chapters are all pages. Gather them when it helps.'}</p>
      </div>
      <div className="library-heading-actions">{current ? <><button className="secondary-button" onClick={() => onRename(current)}><Pencil size={15} />Rename</button><button className="primary-button" disabled={!authored.length} onClick={() => onRead(authored, current.name, { type: 'collection', id: current.id })}><BookOpen size={16} />Read collection</button></> : showingCollections && <button className="primary-button" onClick={onCreate}><Plus size={16} />New collection</button>}</div>
    </div>
    {!current && <div className="library-tabs" aria-label="Library views"><button aria-pressed={tab === 'pages'} onClick={() => { onTab('pages'); setQuery(''); }}><FileText size={16} />Pages<span>{documents.length}</span></button><button aria-pressed={tab === 'collections'} onClick={() => { onTab('collections'); setQuery(''); }}><Folder size={16} />Collections<span>{collections.length}</span></button></div>}
    <div className="library-toolbar"><label className="library-search"><Search size={17} /><input aria-label={showingCollections ? 'Search collections' : 'Search library'} placeholder={showingCollections ? 'Find a collection…' : 'Find a title or a phrase…'} value={query} onChange={event => setQuery(event.target.value)} /></label>
      {!showingCollections && <div className="library-filters">{!current && <select aria-label="Filter library by collection" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All collections</option><option value="inbox">Inbox</option>{collections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}<select aria-label="Sort library" value={effectiveSort} onChange={event => setSort(event.target.value)}><option value="recent">Recently changed</option><option value="title">Title A–Z</option><option value="manual">Author order</option></select></div>}
      <div className="library-layout-switch" role="group" aria-label="Library display"><button aria-label="Tile view" title="Tile view" aria-pressed={layout === 'tile'} onClick={() => changeLayout('tile')}><LayoutGrid size={17} /></button><button aria-label="List view" title="List view" aria-pressed={layout === 'list'} onClick={() => changeLayout('list')}><List size={18} /></button><button aria-label="Detailed view" title="Detailed view" aria-pressed={layout === 'detailed'} onClick={() => changeLayout('detailed')}><ListTree size={18} /></button></div>
    </div>
    {showingCollections ? <div className="collection-grid">{shownCollections.map(item => { const pages = collectionPages.get(item.id) || []; return <article className="collection-card" key={item.id}><div className="collection-card-top"><Folder size={24} strokeWidth={1.2} /><CollectionActions collection={item} pinned={pinned.includes(item.id)} onPin={onPin} onRename={onRename} /></div><button className="collection-card-open" onClick={() => changeCollection(item.id)}><h2>{item.name}</h2><p>{pages.length} {pages.length === 1 ? 'page' : 'pages'}<span>{wordCount(pages.map(page => page.plainText).join(' ')).toLocaleString()} words</span></p>{layout !== 'list' && <span className="collection-preview">{pages.slice(0, 3).map(page => <span key={page.id}>{page.title || 'Untitled'}</span>)}{!pages.length && <span>No pages yet.</span>}</span>}<span className="collection-enter">Open collection<ArrowRight size={16} /></span></button></article>; })}{!shownCollections.length && <div className="library-empty"><Folder size={30} strokeWidth={1.1} /><h2>{query ? 'No matching collection.' : 'A home for connected pages.'}</h2><p>{query ? 'Try a different name.' : 'Use New collection when a few pages belong together.'}</p></div>}</div> : <div className="library-pages"><div className="library-list-caption"><span>{query ? `${visible.length} matching ${visible.length === 1 ? 'page' : 'pages'}` : `${visible.length} ${visible.length === 1 ? 'page' : 'pages'}`}</span><span>{effectiveSort === 'manual' ? 'Author order' : effectiveSort === 'title' ? 'By title' : 'Most recent first'}</span></div><div className="library-page-items">{visible.map(item => <article className="library-page-row" key={item.id}><FileText size={20} strokeWidth={1.3} /><button className="library-page-open" onClick={() => onOpen(item.id)}><h2>{item.title || 'Untitled'}</h2>{layout !== 'list' && <p>{item.plainText.slice(0, layout === 'tile' ? 260 : 190).replace(/\s+/gu, ' ') || 'A blank page, all yours.'}</p>}<span>{!current && <><span className="library-page-collection" title={collections.find(entry => entry.id === item.collectionId)?.name || 'Inbox'}>{collections.find(entry => entry.id === item.collectionId)?.name || 'Inbox'}</span><i /></>}{wordCount(item.plainText).toLocaleString()} words<i />{shortDate(item.updatedAt)}</span>{(layout === 'detailed' || item.origin === 'ai') && <small className={`library-origin ${item.origin === 'ai' ? 'library-origin-unverified' : ''}`}><ShieldCheck size={11} />{readerOrigin[item.origin]}</small>}</button><div className="library-page-actions"><button className="icon-button" aria-label={`Read ${item.title || 'Untitled'}`} title="Read page" onClick={() => onRead([item], item.title || 'Untitled')}><BookOpen size={18} /></button><details className="library-row-menu"><summary aria-label={`Options for ${item.title || 'Untitled'}`}><MoreHorizontal size={18} /></summary><label>Move to<select aria-label={`Move ${item.title || 'Untitled'} to collection`} value={item.collectionId || ''} onChange={event => { onMove(item.id, event.target.value || null); event.currentTarget.closest('details')?.removeAttribute('open'); }}><option value="">Inbox</option>{collections.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></details></div></article>)}</div>{!visible.length && <div className="library-empty"><Inbox size={32} strokeWidth={1.1} /><h2>{query || filter !== 'all' ? 'No matching pages.' : 'Room for a beginning.'}</h2><p>{query || filter !== 'all' ? 'Try another phrase or collection.' : 'Use + to capture a thought. You can organize it later.'}</p></div>}</div>}
  </section>;
}

export function CollectionActions({ collection, pinned, onPin, onRename }: { collection: Collection; pinned: boolean; onPin(id: string): void; onRename(collection: Collection): void }) {
  return <details className="collection-actions"><summary role="button" aria-label={`Options for collection ${collection.name}`}><MoreHorizontal size={17} /></summary><div><button onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onRename(collection); }}><Pencil size={14} />Rename collection</button><button onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onPin(collection.id); }}><Pin size={14} />{pinned ? 'Unpin shortcut' : 'Pin to sidebar'}</button></div></details>;
}
