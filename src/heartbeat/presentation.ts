import type { HeartbeatBeat, HeartbeatTone } from './model';

/** Symbols distinguish the key without assigning new meaning to model labels. */
export const heartbeatSymbols: Record<HeartbeatTone, string> = { warm: '☀', cool: '≈', tense: '⌁', tender: '♡', somber: '◒', wonder: '✧', neutral: '—' };
export interface HeartbeatLegendEntry { tone: HeartbeatTone; feeling: string; beats: HeartbeatBeat[] }
export function heartbeatLegend(beats: HeartbeatBeat[]): HeartbeatLegendEntry[] {
  const entries = new Map<string, HeartbeatLegendEntry>();
  for (const beat of beats) {
    const key = JSON.stringify([beat.tone, beat.foreground]);
    const entry = entries.get(key);
    if (entry) entry.beats.push(beat);
    else entries.set(key, { tone: beat.tone, feeling: beat.foreground, beats: [beat] });
  }
  return [...entries.values()];
}
