import type { WorkspaceSnapshot } from '../domain/model';
import { sha256, stableStringify, validateSnapshot } from '../domain/codec';

export interface WritingArchive { format: 'noveliaa-writing-archive'; schemaVersion: 1; exportedAt: string; snapshot: WorkspaceSnapshot; sha256: string }
export async function encodeArchive(snapshot: WorkspaceSnapshot): Promise<Blob> {
  await validateSnapshot(snapshot);
  const payload = { format: 'noveliaa-writing-archive' as const, schemaVersion: 1 as const, exportedAt: new Date().toISOString(), snapshot };
  const archive = new Blob([JSON.stringify({ ...payload, sha256: await sha256(stableStringify(payload)) }, null, 2)], { type: 'application/json' });
  if (archive.size > 64 * 1024 * 1024) throw new Error('This notebook exceeds the initial 64 MiB portable-archive limit. Its device history is unchanged. Export individual writing as text or HTML; a larger archive format is needed before moving the complete history.');
  return archive;
}
export async function decodeArchive(text: string): Promise<WorkspaceSnapshot> {
  if (new TextEncoder().encode(text).length > 64 * 1024 * 1024) throw new Error('Archive is larger than the supported 64 MiB. Nothing was changed.');
  const archive = JSON.parse(text) as WritingArchive;
  if (archive.format !== 'noveliaa-writing-archive' || archive.schemaVersion !== 1) throw new Error('Unsupported archive format or schema version. Nothing was changed.');
  const { sha256: expected, ...payload } = archive;
  if (expected !== await sha256(stableStringify(payload))) throw new Error('Archive integrity check failed. Nothing was changed.');
  await validateSnapshot(archive.snapshot);
  return archive.snapshot;
}
export function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
