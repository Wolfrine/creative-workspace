import { isHeartbeatRest, type HeartbeatBeat, type HeartbeatTone } from './model';

/** Kept for older callers. New display surfaces use an entry's own mark/color. */
export const heartbeatSymbols: Record<HeartbeatTone, string> = { warm: '☀', cool: '≈', tense: '⌁', tender: '♡', somber: '◒', wonder: '✧', neutral: '—' };

export interface HeartbeatDisplayStyle {
  token: string;
  /** Opaque accents for the light and night papers; never use as prose fill. */
  color: string; nightColor: string;
  mark: string; pattern: 'solid' | 'dashed' | 'dotted';
}
type FamilyStyle = HeartbeatDisplayStyle & { family?: HeartbeatTone };

/** A finite categorical palette, not eighty nearly-identical shades. The first
 * seven slots retain supplied tone-family anchors. Remaining slots distinguish
 * additional foregrounds, without claiming a new emotional taxonomy. Colors
 * are for opaque rail/key accents; marks remain necessary for color vision. */
export const heartbeatFeelingPalette: readonly FamilyStyle[] = [
  { token: 'warm', family: 'warm', color: '#B87508', nightColor: '#E5AC46', mark: '☀', pattern: 'solid' },
  { token: 'cool', family: 'cool', color: '#2874B3', nightColor: '#6EADE1', mark: '≈', pattern: 'solid' },
  { token: 'tense', family: 'tense', color: '#BD4135', nightColor: '#EF8B78', mark: '⌁', pattern: 'solid' },
  { token: 'tender', family: 'tender', color: '#AB4B7F', nightColor: '#D991B5', mark: '♡', pattern: 'solid' },
  { token: 'somber', family: 'somber', color: '#7662A3', nightColor: '#B39BDA', mark: '◒', pattern: 'solid' },
  { token: 'wonder', family: 'wonder', color: '#138677', nightColor: '#62BCA8', mark: '✧', pattern: 'solid' },
  { token: 'neutral', family: 'neutral', color: '#323B35', nightColor: '#E1E5DF', mark: '•', pattern: 'solid' },
  { token: 'olive', color: '#6D8621', nightColor: '#BED36B', mark: '△', pattern: 'solid' },
  { token: 'copper', color: '#B76B39', nightColor: '#ECB38B', mark: '◇', pattern: 'solid' },
  { token: 'cyan', color: '#238DAB', nightColor: '#77D5E7', mark: '○', pattern: 'solid' },
];
/** Rest is explicit tone=neutral + trajectory=quiet, never missing analysis. */
export const heartbeatRestStyle: Readonly<HeartbeatDisplayStyle> = { token: 'rest', color: '#7E837E', nightColor: '#9EA79E', mark: '—', pattern: 'dashed' };
export const heartbeatOverflowStyle: Readonly<HeartbeatDisplayStyle> = { token: 'other', color: '#342D60', nightColor: '#8A70CF', mark: '⋯', pattern: 'dotted' };

export interface HeartbeatLegendEntry extends HeartbeatDisplayStyle {
  key: string;
  /** Representative supplied family, not the identity used for painting. */
  tone: HeartbeatTone;
  /** One honest display label per color; original labels remain below. */
  feeling: string;
  foregrounds: string[];
  beats: HeartbeatBeat[];
  bucket: 'rest' | 'overflow' | null;
  isRest: boolean;
  /** Disambiguates a source label literally named Rest or Other feelings. */
  labelQualifier?: 'Supplied label';
}
type FeelingSource = Pick<HeartbeatBeat, 'foreground' | 'tone' | 'trajectory'>;
export interface HeartbeatFeelingMap {
  status: 'ready' | 'empty' | 'invalid';
  entries: HeartbeatLegendEntry[];
  /** Also accepts derived source regions; the document map allocates colors. */
  entryFor(beat: FeelingSource): HeartbeatLegendEntry | undefined;
  /** Filters the existing document map; it never allocates from a spread. */
  visibleEntries(beats: readonly HeartbeatBeat[]): HeartbeatLegendEntry[];
}

const tones = new Set<HeartbeatTone>(['warm', 'cool', 'tense', 'tender', 'somber', 'wonder', 'neutral']);
const trajectories = new Set<HeartbeatBeat['trajectory']>(['build', 'hold', 'shift', 'release', 'quiet']);
const displayLabel = (value: string): string => value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
const normalizeFeeling = (value: string): string => displayLabel(value).toLowerCase();
const shortLabel = (value: unknown): value is string => typeof value === 'string' && value.length <= 48 && !!displayLabel(value) && displayLabel(value).length <= 48 && displayLabel(value).split(' ').length <= 3 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
function sourceKey(beat: FeelingSource): string | undefined {
  if (!beat || !shortLabel(beat.foreground) || !tones.has(beat.tone) || !trajectories.has(beat.trajectory)) return undefined;
  return isHeartbeatRest(beat) ? 'rest' : `feeling:${normalizeFeeling(beat.foreground)}`;
}
/** This structural guard cannot establish source coverage; eligibility and the
 * recomputed heartbeatCoverage gate still belong to the source model. */
function validDisplayBeat(beat: HeartbeatBeat): boolean {
  return !!sourceKey(beat) && Number.isInteger(beat.start) && Number.isInteger(beat.end) && beat.start >= 0 && beat.end > beat.start && beat.end <= 32000000 && typeof beat.quote === 'string' && beat.quote.length === beat.end - beat.start && beat.quote.length <= 2000 && !!beat.quote.trim() && Number.isInteger(beat.weight) && beat.weight >= 1 && beat.weight <= 5 && (beat.undertone === undefined || shortLabel(beat.undertone)) && typeof beat.reasoning === 'string' && !!beat.reasoning.trim() && beat.reasoning.length <= 1200;
}
const foregroundsOf = (beats: readonly HeartbeatBeat[]): string[] => [...new Set(beats.map(beat => beat.foreground))];
const emptyMap = (status: 'empty' | 'invalid'): HeartbeatFeelingMap => ({ status, entries: [], entryFor: () => undefined, visibleEntries: () => [] });

/** Derive once from ALL beats in the exact document revision. A normalized
 * foreground has one display identity across supplied tones. Explicit rests
 * form their own honest common bucket; excess foregrounds share only the
 * explicitly labelled Other feelings bucket, with exact labels in details.
 * No annotation, source beat or source metadata is changed. */
export function createHeartbeatFeelingMap(documentBeats: readonly HeartbeatBeat[]): HeartbeatFeelingMap {
  if (!Array.isArray(documentBeats) || documentBeats.length > 80 || !Array.from(documentBeats).every(validDisplayBeat)) return emptyMap('invalid');
  if (!documentBeats.length) return emptyMap('empty');
  const ordered = [...documentBeats].sort((a, b) => a.start - b.start || a.end - b.end);
  if (ordered.some((beat, index) => index > 0 && beat.start < ordered[index - 1].end)) return emptyMap('invalid');
  const groups = new Map<string, { key: string; tone: HeartbeatTone; beats: HeartbeatBeat[] }>();
  for (const beat of ordered) {
    const key = sourceKey(beat)!;
    const group = groups.get(key);
    if (group) group.beats.push(beat);
    else groups.set(key, { key, tone: key === 'rest' ? 'neutral' : beat.tone, beats: [beat] });
  }

  // Reserve present families before resolving collisions: an early second warm
  // foreground must not take the cool slot of a later source beat.
  const allocation = new Map<string, FamilyStyle>(), used = new Set<string>();
  for (const group of groups.values()) {
    if (group.key === 'rest') continue;
    const style = heartbeatFeelingPalette.find(candidate => candidate.family === group.tone);
    if (style && !used.has(style.token)) { allocation.set(group.key, style); used.add(style.token); }
  }
  for (const group of groups.values()) {
    if (group.key === 'rest' || allocation.has(group.key)) continue;
    const style = heartbeatFeelingPalette.find(candidate => !candidate.family && !used.has(candidate.token)) || heartbeatFeelingPalette.find(candidate => !used.has(candidate.token));
    if (style) { allocation.set(group.key, style); used.add(style.token); }
  }

  const entries: HeartbeatLegendEntry[] = [], bySource = new Map<string, HeartbeatLegendEntry>();
  const usedLabels = new Set(['rest', 'other feelings']);
  let overflow: HeartbeatLegendEntry | undefined;
  for (const group of groups.values()) {
    if (group.key !== 'rest' && !allocation.has(group.key)) {
      if (!overflow) {
        overflow = { ...heartbeatOverflowStyle, key: 'other', tone: 'neutral', feeling: 'Other feelings', foregrounds: [], beats: [], bucket: 'overflow', isRest: false };
        entries.push(overflow);
      }
      overflow.beats.push(...group.beats); bySource.set(group.key, overflow); continue;
    }
    const rest = group.key === 'rest', supplied = displayLabel(group.beats[0].foreground);
    let feeling = rest ? 'Rest' : supplied;
    if (!rest) {
      while (usedLabels.has(normalizeFeeling(feeling))) feeling = `“${feeling}”`;
      usedLabels.add(normalizeFeeling(feeling));
    }
    const entry: HeartbeatLegendEntry = {
      ...(rest ? heartbeatRestStyle : allocation.get(group.key)!), key: group.key, tone: group.tone, feeling,
      foregrounds: foregroundsOf(group.beats), beats: group.beats, bucket: rest ? 'rest' : null, isRest: rest,
      ...(!rest && feeling !== supplied ? { labelQualifier: 'Supplied label' as const } : {}),
    };
    entries.push(entry); bySource.set(group.key, entry);
  }
  if (overflow) { overflow.beats.sort((a, b) => a.start - b.start); overflow.foregrounds = foregroundsOf(overflow.beats); }

  const entryFor = (beat: FeelingSource) => { const key = sourceKey(beat); return key ? bySource.get(key) : undefined; };
  return {
    status: 'ready', entries, entryFor,
    visibleEntries(visible) {
      if (!Array.isArray(visible) || visible.length > 80) return [];
      // Match exact supplied document passages, allowing equivalent cloned beat
      // objects without letting unknown ranges create new legend entries.
      const selected = new Set(visible.filter(validDisplayBeat).map(beat => JSON.stringify([beat.start, beat.end, sourceKey(beat)])));
      return entries.flatMap(entry => {
        const beats = entry.beats.filter(beat => selected.has(JSON.stringify([beat.start, beat.end, sourceKey(beat)])));
        return beats.length ? [{ ...entry, beats, foregrounds: foregroundsOf(beats) }] : [];
      });
    },
  };
}

/** Compatibility helper. Pass allDocumentBeats when displaying a page/spread. */
export function heartbeatLegend(beats: readonly HeartbeatBeat[], allDocumentBeats: readonly HeartbeatBeat[] = beats): HeartbeatLegendEntry[] {
  return createHeartbeatFeelingMap(allDocumentBeats).visibleEntries(beats);
}
