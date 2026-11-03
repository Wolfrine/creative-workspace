import type { RichNode, Revision, WritingDocument } from '../domain/model';
import { stableStringify } from '../domain/codec';

export type HeartbeatTone = 'warm' | 'cool' | 'tense' | 'tender' | 'somber' | 'wonder' | 'neutral';
export interface HeartbeatBeat {
  start: number; end: number; quote: string; foreground: string; undertone?: string;
  weight: number; trajectory: 'build' | 'hold' | 'shift' | 'release' | 'quiet';
  tone: HeartbeatTone; reasoning: string;
}
export interface HeartbeatAnnotation {
  id: string; schema: 'noveliaa-heartbeat-1';
  anchor: { documentId: string; revisionId: string; contentHash: string; title: string };
  attribution: { provider: string; model: string }; contextNote: string;
  beats: HeartbeatBeat[]; origin: 'ai'; verification: 'unverified'; createdAt: string;
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
const boundary = (text: string, index: number) => !(index > 0 && index < text.length && /[\uD800-\uDBFF]/.test(text[index - 1]) && /[\uDC00-\uDFFF]/.test(text[index]));
/** Defence in depth: never attach an inference by a coincidentally matching quote. */
export function eligibleHeartbeat(annotation: HeartbeatAnnotation, document: WritingDocument, revision: Revision, hash: string): boolean {
  if (!annotation || annotation.schema !== 'noveliaa-heartbeat-1' || annotation.origin !== 'ai' || annotation.verification !== 'unverified' || annotation.anchor?.documentId !== document.id || annotation.anchor.revisionId !== revision.id || annotation.anchor.contentHash !== hash || hash !== revision.contentHash || !annotation.attribution?.provider || !annotation.attribution.model || !Array.isArray(annotation.beats) || annotation.beats.length > 80) return false;
  let end = 0;
  return annotation.beats.every(beat => {
    const valid = Number.isInteger(beat.start) && Number.isInteger(beat.end) && beat.start >= end && beat.end > beat.start && beat.end <= document.plainText.length && boundary(document.plainText, beat.start) && boundary(document.plainText, beat.end) && document.plainText.slice(beat.start, beat.end) === beat.quote && typeof beat.foreground === 'string' && beat.foreground.trim().split(/\s+/u).length <= 3 && beat.foreground.trim().length > 0 && (!beat.undertone || typeof beat.undertone === 'string' && beat.undertone.trim().split(/\s+/u).length <= 3) && Number.isInteger(beat.weight) && beat.weight >= 1 && beat.weight <= 5 && tones.has(beat.tone) && movements.has(beat.trajectory) && typeof beat.reasoning === 'string';
    end = beat.end; return valid;
  });
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
