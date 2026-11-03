// Pure shared locator grammar. Names are advisory; only immutable IDs select data.
export const PAGE_ORIGIN = 'https://noveliaa.web.app';
const identity = /^[A-Za-z0-9_-]{1,150}$/;
export function pageSlug(value, fallback = 'untitled') {
  const text = String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return Array.from(text).slice(0, 80).join('').replace(/-+$/g, '') || fallback;
}
export function pagePath(document, collectionName) {
  if (typeof document.id !== 'string' || typeof document.universeId !== 'string' || !identity.test(document.id) || !identity.test(document.universeId)) throw new Error('Invalid writing identity.');
  const collection = document.collectionId === null ? 'inbox' : pageSlug(collectionName || document.collectionId, 'collection');
  return `/u/${document.universeId}/${encodeURIComponent(collection)}/${encodeURIComponent(pageSlug(document.title))}/${document.id}`;
}
export function pageUrl(document, collectionName) { return PAGE_ORIGIN + pagePath(document, collectionName); }
export function parsePageLocation(pathname, search = '') {
  const params = new URLSearchParams(search), legacy = params.getAll('page');
  if (pathname === '/') {
    if (!legacy.length) return null;
    if (legacy.length !== 1 || !identity.test(legacy[0])) throw new Error('Invalid page link.');
    return { documentId: legacy[0] };
  }
  const parts = pathname.split('/');
  if (parts.length !== 6 || parts[1] !== 'u' || !identity.test(parts[2]) || !identity.test(parts[5]) || legacy.length) throw new Error('Invalid page link.');
  for (const part of parts.slice(3, 5)) {
    let decoded;
    try { decoded = decodeURIComponent(part); } catch { throw new Error('Invalid page link.'); }
    if (!decoded || decoded.length > 200 || !/^[\p{L}\p{M}\p{N}_-]+$/u.test(decoded)) throw new Error('Invalid page link.');
  }
  return { universeId: parts[2], documentId: parts[5] };
}
export function resolvePageUrl(value) {
  if (typeof value !== 'string' || value.length > 4096 || !/^https:\/\//.test(value) || /[\\\u0000-\u0020\u007f]/u.test(value)) throw new Error('Use a valid Noveliaa page URL.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Use a valid Noveliaa page URL.'); }
  if (!['noveliaa.web.app', 'noveliaa.firebaseapp.com'].includes(url.hostname) || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || [...url.searchParams.keys()].some(key => key !== 'page')) throw new Error('Use a valid Noveliaa page URL.');
  // Reject traversal before URL normalization can disguise an invalid path.
  const rawPath = value.slice(value.indexOf('/', 8) < 0 ? value.length : value.indexOf('/', 8)).split('?')[0];
  if (/(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i.test(rawPath)) throw new Error('Use a valid Noveliaa page URL.');
  const result = parsePageLocation(url.pathname, url.search);
  if (!result) throw new Error('Use a Noveliaa page URL, not the home page.');
  return result;
}
