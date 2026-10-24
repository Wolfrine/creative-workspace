export const SCHEMA_VERSION = 1 as const;
export type Origin = 'author' | 'recovered_original' | 'remembered_reconstruction' | 'imported_chat' | 'ai' | 'mixed' | 'unknown';
export interface RichNode { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: RichNode[] }
export interface WritingDocument {
  id: string; universeId: string; title: string; body: RichNode; plainText: string;
  collectionId: string | null; trashed: boolean; order: number;
  origin: Origin; sourceOriginalIds: string[]; createdAt: string; updatedAt: string;
  headRevisionId: string | null;
}
export interface Revision {
  id: string; documentId: string; universeId: string; parentIds: string[];
  snapshot: Omit<WritingDocument, 'headRevisionId'>; contentHash: string;
  createdAt: string; restoredFrom?: string;
}
export interface Original {
  id: string; universeId: string; name: string; bytesBase64: string; sha256: string;
  origin: Origin; verification: 'verified' | 'unverified' | 'mixed';
  sourceReference: string; createdAt: string;
  speakerSegments?: { role: 'user' | 'assistant' | 'unknown'; start: number; end: number }[];
}
export interface Universe { id: string; name: string; createdAt: string }
export interface Collection { id: string; universeId: string; name: string; order: number }
export interface SaveReceipt { revisionId: string; level: 'local' | 'cloud'; at: string; conflict?: boolean }
export interface WorkspaceSnapshot {
  schemaVersion: 1; accountId: string; universes: Universe[]; collections: Collection[];
  documents: WritingDocument[]; revisions: Revision[]; originals: Original[]; receipts: SaveReceipt[];
}
export interface CommitOperation { operationId: string; expectedHeadId: string | null; revision: Revision }
export interface CommitResult { status: 'synced' | 'conflict'; headRevisionId: string | null }
export interface CloudAdapter {
  /** Active server-selected workspace; older device stores cannot repopulate a reset. */
  workspaceId?: string;
  load(known?: WorkspaceSnapshot): Promise<WorkspaceSnapshot>;
  watch?(onChange: () => void, onError: (error: unknown) => void): () => void;
  commit(operation: CommitOperation): Promise<CommitResult>;
  putOriginal(original: Original): Promise<void>;
  putCatalog(universes: Universe[], collections: Collection[]): Promise<void>;
  registerDocuments?(documents: { id: string; universeId: string }[]): Promise<void>;
}
export type SaveState = 'saving' | 'local' | 'syncing' | 'synced' | 'conflict' | 'error';
export interface WorkspaceState extends WorkspaceSnapshot {
  ready: boolean; localOnly: boolean; activeUniverseId: string; activeDocumentId: string | null;
  saveState: SaveState; error: string | null; pendingCount: number; online: boolean;
  conflictedDocumentIds: string[];
}
export interface Session { uid: string; displayName: string; localOnly: boolean; workspaceId?: string; signOut(): Promise<void> }
export interface WorkspaceController {
  state: WorkspaceState;
  createDocument(options?: { title?: string; body?: RichNode; collectionId?: string | null }): Promise<string>;
  updateDocument(id: string, patch: Partial<Pick<WritingDocument, 'title' | 'body' | 'collectionId' | 'trashed' | 'order'>>): void;
  selectDocument(id: string): Promise<void>;
  createUniverse(name: string): Promise<void>;
  selectUniverse(id: string): Promise<void>;
  createCollection(name: string): Promise<void>;
  restoreRevision(id: string): Promise<void>;
  sync(): Promise<void>;
  flush(): Promise<void>;
  exportArchive(): Promise<Blob>;
  importArchive(file: File): Promise<void>;
  importText(file: File, origin?: Origin): Promise<string>;
  exportDocument(id: string, format: 'txt' | 'html' | 'md'): Promise<Blob>;
  clearError(): void;
}
export const emptyBody = (): RichNode => ({ type: 'doc', content: [{ type: 'paragraph' }] });
export const textBody = (text: string): RichNode => ({ type: 'doc', content: text.replace(/\r\n/g, '\n').split('\n').map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) });
export function plainText(node: RichNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  const children = node.content ?? [];
  const separator = ['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type) ? '\n' : '';
  return children.map(plainText).join(separator);
}
export function linkIds(node: RichNode): string[] {
  const result = new Set<string>();
  const walk = (n: RichNode) => {
    for (const mark of n.marks ?? []) {
      const href = String(mark.attrs?.href ?? '');
      if (mark.type === 'link' && href.startsWith('noveliaa://document/')) result.add(href.slice('noveliaa://document/'.length));
    }
    n.content?.forEach(walk);
  };
  walk(node); return [...result];
}
export function wordCount(text: string): number { return text.trim() ? text.trim().split(/\s+/u).length : 0; }
