import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ParagraphIndent, paragraphSource } from '../components/ParagraphIndent';
import { assertBody, sha256, stableStringify } from './codec';
import { plainText, type RichNode, type WorkspaceSnapshot } from './model';
import { renderHtml, renderMarkdown } from './render';
import { decodeArchive, encodeArchive } from '../storage/archive';

const body: RichNode = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'First: हिंदी e\u0301 🙂', marks: [{ type: 'bold' }] }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }, { type: 'hardBreak' }, { type: 'text', text: 'Same paragraph.' }] },
] };
function editor(content: RichNode = body) { return new Editor({ element: null, extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), ParagraphIndent], content }); }
function source(current: Editor) { return paragraphSource(current.getJSON() as RichNode); }

describe('First-line paragraph formatting preserves source and portable derivatives', () => {
  it('reads old unannotated bodies without introducing saved defaults or changing a byte of text', () => {
    const before = stableStringify(body); const current = editor();
    expect(source(current)).toEqual(body);
    expect(plainText(source(current))).toBe(plainText(body));
    expect(stableStringify(body)).toBe(before);
    current.destroy();
  });
  it('toggles the current paragraph independently and reverses without inserted whitespace', () => {
    const current = editor(); const firstSize = current.state.doc.child(0).nodeSize;
    current.commands.setTextSelection(firstSize + 1);
    expect(current.commands.toggleFirstLineIndent()).toBe(true);
    const indented = source(current);
    expect(indented.content?.[0].attrs).toBeUndefined();
    expect(indented.content?.[1].attrs).toEqual({ firstLineIndent: true });
    expect(plainText(indented)).toBe(plainText(body));
    assertBody(indented);
    current.commands.toggleFirstLineIndent();
    expect(source(current)).toEqual(body);
    current.destroy();
  });
  it('inherits indentation when splitting a body paragraph and retains it on a hard break', () => {
    const current = editor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'OneTwo' }] }] });
    current.commands.setTextSelection(4); current.commands.toggleFirstLineIndent();
    expect(current.commands.splitBlock()).toBe(true);
    expect(source(current).content?.map(node => node.attrs?.firstLineIndent)).toEqual([true, true]);
    expect(current.commands.setHardBreak()).toBe(true);
    const result = source(current);
    expect(result.content).toHaveLength(2);
    expect(result.content?.[1].attrs).toEqual({ firstLineIndent: true });
    expect(result.content?.[1].content?.some(node => node.type === 'hardBreak')).toBe(true);
    current.destroy();
  });
  it('does not offer a body indent command inside a heading, list, quote or code block', () => {
    for (const block of [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Heading' }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'List' }] }] }] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quote' }] }] },
      { type: 'codeBlock', content: [{ type: 'text', text: 'Code' }] },
    ] as RichNode[]) {
      const current = editor({ type: 'doc', content: [block] });
      current.commands.setTextSelection(block.type === 'bulletList' ? 3 : block.type === 'blockquote' ? 2 : 1);
      expect(current.can().toggleFirstLineIndent()).toBe(false);
      expect(current.commands.toggleFirstLineIndent()).toBe(false);
      current.destroy();
    }
  });
  it('validates the bounded attribute and rejects nested, arbitrary or non-boolean indentation', () => {
    const valid = structuredClone(body); valid.content![1].attrs = { firstLineIndent: true };
    expect(() => assertBody(valid)).not.toThrow();
    for (const value of [false, null, '2em', 2, true]) {
      const paragraph: RichNode = { type: 'paragraph', attrs: { firstLineIndent: value }, content: [{ type: 'text', text: 'Exact text' }] };
      const invalid: RichNode = { type: 'doc', content: value === true ? [{ type: 'blockquote', content: [paragraph] }] : [paragraph] };
      expect(() => assertBody(invalid)).toThrow('First-line indentation');
    }
    expect(() => assertBody({ type: 'doc', content: [{ type: 'heading', attrs: { level: 1, firstLineIndent: true }, content: [{ type: 'text', text: 'Heading' }] }] })).toThrow();
  });
  it('renders the exact 2em first-line style in HTML while text and Markdown remain identical', () => {
    const indented = structuredClone(body); indented.content![1].attrs = { firstLineIndent: true };
    expect(renderHtml(indented)).toBe('<p><strong>First: हिंदी e\u0301 🙂</strong></p><p data-first-line-indent="true" style="text-indent: 2em">Second paragraph.<br>Same paragraph.</p>');
    expect(plainText(indented)).toBe(plainText(body));
    expect(renderMarkdown(indented)).toBe(renderMarkdown(body));
    const nested: RichNode = { type: 'doc', content: [{ type: 'blockquote', content: [indented.content![1]] }] };
    expect(renderHtml(nested)).not.toContain('text-indent');
  });
  it('round-trips old and indented schema-1 archives with their distinct original revision hashes intact', async () => {
    for (const firstLineIndent of [false, true]) {
      const savedBody = structuredClone(body); if (firstLineIndent) savedBody.content![1].attrs = { firstLineIndent: true };
      const time = '2026-10-24T10:00:00.000Z';
      const snapshot = { id: 'page', universeId: 'world', title: 'Source', body: savedBody, plainText: plainText(savedBody), collectionId: null, trashed: false, order: 0, origin: 'author' as const, sourceOriginalIds: [], createdAt: time, updatedAt: time };
      const contentHash = await sha256(stableStringify(snapshot));
      const workspace: WorkspaceSnapshot = { schemaVersion: 1, accountId: 'author', universes: [{ id: 'world', name: 'Writing', createdAt: time }], collections: [], documents: [{ ...snapshot, headRevisionId: 'revision' }], revisions: [{ id: 'revision', documentId: 'page', universeId: 'world', parentIds: [], snapshot, contentHash, createdAt: time }], originals: [], receipts: [] };
      const before = stableStringify(workspace);
      const restored = await decodeArchive(await (await encodeArchive(workspace)).text());
      expect(stableStringify(restored)).toBe(before);
      expect(restored.revisions[0].contentHash).toBe(contentHash);
    }
  });
});
