import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, wide = false, message, messageError = false }: { title: string; children: ReactNode; onClose(): void; wide?: boolean; message?: string | null; messageError?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={19} /></button></header>
    {message && <p className={`dialog-feedback ${messageError ? 'is-error' : ''}`} role={messageError ? 'alert' : 'status'}>{message}</p>}
    {children}
  </dialog>;
}
