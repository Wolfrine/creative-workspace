import { PageFlip } from '../vendor/pageflip/page-flip.js';
import '../vendor/pageflip/page-flip.css';

const activeTurns = new Set<object>();
const activeSlides = new Set<object>();
/** Small diagnostic surface for the isolated DEV browser suite; contains no writing. */
export function pageTurnDiagnostics() { return { activeTurns: activeTurns.size, activeSlides: activeSlides.size }; }
export const softLeafBudget = { characters: 20_000, elements: 600 } as const;
type TransitionArguments = { host: HTMLElement; book: HTMLElement; stage: HTMLElement; source: HTMLElement; from: number; to: number; pages: number; columns: number; stride: number };
export function readerMotionMode(source: HTMLElement): 'curl' | 'slide' {
  return (source.textContent?.length || 0) <= softLeafBudget.characters && source.querySelectorAll('*').length <= softLeafBudget.elements ? 'curl' : 'slide';
}

/** Long/complex books move the canonical prose track, avoiding full-source copies. */
export function beginReadingTransition(args: TransitionArguments): () => void {
  const mode = readerMotionMode(args.source);
  args.stage.dataset.motion = mode; args.stage.dataset.motionActive = 'true';
  const done = () => { args.stage.dataset.motionActive = 'false'; };
  const stop = mode === 'curl' ? beginPageTurn({ ...args, onFinish: done }) : beginPageSlide(args, done);
  return () => { stop(); done(); };
}

function beginPageSlide({ source, from, to, stride }: TransitionArguments, onFinish: () => void): () => void {
  const token = {}; activeSlides.add(token);
  let animation: Animation | null = null; let stopped = false;
  const stop = () => {
    if (stopped) return; stopped = true;
    animation?.cancel(); animation = null; activeSlides.delete(token); onFinish();
  };
  try {
    animation = source.animate([{ transform: `translateX(${-from * stride}px)` }, { transform: `translateX(${-to * stride}px)` }], { duration: 260, easing: 'cubic-bezier(.2,.65,.25,1)' });
    animation.onfinish = stop; animation.oncancel = stop;
  } catch { stop(); }
  return stop;
}

/**
 * A transient, bounded projection of the actual measured prose columns.
 * It never owns manuscript state, pagination, selection, bookmarks or saving.
 * At most four clipped copies exist, independent of the number of book pages.
 */
export function beginPageTurn({ host, book, stage, source, from, to, pages, columns, stride, onFinish = () => {} }: TransitionArguments & { onFinish?: () => void }): () => void {
  const token = {}; activeTurns.add(token);
  const element = document.createElement('div');
  element.className = 'reader-turn'; element.ariaHidden = 'true'; element.inert = true;
  Object.assign(element.style, { position: 'absolute', inset: '0', width: `${book.clientWidth}px`, height: `${book.clientHeight}px` });
  host.append(element);
  const first = Math.min(from, to);
  const paddingTop = parseFloat(getComputedStyle(book).paddingTop) || 0;
  const leaves = Array.from({ length: columns * 2 }, (_, index) => {
    const column = first + index;
    const leaf = document.createElement('div');
    leaf.className = 'reader-motion-leaf'; leaf.dataset.density = 'soft'; leaf.dataset.sourceColumn = String(column);
    if (column < pages) {
      const projection = source.cloneNode(true) as HTMLElement;
      projection.className = 'reader-page-content'; projection.removeAttribute('id'); projection.ariaHidden = 'true';
      projection.style.opacity = '1'; projection.style.transform = `translateX(${-column * stride}px)`;
      projection.style.height = `${stage.clientHeight}px`; projection.style.top = `${paddingTop}px`;
      leaf.append(projection);
    }
    element.append(leaf); return leaf;
  });
  let flip: PageFlip | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstFrame: number | null = null;
  let stopped = false;
  const stop = () => {
    if (stopped) return; stopped = true;
    if (timer) clearTimeout(timer); timer = null;
    if (firstFrame !== null) cancelAnimationFrame(firstFrame); firstFrame = null;
    flip?.destroy(); flip = null;
    element.replaceChildren(); element.remove(); activeTurns.delete(token); onFinish();
  };
  try {
    flip = new PageFlip(element, {
      width: stride, height: book.clientHeight, size: 'fixed', startPage: from < to ? 0 : columns,
      usePortrait: columns === 1, autoSize: false, showCover: false, flippingTime: 460,
      maxShadowOpacity: .19, mobileScrollSupport: false, drawShadow: true,
      // Mouse handlers are disabled. The corner-click guard also rejects the
      // library's own portrait flipPrev point, so programmatic flips bypass it.
      useMouseEvents: false, showPageCorners: false, disableFlipByClick: false,
    });
    flip.loadFromHTML(leaves);
    flip.on('changeState', event => { if (event.data === 'read') stop(); });
    // Render.start initializes the library clock in its first frame. Starting
    // before that tick makes a newly mounted animation appear already expired.
    firstFrame = requestAnimationFrame(() => {
      firstFrame = null;
      if (stopped || !flip) return;
      if (to > from) flip.flipNext('bottom'); else flip.flipPrev('bottom');
    });
    timer = setTimeout(stop, 750);
  } catch { stop(); /* Optional motion cannot prevent access to the next source passage. */ }
  return stop;
}
