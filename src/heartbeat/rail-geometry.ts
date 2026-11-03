/** Display geometry only. Source offsets and supplied feeling states stay intact. */
export interface RailRect { left: number; top: number; width: number; height: number }
export interface RailRange { start: number; end: number; index: number; rects: readonly RailRect[] }
export interface RailFragment { start: number; end: number; index: number; column: number; top: number; bottom: number; continuedBefore: boolean; continuedAfter: boolean }
export interface RailLayout { left: number; top: number; height: number; stride: number; paged: boolean }

/** Same-line changes share a boundary; paragraph whitespace joins the supplied
 * states. Callers must first verify complete coverage or mark all as unanalysed. */
export function partitionHeartbeatRail(ranges: readonly RailRange[], layout: RailLayout): RailFragment[] {
  if (!Number.isFinite(layout.height) || layout.height <= 0 || layout.paged && (!Number.isFinite(layout.stride) || layout.stride <= 0)) return [];
  const fragments: RailFragment[] = [];
  for (const range of ranges) {
    const columns = new Map<number, { top: number; bottom: number }>();
    for (const rect of range.rects) {
      if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= .1 || rect.height <= .1) continue;
      const column = layout.paged ? Math.max(0, Math.floor((rect.left - layout.left + 1) / layout.stride)) : 0;
      const top = Math.max(0, rect.top - layout.top), bottom = Math.min(layout.height, rect.top + rect.height - layout.top);
      if (bottom <= top) continue;
      const previous = columns.get(column);
      columns.set(column, { top: Math.min(previous?.top ?? top, top), bottom: Math.max(previous?.bottom ?? bottom, bottom) });
    }
    for (const [column, value] of columns) fragments.push({ start: range.start, end: range.end, index: range.index, column, ...value, continuedBefore: false, continuedAfter: false });
  }
  if (!fragments.length) return [];
  const firstColumn = Math.min(...fragments.map(value => value.column)), lastColumn = Math.max(...fragments.map(value => value.column));
  const columns = new Map<number, RailFragment[]>();
  for (const value of fragments) { const group = columns.get(value.column) || []; group.push(value); columns.set(value.column, group); }
  const result: RailFragment[] = [];
  for (const [column, values] of [...columns].sort(([a], [b]) => a - b)) {
    values.sort((a, b) => a.start - b.start || a.top - b.top);
    const top = layout.paged && column > firstColumn ? 0 : values[0].top;
    const bottom = layout.paged && column < lastColumn ? layout.height : values.at(-1)!.bottom;
    const minimum = Math.min(.5, (bottom - top) / (values.length * 2));
    const boundaries = [top];
    for (let index = 1; index < values.length; index++) boundaries.push(Math.max(boundaries[index - 1] + minimum, Math.min(bottom - minimum * (values.length - index), (values[index - 1].bottom + values[index].top) / 2)));
    boundaries.push(bottom);
    values.forEach((value, index) => result.push({ ...value, top: boundaries[index], bottom: boundaries[index + 1], continuedBefore: layout.paged && column > firstColumn && index === 0, continuedAfter: layout.paged && column < lastColumn && index === values.length - 1 }));
  }
  return result;
}
