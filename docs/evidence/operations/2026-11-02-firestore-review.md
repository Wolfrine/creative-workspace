# Weekly Firestore review — 2 November 2026

**Fresh production API metrics are available. Sparse daily coverage prevents a
complete week-over-week comparison. Observed activity does not justify changing
the approved save/sync design. No owner action is requested.**

## Evidence and freshness

- Started with a clean checkout; local and fetched remote `main` both matched
  `a15e26c4cde069c8695cced1729bb182a72043d7`. No other work was changed.
- At the initial check, the latest 30 Actions runs contained no 2 November
  scheduled audit. The latest audit was
  [40306690806](https://github.com/Wolfrine/creative-workspace/actions/runs/40306690806),
  source `49f485f885077c8a15e457d8b8272ece3954d212`. Its original 26 October
  10:21 UTC report already returned all five metric series. Historical 403 notes
  therefore do not describe the latest API evidence.
- Refreshed that existing job without changing its code or workflow. The metrics,
  summarizer and existing bounded OAuth cleanup code are byte-identical to current
  main (`git diff` on those five paths was empty). Fresh job **125103592945**
  succeeded; measurements were captured at **2026-11-02T05:00:06.019Z**.
- Retained [raw API report](2026-11-02-firestore-usage.json), independently
  recomputed [coverage/subtotals](2026-11-02-firestore-coverage.json) and the
  separate [existing OAuth cleanup result](2026-11-02-oauth-cleanup.json).
  Artifact **13117841966**, created 05:00:14 UTC, was verified against SHA-256
  `234c540c144a970297a7ff07075540ea70837f4e0b48501d66674cd7eeb60e5f`.
- The current browser inventory had no enabled browser or owner Chrome window.
  A direct Chrome Usage-route attempt returned **Browser is not available:
  chrome**. No Console chart, displayed chart range or chart timezone is claimed;
  no terms, login, access or API changes were attempted. API evidence sufficed
  for the observations below; Chrome could not supplement missing buckets.

## Coverage, operations and pressure

The API queried the preceding 16 days, approximately **17 October 05:00 UTC–
2 November 05:00 UTC**, using hourly sums for operations and hourly maxima for
gauges. Reports use **America/Los_Angeles** calendar days. At capture, **1 November
was still the current partial Pacific day** and was excluded. Intended complete
periods are **25–31 October** and **18–24 October**. Hourly alignment approximates
Pacific calendar buckets; this is not a billed-operation ledger.

All five series returned points. That establishes metric access, not complete
daily or hourly coverage. Values are unrounded numeric observations in the API
report. Missing samples remain null; none were imputed as zero.

| Metric | 25–31 Oct observed subtotal, not weekly total | Days with observations | 18–24 Oct observed subtotal, not weekly total | Days with observations |
| --- | ---: | ---: | ---: | ---: |
| Reads | 1,321 | 6/7 | 2,902 | 2/7 |
| Writes | 69 | 6/7 | 769 | 2/7 |
| Deletes | 20 | 5/7 | 160 | 1/7 |

These are **lower bounds from returned observations**, with unequal coverage.
Weekly totals, changes and growth ratios remain unavailable. Reads/writes lack
31 October; deletes also lack 25 October. The prior period lacks 18–22 October
for reads/writes and 18–23 October for deletes. The retained JSON lists every day.
Do not compare these partial subtotals with each other or with the older
UTC+5:30 Console baseline as if they were equivalent weeks.

Latest-period observed daily peaks were **664 reads** (27 Oct), **21 writes**
(29 Oct) and **7 deletes** (29 Oct). None reached the configured investigation
threshold of 50% of the corresponding daily free-tier baseline. This is neither
a Blaze spending cap nor evidence of complete billed usage. The growth signal
could not be evaluated because weekly totals are unknown.

Latest-period observed hourly gauge peaks were **12 snapshot listeners** and
**3 active connections**. The query sums per-series hourly maxima; these are not
exact simultaneous client/device counts. There is no measured pressure signal
requiring a listener redesign. Aggregate counts do not attribute activity to a
particular save, retry, device or page.

No client round-trip or production save-latency measurement was collected. The
10-second local / 60-second cloud trailing idle deadlines are policy, not measured
latency. Emulator/browser test timings are synthetic and are not substituted.

## Actions, safeguards and next review

- The existing Action also reclaimed **19 already-expired access-token metadata
  records**, with no bound reached; other cleanup namespaces reported zero
  removals. This fixed-namespace cleanup preserves grants, clients, consent,
  collaboration, originals and writing/history. It ran after metric collection,
  on the excluded partial Pacific day; do not add its 19 deletes to the table or
  attribute the table's deletes to this sweep. No database scan estimated usage.
- Retained the agreed 10s/60s idle saves, immutable history, provenance and
  concurrency checks. No source/UI change or new Firebase deployment was made.
  The existing monitoring tests passed **3/3**; artifact integrity, date cutoff,
  missing-day lists and arithmetic were checked independently.
  The deployment-candidate guard initially detected the edited operations guide;
  its retained source inventory was refreshed for that documentation change and
  reverified. No UI render or runtime-code change is implied by this refresh.
- Source still specifies Function min0/max2/concurrency1 and one-day build-image
  cleanup. The last actual deployed readback remains **26 October 11:46 UTC** in
  [release evidence](../plugin-2026-10-25/release/completed-2026-10-26.json);
  it was not re-measured today. The INR100 warning is the existing INR25
  project-only budget's fourth rule, not a cap or duplicate budget. No fresh
  invoice/billing observation is claimed.
- Corrected the recurring prompt's stale Billing-API sentence: Cloud Billing was
  verified enabled on 26 October; the optional Budgets API was disabled at that
  check. Also recorded restored Monitoring access without treating sparse
  coverage as a full week. Schedule, privacy boundaries and quiet notification
  intent were preserved; no IAM, API, key, billing or access change was made.
- Continue the next equivalent complete-period review. If observed pressure
  crosses a threshold, first identify a concrete listener/query/reconnect/save
  or retry mechanism. Current evidence supports no product optimization or new
  approval request. Record missing days rather than manufacturing a trend.
