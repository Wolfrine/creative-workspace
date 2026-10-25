/** Public surface consumed by Noveliaa; implementation is pinned and MIT licensed. */
export class PageFlip {
  constructor(element: HTMLElement, settings: { width: number; height: number; size: 'fixed'; startPage?: number; usePortrait: boolean; autoSize: boolean; showCover: boolean; flippingTime: number; maxShadowOpacity: number; mobileScrollSupport: boolean; drawShadow: boolean; useMouseEvents: boolean; showPageCorners: boolean; disableFlipByClick: boolean });
  loadFromHTML(elements: HTMLElement[]): void;
  flipNext(corner?: 'top' | 'bottom'): void;
  flipPrev(corner?: 'top' | 'bottom'): void;
  on(event: string, callback: (event: { data: string | number | boolean | object }) => void): PageFlip;
  destroy(): void;
}
