import { useMemo } from 'react';
import { CheckCheck, FileText } from 'lucide-react';

// Exact line matching only. This comparison never interprets or rewrites the author's text.
function compareLines(before: string, after: string) {
  const left = before.split('\n'); const right = after.split('\n');
  if (before === after) return { left, right, removed: new Set<number>(), added: new Set<number>(), detailed: true };
  if (left.length * right.length > 500000) return { left, right, removed: new Set<number>(), added: new Set<number>(), detailed: false };
  const table = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const removed = new Set<number>(); const added = new Set<number>(); let i = 0; let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) { i++; j++; }
    else if (i < left.length && (j === right.length || table[i + 1][j] >= table[i][j + 1])) removed.add(i++);
    else added.add(j++);
  }
  return { left, right, removed, added, detailed: true };
}

export default function RevisionComparison({ selected, current, differences = [] }: { selected: string; current: string; differences?: string[] }) {
  const result = useMemo(() => compareLines(selected, current), [selected, current]);
  const identical = selected === current;
  if (identical) return <div className="comparison-content comparison-matches">
    <p className="matching-text-notice"><CheckCheck size={17} aria-hidden="true" /><span>The prose matches. {differences.length ? differences.join(' ') : 'Titles and saved formatting match too.'}</span></p>
    {selected.trim() ? <div className="revision-texts"><div><h4>Matching text</h4><pre className="revision-prose">{selected}</pre></div></div> : <div className="matching-empty"><FileText size={26} strokeWidth={1.3} aria-hidden="true" /><h4>No prose to compare</h4><p>Both saved versions have no prose. Check the selected version's title and details before choosing.</p></div>}
    <p className="comparison-footnote">Text comparison only. Complete saved versions, including formatting, remain in your archive.</p>
  </div>;
  return <div className="comparison-content">
    <p className="comparison-summary">{result.detailed ? `Text comparison: ${result.removed.size} removed ${result.removed.size === 1 ? 'line' : 'lines'} · ${result.added.size} added ${result.added.size === 1 ? 'line' : 'lines'}.` : 'These long versions differ. Exact text is shown below without line highlighting.'} {differences.join(' ')}</p>
    <div className="revision-texts is-comparing"><div><h4><span className="diff-key removed-key" />Selected version</h4><pre className="revision-prose">{result.left.map((line, index) => <span key={index} className={result.removed.has(index) ? 'diff-line diff-removed' : 'diff-line'}>{line}{index < result.left.length - 1 ? '\n' : ''}</span>)}</pre></div><div><h4><span className="diff-key added-key" />Current writing</h4><pre className="revision-prose">{result.right.map((line, index) => <span key={index} className={result.added.has(index) ? 'diff-line diff-added' : 'diff-line'}>{line}{index < result.right.length - 1 ? '\n' : ''}</span>)}</pre></div></div>
    <p className="comparison-footnote">Text comparison only. Full revision data, including formatting, stays in your archive.</p>
  </div>;
}
