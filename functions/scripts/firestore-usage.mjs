// Read-only aggregate monitoring. Never connects to Firestore or reads writing.
import { applicationDefault } from 'firebase-admin/app';
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { summarizeUsage, monitoringFailure } from '../../scripts/summarize-firestore-usage.mjs';

const binding = JSON.parse(await readFile('deployment/firebase-binding.json', 'utf8'));
if (process.env.VERIFIED_PROJECT !== 'noveliaa' || binding.projectId !== 'noveliaa' || binding.planConstraint !== 'Spark') throw new Error('Usage audit target mismatch.');
const credential = applicationDefault();
const now = new Date(), start = new Date(now.getTime() - 16 * 86400000);
const definitions = [
  ['reads', 'document/read_count', 'ALIGN_SUM'], ['writes', 'document/write_count', 'ALIGN_SUM'], ['deletes', 'document/delete_count', 'ALIGN_SUM'],
  ['connections', 'network/active_connections', 'ALIGN_MAX'], ['listeners', 'network/snapshot_listeners', 'ALIGN_MAX'],
];
const metrics = {};
for (const [name, suffix, aligner] of definitions) {
  const metricType = 'firestore.googleapis.com/' + suffix;
  try {
    const series = []; let pageToken;
    for (let page = 0; ; page++) {
      if (page >= 100) throw Object.assign(new Error('Pagination bound exceeded'), { code: 'PAGINATION_LIMIT' });
      const query = new URLSearchParams({ filter: `metric.type="${metricType}" AND resource.type="firestore_instance"`, 'interval.startTime': start.toISOString(), 'interval.endTime': now.toISOString(), 'aggregation.alignmentPeriod': '3600s', 'aggregation.perSeriesAligner': aligner, 'aggregation.crossSeriesReducer': 'REDUCE_SUM', view: 'FULL', pageSize: '1000', ...(pageToken ? { pageToken } : {}) });
      const token = await credential.getAccessToken();
      const response = await fetch('https://monitoring.googleapis.com/v3/projects/noveliaa/timeSeries?' + query, { headers: { Authorization: 'Bearer ' + token.access_token }, signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error('Monitoring request unavailable'), monitoringFailure(data, response.status));
      series.push(...(data.timeSeries ?? [])); pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    metrics[name] = { status: series.some(row => row.points?.length) ? 'available' : 'no-data', metricType, series };
  } catch (error) {
    // No token, credential path, API response body or manuscript enters output.
    metrics[name] = { status: 'unavailable', metricType, reason: error.reason ?? error.code ?? error.name ?? 'REQUEST_FAILED', ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}), ...(error.permission ? { permission: error.permission } : {}) };
  }
}
const report = summarizeUsage(metrics, now);
await mkdir('.local', { recursive: true });
await writeFile('.local/firestore-usage.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `# Noveliaa Firestore usage\n\nRead-only Cloud Monitoring observations; not a billing statement.\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`);
if (report.status !== 'available') { console.log('::warning::Some Firestore monitoring evidence is unavailable or incomplete. Missing values are not zero.'); process.exitCode = 1; }
