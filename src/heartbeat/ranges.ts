import { type RichNode } from '../domain/model';
import { heartbeatTextLeaves, type HeartbeatAnnotation } from './model';

export function sourceRanges<T extends { start: number; end: number }>(element: HTMLElement, body: RichNode, items: T[]): { item: T; range: Range }[] {
  const leaves = heartbeatTextLeaves(body);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); const nodes: Text[] = [];
  let current = walker.nextNode(); while (current) { if (!current.parentElement?.closest('.reader-source-heading')) nodes.push(current as Text); current = walker.nextNode(); }
  if (nodes.map(node => node.data).join('') !== leaves.map(leaf => leaf.text).join('')) return [];
  const textOffset = (offset: number) => leaves.reduce((total, leaf) => total + Math.max(0, Math.min(leaf.end, offset) - leaf.start), 0);
  const point = (offset: number, end: boolean): [Text, number] | null => {
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      if (offset < node.length || offset === node.length && (end || index === nodes.length - 1)) return [node, offset];
      offset -= node.length;
    }
    return null;
  };
  // At a paragraph boundary, a start belongs to the next text node. Choosing
  // the prior node's end creates a zero-width rectangle on the previous page.
  return items.flatMap(item => { const start = point(textOffset(item.start), false); const end = point(textOffset(item.end), true); if (!start || !end) return []; const range = document.createRange(); range.setStart(...start); range.setEnd(...end); return [{ item, range }]; });
}
export function heartbeatRanges(element: HTMLElement, body: RichNode, annotation: HeartbeatAnnotation): { beat: HeartbeatAnnotation['beats'][number]; range: Range }[] { return sourceRanges(element, body, annotation.beats).map(({ item, range }) => ({ beat: item, range })); }
