# Weekly Firestore usage review

The owner requested weekly review on 24 October 2026, keeping the agreed design
for now and planning improvements from actual behavior.

GitHub Actions **Weekly Firestore usage audit** runs Monday at 10:00 India time
(04:30 UTC), on relevant main changes and on manual dispatch. It uses the existing
Firebase Actions identity solely to read aggregate Cloud Monitoring metrics.
There is no manuscript read, Firestore collection scan, Firestore write, new
cloud runtime, billing upgrade, API enablement or IAM mutation.

The thread heartbeat **Noveliaa weekly Firestore review** runs Monday at 10:30
India time. It inspects the audit and compares available weekly observations. If
Monitoring is denied, it uses the existing signed-in Chrome Firebase Usage
console, selecting Last 7 days/Last 30 days and populating chart data tables. It
reads only aggregate charts, never the Data tab or manuscripts. Retain displayed
dates, timezone, rounding and missing values. The console timezone may differ
from the API Pacific-day buckets; do not equate a rolling total with daily quota
usage. If the console session is unavailable too, report the evidence gap.
GitHub schedules can start late; a missing/late run is evidence to report, not a
zero-usage day.

The machine report appears in the job log and GitHub step summary, with an
optional 30-day artifact (`firestore-usage`). Logs/summary remain the fallback if
the account artifact quota prevents upload. The report includes daily reads,
writes/deletes, week-over-week totals when sufficiently observed, hourly listener
and connection peaks, and availability per metric. Missing samples remain null.
The API command reports a warning and an unsuccessful step when metric access is
incomplete. The workflow retains that report and continues; job completion does
not mean metrics are available. It never enables an API or requests replacement keys.

Review signals are **investigation thresholds**, not automatic permission to
change product behavior: observed daily operations >=50% of Spark's allowance;
or >=2x weekly growth with at least 1,000 reads / 500 writes or deletes. Diagnose
listeners/reconnects, history/export loads, duplicate retries, no-op writes and
save frequency before proposing a change. Aggregate metrics cannot by themselves
identify a particular page, device, author action or client latency.

The heartbeat may make small evidenced fixes within the approved design, on main
through existing checks/deployment. Save timing, cloud schema, history retention,
billing/access and later-phase changes require owner approval. Never delete
history or disable concurrency/digest verification to reduce metrics.

Keep a concise dated review under `docs/evidence/operations/`: source run URL and
commit, metric interval/coverage, measured comparisons, signals, actions and next
recommendations. If the identity lacks `monitoring.timeSeries.list` or the API is
unavailable, state the exact gap and available alternatives; no missing value
may be presented as zero. A scheduled check alone does not prove monitoring works.

[Firebase monitoring guidance](https://firebase.google.com/docs/firestore/monitor-usage)
explains that operation metrics estimate usage and can undercount billed activity.
[Metric definitions](https://docs.cloud.google.com/monitoring/api/metrics_gcp_d_h#firestore)
document sample/visibility delays. [Free allowances](https://firebase.google.com/docs/firestore/pricing)
reset around midnight Pacific time; hourly buckets approximate those days.
Client round-trip timing still needs direct measurement separately from the
configured 60-second idle wait.

Initial verification: the API audit on main `dd01004` received HTTP 403 for all
five metrics. The already-authorized owner console successfully supplied the
aggregate baseline on 25 October; see the [first review](../evidence/operations/2026-10-25-firestore-baseline.md). No access or billing change was needed.
