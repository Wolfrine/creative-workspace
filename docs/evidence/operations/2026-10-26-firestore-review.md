# Weekly Firestore review — 26 October 2026

Checked at **10:39 India time (05:09 UTC)**. Result: **current usage unavailable**;
no measured trend or evidence-based product change can be established.

## Sources and coverage

- Local and remote `main` matched `709c296ba5a9441120e1624938a0c52e441f8932`
  before this report. The untracked plugin cost comparison was preserved.
- The latest 20 GitHub Actions runs contained no 26 October usage audit as of
  05:09 UTC. The configured Monday audit is scheduled for 04:30 UTC; this is a
  missing/late observation, not proof of a particular scheduler or billing fault.
- The newest available [usage audit, 40191005086](https://github.com/Wolfrine/creative-workspace/actions/runs/40191005086)
  ran on 25 October, commit `01f204d21eb31895411ccc851824226b8d971aa9`.
  Its report was captured at `2026-10-25T11:57:23.441Z`. Job completion is green,
  but all five metric series report **HTTP 403 / PERMISSION_DENIED**. Job logs
  confirm the report; the current artifact digest matches the retained copy:
  artifact `12598286148`, SHA-256
  `c8ca726c8d8f7ddc5f6de170b2bb2d5602fd089544775f13f84beaa2e7ff45e3`.
- No Chrome surface was available to this review; the enabled browser was the
  in-app browser. Its existing owner Google session was used to open only the
  [aggregate Usage route](https://console.firebase.google.com/project/noveliaa/firestore/databases/-default-/usage/last-7d).
  Initial loading reported that the project did not exist or apps could not be
  listed. One explicit Try again then reported **"An error occurred when loading
  the terms of service acceptance status"**, which persisted after loading ended.
  These are console loading errors, not a finding that the project was deleted
  or that new terms must be accepted. No account switching, consent, credentials,
  IAM or API changes were attempted.
- At `2026-10-26T05:10:47.612Z`, the public Hosting SDK configuration returned
  HTTP 200 with project `noveliaa` and the expected Web App
  `1:278082781314:web:9a4b7acef07fa8e4dfb49b`. This checks site identity only,
  not Firestore access, usage measurement or an authenticated writing session.

## Measurements and comparison

Current reads, writes, deletes, listener peaks and connection peaks are **unknown**.
No chart data table, displayed interval, console timezone or precision was
available. The requested URL alone does not establish a displayed date range.
The older API report uses Pacific day buckets and contains null observations;
it cannot establish equivalent complete current/previous weeks. Week-over-week
totals, ratios and quota-pressure comparisons therefore remain unavailable.

The [25 October console baseline](2026-10-25-firestore-baseline.md) remains
historical: displayed Last 7 days, Oct 18–25; daily labels Oct 19–25 in UTC+5:30;
reads 2.5K displayed (approximately 2,531 from rounded daily cells), writes 663,
deletes 160, listeners peak 21 and connections peak 5. It is not today's weekly
measurement and must not be compared directly with a daily free allowance.

No new client latency measurement exists. The 60-second idle deadline is policy,
not network latency. Aggregate operation metrics estimate usage, not billed
operations or an invoice. Missing data is not zero; synthetic emulator tests are
not production observations. There is insufficient evidence to diagnose excessive
reads/writes or attribute activity to a listener, page, device or retry loop.

## Actions and next recommendation

Only metadata/log reads and the aggregate console route were inspected. No Data
tab, manuscript, collection scan, production write, cleanup invocation or deploy
was performed. No application code changed; app tests and desktop/mobile product
QA were not rerun for this report. The 10-second local / 60-second cloud trailing
idle saves, immutable history, originals and concurrency protections remain.

The owner approved Blaze on 25 October; historical Spark allowances are only
free-tier investigation baselines, not a spending cap. Billing, access, timing,
schema and retention remain unchanged. The pending plugin cost-policy decision
does not authorize this scheduled review to resume its deployment.

The recurring prompt was reconciled with the approved billing context and keeps
the existing weekly schedule. It now explicitly stays quiet for unchanged,
non-actionable results and preserves pending author decisions.

**Next action:** check whether the Usage page loads in the owner's signed-in
browser and make that aggregate view available for the next read. Restore
measurement before proposing optimization; do not request a replacement key or
broader access as an automatic response. A fresh successful API audit or populated
Last 30 days daily tables is needed for a defensible complete-period comparison.
