import { describe, expect, it } from 'vitest';
import { partitionHeartbeatRail as partition, type RailRange } from './rail-geometry';
const layout = { left: 100, top: 50, height: 300, stride: 400, paged: true };
const span = (start: number, end: number, index: number, top: number, height: number, left = 100): RailRange => ({ start, end, index, rects: [{ left, top: top + 50, width: 200, height }] });
describe('source-anchored margin current', () => {
  it('joins paragraph whitespace without changing source spans', () => {
    const values = partition([span(0, 40, 0, 20, 40), span(41, 100, 1, 100, 60)], layout);
    expect(values.map(v => [v.start, v.end, v.top, v.bottom])).toEqual([[0, 40, 20, 80], [41, 100, 80, 160]]);
  });
  it('divides a same-line change instead of overlapping two feelings', () => {
    expect(partition([span(0, 10, 0, 20, 30), span(10, 20, 1, 20, 30)], layout).map(v => [v.top, v.bottom])).toEqual([[20, 35], [35, 50]]);
  });
  it('keeps short same-line states in source order', () => {
    const values = partition(Array.from({ length: 10 }, (_, i) => span(i, i + 1, i, 20, 30)), layout);
    expect(values.every(v => v.bottom > v.top)).toBe(true); expect(values.slice(1).every((v, i) => v.top === values[i].bottom)).toBe(true);
    expect(values.map(v => v.index)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });
  it('carries a held range over the page edge but stops at the real ending', () => {
    const value = span(0, 100, 0, 90, 180); value.rects = [...value.rects, { left: 500, top: 50, width: 210, height: 70 }];
    expect(partition([value], layout).map(v => [v.column, v.top, v.bottom, v.continuedBefore, v.continuedAfter])).toEqual([[0, 90, 300, false, true], [1, 0, 70, true, false]]);
  });
  it('does not add a rail over the heading or preceding document', () => { expect(partition([span(0, 100, 0, 80, 120, 900)], layout).map(v => [v.column, v.top, v.bottom])).toEqual([[2, 80, 200]]); });
  it('keeps native-scroll geometry continuous without inventing page edges', () => { expect(partition([span(0, 100, 0, 80, 700)], { ...layout, paged: false, height: 1000 }).map(v => [v.column, v.top, v.bottom])).toEqual([[0, 80, 780]]); });
  it('rejects invalid layout and empty/non-finite rectangles', () => {
    expect(partition([span(0, 10, 0, 20, 30)], { ...layout, stride: 0 })).toEqual([]);
    expect(partition([{ start: 0, end: 10, index: 0, rects: [{ left: NaN, top: 0, width: 10, height: 20 }, { left: 100, top: 50, width: 0, height: 10 }] }], layout)).toEqual([]);
  });
  it('does not mutate caller ranges or rectangles', () => { const input = [span(0, 10, 0, 20, 30)], original = JSON.stringify(input); partition(input, layout); expect(JSON.stringify(input)).toBe(original); });
});
