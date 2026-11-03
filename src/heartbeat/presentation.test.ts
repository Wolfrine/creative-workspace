import { describe, expect, it } from 'vitest';
import type { HeartbeatBeat, HeartbeatTone } from './model';
import { createHeartbeatFeelingMap, heartbeatLegend } from './presentation';
import { continuityAnnotation } from '../../tests/helpers/heartbeat-continuity-fixture';

const beat = (foreground: string, tone: HeartbeatTone = 'warm', index = 0, change: Partial<HeartbeatBeat> = {}): HeartbeatBeat => ({
  start: index * 10, end: index * 10 + 9, quote: 'A passage', foreground, tone,
  weight: 3, trajectory: 'hold', reasoning: 'Synthetic interpretation.', ...change,
});

describe('Heartbeat document feeling map', () => {
  it('distinguishes the reported Eager calm / Quiet reward collision in a seven-region reproduction', () => {
    // Existing public synthetic counterpart; no private writing is used.
    const beats = continuityAnnotation().beats;
    const map = createHeartbeatFeelingMap(beats);
    expect(map.status).toBe('ready');
    expect(map.entries).toHaveLength(7);
    expect(map.entryFor(beats[0])?.color).not.toBe(map.entryFor(beats[6])?.color);
    expect(map.entryFor(beats[0])?.feeling).toBe('Eager calm');
    expect(map.entryFor(beats[6])?.feeling).toBe('Quiet reward');
    expect(new Set(map.entries.map(entry => entry.color)).size).toBe(7);
    expect(new Set(map.entries.map(entry => entry.mark)).size).toBe(7);
  });

  it('allocates once from the full document and only filters on page changes', () => {
    const all = [beat('Eager calm'), beat('Quiet reward', 'warm', 1), beat('Eager calm', 'cool', 2), beat('Awe', 'wonder', 3)];
    const map = createHeartbeatFeelingMap(all);
    const page1 = map.visibleEntries(all.slice(0, 2));
    const page2 = map.visibleEntries(all.slice(2));
    const first = page1.find(entry => entry.feeling === 'Eager calm')!;
    const repeated = page2.find(entry => entry.feeling === 'Eager calm')!;
    expect([first.key, first.color, first.token, first.mark]).toEqual([repeated.key, repeated.color, repeated.token, repeated.mark]);
    expect(first.beats).toEqual([all[0]]);
    expect(repeated.beats).toEqual([all[2]]);
    expect(map.entryFor(all[0])?.beats).toEqual([all[0], all[2]]);
    expect(map.visibleEntries(all.slice(0, 2))).toEqual(page1);
    expect(heartbeatLegend(all.slice(2), all)).toEqual(page2);
  });

  it('deduplicates a normalized foreground across tones without modifying source metadata', () => {
    const all = [beat('  Eager   calm  '), beat('EAGER CALM', 'cool', 1), beat('Ｅａｇｅｒ calm', 'tense', 2)];
    const before = structuredClone(all);
    all.forEach(Object.freeze); Object.freeze(all);
    const map = createHeartbeatFeelingMap(all);
    expect(map.entries).toHaveLength(1);
    expect(map.entries[0].feeling).toBe('Eager calm');
    expect(map.entries[0].foregrounds).toEqual(before.map(item => item.foreground));
    expect(map.entries[0].beats).toEqual(all);
    expect(map.entryFor(all[1])?.color).toBe(map.entryFor(all[0])?.color);
    expect(all).toEqual(before);
  });

  it('normalizes composed Unicode without conflating different words', () => {
    const all = [beat('Café'), beat('Cafe\u0301', 'cool', 1), beat('Cafe', 'warm', 2)];
    const map = createHeartbeatFeelingMap(all);
    expect(map.entries).toHaveLength(2);
    expect(map.entryFor(all[0])).toBe(map.entryFor(all[1]));
    expect(map.entryFor(all[0])?.color).not.toBe(map.entryFor(all[2])?.color);
  });

  it('keeps supplied tone-family anchors before allocating repeated-tone accents', () => {
    const tones: HeartbeatTone[] = ['warm', 'cool', 'tense', 'tender', 'somber', 'wonder', 'neutral'];
    const anchors = tones.map((tone, index) => beat(`Feeling ${index}`, tone, index + 1));
    const baseline = createHeartbeatFeelingMap(anchors);
    const withCollision = createHeartbeatFeelingMap([beat('Extra warmth'), ...anchors]);
    for (const anchor of anchors.filter(item => item.tone !== 'warm')) expect(withCollision.entryFor(anchor)?.token).toBe(baseline.entryFor(anchor)?.token);
    expect(new Set(withCollision.entries.map(entry => entry.color)).size).toBe(withCollision.entries.length);
  });

  it('is deterministic in document order even if the caller passes a reordered array', () => {
    const all = [beat('Hope'), beat('Trust', 'warm', 1), beat('Awe', 'wonder', 2), beat('Hope', 'cool', 3)];
    const values = (beats: HeartbeatBeat[]) => createHeartbeatFeelingMap(beats).entries.map(entry => [entry.key, entry.color, entry.mark, entry.feeling]);
    expect(values([...all].reverse())).toEqual(values(all));
  });

  it('uses one explicit Other feelings bucket after the finite palette, including 80 distinct labels', () => {
    const all = Array.from({ length: 80 }, (_, index) => beat(`Feeling ${index + 1}`, 'warm', index));
    const map = createHeartbeatFeelingMap(all);
    const overflow = map.entries.filter(entry => entry.bucket === 'overflow');
    expect(map.status).toBe('ready');
    expect(map.entries.length).toBeLessThanOrEqual(12);
    expect(overflow).toHaveLength(1);
    expect(overflow[0]).toMatchObject({ feeling: 'Other feelings', pattern: 'dotted', isRest: false });
    expect(overflow[0].foregrounds.length).toBeGreaterThan(1);
    expect(overflow[0].beats.length).toBe(overflow[0].foregrounds.length);
    expect(map.entries.reduce((total, entry) => total + entry.beats.length, 0)).toBe(80);
    expect(new Set(map.entries.map(entry => entry.color)).size).toBe(map.entries.length);
    expect(new Set(map.entries.map(entry => entry.mark)).size).toBe(map.entries.length);
    expect(new Set(map.entries.map(entry => entry.feeling)).size).toBe(map.entries.length);
    for (const item of overflow[0].beats) expect(map.entryFor(item)).toBe(overflow[0]);
    const lastPage = map.visibleEntries(all.slice(-2));
    expect(lastPage).toHaveLength(1);
    expect(lastPage[0].color).toBe(overflow[0].color);
    expect(lastPage[0].feeling).toBe('Other feelings');
    expect(lastPage[0].foregrounds).toEqual(['Feeling 79', 'Feeling 80']);
  });

  it('retains a neutral Rest bucket while preserving the supplied rest foregrounds', () => {
    const all = [beat('Breathing space', 'neutral', 0, { trajectory: 'quiet' }), beat('Stillness', 'neutral', 1, { trajectory: 'quiet' }), beat('Breathing space', 'warm', 2)];
    const map = createHeartbeatFeelingMap(all);
    const rest = map.entryFor(all[0])!;
    expect(rest).toMatchObject({ feeling: 'Rest', bucket: 'rest', isRest: true, tone: 'neutral', pattern: 'dashed', token: 'rest' });
    expect(rest.foregrounds).toEqual(['Breathing space', 'Stillness']);
    expect(map.entryFor(all[1])).toBe(rest);
    expect(map.entryFor(all[2])?.color).not.toBe(rest.color);
    expect(map.entryFor(all[2])?.feeling).toBe('Breathing space');
  });

  it('does not call neutral non-quiet beats Rest or show an ambiguous supplied bucket label', () => {
    const all = [beat('Rest', 'neutral'), beat('Other feelings', 'cool', 1), beat('“Rest”', 'cool', 2), beat('Pause', 'neutral', 3, { trajectory: 'quiet' }), ...Array.from({ length: 15 }, (_, i) => beat(`Feeling ${i + 1}`, 'warm', i + 4))];
    const map = createHeartbeatFeelingMap(all);
    const suppliedRest = map.entryFor(all[0])!;
    expect(suppliedRest).toMatchObject({ bucket: null, isRest: false, labelQualifier: 'Supplied label' });
    expect(suppliedRest.feeling).not.toBe('Rest');
    expect(map.entryFor(all[1])?.labelQualifier).toBe('Supplied label');
    expect(new Set(map.entries.map(entry => entry.feeling.toLowerCase())).size).toBe(map.entries.length);
    expect(map.entryFor(all[3])?.token).toBe('rest');
  });

  it('uses labels of at most three words and keeps undertone, weight, reasoning and originals unchanged', () => {
    const all = Array.from({ length: 30 }, (_, index) => beat(`A feeling ${index}`, 'warm', index, { undertone: 'Doubt', weight: 5, reasoning: 'Exact source explanation.' }));
    const before = structuredClone(all);
    const map = createHeartbeatFeelingMap(all);
    expect(map.entries.every(entry => entry.feeling.split(/\s+/u).length <= 3)).toBe(true);
    expect(all).toEqual(before);
    expect(map.entries.flatMap(entry => entry.beats).sort((a, b) => a.start - b.start)).toEqual(all);
  });

  it('uses separated opaque palette colors, plus marks so color is not the only cue', () => {
    const tones: HeartbeatTone[] = ['warm', 'cool', 'tense', 'tender', 'somber', 'wonder', 'neutral'];
    const all = [...tones.map((tone, index) => beat(`Feeling ${index}`, tone, index)), ...Array.from({ length: 5 }, (_, index) => beat(`Extra ${index}`, 'warm', index + 7)), beat('Pause', 'neutral', 12, { trajectory: 'quiet' })];
    const entries = createHeartbeatFeelingMap(all).entries;
    expect(entries).toHaveLength(12);
    // CIELAB spacing is a regression guard against almost-identical shades,
    // not a claim of universal perception or color-vision accessibility.
    const lab = (hex: string) => {
      const [r, g, b] = hex.slice(1).match(/../g)!.map(part => parseInt(part, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      const f = (value: number) => value > 216 / 24389 ? value ** (1 / 3) : (24389 / 27 * value + 16) / 116;
      const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047), y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b), z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(part => parseInt(part, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (first: string, second: string) => (Math.max(luminance(first), luminance(second)) + 0.05) / (Math.min(luminance(first), luminance(second)) + 0.05);
    entries.forEach((entry, index) => {
      expect(entry.color).toMatch(/^#[\da-f]{6}$/i);
      expect(entry.nightColor).toMatch(/^#[\da-f]{6}$/i);
      expect(entry.mark.trim()).not.toBe('');
      expect(contrast(entry.color, '#fcfbf6')).toBeGreaterThan(3);
      expect(contrast(entry.nightColor, '#242b27')).toBeGreaterThan(3);
      const first = lab(entry.color);
      const night = lab(entry.nightColor);
      for (const other of entries.slice(index + 1)) expect(Math.hypot(...first.map((value, axis) => value - lab(other.color)[axis]))).toBeGreaterThan(20);
      for (const other of entries.slice(index + 1)) expect(Math.hypot(...night.map((value, axis) => value - lab(other.nightColor)[axis]))).toBeGreaterThan(20);
    });
  });

  it('does not invent neutral coverage for empty or sparse source ranges', () => {
    expect(createHeartbeatFeelingMap([])).toMatchObject({ status: 'empty', entries: [] });
    expect(createHeartbeatFeelingMap([]).entryFor(beat('Hope'))).toBeUndefined();
    const sparse = [beat('Hope', 'warm', 2)];
    const map = createHeartbeatFeelingMap(sparse);
    expect(map.entries.flatMap(entry => entry.beats)).toEqual(sparse);
    expect(map.entries.some(entry => entry.isRest)).toBe(false);
    expect(map.visibleEntries([])).toEqual([]);
    expect(map.visibleEntries([beat('Unknown', 'cool', 8)])).toEqual([]);
  });

  it.each([null, {}, Array(1), [null], Array.from({ length: 81 }, (_, index) => beat(`Feeling ${index}`, 'warm', index)), [beat('')], [beat('Four word feeling label')], [beat('x'.repeat(49))], [beat('Hope', 'bad' as HeartbeatTone)], [beat('Hope', 'warm', 0, { start: -1 })], [beat('Hope', 'warm', 0, { trajectory: 'unknown' as HeartbeatBeat['trajectory'] })]])('fails closed for malformed or oversized input %#', input => {
    const map = createHeartbeatFeelingMap(input as HeartbeatBeat[]);
    expect(map).toMatchObject({ status: 'invalid', entries: [] });
    expect(map.entryFor(beat('Hope'))).toBeUndefined();
    expect(map.visibleEntries([beat('Hope')])).toEqual([]);
  });
});
