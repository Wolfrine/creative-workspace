import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Undo2, Redo2, Quote, ArrowUpRight, Search, MoreHorizontal, IndentIncrease } from 'lucide-react';
import type { RichNode, WritingDocument } from '../domain/model';
import Modal from './Modal';
import { ParagraphIndent, paragraphSource } from './ParagraphIndent';

export interface WriterProps {
  document: WritingDocument;
  documents: WritingDocument[];
  onChange(body: RichNode): void;
  onNavigate(id: string): void;
  selections: Map<string, { from: number; to: number }>;
  focusOnMount?: boolean;
  onAutoFocused?(): void;
  focusMode?: boolean;
}

export default function Writer({ document: writing, documents, onChange, onNavigate, selections, focusOnMount, onAutoFocused, focusMode }: WriterProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [moreFormatting, setMoreFormatting] = useState(false);
  const [popupBelow, setPopupBelow] = useState(false);
  const [toolbarVersion, setToolbarVersion] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onNavigateRef = useRef(onNavigate);
  onChangeRef.current = onChange;
  onNavigateRef.current = onNavigate;
  const lastEmitted = useRef(JSON.stringify(writing.body));
  const editor = useEditor({
    extensions: [StarterKit.configure({
      link: { openOnClick: false, protocols: ['noveliaa'], HTMLAttributes: { rel: 'noopener noreferrer', target: null }, isAllowedUri: (url, context) => url.startsWith('noveliaa://document/') || context.defaultValidate(url) },
      heading: { levels: [1, 2, 3] },
    }), ParagraphIndent, Placeholder.configure({ placeholder: 'Begin anywhere. A line, a thought, a whole new world…' })],
    content: writing.body,
    editorProps: {
      attributes: { class: 'manuscript', 'aria-label': 'Writing canvas', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true' },
      handleClick: (_view, _position, event) => {
        const target = (event.target as Element)?.closest('a');
        const href = target?.getAttribute('href');
        if (href?.startsWith('noveliaa://document/')) { event.preventDefault(); onNavigateRef.current(href.slice('noveliaa://document/'.length)); return true; }
        if (href) { event.preventDefault(); return true; }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => { const body = paragraphSource(current.getJSON() as RichNode); lastEmitted.current = JSON.stringify(body); onChangeRef.current(body); },
    onSelectionUpdate: ({ editor: current }) => { selections.set(writing.id, { from: current.state.selection.from, to: current.state.selection.to }); setToolbarVersion(value => value + 1); },
    onTransaction: () => setToolbarVersion(value => value + 1),
    onCreate: ({ editor: current }) => {
      const previous = selections.get(writing.id);
      if (previous) current.commands.setTextSelection({ from: Math.min(previous.from, current.state.doc.content.size), to: Math.min(previous.to, current.state.doc.content.size) });
    },
  }, [writing.id]);

  useEffect(() => { if (editor && focusOnMount) { editor.commands.focus('end'); onAutoFocused?.(); } }, [editor, focusOnMount, onAutoFocused]);
  useEffect(() => { if (!editor?.isFocused) return; const frame = requestAnimationFrame(() => editor.commands.scrollIntoView()); return () => cancelAnimationFrame(frame); }, [editor, focusMode]);
  useLayoutEffect(() => {
    if (!moreFormatting) return;
    const toolbar = toolbarRef.current;
    const scroll = toolbar?.closest('.manuscript-scroll');
    const extra = toolbar?.querySelector<HTMLElement>('.toolbar-secondary');
    const position = () => { if (toolbar && scroll && extra && window.matchMedia('(max-width:650px)').matches) setPopupBelow(toolbar.getBoundingClientRect().top - scroll.getBoundingClientRect().top < extra.getBoundingClientRect().height + 8); };
    position(); scroll?.addEventListener('scroll', position);
    const pointer = (event: PointerEvent) => { if (!toolbarRef.current?.contains(event.target as Node)) setMoreFormatting(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoreFormatting(false); };
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key); scroll?.removeEventListener('scroll', position); };
  }, [moreFormatting]);

  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(writing.body);
    // Local keystrokes already live in ProseMirror. Replacing them loses the caret and IME composition.
    if (incoming !== lastEmitted.current && incoming !== JSON.stringify(paragraphSource(editor.getJSON() as RichNode))) {
      const selection = editor.state.selection;
      editor.commands.setContent(writing.body, { emitUpdate: false });
      editor.commands.setTextSelection({ from: Math.min(selection.from, editor.state.doc.content.size), to: Math.min(selection.to, editor.state.doc.content.size) });
      lastEmitted.current = incoming;
    }
  }, [writing.body, editor]);

  const toolbar = (label: string, icon: React.ReactNode, command: (editor: Editor) => void, active = false, disabled = false) => <button key={label} type="button" className={`format-button ${active ? 'is-active' : ''}`} aria-label={label} aria-pressed={active} title={label} disabled={disabled || !editor} onMouseDown={event => event.preventDefault()} onClick={() => { if (editor) command(editor); setMoreFormatting(false); }}>{icon}</button>;
  const insertLink = (target: WritingDocument) => {
    if (!editor) return;
    const href = `noveliaa://document/${target.id}`;
    if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: 'text', text: target.title || 'Untitled', marks: [{ type: 'link', attrs: { href } }] }).run();
    else editor.chain().focus().setLink({ href }).run();
    setLinkOpen(false); setQuery('');
  };
  void toolbarVersion;
  return <>
    <div ref={toolbarRef} className={`format-toolbar ${popupBelow ? 'popup-below' : ''}`} role="toolbar" aria-label="Text formatting">
      <select aria-label="Paragraph style" value={editor?.isActive('heading', { level: 1 }) ? 'h1' : editor?.isActive('heading', { level: 2 }) ? 'h2' : editor?.isActive('heading', { level: 3 }) ? 'h3' : 'p'} onChange={event => { if (!editor) return; const value = event.target.value; if (value === 'p') editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: value === 'h1' ? 1 : value === 'h2' ? 2 : 3 }).run(); }}><option value="p">Paragraph</option><option value="h1">Main heading</option><option value="h2">Heading</option><option value="h3">Subheading</option></select>
      <span className="toolbar-divider" />
      {toolbar('Bold', <Bold size={17} />, e => e.chain().focus().toggleBold().run(), editor?.isActive('bold'))}
      {toolbar('Italic', <Italic size={17} />, e => e.chain().focus().toggleItalic().run(), editor?.isActive('italic'))}
      <span className="primary-underline">{toolbar('Underline', <Underline size={17} />, e => e.chain().focus().toggleUnderline().run(), editor?.isActive('underline'))}</span>
      {toolbar('Link to writing', <Link2 size={17} />, () => setLinkOpen(true), editor?.isActive('link'))}
      <button className="format-button mobile-format-more" aria-label="More formatting" aria-expanded={moreFormatting} aria-controls="additional-formatting" onMouseDown={event => event.preventDefault()} onClick={() => setMoreFormatting(!moreFormatting)}><MoreHorizontal size={20} /></button>
      <div id="additional-formatting" className={`toolbar-secondary ${moreFormatting ? 'is-open' : ''}`} role="group" aria-label="Additional text formatting">
        <span className="toolbar-divider" />
        <span className="secondary-underline">{toolbar('Underline', <Underline size={17} />, e => e.chain().focus().toggleUnderline().run(), editor?.isActive('underline'))}</span>
        {toolbar('First-line indent', <IndentIncrease size={18} />, e => e.chain().focus().toggleFirstLineIndent().run(), editor?.isActive('paragraph', { firstLineIndent: true }), !editor?.can().toggleFirstLineIndent())}
        {toolbar('Bullet list', <List size={18} />, e => e.chain().focus().toggleBulletList().run(), editor?.isActive('bulletList'))}
        {toolbar('Numbered list', <ListOrdered size={18} />, e => e.chain().focus().toggleOrderedList().run(), editor?.isActive('orderedList'))}
        {toolbar('Block quote', <Quote size={17} />, e => e.chain().focus().toggleBlockquote().run(), editor?.isActive('blockquote'))}
        {editor?.isActive('link') && <button className="text-button" onClick={() => editor.chain().focus().unsetLink().run()}>Unlink</button>}
        <span className="toolbar-spacer" />
        {toolbar('Undo', <Undo2 size={17} />, e => e.chain().focus().undo().run(), false, !editor?.can().undo())}
        {toolbar('Redo', <Redo2 size={17} />, e => e.chain().focus().redo().run(), false, !editor?.can().redo())}
      </div>
    </div>
    <EditorContent editor={editor} className="editor-body" />
    {linkOpen && <Modal title="Link to your writing" onClose={() => setLinkOpen(false)}>
      <p className="dialog-intro">Connect this passage to a note or scene. Links keep working when titles change.</p>
      <label className="search-field"><Search size={17} /><input autoFocus placeholder="Find a note or scene…" aria-label="Find link target" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="link-results">{documents.filter(d => d.id !== writing.id && !d.trashed && `${d.title} ${d.plainText}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(target => <button className="link-result" key={target.id} onClick={() => insertLink(target)}><span><strong>{target.title || 'Untitled'}</strong><small>{target.plainText.slice(0, 90) || 'An unwritten thought'}</small></span><ArrowUpRight size={17} /></button>)}</div>
      {!documents.some(d => d.id !== writing.id && !d.trashed) && <p className="quiet-empty">Create another thought first, then connect the two.</p>}
    </Modal>}
  </>;
}
