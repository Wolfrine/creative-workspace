import { useLayoutEffect, useRef } from 'react';
import { plainText, type RichNode } from '../domain/model';
import { heartbeatCoverage, heartbeatRegions, type HeartbeatAnnotation } from './model';
import { createHeartbeatFeelingMap, type HeartbeatDisplayStyle } from './presentation';
import { partitionHeartbeatRail } from './rail-geometry';
import { sourceRanges } from './ranges';
import './rail.css';

type Scope = 'writer' | 'reader';
type RailOptions = { enabled: boolean; layoutKey?: unknown; unanalysedDocuments?: readonly { id: string; body: RichNode }[] };
type Surface = { scope: Scope; suspended: boolean; svg?: SVGSVGElement };
const surfaces = new Set<Surface>();
const ns = 'http://www.w3.org/2000/svg';
const unanalysed: HeartbeatDisplayStyle = { token: 'unanalysed', color: '#7E837E', nightColor: '#9EA79E', mark: '·', pattern: 'dotted' };

function removeLegacyHighlights(scope: Scope | 'motion') {
  const registry = (CSS as unknown as { highlights?: { keys(): IterableIterator<string>; delete(name: string): void } }).highlights;
  for (const name of registry?.keys() || []) if (name.startsWith(`heartbeat-${scope}-`)) registry!.delete(name);
}
export function clearHeartbeatMotionRails() {
  document.querySelectorAll('.reader-motion-host .heartbeat-rail').forEach(element => element.remove());
  removeLegacyHighlights('motion');
}
/** Immediate invalidation also cancels queued geometry work after an edit. */
export function clearHeartbeatRail(scope: Scope) {
  for (const surface of surfaces) if (surface.scope === scope) { surface.suspended = true; surface.svg?.remove(); surface.svg = undefined; }
  document.querySelectorAll(`.heartbeat-rail[data-heartbeat-scope="${scope}"]`).forEach(element => element.remove());
  removeLegacyHighlights(scope); if (scope === 'reader') clearHeartbeatMotionRails();
}

/** Absolute SVGs sit outside editable/source text and contain no text nodes.
 * Local coordinates move with the actual article, native scroll and inert
 * page-turn copies. No editor transaction, manuscript mark or Firestore work. */
export function useHeartbeatRail(element: HTMLElement | null, body: RichNode, annotation: HeartbeatAnnotation | undefined, scope: Scope, options: RailOptions) {
  const previous = useRef({ element, body, annotationId: annotation?.id });
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = { element, body, annotationId: annotation?.id };
    // A page transform/re-measure must not strip the still-visible outgoing
    // leaf. Real data invalidation or OFF clears every canonical/projected cue.
    if (!options.enabled || old.element === element && (old.body !== body || old.annotationId !== annotation?.id)) clearHeartbeatRail(scope);
    else removeLegacyHighlights(scope);
    if (!element || !options.enabled) return;
    const root = scope === 'reader' ? element.closest<HTMLElement>('.reader-prose') : element.closest<HTMLElement>('.editor-body');
    if (!root) return;
    const surface: Surface = { scope, suspended: false }; surfaces.add(surface);
    const text = plainText(body);
    const continuous = !!annotation && heartbeatCoverage(text, annotation.beats).status === 'continuous';
    const map = createHeartbeatFeelingMap(continuous ? annotation!.beats : []);
    const regions = continuous && map.status === 'ready' ? heartbeatRegions(text, annotation!.beats) : [];
    let frame = 0, alive = true;
    const draw = () => {
      if (!alive || surface.suspended || !element.isConnected) return;
      surface.svg?.remove(); surface.svg = undefined;
      const verified = regions.length ? sourceRanges(element, body, regions) : [];
      const analysed = verified.length === regions.length && regions.length > 0;
      const ranges = analysed ? verified : /\S/u.test(text) ? sourceRanges(element, body, [{ start: 0, end: text.length }]) : [];
      const box = root.getBoundingClientRect(), sourceBox = element.getBoundingClientRect();
      const paged = scope === 'reader' && root.closest('.reader-stage')?.getAttribute('data-layout') !== 'scroll';
      const style = getComputedStyle(root), stride = paged ? (parseFloat(style.columnWidth) || root.clientWidth) + (parseFloat(style.columnGap) || 0) : 0;
      const height = paged ? root.clientHeight : Math.max(root.scrollHeight, root.clientHeight);
      const layout = { left: box.left, top: box.top, height, stride, paged };
      const toFragments = (values: typeof ranges) => partitionHeartbeatRail(values.map(({ item, range }, index) => ({ ...item, index, rects: [...range.getClientRects()].map(rect => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })) })), layout);
      const batches = [{ documentId: element.dataset.readerDocument || '', analysed, fragments: toFragments(ranges) }];
      // A facing spread can show the end of one document and the start of
      // another. No extra fetch: the other frozen source gets an honest dotted
      // state, never the current document's emotional interpretation.
      if (scope === 'reader') for (const other of options.unanalysedDocuments || []) {
        if (other.id === element.dataset.readerDocument) continue;
        const source = [...root.querySelectorAll<HTMLElement>('[data-reader-document]')].find(node => node.dataset.readerDocument === other.id);
        const otherText = plainText(other.body);
        if (!source || !/\S/u.test(otherText)) continue;
        batches.push({ documentId: other.id, analysed: false, fragments: toFragments(sourceRanges(source, other.body, [{ start: 0, end: otherText.length }])) });
      }
      if (!batches.some(batch => batch.fragments.length)) return;
      const svg = document.createElementNS(ns, 'svg'); svg.classList.add('heartbeat-rail'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.dataset.heartbeatScope = scope; svg.dataset.coverage = analysed ? 'continuous' : 'unanalysed';
      const width = Math.max(root.scrollWidth, root.clientWidth) + 12;
      svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
      Object.assign(svg.style, { left: '-12px', top: '0', width: `${width}px`, height: `${height}px` });
      for (const batch of batches) for (const fragment of batch.fragments) {
        const region = batch.analysed ? regions[fragment.index] : undefined;
        const entry = region ? map.entryFor(region) : undefined;
        const display = entry || unanalysed;
        const weight = region?.weight || 1, strokeWidth = region ? 1.1 + weight * .4 : 1.5;
        const x = paged ? fragment.column * stride : Math.max(0, sourceBox.left - box.left);
        const path = document.createElementNS(ns, 'path'); path.classList.add('heartbeat-rail-segment');
        path.setAttribute('d', `M ${x} ${fragment.top} L ${x} ${fragment.bottom}`); path.setAttribute('stroke-width', String(strokeWidth));
        path.style.setProperty('--hb-color', display.color); path.style.setProperty('--hb-night-color', display.nightColor);
        Object.assign(path.dataset, { documentId: batch.documentId, coverage: batch.analysed ? 'continuous' : 'unanalysed', sourceStart: String(fragment.start), sourceEnd: String(fragment.end), beatIndexes: (region?.beatIndexes || []).join(','), feelingKey: entry?.key || 'unanalysed', token: display.token, pattern: display.pattern, column: String(fragment.column), top: String(fragment.top), bottom: String(fragment.bottom), width: String(strokeWidth), trajectory: region?.trajectory || 'unanalysed', continuedBefore: String(fragment.continuedBefore), continuedAfter: String(fragment.continuedAfter) });
        svg.append(path);
      }
      root.append(svg); surface.svg = svg;
    };
    const schedule = () => { if (!alive || surface.suspended) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    const observer = new ResizeObserver(schedule); observer.observe(root); if (element !== root) observer.observe(element);
    schedule(); void document.fonts.ready.then(schedule);
    return () => { alive = false; cancelAnimationFrame(frame); observer.disconnect(); surface.svg?.remove(); surfaces.delete(surface); };
  }, [element, body, annotation, scope, options.enabled, options.layoutKey, options.unanalysedDocuments]);
}

/** cloneNode carries the paths. Mark inert provenance after vendor reparenting;
 * never recalculate geometry from boxes that are currently rotating. */
export function projectHeartbeatRail(_source: HTMLElement, projection: HTMLElement) {
  projection.querySelectorAll<SVGSVGElement>('.heartbeat-rail').forEach(svg => { svg.dataset.projection = 'true'; });
}
