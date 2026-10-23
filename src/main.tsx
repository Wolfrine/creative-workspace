import { createRoot } from 'react-dom/client';
import AppHost from './AppHost';

createRoot(document.getElementById('root')!).render(<AppHost />);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => { /* The editor reports device persistence independently. */ }); });
}
