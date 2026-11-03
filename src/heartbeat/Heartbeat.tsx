import { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import type { HeartbeatBeat } from './model';
import type { HeartbeatState } from './useHeartbeat';
import { heartbeatLegend, heartbeatSymbols } from './presentation';
import './heartbeat.css';

export function HeartbeatToggle({ enabled, onToggle }: { enabled: boolean; onToggle(): void }) {
  return <button type="button" className={`heartbeat-toggle ${enabled ? 'is-on' : ''}`} aria-label="Emotional Heartbeat" aria-pressed={enabled} title="Emotional Heartbeat" onMouseDown={event => event.preventDefault()} onClick={onToggle}><Activity size={15} /><span>Heartbeat</span><span className="heartbeat-switch" aria-hidden="true" /></button>;
}

export default function Heartbeat({ state, beats, onFind, limit = 3 }: { state: HeartbeatState; beats?: HeartbeatBeat[]; onFind?(beat: HeartbeatBeat): void; limit?: number }) {
  const [details, setDetails] = useState<HeartbeatBeat | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const annotation = state.annotation;
  const continuous = state.coverage?.status === 'continuous';
  const colorsAvailable = typeof (window as unknown as { Highlight?: unknown }).Highlight === 'function' && !!(CSS as unknown as { highlights?: unknown }).highlights;
  const visible = continuous ? (beats || annotation?.beats || []) : [];
  const entries = heartbeatLegend(visible);
  const selectedEntry = details ? entries.find(entry => entry.beats.includes(details)) : undefined;
  useEffect(() => { setDetails(null); setKeyOpen(false); }, [annotation?.id, state.status]);
  if (state.status === 'off') return null;
  const messages = { loading: 'Checking this exact revision…', stale: 'Writing changed. Regenerate Heartbeat for this exact revision.', empty: 'No Heartbeat for this revision. Ask your connected AI for a full reading.', error: state.message || 'Heartbeat could not be reached. Your writing is safe.' };
  const incomplete = state.status === 'ready' && !continuous && state.coverage?.status !== 'empty';
  const choose = (beat: HeartbeatBeat) => { setKeyOpen(false); setDetails(beat); };
  const keyButton = (entry: typeof entries[number]) => <button className={`heartbeat-legend-item heartbeat-tone-${entry.tone}`} key={`${entry.tone}-${entry.feeling}`} aria-label={`${entry.feeling}. Show interpretation.`} onClick={() => choose(entry.beats[0])}><span className="heartbeat-swatch" aria-hidden="true">{heartbeatSymbols[entry.tone]}</span><span>{entry.feeling}</span></button>;
  return <section className="heartbeat" aria-label="Emotional Heartbeat overlay" aria-description="Unverified AI interpretation, not measured reader emotion or author intent.">
    <div className="heartbeat-caption"><span>{state.status === 'ready' && continuous ? colorsAvailable ? 'Color → feeling' : 'Feeling key' : 'Heartbeat'}<span className="heartbeat-unverified">{state.status === 'ready' && continuous && !colorsAvailable ? 'Colors unavailable' : 'AI · unverified'}</span></span><button aria-label="Refresh Heartbeat" title="Refresh Heartbeat" onClick={state.refresh}><RefreshCw size={14} /></button></div>
    {state.status !== 'ready' ? <p className="heartbeat-state" role="status">{messages[state.status]}</p> : incomplete ? <p className="heartbeat-state" role="status">Incomplete reading. Regenerate for the full revision; unanalysed text stays uncolored.</p> : visible.length ? <div className="heartbeat-legend" aria-label="Color to feeling legend">{entries.slice(0, limit).map(keyButton)}{entries.length > limit && <button className="heartbeat-more" onClick={() => setKeyOpen(true)}>+{entries.length - limit} {entries.length - limit === 1 ? 'feeling' : 'feelings'}</button>}</div> : <p className="heartbeat-state">{state.coverage?.status === 'empty' ? 'No text to analyse.' : 'No analysed text on this page.'}</p>}
    {keyOpen && <Modal title="Color to feeling" onClose={() => setKeyOpen(false)}><div className="heartbeat-detail"><p className="heartbeat-detail-meta">Unverified AI interpretation. Select a feeling to inspect its exact passage.</p><div className="heartbeat-full-key">{entries.map(keyButton)}</div></div></Modal>}
    {details && annotation && <Modal title="A possible reading" onClose={() => setDetails(null)}><div className="heartbeat-detail">
      <p className={`heartbeat-detail-label heartbeat-tone-${details.tone}`}><span className="heartbeat-swatch" aria-hidden="true">{heartbeatSymbols[details.tone]}</span>{details.foreground}{details.undertone && <span className="heartbeat-detail-undertone">Undertone: {details.undertone}</span>}</p>
      {selectedEntry && selectedEntry.beats.length > 1 && <label className="heartbeat-passage-choice">Passage<select aria-label="Passage for selected feeling" value={selectedEntry.beats.indexOf(details)} onChange={event => setDetails(selectedEntry.beats[Number(event.target.value)])}>{selectedEntry.beats.map((beat, index) => <option value={index} key={`${beat.start}-${beat.end}`}>{index + 1} of {selectedEntry.beats.length}</option>)}</select></label>}
      <p>{details.reasoning}</p>
      <blockquote>{details.quote}</blockquote>
      {onFind && <button className="text-button" onClick={() => { const beat = details; setDetails(null); requestAnimationFrame(() => requestAnimationFrame(() => onFind(beat))); }}>Find this passage</button>}
      <p className="heartbeat-detail-meta">{details.trajectory} · weight {details.weight} of 5</p>
      {annotation.contextNote && <p className="heartbeat-context">Context: {annotation.contextNote}</p>}
      <p className="heartbeat-detail-meta">Unverified AI inference, not measured emotion or author intent. Self-reported provider and model: {annotation.attribution.provider} · {annotation.attribution.model}.</p>
      <details className="heartbeat-source"><summary>Exact source revision</summary><p className="heartbeat-detail-meta">{annotation.anchor.revisionId}<br />{annotation.anchor.contentHash}</p></details>
    </div></Modal>}
  </section>;
}
