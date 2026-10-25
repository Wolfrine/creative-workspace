import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, FileText, Folder, Inbox, MoreHorizontal, Pencil, Pin, Plus, Search } from 'lucide-react';
import type { Collection, WritingDocument } from '../domain/model';
import { wordCount } from '../domain/model';
import type { ReadingScope } from '../reader/reading';

interface Props {
  documents: WritingDocument[]; collections: Collection[]; collectionId: string | null;
  pinned: string[]; onPin(id: string): void; onCollection(id: string | null): void;
  onOpen(id: string): void; onRead(documents: WritingDocument[], title: string, scope?: ReadingScope): void;
  onRename(collection: Collection): void; onCreate(): void; onNew(): void;
  onMove(id: string, collectionId: string | null): void;
}
export default function Library({ documents, collections, collectionId, pinned, onPin, onCollection, onOpen, onRead, onRename, onCreate, onNew, onMove }: Props) {
  const [tab, setTab] = useState<'pages' | 'collections'>('pages');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const current = collections.find(item => item.id === collectionId);
  const authored = useMemo(() => documents.filter(item => !collectionId || item.collectionId === collectionId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)), [documents, collectionId]);
  const visible = useMemo(() => authored.filter(item => filter === 'all' || (filter === 'inbox' ? !item.collectionId : item.collectionId === filter))
    .filter(item => !query || `${item.title}\n${item.plainText}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => sort === 'title' ? (a.title || 'Untitled').localeCompare(b.title || 'Untitled') : sort === 'manual' ? a.order - b.order : b.updatedAt.localeCompare(a.updatedAt)), [authored, filter, query, sort]);
  const shownCollections = collections.filter(item => !query || item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const changeCollection = (id: string | null) => { setQuery(''); setFilter('all'); setSort(id ? 'manual' : 'recent'); onCollection(id); };
  return <section className="library-workspace" aria-label="Writing library">
    <div className="library-masthead">
      <div>{current ? <button className="library-back" onClick={() => changeCollection(null)}><ArrowLeft size={15} />Library</button> : <p className="eyebrow">A HOME FOR EVERY THOUGHT</p>}
        <h1>{current?.name || 'Your library'}<span>.</span></h1>
        <p>{current ? `${authored.length} ${authored.length === 1 ? 'page' : 'pages'} · Your chosen order, ready to read.` : 'Find a line. Return to a world. Make room for the next.'}</p>
      </div>
      <div className="library-heading-actions">{current ? <><button className="secondary-button" onClick={() => onRename(current)}><Pencil size={15} />Rename</button><button className="primary-button" disabled={!authored.length} onClick={() => onRead(authored, current.name, { type: 'collection', id: current.id })}><BookOpen size={16} />Read collection</button></> : <button className="primary-button" onClick={onNew}><Plus size={17} />New thought</button>}</div>
    </div>
    {!current && <div className="library-tabs" aria-label="Library views"><button aria-pressed={tab === 'pages'} onClick={() => { setTab('pages'); setQuery(''); }}><FileText size={16} />Pages<span>{documents.length}</span></button><button aria-pressed={tab === 'collections'} onClick={() => { setTab('collections'); setQuery(''); }}><Folder size={16} />Collections<span>{collections.length}</span></button></div>}
    <div className="library-toolbar"><label className="library-search"><Search size={17} /><input aria-label={tab === 'collections' && !current ? 'Search collections' : 'Search library'} placeholder={tab === 'collections' && !current ? 'Find a collection…' : 'A title, a phrase, a beginning…'} value={query} onChange={event => setQuery(event.target.value)} /></label>
      {(tab === 'pages' || current) ? <div className="library-filters">{!current && <select aria-label="Filter library by collection" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All collections</option><option value="inbox">Inbox</option>{collections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}<select aria-label="Sort library" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently changed</option><option value="title">Title A–Z</option><option value="manual">Author order</option></select></div> : <button className="secondary-button" onClick={onCreate}><Plus size={16} />New collection</button>}
    </div>
    {tab === 'collections' && !current ? <div className="collection-grid">{shownCollections.map(item => { const pages = documents.filter(document => document.collectionId === item.id); return <article className="collection-card" key={item.id}><div className="collection-card-top"><Folder size={24} strokeWidth={1.2} /><CollectionActions collection={item} pinned={pinned.includes(item.id)} onPin={onPin} onRename={onRename} /></div><button className="collection-card-open" onClick={() => changeCollection(item.id)}><h2>{item.name}</h2><p>{pages.length} {pages.length === 1 ? 'page' : 'pages'}<span>{wordCount(pages.map(page => page.plainText).join(' ')).toLocaleString()} words</span></p><span className="collection-preview">{pages.sort((a, b) => a.order - b.order).slice(0, 3).map(page => <span key={page.id}>{page.title || 'Untitled'}</span>)}{!pages.length && <span>A little room to gather your writing.</span>}</span><span className="collection-enter">Open collection<ArrowRight size={16} /></span></button></article>; })}<button className="collection-create" onClick={onCreate}><Plus size={24} strokeWidth={1.2} /><span>A new collection</span><small>Organize when it feels useful.</small></button></div> : <div className="library-pages"><div className="library-list-caption"><span>{query ? `${visible.length} matching ${visible.length === 1 ? 'page' : 'pages'}` : `${visible.length} ${visible.length === 1 ? 'page' : 'pages'}`}</span><span>{sort === 'manual' ? 'Author order' : sort === 'title' ? 'By title' : 'Most recent first'}</span></div>{visible.map(item => <article className="library-page-row" key={item.id}><FileText size={20} strokeWidth={1.3} /><button className="library-page-open" onClick={() => onOpen(item.id)}><h2>{item.title || 'Untitled'}</h2><p>{item.plainText.slice(0, 150).replace(/\s+/gu, ' ') || 'A blank page, all yours.'}</p><span>{!current && <>{collections.find(entry => entry.id === item.collectionId)?.name || 'Inbox'}<i /></>}{wordCount(item.plainText).toLocaleString()} words<i />{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></button><div className="library-page-actions"><button className="icon-button" aria-label={`Read ${item.title || 'Untitled'}`} onClick={() => onRead([item], item.title || 'Untitled')}><BookOpen size={18} /></button><details className="library-row-menu"><summary aria-label={`Options for ${item.title || 'Untitled'}`}><MoreHorizontal size={18} /></summary><label>Move to<select aria-label={`Move ${item.title || 'Untitled'} to collection`} value={item.collectionId || ''} onChange={event => onMove(item.id, event.target.value || null)}><option value="">Inbox</option>{collections.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></details></div></article>)}{!visible.length && <div className="library-empty"><Inbox size={32} strokeWidth={1.1} /><h2>{query ? 'The right words will turn up.' : 'Room for a beginning.'}</h2><p>{query ? 'Try another phrase or collection.' : 'Capture a thought now. Give it a home whenever you like.'}</p>{!query && <button className="secondary-button" onClick={onNew}><Plus size={16} />New thought</button>}</div>}</div>}
  </section>;
}

export function CollectionActions({ collection, pinned, onPin, onRename }: { collection: Collection; pinned: boolean; onPin(id: string): void; onRename(collection: Collection): void }) {
  return <details className="collection-actions"><summary role="button" aria-label={`Options for collection ${collection.name}`}><MoreHorizontal size={17} /></summary><div><button onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onRename(collection); }}><Pencil size={14} />Rename collection</button><button onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onPin(collection.id); }}><Pin size={14} />{pinned ? 'Unpin shortcut' : 'Pin to sidebar'}</button></div></details>;
}
