export interface PageMetadata { id: string; universeId: string; title: string; collectionId: string | null }
export interface PageReference { documentId: string; universeId?: string }
export const PAGE_ORIGIN: string;
export function pageSlug(value: string, fallback?: string): string;
export function pagePath(document: PageMetadata, collectionName?: string): string;
export function pageUrl(document: PageMetadata, collectionName?: string): string;
export function parsePageLocation(pathname: string, search?: string): PageReference | null;
export function resolvePageUrl(value: string): PageReference;
