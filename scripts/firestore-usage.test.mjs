import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeUsage } from './summarize-firestore-usage.mjs';
test('permission failure and missing samples are never reported as zero', () => {
  const report = summarizeUsage({ reads: { status: 'unavailable', metricType: 'read_count', reason: 'PERMISSION_DENIED' } }, new Date('2026-10-24T12:00:00Z'));
  assert.equal(report.status, 'unavailable'); assert.equal(report.comparison.reads.latestWeek, null); assert(report.daily.every(day => day.reads === null));
});
test('uses complete Pacific days, totals observations and detects quota pressure without claiming billing truth', () => {
  const series = [{ points: [{ interval: { endTime: '2026-10-24T06:00:00Z' }, value: { int64Value: '30000' } }, { interval: { endTime: '2026-10-24T15:00:00Z' }, value: { int64Value: '99999' } }] }];
  const report = summarizeUsage({ reads: { status: 'available', metricType: 'read_count', series } }, new Date('2026-10-24T18:00:00Z'));
  assert.equal(report.daily.at(-1).date, '2026-10-23'); assert.equal(report.daily.at(-1).reads, 30000); assert.equal(report.comparison.reads.latestWeek, null); assert.equal(report.signals.length, 1);
});
