import { Extension } from '@tiptap/react';
import { Plugin, type Transaction } from '@tiptap/pm/state';
import type { RichNode } from '../domain/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphIndent: { toggleFirstLineIndent: () => ReturnType };
  }
}

/** A missing attribute remains missing in persisted source, including old archives. */
export function paragraphSource(node: RichNode): RichNode {
  const attrs = node.type === 'paragraph' && node.attrs ? { ...node.attrs } : node.attrs;
  if (attrs && node.type === 'paragraph' && attrs.firstLineIndent !== true) delete attrs.firstLineIndent;
  const result = { ...node, ...(node.content ? { content: node.content.map(paragraphSource) } : {}) };
  if (attrs && Object.keys(attrs).length) result.attrs = attrs;
  else if (node.type === 'paragraph') delete result.attrs;
  return result;
}

/** Current/selected top-level paragraphs only. No whitespace is inserted into the text. */
export function toggleIndentTransaction(tr: Transaction, apply = true): boolean {
  const targets: { position: number; attrs: Record<string, unknown> }[] = [];
  tr.doc.nodesBetween(tr.selection.from, tr.selection.to, (node, position, parent) => {
    if (node.type.name === 'paragraph' && parent?.type.name === 'doc') targets.push({ position, attrs: node.attrs });
  });
  if (!targets.length) return false;
  const next = targets.every(target => target.attrs.firstLineIndent === true) ? null : true;
  if (apply) targets.forEach(target => tr.setNodeMarkup(target.position, undefined, { ...target.attrs, firstLineIndent: next }));
  return true;
}

export const ParagraphIndent = Extension.create({
  name: 'paragraphIndent',
  addGlobalAttributes() {
    return [{ types: ['paragraph'], attributes: {
      firstLineIndent: {
        default: null,
        keepOnSplit: true,
        parseHTML: element => element.getAttribute('data-first-line-indent') === 'true' || element.style.textIndent === '2em' ? true : null,
        renderHTML: attributes => attributes.firstLineIndent === true ? { 'data-first-line-indent': 'true', style: 'text-indent: 2em' } : {},
      },
    } }];
  },
  addCommands() { return { toggleFirstLineIndent: () => ({ tr, dispatch }) => toggleIndentTransaction(tr, Boolean(dispatch)) }; },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _previous, current) {
        if (!transactions.some(transaction => transaction.docChanged)) return null;
        const tr = current.tr;
        current.doc.descendants((node, position, parent) => {
          // Converting an indented paragraph to a quote/list is an explicit formatting edit.
          if (node.type.name === 'paragraph' && node.attrs.firstLineIndent === true && parent?.type.name !== 'doc') tr.setNodeMarkup(position, undefined, { ...node.attrs, firstLineIndent: null });
        });
        return tr.docChanged ? tr : null;
      },
    })];
  },
});
