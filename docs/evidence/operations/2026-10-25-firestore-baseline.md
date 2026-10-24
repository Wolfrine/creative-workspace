# Firestore baseline — 25 October 2026

Real aggregate production metrics, read from the existing owner Chrome session
in [Noveliaa → Firestore → Usage](https://console.firebase.google.com/project/noveliaa/firestore/databases/-default-/usage/last-7d).
No manuscripts, collection scans, credentials or writing fixtures were used.

The selected range was **Last 7 days, Oct 18–25**. The populated daily chart table
displayed bucket labels Oct 19–25 at midnight in UTC+5:30. These are the console's
displayed buckets, not verified Pacific quota-day boundaries.

| Observation | Displayed result |
| --- | --- |
| Reads | 2.5K total; daily cells 0.039K + 2.492K = approximately 2,531 |
| Writes | 663 total; daily cells 0.011K + 0.652K |
| Deletes | 160 total |
| Snapshot listeners | 21 peak |
| Active connections | 5 peak |

These totals include activity before this release, including console and earlier
operations. They do not establish the new timer design's savings, current active
devices, client latency or billed-operation totals. The observed volume gives no
immediate reason to shorten/lengthen the agreed timers. Retain **10 seconds local,
60 seconds cloud** and compare equivalent periods after the new version has been
used. Earlier-week comparison is unavailable in this first captured baseline.

The first [headless audit](https://github.com/Wolfrine/creative-workspace/actions/runs/40121889149)
on `dd01004731c49cca19005d85a27199a77e59406f` authenticated successfully but
received HTTP 403 / `PERMISSION_DENIED` for all five Monitoring metrics. Its
missing values were retained as null, never zero. The signed-in owner console
supplied the fallback above. No IAM, API-enablement, billing or key change was
made. Follow-up diagnostics distinguish API disablement from IAM permission
failure; the command remains visibly unsuccessful when metrics are unavailable,
while the workflow retains the report for the thread's console fallback.

The weekly thread review is active on **Monday 10:30 India time**. It should
inspect Last 7/30 day tables or API evidence, preserve date/precision limitations,
and propose source-backed improvements if reads/writes or listener pressure grow.
Keep originals, all existing history and expected-head conflict protection.
Timing/schema/retention/access/billing changes still require owner approval.
