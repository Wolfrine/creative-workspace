import { useLayoutEffect } from 'react';
import type { RichNode } from '../domain/model';
import { heartbeatTextLeaves, type HeartbeatAnnotation, type HeartbeatTone } from './model';

type HighlightRegistry = { set(name: string, highlight: unknown): void; delete(name: string): void };
const toneNames: HeartbeatTone[] = ['warm', 'cool', 'tense', 'tender', 'somber', 'wonder', 'neutral'];
const registry = () => (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
export function clearHeartbeatHighlights(scope: 'writer' | 'reader') { toneNames.forEach(tone => registry()?.delete(`heartbeat-${scope}-${tone}`)); }
export function heartbeatRanges(element: HTMLElement, body: RichNode, annotation: HeartbeatAnnotation): { beat: HeartbeatAnnotation['beats'][number]; range: Range }[] {
  const leaves = heartbeatTextLeaves(body);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); const nodes: Text[] = [];
  let current = walker.nextNode(); while (current) { if (!current.parentElement?.closest('.reader-source-heading')) nodes.push(current as Text); current = walker.nextNode(); }
  if (nodes.map(node => node.data).join('') !== leaves.map(leaf => leaf.text).join('')) return [];
  const textOffset = (offset: number) => leaves.reduce((total, leaf) => total + Math.max(0, Math.min(leaf.end, offset) - leaf.start), 0);
  const point = (offset: number): [Text, number] | null => { for (const node of nodes) { if (offset <= node.length) return [node, offset]; offset -= node.length; } return null; };
  return annotation.beats.flatMap(beat => { const start = point(textOffset(beat.start)); const end = point(textOffset(beat.end)); if (!start || !end) return []; const range = document.createRange(); range.setStart(...start); range.setEnd(...end); return [{ beat, range }]; });
}
/** Native highlight ranges decorate text without marks, node edits or editor transactions. */
export function useHeartbeatHighlights(element: HTMLElement | null, body: RichNode, annotation: HeartbeatAnnotation | undefined, scope: 'writer' | 'reader') {
  useLayoutEffect(() => {
    clearHeartbeatHighlights(scope);
    const Highlight = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    if (!element || !annotation || !Highlight || !registry()) return;
    const ranges = heartbeatRanges(element, body, annotation);
    toneNames.forEach(tone => { const group = ranges.filter(item => item.beat.tone === tone).map(item => item.range); if (group.length) registry()!.set(`heartbeat-${scope}-${tone}`, new Highlight(...group)); });
    return () => clearHeartbeatHighlights(scope);
  }, [element, body, annotation, scope]);
}
