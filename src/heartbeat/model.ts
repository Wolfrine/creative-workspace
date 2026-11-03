import type { RichNode, Revision, WritingDocument } from '../domain/model';
import { stableStringify } from '../domain/codec';

export type HeartbeatTone = 'warm' | 'cool' | 'tense' | 'tender' | 'somber' | 'wonder' | 'neutral';
export interface HeartbeatBeat {
  start: number; end: number; quote: string; foreground: string; undertone?: string;
  weight: number; trajectory: 'build' | 'hold' | 'shift' | 'release' | 'quiet';
  tone: HeartbeatTone; reasoning: string;
}
export interface HeartbeatCoverage {
  contract: 'noveliaa-heartbeat-continuity-1'; status: 'continuous' | 'sparse' | 'empty' | 'invalid';
  sourceCharacters: number; meaningfulCharacters: number; coveredMeaningfulCharacters: number; uncoveredMeaningfulCharacters: number;
}
export interface HeartbeatRegion {
  start: number; end: number; foreground: string; undertone?: string; tone: HeartbeatTone;
  weight: number; trajectory: HeartbeatBeat['trajectory']; beatIndexes: number[];
}
export interface HeartbeatAnnotation {
  id: string; schema: 'noveliaa-heartbeat-1';
  anchor: { documentId: string; revisionId: string; contentHash: string; title: string };
  attribution: { provider: string; model: string }; contextNote: string;
  beats: HeartbeatBeat[]; coverage?: HeartbeatCoverage; origin: 'ai'; verification: 'unverified'; createdAt: string;
}
export interface HeartbeatResponse { schema: 'noveliaa-heartbeat-1'; annotations: HeartbeatAnnotation[]; sourceIsCurrent: boolean }
export function heartbeatSource(document: WritingDocument): string {
  const { headRevisionId: _head, ...snapshot } = document;
  return stableStringify(snapshot);
}
export function heartbeatRevision(document: WritingDocument, revisions: Revision[], source = heartbeatSource(document)): Revision | undefined {
  return revisions.find(item => item.id === document.headRevisionId && item.documentId === document.id && stableStringify(item.snapshot) === source);
}
const tones = new Set(['warm', 'cool', 'tense', 'tender', 'somber', 'wonder', 'neutral']);
const movements = new Set(['build', 'hold', 'shift', 'release', 'quiet']);
const beatFields = new Set(['start', 'end', 'quote', 'foreground', 'undertone', 'weight', 'trajectory', 'tone', 'reasoning']);
const boundary = (text: string, index: number) => !(index > 0 && index < text.length && /[\uD800-\uDBFF]/.test(text[index - 1]) && /[\uDC00-\uDFFF]/.test(text[index]));
const shortText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max && value.trim().length > 0;
const label = (value: unknown): value is string => shortText(value, 48) && value.trim() === value && value.split(/\s+/u).length <= 3;
function validBeats(plainText: string, beats: unknown): beats is HeartbeatBeat[] {
  if (!Array.isArray(beats) || beats.length > 80) return false;
  let end = 0;
  for (const beat of beats) {
    if (!beat || typeof beat !== 'object' || Object.keys(beat).some(key => !beatFields.has(key))) return false;
    if (!(Number.isInteger(beat.start) && Number.isInteger(beat.end) && beat.start >= end && beat.end > beat.start && beat.end <= 32000000 && beat.end <= plainText.length && boundary(plainText, beat.start) && boundary(plainText, beat.end) && shortText(beat.quote, 2000) && plainText.slice(beat.start, beat.end) === beat.quote && label(beat.foreground) && (beat.undertone === undefined || label(beat.undertone)) && Number.isInteger(beat.weight) && beat.weight >= 1 && beat.weight <= 5 && tones.has(beat.tone) && movements.has(beat.trajectory) && shortText(beat.reasoning, 1200))) return false;
    end = beat.end;
  }
  return true;
}
const meaningfulUnits = (text: string): number => {
  let count = 0;
  for (const character of text) if (/\S/u.test(character)) count += character.length;
  return count;
};
/** Verifies explicit source coverage, never emotional accuracy. Recompute even
 * when the server supplies metadata, including for historical annotations. */
export function heartbeatCoverage(plainText: string, beats: unknown): HeartbeatCoverage {
  const meaningfulCharacters = meaningfulUnits(plainText), valid = validBeats(plainText, beats);
  const coveredMeaningfulCharacters = valid ? beats.reduce((count, beat) => count + meaningfulUnits(beat.quote), 0) : 0;
  const uncoveredMeaningfulCharacters = meaningfulCharacters - coveredMeaningfulCharacters;
  return { contract: 'noveliaa-heartbeat-continuity-1', status: !valid ? 'invalid' : !plainText.length ? 'empty' : !beats.length || uncoveredMeaningfulCharacters ? 'sparse' : 'continuous',
    sourceCharacters: plainText.length, meaningfulCharacters, coveredMeaningfulCharacters, uncoveredMeaningfulCharacters };
}
/** Rest is an explicit supplied interpretation, never the absence of a beat. */
export const isHeartbeatRest = (beat: Pick<HeartbeatBeat, 'tone' | 'trajectory'>): boolean => beat.tone === 'neutral' && beat.trajectory === 'quiet';
/** Adjacent identical feeling states form one visual region. Preserve every
 * source beat index for reasoning; never extend a state over an unannotated gap. */
export function heartbeatRegions(plainText: string, beats: HeartbeatBeat[]): HeartbeatRegion[] {
  if (heartbeatCoverage(plainText, beats).status !== 'continuous') return [];
  const regions: HeartbeatRegion[] = [];
  beats.forEach((beat, index) => {
    const previous = regions.at(-1);
    if (previous && previous.end === beat.start && previous.foreground === beat.foreground && previous.undertone === beat.undertone && previous.tone === beat.tone && previous.weight === beat.weight && previous.trajectory === beat.trajectory) {
      previous.end = beat.end; previous.beatIndexes.push(index);
    } else regions.push({ start: beat.start, end: beat.end, foreground: beat.foreground, ...(beat.undertone !== undefined ? { undertone: beat.undertone } : {}), tone: beat.tone, weight: beat.weight, trajectory: beat.trajectory, beatIndexes: [index] });
  });
  return regions;
}
/** Defence in depth: never attach an inference by a coincidentally matching quote. */
export function eligibleHeartbeat(annotation: HeartbeatAnnotation, document: WritingDocument, revision: Revision, hash: string): boolean {
  return !!annotation && annotation.schema === 'noveliaa-heartbeat-1' && annotation.origin === 'ai' && annotation.verification === 'unverified' && annotation.anchor?.documentId === document.id && annotation.anchor.revisionId === revision.id && annotation.anchor.contentHash === hash && hash === revision.contentHash && shortText(annotation.attribution?.provider, 80) && shortText(annotation.attribution.model, 120) && typeof annotation.createdAt === 'string' && validBeats(document.plainText, annotation.beats);
}
/** Exact UTF-16 source offsets mapped to the text-only DOM, skipping only source separators. */
export function heartbeatTextLeaves(body: RichNode): { start: number; end: number; text: string }[] {
  const leaves: { start: number; end: number; text: string }[] = []; let offset = 0;
  const walk = (node: RichNode) => {
    if (node.type === 'text') { const text = node.text || ''; leaves.push({ start: offset, end: offset + text.length, text }); offset += text.length; return; }
    if (node.type === 'hardBreak') { offset++; return; }
    const separator = ['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type);
    (node.content || []).forEach((child, index) => { if (index && separator) offset++; walk(child); });
  };
  walk(body); return leaves;
}
