import { useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import type { WritingDocument } from '../domain/model';
import { pageUrl } from '../../functions/src/page-url.mjs';
import Modal from './Modal';

export default function CopyPageLink({ document, collectionName }: { document: WritingDocument; collectionName?: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const url = pageUrl(document, collectionName);
  useEffect(() => { setCopied(false); setFallback(false); }, [url]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  useEffect(() => { if (fallback) { field.current?.focus(); field.current?.select(); } }, [fallback]);
  return <>
    <button type="button" className="icon-button copy-page-link" aria-label="Copy page link" title={copied ? 'Page link copied' : 'Copy page link'} onClick={() => {
      if (!navigator.clipboard?.writeText) { setFallback(true); return; }
      void navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => setFallback(true));
    }}>{copied ? <Check size={17} /> : <Link2 size={17} />}<span className="visually-hidden" aria-live="polite" role={copied ? 'status' : undefined}>{copied ? 'Page link copied. Access remains private.' : ''}</span></button>
    {fallback && <Modal title="Copy page link" onClose={() => setFallback(false)}><div className="page-link-dialog"><p>This link locates your page. Google author access or an authorized Noveliaa AI connection is still required.</p><label className="page-link-field">Page URL<input ref={field} aria-label="Page URL" readOnly value={url} onFocus={event => event.target.select()} /></label><p className="subtle">Select and copy the link with your device’s copy command.</p></div></Modal>}
  </>;
}
