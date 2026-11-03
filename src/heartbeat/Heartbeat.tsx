import { useEffect, useState } from 'react';
import { Activity, ChevronDown, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import type { HeartbeatBeat } from './model';
import type { HeartbeatState } from './useHeartbeat';
import './heartbeat.css';

export function HeartbeatToggle({ enabled, onToggle }: { enabled: boolean; onToggle(): void }) {
  return <button type="button" className={`heartbeat-toggle ${enabled ? 'is-on' : ''}`} aria-label="Emotional Heartbeat" aria-pressed={enabled} title="Emotional Heartbeat" onMouseDown={event => event.preventDefault()} onClick={onToggle}><Activity size={15} /><span>Heartbeat</span><span className="heartbeat-switch" aria-hidden="true" /></button>;
}
export default function Heartbeat({ state, beats, onFind }: { state: HeartbeatState; beats?: HeartbeatBeat[]; onFind?(beat: HeartbeatBeat): void }) {
  const [details, setDetails] = useState<number | null>(null);
  const annotation = state.annotation; const visible = beats || annotation?.beats || [];
  useEffect(() => setDetails(null), [annotation?.id, state.status]);
  if (state.status === 'off') return null;
  const messages = { loading: 'Checking this exact revision…', stale: 'Writing changed. Heartbeat is hidden until this exact revision has a fresh annotation.', empty: 'No Heartbeat for this revision. Use your connected AI to return an interpretation.', error: state.message || 'Heartbeat could not be reached. Your writing is safe.' };
  return <section className="heartbeat" aria-label="Emotional Heartbeat overlay">
    <div className="heartbeat-caption"><span><Activity size={12} />AI interpretation <span className="heartbeat-unverified">· unverified</span></span><button aria-label="Refresh Heartbeat" title="Refresh Heartbeat" onClick={state.refresh}><RefreshCw size={12} /></button></div>
    {state.status !== 'ready' ? <p className="heartbeat-state" role="status">{messages[state.status]}</p> : <>
      {visible.length ? <div className="heartbeat-strip" aria-label="Passage heartbeat">{visible.map((beat, index) => <button className={`heartbeat-beat heartbeat-tone-${beat.tone}`} key={`${beat.start}-${beat.end}`} aria-description={`Weight ${beat.weight} of 5. Show reasoning.`} onClick={() => setDetails(annotation!.beats.indexOf(beat))}><span className="heartbeat-weight" aria-hidden="true">{[1, 2, 3, 4, 5].map(value => <i key={value} className={value <= beat.weight ? 'filled' : ''} />)}</span><span className="heartbeat-emotions"><strong>{beat.foreground}</strong>{beat.undertone && <>{' '}<small>undertone: {beat.undertone}</small></>}</span>{' '}<span className="heartbeat-trajectory">{beat.trajectory}</span><ChevronDown size={11} />{index < visible.length - 1 && <span className="heartbeat-next" aria-hidden="true">·</span>}</button>)}</div> : <p className="heartbeat-state">A quiet passage. No marked emotional turn.</p>}
      <p className="heartbeat-attribution">{annotation?.attribution.provider} · {annotation?.attribution.model}<span>Self-reported model · not reader responses</span></p>
    </>}
    {details !== null && annotation?.beats[details] && <Modal title="A possible reading" onClose={() => setDetails(null)}><div className="heartbeat-detail"><p className="heartbeat-detail-label">{annotation.beats[details].foreground}{annotation.beats[details].undertone && <span> / {annotation.beats[details].undertone}</span>}</p><p className="heartbeat-detail-meta">{annotation.beats[details].trajectory} · weight {annotation.beats[details].weight} of 5</p><blockquote>{annotation.beats[details].quote}</blockquote>{onFind && <button className="text-button" onClick={() => { const beat = annotation.beats[details]; setDetails(null); requestAnimationFrame(() => requestAnimationFrame(() => onFind(beat))); }}>Find this passage</button>}<p>{annotation.beats[details].reasoning}</p>{annotation.contextNote && <p className="heartbeat-context">Context: {annotation.contextNote}</p>}<p className="heartbeat-detail-meta">Unverified AI inference, not measured emotion or author intent. Provider and model are self-reported: {annotation.attribution.provider} · {annotation.attribution.model}.</p><p className="heartbeat-detail-meta">Exact revision {annotation.anchor.revisionId}<br />Hash {annotation.anchor.contentHash}</p></div></Modal>}
  </section>;
}
