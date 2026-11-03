import { useLayoutEffect } from 'react';
import { plainText, type RichNode } from '../domain/model';
import { heartbeatCoverage, heartbeatRegions, heartbeatTextLeaves, type HeartbeatAnnotation, type HeartbeatTone } from './model';

type HighlightRegistry = { set(name: string, highlight: unknown): void; delete(name: string): void; get(name: string): Iterable<Range> | undefined };
const toneNames: HeartbeatTone[] = ['warm', 'cool', 'tense', 'tender', 'somber', 'wonder', 'neutral'];
const registry = () => (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
export function clearHeartbeatHighlights(scope: 'writer' | 'reader') { toneNames.forEach(tone => registry()?.delete(`heartbeat-${scope}-${tone}`)); }
function sourceRanges<T extends { start: number; end: number }>(element: HTMLElement, body: RichNode, items: T[]): { item: T; range: Range }[] {
  const leaves = heartbeatTextLeaves(body);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); const nodes: Text[] = [];
  let current = walker.nextNode(); while (current) { if (!current.parentElement?.closest('.reader-source-heading')) nodes.push(current as Text); current = walker.nextNode(); }
  if (nodes.map(node => node.data).join('') !== leaves.map(leaf => leaf.text).join('')) return [];
  const textOffset = (offset: number) => leaves.reduce((total, leaf) => total + Math.max(0, Math.min(leaf.end, offset) - leaf.start), 0);
  const point = (offset: number): [Text, number] | null => { for (const node of nodes) { if (offset <= node.length) return [node, offset]; offset -= node.length; } return null; };
  return items.flatMap(item => { const start = point(textOffset(item.start)); const end = point(textOffset(item.end)); if (!start || !end) return []; const range = document.createRange(); range.setStart(...start); range.setEnd(...end); return [{ item, range }]; });
}
export function heartbeatRanges(element: HTMLElement, body: RichNode, annotation: HeartbeatAnnotation): { beat: HeartbeatAnnotation['beats'][number]; range: Range }[] { return sourceRanges(element, body, annotation.beats).map(({ item, range }) => ({ beat: item, range })); }
/** Native highlight ranges decorate text without marks, node edits or editor transactions. */
export function useHeartbeatHighlights(element: HTMLElement | null, body: RichNode, annotation: HeartbeatAnnotation | undefined, scope: 'writer' | 'reader') {
  useLayoutEffect(() => {
    clearHeartbeatHighlights(scope);
    if (scope === 'reader') clearHeartbeatMotionHighlights();
    const Highlight = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    if (!element || !annotation || !Highlight || !registry()) return;
    const text = plainText(body);
    if (heartbeatCoverage(text, annotation.beats).status !== 'continuous') return;
    const ranges = sourceRanges(element, body, heartbeatRegions(text, annotation.beats));
    toneNames.forEach(tone => { const group = ranges.filter(({ item }) => item.tone === tone).map(item => item.range); if (group.length) registry()!.set(`heartbeat-${scope}-${tone}`, new Highlight(...group)); });
    return () => { clearHeartbeatHighlights(scope); if (scope === 'reader') clearHeartbeatMotionHighlights(); };
  }, [element, body, annotation, scope]);
}

const projectedRanges = new Map<HeartbeatTone, Range[]>();
let projectedElements = new WeakSet<HTMLElement>();
export function clearHeartbeatMotionHighlights() { toneNames.forEach(tone => registry()?.delete(`heartbeat-motion-${tone}`)); projectedRanges.clear(); projectedElements = new WeakSet(); }
/** Copy only native display ranges onto the bounded inert page-turn projection. */
export function projectHeartbeatHighlights(source: HTMLElement, projection: HTMLElement) {
  const Highlight = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!Highlight || !registry() || projectedElements.has(projection)) return;
  const textNodes = (root: HTMLElement) => { const nodes: Text[] = []; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node; while ((node = walker.nextNode())) nodes.push(node as Text); return nodes; };
  const originals = textNodes(source), copies = textNodes(projection);
  if (originals.length !== copies.length || originals.some((node, index) => node.data !== copies[index].data)) return;
  projectedElements.add(projection);
  toneNames.forEach(tone => {
    const ranges = projectedRanges.get(tone) || [];
    for (const original of registry()!.get(`heartbeat-reader-${tone}`) || []) {
      const start = originals.indexOf(original.startContainer as Text), end = originals.indexOf(original.endContainer as Text);
      if (start < 0 || end < 0) continue;
      const range = document.createRange(); range.setStart(copies[start], original.startOffset); range.setEnd(copies[end], original.endOffset); ranges.push(range);
    }
    if (ranges.length) { projectedRanges.set(tone, ranges); registry()!.set(`heartbeat-motion-${tone}`, new Highlight(...ranges)); }
  });
}
