import type { RichNode, WritingDocument } from '../domain/model';

export interface ReadingAnchor { documentId: string; passage: number; offset: number }
export interface ReadingSnapshot { key: string; title: string; documents: WritingDocument[] }
export interface ReadingBookmark { anchor: ReadingAnchor; sourceVersion: string }
export interface ReadingScope { type: 'document' | 'collection'; id: string }
export const readerOrigin: Record<WritingDocument['origin'], string> = { author: 'Author writing', recovered_original: 'Recovered original', remembered_reconstruction: 'Remembered reconstruction', imported_chat: 'Imported conversation', ai: 'AI-origin · unverified', mixed: 'Mixed origin', unknown: 'Origin unverified' };

/** A reader session is a private projection. Source objects and revision identities stay untouched. */
export function readingSnapshot(documents: WritingDocument[], title: string): ReadingSnapshot {
  const copied = structuredClone(documents.filter(document => !document.trashed));
  return { key: copied.map(document => document.id).join(':'), title, documents: copied };
}
export function readingText(node: RichNode): string { return node.type === 'text' ? node.text || '' : node.type === 'hardBreak' ? '\n' : (node.content || []).map(readingText).join(''); }
export function boundAnchor(value: unknown, documents: WritingDocument[]): ReadingAnchor {
  const input = value && typeof value === 'object' ? value as Partial<ReadingAnchor> : {};
  const document = documents.find(item => item.id === input.documentId) || documents[0];
  const passage = Math.max(0, Math.min((document?.body.content?.length || 1) - 1, Number.isInteger(input.passage) ? input.passage! : 0));
  const length = readingText(document?.body.content?.[passage] || { type: 'paragraph' }).length;
  return { documentId: document?.id || '', passage, offset: Math.max(0, Math.min(length, Number.isInteger(input.offset) ? input.offset! : 0)) };
}
export function safeReaderHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^noveliaa:\/\/document\/[a-zA-Z0-9_-]+$/.test(value) || /^(https?:|mailto:)/i.test(value)) return value;
  return undefined;
}

/** Local resume invalidation only, never a source-integrity or approval claim. */
export function readingVersion(document: WritingDocument): string {
  const text = JSON.stringify(document.body); let first = 2166136261; let second = 5381;
  for (let index = 0; index < text.length; index++) { first = Math.imul(first ^ text.charCodeAt(index), 16777619); second = Math.imul(second, 33) ^ text.charCodeAt(index); }
  return `${text.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}
export function readingBookmark(anchor: ReadingAnchor, documents: WritingDocument[]): ReadingBookmark {
  const document = documents.find(item => item.id === anchor.documentId) || documents[0];
  return { anchor, sourceVersion: document ? readingVersion(document) : '' };
}
export function resumeReading(value: unknown, documents: WritingDocument[]): { anchor: ReadingAnchor; reset: boolean } {
  if (!value || typeof value !== 'object') return { anchor: boundAnchor(null, documents), reset: false };
  const bookmark = value as Partial<ReadingBookmark>;
  const point = boundAnchor(bookmark.anchor, documents);
  const document = documents.find(item => item.id === point.documentId);
  if (document && bookmark.anchor?.documentId === document.id && bookmark.sourceVersion === readingVersion(document)) return { anchor: point, reset: false };
  return { anchor: { documentId: point.documentId, passage: 0, offset: 0 }, reset: true };
}
export function validReadingScope(value: unknown): ReadingScope | null {
  if (!value || typeof value !== 'object') return null;
  const scope = value as Partial<ReadingScope>;
  return (scope.type === 'document' || scope.type === 'collection') && typeof scope.id === 'string' && /^[a-zA-Z0-9_-]{1,150}$/.test(scope.id) ? { type: scope.type, id: scope.id } : null;
}
export function readerPageStart(next: number, pages: number, columns: number): number {
  const count = Math.max(1, columns); const last = Math.floor(Math.max(0, pages - 1) / count) * count;
  return Math.max(0, Math.min(last, Math.floor(next / count) * count));
}
