import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Activity, Info, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import type { HeartbeatBeat } from './model';
import type { HeartbeatState } from './useHeartbeat';
import { createHeartbeatFeelingMap, heartbeatRestStyle, type HeartbeatLegendEntry } from './presentation';
import './heartbeat.css';

export function HeartbeatToggle({ enabled, onToggle }: { enabled: boolean; onToggle(): void }) {
  return <button type="button" className={`heartbeat-toggle ${enabled ? 'is-on' : ''}`} aria-label="Emotional Heartbeat" aria-pressed={enabled} title="Emotional Heartbeat" onMouseDown={event => event.preventDefault()} onClick={onToggle}><Activity size={15} /><span>Heartbeat</span><span className="heartbeat-switch" aria-hidden="true" /></button>;
}
const entryStyle = (entry?: HeartbeatLegendEntry) => entry ? { '--heartbeat-color': entry.color, '--heartbeat-night-color': entry.nightColor } as CSSProperties : undefined;
function HeartbeatSwatch({ pattern = 'solid', weight = 3 }: { pattern?: 'solid' | 'dashed' | 'dotted'; weight?: number }) {
  return <span className="heartbeat-swatch" aria-hidden="true"><svg viewBox="0 0 24 12" width="24" height="12" preserveAspectRatio="none"><path d="M 1 6 H 23" fill="none" stroke="currentColor" strokeWidth={1.1 + weight * .4} strokeDasharray={pattern === 'dashed' ? '7 4' : pattern === 'dotted' ? '1 4' : undefined} strokeLinecap={pattern === 'dotted' ? 'round' : 'butt'} /></svg></span>;
}

export default function Heartbeat({ state, beats, onFind, limit = 3, showUnanalysed = false, fitToWidth = false, visibleExtents }: { state: HeartbeatState; beats?: HeartbeatBeat[]; onFind?(beat: HeartbeatBeat): void; limit?: number; showUnanalysed?: boolean; fitToWidth?: boolean; visibleExtents?: Readonly<Record<string, number>> }) {
  const [details, setDetails] = useState<HeartbeatBeat | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const legend = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const [fittedLimit, setFittedLimit] = useState(limit);
  const annotation = state.annotation;
  // The entire exact revision allocates identities. A page only filters them.
  const feelingMap = useMemo(() => createHeartbeatFeelingMap(annotation?.beats || []), [annotation]);
  const continuous = state.coverage?.status === 'continuous' && feelingMap.status === 'ready';
  const pageEntries = continuous ? feelingMap.visibleEntries(beats || annotation?.beats || []) : [];
  // Source geometry only chooses which exact labels get scarce preview space.
  // It never changes a document identity, supplied feeling or emotional weight.
  const extent = (entry: HeartbeatLegendEntry) => entry.beats.reduce((sum, beat) => sum + (visibleExtents?.[`${beat.start}:${beat.end}`] || 0), 0);
  const entries = fitToWidth && pageEntries.length > limit && visibleExtents ? [...pageEntries].sort((a, b) => extent(b) - extent(a) || a.beats[0].start - b.beats[0].start) : pageEntries;
  const displayKey = JSON.stringify(entries.map(entry => [entry.key, entry.feeling]));
  useLayoutEffect(() => {
    if (!fitToWidth || !legend.current || !ruler.current) { setFittedLimit(limit); return; }
    let alive = true;
    const measure = () => {
      const row = legend.current, measuring = ruler.current;
      if (!alive || !row || !measuring || !row.clientWidth) return;
      const widths = [...measuring.querySelectorAll<HTMLElement>('[data-measure-feeling]')].map(node => node.getBoundingClientRect().width);
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const more = measuring.querySelector<HTMLElement>('[data-measure-more]')!.getBoundingClientRect().width;
      const generic = showUnanalysed ? measuring.querySelector<HTMLElement>('[data-measure-unanalysed]')!.getBoundingClientRect().width : 0;
      let count = Math.min(limit, widths.length);
      const required = () => {
        const overflow = count < widths.length, children = count + Number(overflow) + Number(showUnanalysed);
        return widths.slice(0, count).reduce((sum, width) => sum + width, 0) + (overflow ? more : 0) + generic + Math.max(0, children - 1) * gap;
      };
      while (count > 0 && required() > row.clientWidth + .5) count--;
      setFittedLimit(previous => previous === count ? previous : count);
    };
    const observer = new ResizeObserver(measure); observer.observe(legend.current); measure();
    void document.fonts.ready.then(measure);
    return () => { alive = false; observer.disconnect(); };
  }, [fitToWidth, limit, displayKey, showUnanalysed, state.status]);
  const shown = fitToWidth ? Math.min(limit, fittedLimit) : limit;
  const selectedEntry = details ? feelingMap.entryFor(details) : undefined;
  useEffect(() => { setDetails(null); setKeyOpen(false); setInfoOpen(false); }, [annotation?.id, state.status]);
  if (state.status === 'off') return null;
  const messages = { loading: 'Checking this exact revision…', stale: 'Writing changed. A new interpretation is needed.', empty: 'No AI interpretation for this revision.', error: state.message || 'The interpretation is unavailable. Your writing is safe.' };
  const incomplete = state.status === 'ready' && !continuous && state.coverage?.status !== 'empty';
  const choose = (beat: HeartbeatBeat) => { setKeyOpen(false); setInfoOpen(false); setDetails(beat); };
  const keyButton = (entry: HeartbeatLegendEntry) => <button className={`heartbeat-legend-item ${entry.isRest ? 'heartbeat-rest' : ''}`} style={entryStyle(entry)} data-feeling-key={entry.key} data-display-token={entry.token} data-token={entry.token} data-pattern={entry.pattern} key={entry.key} aria-label={`${entry.feeling}. Show interpretation.`} onClick={() => choose(entry.beats[0])}><HeartbeatSwatch pattern={entry.pattern} weight={entry.beats[0]?.weight} /><span>{entry.feeling}</span></button>;
  const unanalysedKey = <button className="heartbeat-legend-item heartbeat-unanalysed" data-feeling-key="unanalysed" data-token="unanalysed" data-pattern="dotted" aria-label="Unanalysed writing. About this interpretation." onClick={() => setInfoOpen(true)}><HeartbeatSwatch pattern="dotted" weight={1} /><span>Unanalysed</span></button>;
  return <section className="heartbeat" aria-label="Emotional Heartbeat overlay" aria-description="Unverified AI interpretation, not measured reader emotion or author intent.">
    <div className="heartbeat-caption"><button className="heartbeat-about" aria-label="About this AI interpretation" onClick={() => setInfoOpen(true)}>AI interpretation<Info size={13} aria-hidden="true" /></button></div>
    {state.status !== 'ready' ? <p className="heartbeat-state" role="status">{messages[state.status]}</p> : incomplete ? unanalysedKey : entries.length ? <div ref={legend} className="heartbeat-legend" aria-label="Color to feeling legend">{entries.slice(0, shown).map(keyButton)}{entries.length > shown && <button className="heartbeat-more" aria-label={`${fitToWidth ? 'All feelings. ' : ''}Show ${entries.length - shown} more feelings on this page`} onClick={() => setKeyOpen(true)}>{fitToWidth ? 'All feelings' : `+${entries.length - shown}`}</button>}{showUnanalysed && unanalysedKey}{fitToWidth && <div ref={ruler} className="heartbeat-fit-measure" aria-hidden="true" inert>{entries.map(entry => <span key={entry.key} className="heartbeat-fit-item" data-measure-feeling><span className="heartbeat-fit-sample" /><span>{entry.feeling}</span></span>)}<span className="heartbeat-fit-item" data-measure-unanalysed><span className="heartbeat-fit-sample" /><span>Unanalysed</span></span><span className="heartbeat-fit-more" data-measure-more>All feelings</span></div>}</div> : <p className="heartbeat-state">{state.coverage?.status === 'empty' ? 'No text to analyse.' : 'No analysed text in view.'}</p>}
    {infoOpen && <Modal title="About this interpretation" onClose={() => setInfoOpen(false)}><div className="heartbeat-detail">
      <p>AI interpretation, unverified. A possible reading, not author intent or measured reader emotion.</p>
      <div className="heartbeat-grammar">
        <div style={entryStyle(feelingMap.entries.find(entry => !entry.isRest))}><HeartbeatSwatch /><p><strong>Held</strong><span>Feeling continues; width shows weight.</span></p></div>
        <div style={{ '--heartbeat-color': heartbeatRestStyle.color } as CSSProperties}><HeartbeatSwatch pattern="dashed" weight={1} /><p><strong>Rest</strong><span>Explicitly read as rest.</span></p></div>
        <div className="heartbeat-unanalysed"><HeartbeatSwatch pattern="dotted" weight={1} /><p><strong>Unanalysed</strong><span>No complete reading; no feeling inferred.</span></p></div>
      </div>
      <details className="heartbeat-source heartbeat-metadata"><summary>Interpretation details</summary><p className="heartbeat-detail-meta">Weight uses the supplied 1–5 scale.{annotation && <> Self-reported provider and model: {annotation.attribution.provider} · {annotation.attribution.model}.</>}</p></details>
      <div className="heartbeat-info-actions"><button className="text-button" onClick={() => { setInfoOpen(false); setKeyOpen(true); }}>All feelings</button><button className="text-button" aria-label="Refresh Heartbeat" onClick={() => { setInfoOpen(false); state.refresh(); }}><RefreshCw size={14} />Refresh interpretation</button></div>
    </div></Modal>}
    {keyOpen && <Modal title="Color to feeling" onClose={() => setKeyOpen(false)}><div className="heartbeat-detail"><p className="heartbeat-detail-meta">The same feeling keeps its color throughout this writing. Select one to inspect its exact passage.</p><div className="heartbeat-full-key">{feelingMap.entries.map(keyButton)}</div></div></Modal>}
    {details && annotation && <Modal title="A possible reading" onClose={() => setDetails(null)}><div className="heartbeat-detail">
      <p className="heartbeat-detail-label" style={entryStyle(selectedEntry)}><HeartbeatSwatch pattern={selectedEntry?.pattern} weight={details.weight} />{details.foreground}{details.undertone && <span className="heartbeat-detail-undertone">Undertone: {details.undertone}</span>}</p>
      {selectedEntry && selectedEntry.beats.length > 1 && <label className="heartbeat-passage-choice">Passage<select aria-label="Passage for selected feeling" value={selectedEntry.beats.indexOf(details)} onChange={event => setDetails(selectedEntry.beats[Number(event.target.value)])}>{selectedEntry.beats.map((beat, index) => <option value={index} key={`${beat.start}-${beat.end}`}>{index + 1} of {selectedEntry.beats.length}</option>)}</select></label>}
      <p>{details.reasoning}</p><blockquote>{details.quote}</blockquote>
      {onFind && <button className="text-button" onClick={() => { const beat = details; setDetails(null); requestAnimationFrame(() => requestAnimationFrame(() => onFind(beat))); }}>Find this passage</button>}
      <p className="heartbeat-detail-meta">{details.trajectory} · weight {details.weight} of 5</p>
      {annotation.contextNote && <p className="heartbeat-context">Context: {annotation.contextNote}</p>}
      <p className="heartbeat-detail-meta">Unverified AI inference, not measured emotion or author intent. Self-reported provider and model: {annotation.attribution.provider} · {annotation.attribution.model}.</p>
      <details className="heartbeat-source"><summary>Exact source revision</summary><p className="heartbeat-detail-meta">{annotation.anchor.revisionId}<br />{annotation.anchor.contentHash}</p></details>
    </div></Modal>}
  </section>;
}
