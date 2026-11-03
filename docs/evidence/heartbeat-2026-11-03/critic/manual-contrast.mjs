import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const evidence = JSON.parse(await readFile(new URL('./color-review/contrast-review.json', import.meta.url)));
const channels = color => color.startsWith('#') ? color.slice(1).match(/../g).map(value => parseInt(value, 16)) : color.match(/[\d.]+/g).slice(0, 3).map(Number);
const luminance = color => channels(color).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05); };
const results = [];
for (const state of evidence.states.filter(item => ['details', 'night-details'].includes(item.state))) {
  // The real <dialog> is a solid #fcfdf8 (src/styles.css); axe marks text inside
  // top-layer dialogs incomplete due to overlap. Inspect these concrete pairs.
  const colors = new Set(state.colors.filter(item => /heartbeat-detail|heartbeat-context/.test(item.className)).map(item => item.color));
  colors.add('rgb(101, 107, 88)'); // measured secondary large label in these dialogs
  for (const color of colors) {
    const ratio = contrast(color, '#fcfdf8');
    assert(ratio >= 4.5, `${state.state} ${state.width} ${color}: ${ratio}`);
    results.push({ state: state.state, width: state.width, foreground: color, background: '#fcfdf8', ratio, threshold: 4.5, result: 'PASS' });
  }
}
await writeFile(new URL('./color-review/manual-contrast.json', import.meta.url), JSON.stringify({ method: 'sRGB relative luminance from measured computed foregrounds and solid dialog background; no axe rule disabled', checks: results }, null, 2));
console.log(JSON.stringify({ checks: results.length, minRatio: Math.min(...results.map(item => item.ratio)), result: 'PASS' }));
