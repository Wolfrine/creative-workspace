const DAY = 86400000;
const date = time => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
export function monitoringFailure(payload, httpStatus) {
  const info = payload.error?.details?.find(value => value['@type']?.endsWith('/google.rpc.ErrorInfo'));
  const permission = info?.metadata?.permission ?? /Permission ['"]?([A-Za-z][A-Za-z0-9_.]+)['"]? (?:denied|is required)/i.exec(payload.error?.message ?? '')?.[1];
  return { status: 'unavailable', reason: info?.reason ?? payload.error?.status ?? 'HTTP_' + httpStatus, httpStatus, ...(permission ? { permission } : {}) };
}
export function summarizeUsage(metrics, now = new Date()) {
  const today = date(now);
  // Calendar arithmetic on the Pacific date avoids skipping DST days.
  const calendar = new Date(today + 'T12:00:00Z');
  const dates = Array.from({ length: 14 }, (_, n) => new Date(calendar.getTime() - (14 - n) * DAY).toISOString().slice(0, 10));
  const daily = dates.map(day => ({ date: day, reads: null, writes: null, deletes: null }));
  const gauges = {}, availability = {};
  for (const [name, metric] of Object.entries(metrics)) {
    availability[name] = { status: metric.status, metricType: metric.metricType, ...(metric.reason ? { reason: metric.reason } : {}), ...(metric.httpStatus ? { httpStatus: metric.httpStatus } : {}), ...(metric.permission ? { permission: metric.permission } : {}) };
    if (metric.status !== 'available') continue;
    const points = metric.series.flatMap(series => series.points ?? []).map(point => ({ day: date(new Date(new Date(point.interval.endTime).getTime() - 1)), value: Number(point.value.int64Value ?? point.value.doubleValue) })).filter(point => Number.isFinite(point.value));
    if (['reads', 'writes', 'deletes'].includes(name)) {
      for (const row of daily) { const values = points.filter(point => point.day === row.date); if (values.length) row[name] = values.reduce((sum, point) => sum + point.value, 0); }
    } else {
      const values = points.filter(point => dates.slice(-7).includes(point.day)).map(point => point.value);
      gauges[name] = { hourlyPeakObserved: values.length ? Math.max(...values) : null, note: 'Sum of per-series hourly maxima; not an exact simultaneous client count.' };
    }
  }
  const comparison = {}, signals = [];
  for (const [name, quota] of [['reads', 50000], ['writes', 20000], ['deletes', 20000]]) {
    const prior = daily.slice(0, 7).map(row => row[name]), latest = daily.slice(-7).map(row => row[name]);
    const priorTotal = prior.every(value => value !== null) ? prior.reduce((a, b) => a + b, 0) : null;
    const latestTotal = latest.every(value => value !== null) ? latest.reduce((a, b) => a + b, 0) : null;
    comparison[name] = { previousWeek: priorTotal, latestWeek: latestTotal, ratio: priorTotal > 0 && latestTotal !== null ? latestTotal / priorTotal : null, observedDailyPeak: latest.some(value => value !== null) ? Math.max(...latest.filter(value => value !== null)) : null, dailySparkAllowance: quota };
    for (const row of daily.slice(-7)) if (row[name] !== null && row[name] >= quota * .5) signals.push(`${row.date}: observed ${name} reached at least 50% of daily Spark allowance; usage metrics can undercount billed operations.`);
    if (priorTotal > 0 && latestTotal >= Math.max(priorTotal * 2, name === 'reads' ? 1000 : 500)) signals.push(`${name} at least doubled week over week; inspect the cause before changing the design.`);
  }
  const available = Object.values(availability).filter(value => value.status === 'available').length;
  return { capturedAt: now.toISOString(), project: 'noveliaa', source: 'Google Cloud Monitoring API; real aggregate production metrics', status: available === 5 ? 'available' : available ? 'partial' : 'unavailable', reportingTimezone: 'America/Los_Angeles', excludesCurrentPartialDay: true, availability, daily, comparison, gauges, signals, limits: 'Usage metrics are not billed-operation totals. Missing samples/days remain null. Hourly buckets approximate Pacific quota days; no client round-trip latency is inferred. No manuscript, database collection scan, API enablement, billing change or Firestore write.' };
}
