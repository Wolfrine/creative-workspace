import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, List, Settings2, ShieldCheck, X } from 'lucide-react';
import type { RichNode } from '../domain/model';
import { readerOrigin, safeReaderHref, readingBookmark, readerPageStart, resumeReading, type ReadingAnchor, type ReadingSnapshot } from '../reader/reading';

interface Preferences { size: number; leading: number; margin: 'comfortable' | 'wide'; theme: 'paper' | 'night'; font: 'serif' | 'sans'; animation: boolean; spread: boolean }
const defaults: Preferences = { size: 20, leading: 1.85, margin: 'comfortable', theme: 'paper', font: 'serif', animation: true, spread: true };
function readPreferences(): Preferences { try { const item = JSON.parse(localStorage.getItem('noveliaa.reader.preferences') || '{}'); return { ...defaults, size: Math.max(16, Math.min(28, Number(item.size) || defaults.size)), leading: Math.max(1.4, Math.min(2.2, Number(item.leading) || defaults.leading)), margin: item.margin === 'wide' ? 'wide' : 'comfortable', theme: item.theme === 'night' ? 'night' : 'paper', font: item.font === 'sans' ? 'sans' : 'serif', animation: item.animation !== false, spread: item.spread !== false }; } catch { return defaults; } }

function RichText({ node }: { node: RichNode }): ReactNode {
  const children = node.content?.map((child, index) => <RichText key={index} node={child} />);
  if (node.type === 'text') { let content: ReactNode = node.text || ''; for (const mark of node.marks || []) { if (mark.type === 'bold') content = <strong>{content}</strong>; else if (mark.type === 'italic') content = <em>{content}</em>; else if (mark.type === 'underline') content = <u>{content}</u>; else if (mark.type === 'strike') content = <s>{content}</s>; else if (mark.type === 'code') content = <code>{content}</code>; else if (mark.type === 'link') { const href = safeReaderHref(mark.attrs?.href); if (href) content = <a href={href} {...(!href.startsWith('noveliaa:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{content}</a>; } } return content; }
  switch (node.type) {
    case 'paragraph': return <p data-first-line-indent={node.attrs?.firstLineIndent === true ? 'true' : undefined}>{children?.length ? children : <br />}</p>;
    case 'heading': return node.attrs?.level === 1 ? <h2>{children}</h2> : node.attrs?.level === 3 ? <h4>{children}</h4> : <h3>{children}</h3>;
    case 'bulletList': return <ul>{children}</ul>;
    case 'orderedList': return <ol start={Number(node.attrs?.start) || 1} type={['1', 'a', 'A', 'i', 'I'].includes(String(node.attrs?.type)) ? node.attrs!.type as '1' | 'a' | 'A' | 'i' | 'I' : undefined}>{children}</ol>;
    case 'listItem': return <li>{children}</li>;
    case 'blockquote': return <blockquote>{children}</blockquote>;
    case 'codeBlock': return <pre><code>{children}</code></pre>;
    case 'horizontalRule': return <hr />;
    case 'hardBreak': return <br />;
    default: return <Fragment>{children || node.text}</Fragment>;
  }
}

/** Resolve a passage offset in DOM text without inserting whitespace or changing source. */
function passageRange(element: HTMLElement, offset: number): Range {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let node = walker.nextNode(); let remaining = offset;
  const range = document.createRange();
  while (node) { const length = node.textContent?.length || 0; if (remaining <= length) { range.setStart(node, remaining); range.collapse(true); return range; } remaining -= length; node = walker.nextNode(); }
  // Empty paragraphs and horizontal rules still occupy a real reader column.
  range.selectNodeContents(element); return range;
}

export default function Reader({ snapshot, availableDocumentIds, onClose, onEdit, changed }: { snapshot: ReadingSnapshot; availableDocumentIds: string[]; onClose(): void; onEdit(id: string): void; changed: boolean }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [panel, setPanel] = useState<'contents' | 'appearance' | null>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [columns, setColumns] = useState(1);
  const [turn, setTurn] = useState<'forward' | 'back' | null>(null);
  const [ready, setReady] = useState(false);
  const stage = useRef<HTMLDivElement>(null); const article = useRef<HTMLElement>(null); const stride = useRef(0); const layoutPage = useRef(0);
  const storageKey = `noveliaa.reader.position.${snapshot.key}`;
  const [resume] = useState(() => resumeReading((() => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } })(), snapshot.documents));
  const anchor = useRef<ReadingAnchor>(resume.anchor);
  const [resumeNotice, setResumeNotice] = useState(resume.reset);
  const [linkNotice, setLinkNotice] = useState(false);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTitle, setActiveTitle] = useState(snapshot.documents[0]?.title || 'Untitled');
  const [activeDocumentId, setActiveDocumentId] = useState(anchor.current.documentId);
  const readerPanel = useRef<HTMLElement>(null);
  const passages = () => [...(article.current?.querySelectorAll<HTMLElement>('[data-passage]') || [])];
  const findPassage = (point: ReadingAnchor) => passages().find(element => element.dataset.document === point.documentId && Number(element.dataset.passage) === point.passage);
  const columnAt = (range: Range) => { const rect = range.getClientRects()[0]; const base = article.current?.getBoundingClientRect(); return rect && base && stride.current ? Math.max(0, Math.floor((rect.left - base.left + 2) / stride.current)) : 0; };
  const rememberPage = useCallback((column: number) => {
    const blocks = [...(article.current?.querySelectorAll<HTMLElement>('[data-passage]') || [])];
    for (const element of blocks) {
      const textLength = element.textContent?.length || 0;
      const last = passageRange(element, textLength);
      if (columnAt(last) < column) continue;
      let low = 0; let high = textLength;
      while (low < high) { const middle = Math.floor((low + high) / 2); if (columnAt(passageRange(element, middle)) < column) low = middle + 1; else high = middle; }
      anchor.current = { documentId: element.dataset.document || '', passage: Number(element.dataset.passage), offset: low };
      setActiveTitle(snapshot.documents.find(item => item.id === anchor.current.documentId)?.title || 'Untitled'); setActiveDocumentId(anchor.current.documentId);
      try { localStorage.setItem(storageKey, JSON.stringify(readingBookmark(anchor.current, snapshot.documents))); } catch { /* Reading preferences never block the manuscript. */ }
      return;
    }
  }, [snapshot.documents, storageKey]);
  const go = useCallback((next: number, animate = true) => {
    const target = readerPageStart(next, pages, columns);
    if (target === page) return;
    if (animationTimer.current) clearTimeout(animationTimer.current);
    if (animate && preferences.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTurn(target > page ? 'forward' : 'back'); animationTimer.current = setTimeout(() => setTurn(null), 440); }
    else setTurn(null);
    layoutPage.current = target; setPage(target); rememberPage(target);
  }, [page, pages, columns, preferences.animation, rememberPage]);
  useLayoutEffect(() => {
    const viewport = stage.current; const content = article.current; if (!viewport || !content) return;
    let frame = 0; let alive = true;
    const measure = () => {
      if (!alive) return;
      const width = viewport.clientWidth; const height = viewport.clientHeight;
      if (!width || !height) return;
      const count = preferences.spread && width >= 900 ? 2 : 1;
      const margin = width < 500 ? (preferences.margin === 'wide' ? 30 : 22) : preferences.margin === 'wide' ? 72 : 48;
      const sheet = width / count; const columnWidth = Math.max(100, sheet - margin * 2); const gap = margin * 2;
      stride.current = sheet;
      content.style.setProperty('--reader-column', `${columnWidth}px`); content.style.setProperty('--reader-gap', `${gap}px`); content.style.setProperty('--reader-padding', `${margin}px`);
      content.style.width = `${columnWidth}px`; content.style.height = `${height}px`;
      const total = Math.max(1, Math.ceil((content.scrollWidth + gap) / sheet));
      const currentPassage = anchor.current.passage === 0 && anchor.current.offset === 0 ? content.querySelector<HTMLElement>(`[data-reader-document="${anchor.current.documentId}"] .reader-source-heading`) : findPassage(anchor.current); const target = currentPassage ? columnAt(passageRange(currentPassage, anchor.current.offset)) : 0;
      const aligned = readerPageStart(target, total, count);
      layoutPage.current = aligned; setColumns(count); setPages(total); setPage(aligned); setReady(true);
      setActiveTitle(snapshot.documents.find(item => item.id === anchor.current.documentId)?.title || 'Untitled'); setActiveDocumentId(anchor.current.documentId);
      content.style.transform = `translateX(${-aligned * sheet}px)`;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule); observer.observe(viewport); schedule(); void document.fonts.ready.then(schedule);
    return () => { alive = false; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [preferences, snapshot]);
  useEffect(() => { try { localStorage.setItem('noveliaa.reader.preferences', JSON.stringify(preferences)); } catch { /* Optional local preference only. */ } }, [preferences]);
  useEffect(() => { if (ready) try { localStorage.setItem(storageKey, JSON.stringify(readingBookmark(anchor.current, snapshot.documents))); } catch { /* Position remains optional when local preferences are unavailable. */ } }, [ready, storageKey, snapshot.documents]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); if (panel) setPanel(null); else onClose(); return; } if (panel || (event.target as Element).closest('input,select,button,a')) return; if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); go(page + columns); } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); go(page - columns); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [go, page, columns, panel, onClose]);
  useEffect(() => { stage.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (!panel) return; const previous = document.activeElement as HTMLElement | null;
    const elements = () => [...(readerPanel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href]') || [])];
    elements()[0]?.focus();
    const trap = (event: KeyboardEvent) => { if (event.key !== 'Tab') return; const available = elements(); const first = available[0]; const last = available[available.length - 1]; if (event.shiftKey && (document.activeElement === first || !readerPanel.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && (document.activeElement === last || !readerPanel.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); } };
    document.addEventListener('keydown', trap); return () => { document.removeEventListener('keydown', trap); previous?.focus({ preventScroll: true }); };
  }, [panel]);
  useEffect(() => () => { if (animationTimer.current) clearTimeout(animationTimer.current); }, []);
  const jump = (id: string) => { anchor.current = { documentId: id, passage: 0, offset: 0 }; const element = article.current?.querySelector<HTMLElement>(`[data-reader-document="${id}"] .reader-source-heading`); if (element) go(columnAt(passageRange(element, 0)), false); anchor.current = { documentId: id, passage: 0, offset: 0 }; setActiveDocumentId(id); setActiveTitle(snapshot.documents.find(item => item.id === id)?.title || 'Untitled'); try { localStorage.setItem(storageKey, JSON.stringify(readingBookmark(anchor.current, snapshot.documents))); } catch { /* Optional reading position only. */ } setPanel(null); };
  const touch = useRef<{ x: number; y: number } | null>(null);
  const css = { '--reader-size': `${preferences.size}px`, '--reader-leading': preferences.leading, '--reader-font': preferences.font === 'serif' ? 'var(--serif)' : "'DM Sans Variable', sans-serif" } as CSSProperties;
  return <section className={`reader reader-${preferences.theme} ${columns === 2 ? 'reader-spread' : ''}`} style={css} aria-label="Private reading mode">
    <header className="reader-header"><button className="reader-back" onClick={() => onEdit(anchor.current.documentId)}><ArrowLeft size={17} /><span>Back to writing</span></button><div className="reader-book-title"><BookOpen size={15} /><span>{snapshot.title}</span></div><div className="reader-header-actions"><button className="icon-button" aria-label="Reading contents" aria-pressed={panel === 'contents'} onClick={() => setPanel(panel === 'contents' ? null : 'contents')}><List size={20} /></button><button className="icon-button" aria-label="Reading appearance" aria-pressed={panel === 'appearance'} onClick={() => setPanel(panel === 'appearance' ? null : 'appearance')}><Settings2 size={19} /></button></div></header>
    <div className="reader-chapter-heading"><span>{activeTitle}</span><span>{readerOrigin[snapshot.documents.find(item => item.id === activeDocumentId)?.origin || 'unknown']}</span></div>
    {resumeNotice && <div className="reader-update" role="status">This writing changed since your last reading. Starting at the beginning of this page.<button aria-label="Dismiss reading position notice" onClick={() => setResumeNotice(false)}><X size={13} /></button></div>}
    {changed && <div className="reader-update">Newer writing is available. This reading session keeps its place.<button onClick={onClose}>Return to writing<ArrowRight size={13} /></button></div>}
    {linkNotice && <div className="reader-update" role="status">That linked writing is in Trash or is unavailable in this universe.<button aria-label="Dismiss reading link notice" onClick={() => setLinkNotice(false)}><X size={13} /></button></div>}
    <div className="reader-book" role="main" onTouchStart={event => { touch.current = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }; }} onTouchEnd={event => { const start = touch.current; touch.current = null; if (!start || window.getSelection()?.toString() || (event.target as Element).closest('a,button')) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(page + (dx < 0 ? columns : -columns)); }}>
      <div ref={stage} className="reader-stage" tabIndex={0} aria-label="Book pages" data-pages={pages} data-page={page} data-columns={columns} onFocusCapture={event => { const link = (event.target as Element).closest('a'); if (!link) return; const range = document.createRange(); range.selectNodeContents(link); go(columnAt(range), false); requestAnimationFrame(() => { if (stage.current) { stage.current.scrollLeft = 0; stage.current.scrollTop = 0; } }); }}>
        <article ref={article} className="reader-prose" style={{ transform: `translateX(${-page * stride.current}px)`, opacity: ready ? 1 : 0 }} onClick={event => { const link = (event.target as Element).closest('a'); if (link?.getAttribute('href')?.startsWith('noveliaa://document/')) { event.preventDefault(); const id = link.getAttribute('href')!.slice('noveliaa://document/'.length); if (snapshot.documents.some(item => item.id === id)) jump(id); else if (availableDocumentIds.includes(id)) onEdit(id); else setLinkNotice(true); } }}>
          {snapshot.documents.map((document, index) => <section className="reader-source" key={document.id} data-reader-document={document.id}><div className="reader-source-heading"><p className="reader-source-number">{snapshot.documents.length > 1 ? `WRITING ${String(index + 1).padStart(2, '0')}` : 'YOUR WRITING, A LITTLE QUIETER'}</p><h1>{document.title || 'Untitled'}</h1><p className="reader-source-origin"><ShieldCheck size={11} />{readerOrigin[document.origin]}</p></div>{(document.body.content || []).map((node, passage) => <div key={passage} data-document={document.id} data-passage={passage}><RichText node={node} /></div>)}</section>)}
        </article>
      </div>
      {columns === 2 && <span className="reader-gutter" aria-hidden="true" />}
      {turn && <span key={`${page}-${turn}`} className={`reader-turn reader-turn-${turn}`} aria-hidden="true" />}
    </div>
    <footer className="reader-footer"><button className="reader-turn-control" aria-label="Previous reader page" disabled={page === 0} onClick={() => go(page - columns)}><ChevronLeft size={21} /><span>Previous</span></button><div className="reader-progress"><span aria-live="polite">{columns === 2 && page + 1 < pages ? `${page + 1}–${Math.min(pages, page + columns)}` : page + 1} / {pages}</span><div><span style={{ width: `${Math.min(100, (page + columns) / pages * 100)}%` }} /></div><small>{Math.min(100, Math.round((page + columns) / pages * 100))}% through this reading</small></div><button className="reader-turn-control" aria-label="Next reader page" disabled={page + columns >= pages} onClick={() => go(page + columns)}><span>Next</span><ChevronRight size={21} /></button></footer>
    {panel && <><button className="reader-panel-scrim" aria-label="Close reader panel" onClick={() => setPanel(null)} /><aside ref={readerPanel} className="reader-panel" role="dialog" aria-modal="true" aria-label={panel === 'contents' ? 'Reading contents panel' : 'Reading appearance panel'}><header><h2>{panel === 'contents' ? 'In this reading' : 'Make yourself at home'}</h2><button className="icon-button" aria-label="Close reading settings" onClick={() => setPanel(null)}><X size={18} /></button></header>{panel === 'contents' ? <><p className="reader-panel-intro">Your pages, in your chosen order.</p><nav>{snapshot.documents.map((document, index) => <button key={document.id} aria-current={activeDocumentId === document.id ? 'location' : undefined} onClick={() => jump(document.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{document.title || 'Untitled'}</strong><ChevronRight size={15} /></button>)}</nav></> : <div className="reader-settings"><label>Typeface<select aria-label="Reading typeface" value={preferences.font} onChange={event => setPreferences({ ...preferences, font: event.target.value as Preferences['font'] })}><option value="serif">Literary serif</option><option value="sans">Clear sans serif</option></select></label><label>Text size<span>{preferences.size}px</span><input aria-label="Reading text size" type="range" min="16" max="28" value={preferences.size} onChange={event => setPreferences({ ...preferences, size: Number(event.target.value) })} /></label><label>Line spacing<span>{preferences.leading.toFixed(2)}</span><input aria-label="Reading line spacing" type="range" min="1.4" max="2.2" step="0.05" value={preferences.leading} onChange={event => setPreferences({ ...preferences, leading: Number(event.target.value) })} /></label><label>Margins<select aria-label="Reading margins" value={preferences.margin} onChange={event => setPreferences({ ...preferences, margin: event.target.value as Preferences['margin'] })}><option value="comfortable">Comfortable</option><option value="wide">Generous</option></select></label><div className="reader-theme-options"><button aria-pressed={preferences.theme === 'paper'} onClick={() => setPreferences({ ...preferences, theme: 'paper' })}><span className="reader-paper-swatch" />Paper{preferences.theme === 'paper' && <Check size={14} />}</button><button aria-pressed={preferences.theme === 'night'} onClick={() => setPreferences({ ...preferences, theme: 'night' })}><span className="reader-night-swatch" />Night{preferences.theme === 'night' && <Check size={14} />}</button></div><label className="reader-check"><input type="checkbox" checked={preferences.spread} onChange={event => setPreferences({ ...preferences, spread: event.target.checked })} />Facing pages on wide screens</label><label className="reader-check"><input type="checkbox" checked={preferences.animation} onChange={event => setPreferences({ ...preferences, animation: event.target.checked })} />Paper-turn animation</label><p className="reader-preference-note">Preferences and your place stay on this device. Your original writing is unchanged.</p></div>}</aside></>}
  </section>;
}
