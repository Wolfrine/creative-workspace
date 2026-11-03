import { describe, expect, it } from 'vitest';
import { pagePath, pageSlug, pageUrl, parsePageLocation, resolvePageUrl } from '../../functions/src/page-url.mjs';

const page = { id: 'stable-id', universeId: 'world-1', collectionId: 'collection-1', title: 'The door / Chapter 1?' };
describe('shared page URL grammar', () => {
  it('keeps unicode, normalizes equivalent names, bounds long titles and handles empty slugs', () => {
    expect(pageSlug(' Café — e\u0301 🙂 ')).toBe('café-é');
    expect(pageSlug('हिन्दी 世界')).toBe('हिन्दी-世界');
    expect(pageSlug('🙂 / ?')).toBe('untitled');
    expect(pageSlug('a'.repeat(500))).toHaveLength(80);
    expect(() => pagePath({ ...page, title: '𐐀'.repeat(81) })).not.toThrow();
    expect(() => resolvePageUrl(pageUrl({ ...page, title: '𐐀'.repeat(81), universeId: 'a'.repeat(150), id: 'b'.repeat(150) }, '𐐀'.repeat(81)))).not.toThrow();
    expect(decodeURIComponent(pagePath(page, 'Draft chapters'))).toBe('/u/world-1/draft-chapters/the-door-chapter-1/stable-id');
  });
  it('duplicate names stay distinct; renames and moves preserve identity', () => {
    const old = pageUrl(page, 'Draft chapters');
    const moved = pageUrl({ ...page, title: 'New name', collectionId: null });
    expect(resolvePageUrl(old)).toEqual(resolvePageUrl(moved));
    expect(pageUrl({ ...page, id: 'another-id' }, 'Draft chapters')).not.toBe(old);
    expect(pagePath({ ...page, universeId: 'world-2' }, 'Draft chapters')).not.toBe(pagePath(page, 'Draft chapters'));
  });
  it('supports legacy query IDs and safe backend collection fallbacks', () => {
    expect(resolvePageUrl('https://noveliaa.web.app/?page=stable-id')).toEqual({ documentId: 'stable-id' });
    expect(resolvePageUrl('https://noveliaa.firebaseapp.com' + pagePath(page))).toEqual({ documentId: page.id, universeId: page.universeId });
    expect(parsePageLocation('/')).toBeNull();
  });
  it.each([
    'https://evil.invalid/u/world/inbox/title/stable-id',
    'http://noveliaa.web.app/u/world/inbox/title/stable-id',
    'https://noveliaa.web.app.evil.invalid/?page=stable-id',
    'https://user@noveliaa.web.app/?page=stable-id',
    'https://noveliaa.web.app:444/?page=stable-id',
    'https://noveliaa.web.app/?page=one&page=two',
    'https://noveliaa.web.app/?page=../secret',
    'https://noveliaa.web.app/u/world/inbox/title/stable-id?page=other',
    'https://noveliaa.web.app/u/world/%2F/title/stable-id',
    'https://noveliaa.web.app/u/world/%/title/stable-id',
    'https://noveliaa.web.app/u/world/inbox/title/stable-id/extra',
    'https://noveliaa.web.app/u/world/inbox/title/stable-id#secret',
    'https://noveliaa.web.app/u/world/inbox/title/stable-id?local=1',
    'https://noveliaa.web.app/u/world/inbox/title/../stable-id',
    'https://noveliaa.web.app/u/world/inbox/title/%2e%2e/stable-id',
    'https://noveliaa.web.app/',
  ])('rejects invalid URL %s', url => expect(() => resolvePageUrl(url)).toThrow());
});
