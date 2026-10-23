import { memo, useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { WritingDocument } from '../domain/model';

interface Props { document: WritingDocument; selected: boolean; onOpen(document: WritingDocument): void }
function DocumentShelfRow({ document, selected, onOpen }: Props) {
  // A retrieval snippet never needs to normalize a whole 20,000-word manuscript.
  const snippet = useMemo(() => document.plainText.slice(0, 180).replace(/\s+/g, ' ').slice(0, 65), [document.plainText]);
  return <button className={`document-row ${selected ? 'selected' : ''}`} aria-current={selected ? 'page' : undefined} onClick={() => onOpen(document)}><FileText size={15} /><span><strong>{document.title || 'Untitled'}</strong><small>{snippet || (document.plainText ? 'Open this page to continue.' : 'A blank page, all yours.')}</small></span>{selected && <span className="selected-dot" />}</button>;
}
export default memo(DocumentShelfRow, (before, after) => before.selected === after.selected && before.onOpen === after.onOpen && before.document.id === after.document.id && before.document.title === after.document.title && before.document.plainText === after.document.plainText && before.document.trashed === after.document.trashed);
