import type { RichNode } from './model';

const html = (text: string) => text.replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]!));
const md = (text: string) => text.replace(/[\\`*_[\]<>#~]/g, '\\$&');
const fence = (text: string, minimum = 1) => '`'.repeat(Math.max(minimum, ...[...text.matchAll(/`+/g)].map(match => match[0].length + 1)));

/** Readable derivatives; the versioned JSON archive remains the lossless format. */
export function renderHtml(node: RichNode, parentType?: string): string {
  let value = (node.content ?? []).map(child => renderHtml(child, node.type)).join('');
  if (node.type === 'text') {
    value = html(node.text ?? '');
    for (const mark of node.marks ?? []) {
      if (mark.type === 'link') value = `<a href="${html(String(mark.attrs?.href ?? ''))}" rel="noopener noreferrer"${mark.attrs?.title ? ` title="${html(String(mark.attrs.title))}"` : ''}>${value}</a>`;
      else { const tag = { bold: 'strong', italic: 'em', underline: 'u', strike: 's', code: 'code' }[mark.type]; if (tag) value = `<${tag}>${value}</${tag}>`; }
    }
    return value;
  }
  if (node.type === 'doc') return value;
  if (node.type === 'hardBreak') return '<br>';
  if (node.type === 'horizontalRule') return '<hr>';
  if (node.type === 'codeBlock') return '<pre><code>' + value + '</code></pre>';
  if (node.type === 'orderedList') return `<ol start="${Number(node.attrs?.start ?? 1)}">${value}</ol>`;
  if (node.type === 'paragraph' && node.attrs?.firstLineIndent === true && parentType === 'doc') return `<p data-first-line-indent="true" style="text-indent: 2em">${value}</p>`;
  const tag = node.type === 'heading' ? 'h' + Number(node.attrs?.level ?? 2) : { paragraph: 'p', bulletList: 'ul', listItem: 'li', blockquote: 'blockquote' }[node.type];
  return tag ? `<${tag}>${value}</${tag}>` : value;
}
export function renderMarkdown(node: RichNode): string {
  const children = node.content ?? [];
  if (node.type === 'text') {
    let value = md(node.text ?? '');
    for (const mark of node.marks ?? []) {
      if (mark.type === 'code') { const delimiter = fence(node.text ?? ''); value = delimiter + ' ' + (node.text ?? '') + ' ' + delimiter; }
      if (mark.type === 'bold') value = '**' + value + '**';
      if (mark.type === 'italic') value = '*' + value + '*';
      if (mark.type === 'underline') value = '<u>' + value + '</u>';
      if (mark.type === 'strike') value = '~~' + value + '~~';
      if (mark.type === 'link') value = '[' + value + '](<' + String(mark.attrs?.href ?? '').replace(/[<>\r\n]/g, character => encodeURIComponent(character)) + '>)';
    }
    return value;
  }
  if (node.type === 'hardBreak') return '  \n';
  if (node.type === 'horizontalRule') return '---';
  if (node.type === 'codeBlock') { const text = children.map(child => child.text ?? '').join(''), delimiter = fence(text, 3); return delimiter + '\n' + text + '\n' + delimiter; }
  if (node.type === 'bulletList' || node.type === 'orderedList') return children.map((child, index) => {
    const prefix = node.type === 'orderedList' ? `${Number(node.attrs?.start ?? 1) + index}. ` : '- ';
    return prefix + renderMarkdown(child).split('\n').join('\n' + ' '.repeat(prefix.length));
  }).join('\n');
  const value = children.map(renderMarkdown).join(['doc', 'listItem', 'blockquote'].includes(node.type) ? '\n\n' : '');
  if (node.type === 'heading') return '#'.repeat(Number(node.attrs?.level ?? 2)) + ' ' + value;
  if (node.type === 'blockquote') return value.split('\n').map(line => '> ' + line).join('\n');
  return value;
}
