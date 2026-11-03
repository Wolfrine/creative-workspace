import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, List, Pencil, Settings2, ShieldCheck, X } from 'lucide-react';
import type { Collection, Revision, RichNode, WritingDocument } from '../domain/model';
import Heartbeat, { HeartbeatToggle } from '../heartbeat/Heartbeat';
import { useHeartbeat, type HeartbeatState } from '../heartbeat/useHeartbeat';
import { heartbeatRanges, useHeartbeatRail } from '../heartbeat/decorations';
import type { HeartbeatBeat } from '../heartbeat/model';
import { beginReadingTransition } from '../reader/page-turn';
import { readerOrigin, safeReaderHref, readingBookmark, readerPageStart, resumeReading, type ReadingAnchor, type ReadingSnapshot } from '../reader/reading';
import Modal from './Modal';
import CopyPageLink from './CopyPageLink';

interface Preferences { size: number; leading: number; margin: 'comfortable' | 'wide'; theme: 'paper' | 'night'; font: 'serif' | 'sans'; animation: boolean; spread: boolean; layout: 'auto' | 'pages' | 'scroll' }
const defaults: Preferences = { size: 20, leading: 1.85, margin: 'comfortable', theme: 'paper', font: 'serif', animation: true, spread: true, layout: 'auto' };
function readPreferences(): Preferences { try { const item = JSON.parse(localStorage.getItem('noveliaa.reader.preferences') || '{}'); return { ...defaults, size: Math.max(16, Math.min(28, Number(item.size) || defaults.size)), leading: Math.max(1.4, Math.min(2.2, Number(item.leading) || defaults.leading)), margin: item.margin === 'wide' ? 'wide' : 'comfortable', theme: item.theme === 'night' ? 'night' : 'paper', font: item.font === 'sans' ? 'sans' : 'serif', animation: item.animation !== false, spread: item.spread !== false, layout: item.layout === 'pages' || item.layout === 'scroll' ? item.layout : 'auto' }; } catch { return defaults; } }

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

export default function Reader({ onCurrentDocument, linkDocuments, collections, snapshot, availableDocumentIds, onClose, onEdit, changed, returnToLibrary = false, heartbeatSourceChanged = false, heartbeatEnabled, onHeartbeatToggle, heartbeatLocalPreview, revisions }: { onCurrentDocument(id: string): void; linkDocuments: WritingDocument[]; collections: Collection[]; returnToLibrary?: boolean; snapshot: ReadingSnapshot; availableDocumentIds: string[]; onClose(): void; onEdit(id: string): void; changed: boolean; heartbeatEnabled: boolean; onHeartbeatToggle(): void; heartbeatLocalPreview: boolean; revisions: Revision[]; heartbeatSourceChanged?: boolean }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const flow = preferences.layout === 'scroll' || (preferences.layout === 'auto' && (windowSize.width <= 350 || (windowSize.width <= 650 && windowSize.height <= 740)));
  const compactFlow = flow && windowSize.width <= 350 && heartbeatEnabled;
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sourceDetails, setSourceDetails] = useState<string | null>(null);
  const [panel, setPanel] = useState<'contents' | 'appearance' | null>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [columns, setColumns] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const book = useRef<HTMLDivElement>(null);
  const motionHost = useRef<HTMLDivElement>(null);
  const motionCleanup = useRef<(() => void) | null>(null);
  const stopMotion = useCallback(() => { motionCleanup.current?.(); motionCleanup.current = null; }, []);
  const [ready, setReady] = useState(false);
  const stage = useRef<HTMLDivElement>(null); const article = useRef<HTMLElement>(null); const stride = useRef(0); const layoutPage = useRef(0);
  const storageKey = `noveliaa.reader.position.${snapshot.key}`;
  const [resume] = useState(() => resumeReading((() => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } })(), snapshot.documents));
  const anchor = useRef<ReadingAnchor>(resume.anchor);
  const restoringScroll = useRef(false);
  const programmaticScrollTop = useRef<number | null>(null);
  const anchorViewportOffset = useRef(0);
  const [resumeNotice, setResumeNotice] = useState(resume.reset);
  const [linkNotice, setLinkNotice] = useState(false);
  const [activeTitle, setActiveTitle] = useState(snapshot.documents[0]?.title || 'Untitled');
  const [activeDocumentId, setActiveDocumentId] = useState(anchor.current.documentId);
  useEffect(() => { onCurrentDocument(activeDocumentId); }, [activeDocumentId, onCurrentDocument]);
  const linkDocument = linkDocuments.find(item => item.id === activeDocumentId && !item.trashed);
  const heartbeatDocument = snapshot.documents.find(item => item.id === activeDocumentId) || snapshot.documents[0];
  const heartbeatRequest = useHeartbeat(heartbeatDocument, revisions, heartbeatEnabled && !changed && !heartbeatSourceChanged, heartbeatLocalPreview);
  const heartbeat: HeartbeatState = heartbeatEnabled && (changed || heartbeatSourceChanged) ? { status: 'stale', refresh: heartbeatRequest.refresh } : heartbeatRequest;
  const heartbeatSource = article.current?.querySelector<HTMLElement>(`[data-reader-document="${heartbeatDocument.id}"]`) || null;
  const [pageBeats, setPageBeats] = useState<HeartbeatBeat[]>([]);
  const [visibleBeatExtents, setVisibleBeatExtents] = useState<Record<string, number>>({});
  const [showUnanalysed, setShowUnanalysed] = useState(false);
  useHeartbeatRail(heartbeatSource, heartbeatDocument.body, heartbeat.annotation, 'reader', { enabled: heartbeatEnabled, unanalysedDocuments: snapshot.documents, layoutKey: `${viewportSize.width}:${viewportSize.height}:${preferences.size}:${preferences.leading}:${preferences.font}:${preferences.margin}:${ready}:${flow}` });
  useLayoutEffect(() => {
    if (!heartbeat.annotation || !heartbeatSource || !stage.current) { setPageBeats([]); setVisibleBeatExtents({}); setShowUnanalysed(false); return; }
    const viewport = stage.current; let frame = 0;
    const measure = () => {
      const bounds = viewport.getBoundingClientRect(), bottom = bounds.bottom - (flow && viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1 ? 10 : 0);
      const readable = (rect: DOMRect) => rect.width > .5 && rect.right > bounds.left && rect.left < bounds.right && Math.min(rect.bottom, bottom) - Math.max(rect.top, bounds.top) >= rect.height * .5;
      const visible = heartbeatRanges(heartbeatSource, heartbeatDocument.body, heartbeat.annotation!).flatMap(({ beat, range }) => {
        const columns = new Map<number, { top: number; bottom: number }>();
        for (const rect of range.getClientRects()) {
          if (!readable(rect)) continue;
          const column = Math.floor((Math.max(bounds.left, rect.left) - bounds.left) / (stride.current || bounds.width));
          const prior = columns.get(column), top = Math.max(bounds.top, rect.top), end = Math.min(bottom, rect.bottom);
          columns.set(column, { top: Math.min(prior?.top ?? top, top), bottom: Math.max(prior?.bottom ?? end, end) });
        }
        return columns.size ? [{ beat, extent: [...columns.values()].reduce((sum, column) => sum + column.bottom - column.top, 0) }] : [];
      });
      const next = visible.map(item => item.beat), extents = Object.fromEntries(visible.map(({ beat, extent }) => [`${beat.start}:${beat.end}`, Math.round(extent)]));
      setPageBeats(previous => previous.length === next.length && previous.every((beat, index) => beat === next[index]) ? previous : next);
      setVisibleBeatExtents(previous => JSON.stringify(previous) === JSON.stringify(extents) ? previous : extents);
      setShowUnanalysed([...(article.current?.querySelectorAll<HTMLElement>('.reader-source') || [])].filter(source => source.dataset.readerDocument !== heartbeatDocument.id).some(source => [...source.querySelectorAll<HTMLElement>('[data-passage]')].some(passage => { if (!passage.textContent?.trim()) return false; const range = document.createRange(); range.selectNodeContents(passage); return [...range.getClientRects()].some(readable); })));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure(); viewport.addEventListener('scroll', schedule, { passive: true });
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener('scroll', schedule); };
  }, [heartbeat.annotation, heartbeatSource, heartbeatDocument.body, page, preferences, ready, viewportSize, flow]);
  const readerPanel = useRef<HTMLElement>(null);
  const passages = () => [...(article.current?.querySelectorAll<HTMLElement>('[data-passage]') || [])];
  const findPassage = (point: ReadingAnchor) => passages().find(element => element.dataset.document === point.documentId && Number(element.dataset.passage) === point.passage);
  const columnAt = (range: Range) => { const rect = range.getClientRects()[0]; const base = article.current?.getBoundingClientRect(); return rect && base && stride.current ? Math.max(0, Math.floor((rect.left - base.left + 2) / stride.current)) : 0; };
  const saveAnchor = useCallback((point: ReadingAnchor) => {
    anchor.current = point;
    setActiveTitle(snapshot.documents.find(item => item.id === point.documentId)?.title || 'Untitled'); setActiveDocumentId(point.documentId);
    try { localStorage.setItem(storageKey, JSON.stringify(readingBookmark(point, snapshot.documents))); } catch { /* Local reading position only. */ }
  }, [snapshot.documents, storageKey]);
  const rememberScroll = useCallback(() => {
    const viewport = stage.current; if (!viewport || !flow) return;
    const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    setScrollProgress(maximum ? Math.max(0, Math.min(1, viewport.scrollTop / maximum)) : 1);
    // Programmatic restoration must not round an exact saved character back to
    // a page boundary or to the start of the line containing that character.
    if (restoringScroll.current || (programmaticScrollTop.current !== null && Math.abs(viewport.scrollTop - programmaticScrollTop.current) < 1)) return;
    programmaticScrollTop.current = null;
    const top = viewport.getBoundingClientRect().top;
    for (const element of article.current?.querySelectorAll<HTMLElement>('[data-passage]') || []) {
      const length = element.textContent?.length || 0;
      if (passageRange(element, length).getBoundingClientRect().top < top - 1) continue;
      let low = 0, high = length;
      while (low < high) { const middle = Math.floor((low + high) / 2); if (passageRange(element, middle).getBoundingClientRect().top < top - 1) low = middle + 1; else high = middle; }
      anchorViewportOffset.current = Math.max(0, passageRange(element, low).getBoundingClientRect().top - top);
      saveAnchor({ documentId: element.dataset.document || '', passage: Number(element.dataset.passage), offset: low });
      return;
    }
  }, [flow, saveAnchor]);
  const rememberPage = useCallback((column: number) => {
    anchorViewportOffset.current = 0;
    const blocks = [...(article.current?.querySelectorAll<HTMLElement>('[data-passage]') || [])];
    for (const element of blocks) {
      const textLength = element.textContent?.length || 0;
      const last = passageRange(element, textLength);
      if (columnAt(last) < column) continue;
      let low = 0; let high = textLength;
      while (low < high) { const middle = Math.floor((low + high) / 2); if (columnAt(passageRange(element, middle)) < column) low = middle + 1; else high = middle; }
      saveAnchor({ documentId: element.dataset.document || '', passage: Number(element.dataset.passage), offset: low });
      return;
    }
  }, [saveAnchor]);
  const go = useCallback((next: number, animate = true) => {
    const target = readerPageStart(next, pages, columns);
    if (target === page) return;
    stopMotion();
    if (animate && Math.abs(target - page) === columns && preferences.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && motionHost.current && book.current && stage.current && article.current) {
      motionCleanup.current = beginReadingTransition({ host: motionHost.current, book: book.current, stage: stage.current, source: article.current, from: page, to: target, pages, columns, stride: stride.current });
    }
    layoutPage.current = target; setPage(target); rememberPage(target);
  }, [page, pages, columns, preferences.animation, rememberPage, stopMotion]);
  useLayoutEffect(() => {
    stopMotion();
    const viewport = stage.current; const content = article.current; if (!viewport || !content) return;
    let frame = 0, restoreFrame = 0; let alive = true;
    const measure = () => {
      if (!alive) return;
      stopMotion();
      const width = flow ? viewport.getBoundingClientRect().width : viewport.clientWidth; const height = viewport.clientHeight;
      if (!width || !height) return;
      setViewportSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
      const count = !flow && preferences.spread && width >= 900 ? 2 : 1;
      const margin = width < 500 ? (preferences.margin === 'wide' ? 30 : 20) : preferences.margin === 'wide' ? 64 : 38;
      const rightMargin = width <= 350 && preferences.margin === 'comfortable' ? 12 : margin;
      const sheet = width / count; const columnWidth = Math.max(100, sheet - margin - rightMargin); const gap = margin + rightMargin;
      stride.current = sheet;
      content.style.setProperty('--reader-column', `${columnWidth}px`); content.style.setProperty('--reader-gap', `${gap}px`); content.style.setProperty('--reader-padding', `${margin}px`);
      content.style.width = `${columnWidth}px`; content.style.height = flow ? 'auto' : `${height}px`;
      restoringScroll.current = true; cancelAnimationFrame(restoreFrame);
      if (flow) {
        content.style.transform = 'translateX(0px)';
        const heading = anchor.current.passage === 0 && anchor.current.offset === 0 ? content.querySelector<HTMLElement>(`[data-reader-document="${anchor.current.documentId}"] .reader-source-heading`) : null;
        const current = heading || findPassage(anchor.current);
        const rect = current ? heading ? current.getBoundingClientRect() : passageRange(current, anchor.current.offset).getBoundingClientRect() : null;
        if (rect) viewport.scrollTop = Math.max(0, viewport.scrollTop + rect.top - viewport.getBoundingClientRect().top - anchorViewportOffset.current);
        programmaticScrollTop.current = viewport.scrollTop;
        layoutPage.current = 0; setColumns(1); setPages(1); setPage(0); setReady(true);
        const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight); setScrollProgress(maximum ? Math.min(1, viewport.scrollTop / maximum) : 1);
        restoreFrame = requestAnimationFrame(() => { restoreFrame = requestAnimationFrame(() => { restoringScroll.current = false; }); });
        return;
      }
      viewport.scrollTop = 0;
      const total = Math.max(1, Math.ceil((content.scrollWidth + gap) / sheet));
      const currentPassage = anchor.current.passage === 0 && anchor.current.offset === 0 ? content.querySelector<HTMLElement>(`[data-reader-document="${anchor.current.documentId}"] .reader-source-heading`) : findPassage(anchor.current); const target = currentPassage ? columnAt(passageRange(currentPassage, anchor.current.offset)) : 0;
      const aligned = readerPageStart(target, total, count);
      layoutPage.current = aligned; setColumns(count); setPages(total); setPage(aligned); setReady(true);
      setActiveTitle(snapshot.documents.find(item => item.id === anchor.current.documentId)?.title || 'Untitled'); setActiveDocumentId(anchor.current.documentId);
      content.style.transform = `translateX(${-aligned * sheet}px)`;
      restoreFrame = requestAnimationFrame(() => { restoringScroll.current = false; });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule); observer.observe(viewport); schedule(); void document.fonts.ready.then(schedule);
    return () => { alive = false; observer.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(restoreFrame); };
  }, [preferences, snapshot, stopMotion, flow]);
  useEffect(() => {
    const resize = () => { setWindowSize({ width: window.innerWidth, height: window.innerHeight }); };
    window.addEventListener('resize', resize, { passive: true }); return () => window.removeEventListener('resize', resize);
  }, [rememberScroll]);
  useEffect(() => {
    const viewport = stage.current; if (!flow || !viewport) return;
    let frame = 0;
    const scroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(rememberScroll); };
    viewport.addEventListener('scroll', scroll, { passive: true });
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener('scroll', scroll); };
  }, [flow, rememberScroll]);
  useEffect(() => { try { localStorage.setItem('noveliaa.reader.preferences', JSON.stringify(preferences)); } catch { /* Optional local preference only. */ } }, [preferences]);
  useEffect(() => { if (ready) try { localStorage.setItem(storageKey, JSON.stringify(readingBookmark(anchor.current, snapshot.documents))); } catch { /* Position remains optional when local preferences are unavailable. */ } }, [ready, storageKey, snapshot.documents]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if ((event.target as Element).closest('dialog')) return; if (event.key === 'Escape') { event.preventDefault(); if (panel) setPanel(null); else onClose(); return; } if (panel || (event.target as Element).closest('input,select,button,a')) return; const forward = event.key === 'ArrowRight' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey); const backward = event.key === 'ArrowLeft' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey); if (forward || backward) { event.preventDefault(); if (flow && stage.current) stage.current.scrollBy({ top: (forward ? 1 : -1) * stage.current.clientHeight * .88, behavior: 'instant' }); else go(page + (forward ? columns : -columns)); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [go, page, columns, panel, onClose, flow]);
  useEffect(() => { stage.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (!panel) return; const previous = document.activeElement as HTMLElement | null;
    const elements = () => [...(readerPanel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href]') || [])];
    elements()[0]?.focus();
    const trap = (event: KeyboardEvent) => { if (event.key !== 'Tab') return; const available = elements(); const first = available[0]; const last = available[available.length - 1]; if (event.shiftKey && (document.activeElement === first || !readerPanel.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && (document.activeElement === last || !readerPanel.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); } };
    document.addEventListener('keydown', trap); return () => { document.removeEventListener('keydown', trap); previous?.focus({ preventScroll: true }); };
  }, [panel]);
  useEffect(() => stopMotion, [stopMotion]);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const change = () => { if (media.matches) stopMotion(); }; media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, [stopMotion]);
  const findBeat = (beat: HeartbeatBeat) => {
    if (!heartbeat.annotation || !heartbeatSource || !stage.current) return;
    const range = heartbeatRanges(heartbeatSource, heartbeatDocument.body, heartbeat.annotation).find(item => item.beat === beat)?.range;
    if (!range) return;
    anchorViewportOffset.current = 0;
    const element = range.startContainer.parentElement?.closest<HTMLElement>('[data-passage]');
    let offset = range.startOffset;
    if (element) { const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let node; while ((node = walker.nextNode()) && node !== range.startContainer) offset += node.textContent?.length || 0; }
    if (flow) { restoringScroll.current = true; stage.current.scrollTop += range.getBoundingClientRect().top - stage.current.getBoundingClientRect().top; programmaticScrollTop.current = stage.current.scrollTop; requestAnimationFrame(() => { restoringScroll.current = false; }); }
    else go(columnAt(range), false);
    if (element) saveAnchor({ documentId: element.dataset.document || '', passage: Number(element.dataset.passage), offset });
  };
  const jump = (id: string) => {
    anchorViewportOffset.current = 0;
    const point = { documentId: id, passage: 0, offset: 0 };
    const element = article.current?.querySelector<HTMLElement>(`[data-reader-document="${id}"] .reader-source-heading`);
    if (element && flow && stage.current) { restoringScroll.current = true; stage.current.scrollTop += element.getBoundingClientRect().top - stage.current.getBoundingClientRect().top; programmaticScrollTop.current = stage.current.scrollTop; requestAnimationFrame(() => { restoringScroll.current = false; }); }
    else if (element) go(columnAt(passageRange(element, 0)), false);
    saveAnchor(point); setPanel(null);
  };
  const touch = useRef<{ x: number; y: number } | null>(null);
  const css = { '--reader-size': `${preferences.size}px`, '--reader-leading': preferences.leading, '--reader-font': preferences.font === 'serif' ? 'var(--serif)' : "'DM Sans Variable', sans-serif" } as CSSProperties;
  return <section className={`reader reader-${preferences.theme} ${columns === 2 ? 'reader-spread' : ''} ${flow ? 'reader-flow' : ''} ${compactFlow ? 'reader-compact-flow' : ''} ${flow && scrollProgress > .99 ? 'reader-flow-at-end' : ''}`} style={css} aria-label="Private reading mode">
    <header className="reader-header"><button className="reader-back" onClick={() => returnToLibrary ? onClose() : onEdit(anchor.current.documentId)}><ArrowLeft size={17} /><span>{returnToLibrary ? 'Back to Library' : 'Back to writing'}</span></button><div className="reader-book-title"><BookOpen size={15} /><span title={snapshot.title === activeTitle ? snapshot.title : `${snapshot.title} ? ${activeTitle}`}>{snapshot.title}</span></div><div className="reader-header-actions">{linkDocument && <CopyPageLink document={linkDocument} collectionName={collections.find(item => item.id === linkDocument.collectionId)?.name} />}<HeartbeatToggle enabled={heartbeatEnabled} onToggle={onHeartbeatToggle} />{returnToLibrary && <button className="icon-button" aria-label="Edit current page" title="Edit current page" onClick={() => onEdit(anchor.current.documentId)}><Pencil size={18} /></button>}<button className="icon-button" aria-label="Reading contents" aria-pressed={panel === 'contents'} onClick={() => setPanel(panel === 'contents' ? null : 'contents')}><List size={20} /></button><button className="icon-button" aria-label="Reading appearance" aria-pressed={panel === 'appearance'} onClick={() => setPanel(panel === 'appearance' ? null : 'appearance')}><Settings2 size={19} /></button></div></header>
    {resumeNotice && <div className="reader-update" role="status">This writing changed since your last reading. Starting at the beginning of this page.<button aria-label="Dismiss reading position notice" onClick={() => setResumeNotice(false)}><X size={13} /></button></div>}
    {changed && <div className="reader-update">Newer writing is available. This reading session keeps its place.<button onClick={onClose}>{returnToLibrary ? 'Return to Library' : 'Return to writing'}<ArrowRight size={13} /></button></div>}
    {linkNotice && <div className="reader-update" role="status">That linked writing is in Trash or is unavailable in this universe.<button aria-label="Dismiss reading link notice" onClick={() => setLinkNotice(false)}><X size={13} /></button></div>}
    <div ref={book} className="reader-book" role="main" onTouchStart={event => { touch.current = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }; }} onTouchEnd={event => { const start = touch.current; touch.current = null; if (flow || !start || window.getSelection()?.toString() || (event.target as Element).closest('a,button')) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(page + (dx < 0 ? columns : -columns)); }}>
      <div ref={stage} className="reader-stage" tabIndex={0} aria-label={flow ? 'Continuous reading' : 'Book pages'} data-layout={flow ? 'scroll' : 'pages'} data-pages={pages} data-page={page} data-columns={columns} onFocusCapture={event => { const link = (event.target as Element).closest('a'); if (!link) return; const range = document.createRange(); range.selectNodeContents(link); if (flow && stage.current) { const rect = range.getBoundingClientRect(), bounds = stage.current.getBoundingClientRect(); if (rect.top < bounds.top) stage.current.scrollTop += rect.top - bounds.top; else if (rect.bottom > bounds.bottom) stage.current.scrollTop += rect.bottom - bounds.bottom; } else { go(columnAt(range), false); requestAnimationFrame(() => { if (stage.current) { stage.current.scrollLeft = 0; stage.current.scrollTop = 0; } }); } }}>
        <article ref={article} className="reader-prose" style={{ transform: `translateX(${-page * stride.current}px)`, opacity: ready ? 1 : 0 }} onClick={event => { const link = (event.target as Element).closest('a'); if (link?.getAttribute('href')?.startsWith('noveliaa://document/')) { event.preventDefault(); const id = link.getAttribute('href')!.slice('noveliaa://document/'.length); if (snapshot.documents.some(item => item.id === id)) jump(id); else if (availableDocumentIds.includes(id)) onEdit(id); else setLinkNotice(true); } }}>
          {snapshot.documents.map((document, index) => <section className="reader-source" key={document.id} data-reader-document={document.id}><div className="reader-source-heading">{snapshot.documents.length > 1 && <p className="reader-source-number">{`WRITING ${String(index + 1).padStart(2, '0')}`}</p>}<div className="reader-source-title"><h1>{document.title || 'Untitled'}</h1><button className="reader-source-badge" aria-label={`Source provenance for ${document.title || 'Untitled'}`} title="Source provenance" onClick={() => setSourceDetails(document.id)}><ShieldCheck size={12} /><span>Source</span></button></div></div>{(document.body.content || []).map((node, passage) => <div key={passage} data-document={document.id} data-passage={passage}><RichText node={node} /></div>)}</section>)}
        </article>
      </div>
      {columns === 2 && <span className="reader-gutter" aria-hidden="true" />}
      <div ref={motionHost} className="reader-motion-host" aria-hidden="true" inert />
    </div>
    <footer className={`reader-footer ${heartbeatEnabled ? 'reader-footer-heartbeat' : ''} ${heartbeatEnabled && heartbeat.coverage?.status === 'continuous' ? 'reader-footer-field' : ''}`}>
      {!flow && <button className="reader-turn-control" aria-label="Previous reader page" disabled={page === 0} onClick={() => go(page - columns)}><ChevronLeft size={21} /><span>Previous</span></button>}
      <div className="reader-progress"><span aria-live={flow ? 'off' : 'polite'}>{flow ? scrollProgress < .01 ? 'Continuous reading' : scrollProgress > .99 ? 'End' : `${Math.round(scrollProgress * 100)}% read` : `${columns === 2 && page + 1 < pages ? `${page + 1}–${Math.min(pages, page + columns)}` : page + 1} / ${pages}`}</span><div aria-hidden="true"><span style={{ width: `${flow ? scrollProgress * 100 : Math.min(100, (page + columns) / pages * 100)}%` }} /></div></div>
      {flow ? <button className="reader-pages-choice" aria-label="Switch to paginated reading" onClick={() => { rememberScroll(); setPreferences({ ...preferences, layout: 'pages' }); }}>Pages</button> : <button className="reader-turn-control" aria-label="Next reader page" disabled={page + columns >= pages} onClick={() => go(page + columns)}><span>Next</span><ChevronRight size={21} /></button>}
      {heartbeatEnabled && <div className="reader-heartbeat"><Heartbeat state={heartbeat} beats={pageBeats} limit={viewportSize.width < 900 ? 2 : 6} fitToWidth visibleExtents={visibleBeatExtents} showUnanalysed={showUnanalysed} onFind={findBeat} /></div>}
    </footer>
    {sourceDetails && <Modal title="Source provenance" onClose={() => setSourceDetails(null)}><div className="heartbeat-detail"><p>{readerOrigin[snapshot.documents.find(document => document.id === sourceDetails)!.origin]}</p><p className="heartbeat-detail-meta">This is a private reading of the unchanged source. Heartbeat is a separate AI interpretation and does not approve or rewrite this writing.</p></div></Modal>}
    {panel && <><button className="reader-panel-scrim" aria-label="Close reader panel" onClick={() => setPanel(null)} /><aside ref={readerPanel} className="reader-panel" role="dialog" aria-modal="true" aria-label={panel === 'contents' ? 'Reading contents panel' : 'Reading appearance panel'}><header><h2>{panel === 'contents' ? 'In this reading' : 'Make yourself at home'}</h2><button className="icon-button" aria-label="Close reading settings" onClick={() => setPanel(null)}><X size={18} /></button></header>{panel === 'contents' ? <><p className="reader-panel-intro">Your pages, in your chosen order.</p><nav>{snapshot.documents.map((document, index) => <button key={document.id} aria-current={activeDocumentId === document.id ? 'location' : undefined} onClick={() => jump(document.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{document.title || 'Untitled'}</strong><ChevronRight size={15} /></button>)}</nav></> : <div className="reader-settings"><label>Reading layout<select aria-label="Reading layout" value={preferences.layout} onChange={event => { rememberScroll(); setPreferences({ ...preferences, layout: event.target.value as Preferences['layout'] }); }}><option value="auto">Automatic</option><option value="pages">Pages</option><option value="scroll">Scroll</option></select></label><label>Typeface<select aria-label="Reading typeface" value={preferences.font} onChange={event => setPreferences({ ...preferences, font: event.target.value as Preferences['font'] })}><option value="serif">Literary serif</option><option value="sans">Clear sans serif</option></select></label><label>Text size<span>{preferences.size}px</span><input aria-label="Reading text size" type="range" min="16" max="28" value={preferences.size} onChange={event => setPreferences({ ...preferences, size: Number(event.target.value) })} /></label><label>Line spacing<span>{preferences.leading.toFixed(2)}</span><input aria-label="Reading line spacing" type="range" min="1.4" max="2.2" step="0.05" value={preferences.leading} onChange={event => setPreferences({ ...preferences, leading: Number(event.target.value) })} /></label><label>Margins<select aria-label="Reading margins" value={preferences.margin} onChange={event => setPreferences({ ...preferences, margin: event.target.value as Preferences['margin'] })}><option value="comfortable">Comfortable</option><option value="wide">Generous</option></select></label><div className="reader-theme-options"><button aria-pressed={preferences.theme === 'paper'} onClick={() => setPreferences({ ...preferences, theme: 'paper' })}><span className="reader-paper-swatch" />Paper{preferences.theme === 'paper' && <Check size={14} />}</button><button aria-pressed={preferences.theme === 'night'} onClick={() => setPreferences({ ...preferences, theme: 'night' })}><span className="reader-night-swatch" />Night{preferences.theme === 'night' && <Check size={14} />}</button></div><label className="reader-check"><input type="checkbox" checked={preferences.spread} onChange={event => setPreferences({ ...preferences, spread: event.target.checked })} />Facing pages on wide screens</label><label className="reader-check"><input type="checkbox" checked={preferences.animation} onChange={event => setPreferences({ ...preferences, animation: event.target.checked })} />Page-turn animation</label><p className="reader-preference-note">Preferences and your place stay on this device. Your original writing is unchanged.</p></div>}</aside></>}
  </section>;
}
