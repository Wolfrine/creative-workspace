# Aggregate measurement restored — 26 October 2026

This supplements the earlier 05:09 UTC access-gap report; it does not rewrite
that historical observation. During the approved plugin release, the owner's
Chrome extension became available. Its signed-in Firebase **Usage** page loaded
successfully. No Data tab or manuscript was read and no database scan was used.

Source: https://console.firebase.google.com/project/noveliaa/firestore/databases/-default-/usage/last-30d

The selected range displayed **Last 30 days, Sep26–Oct26**. Chart accessibility
text reported daily buckets **Sep27 00:00–Oct26 00:00, UTC+5:30**. Oct26 is the
current incomplete day. The displayed totals were **3.4K reads, 777 writes,
160 deletes**, with **21 peak listeners and 5 peak active connections**.
These are aggregate estimates including console activity, not billed operations
or an invoice. No network/client latency series was supplied.

The Operations table was explicitly populated and daily headers expanded through
the accessibility controls. The equivalent complete periods are Oct19–25 and
Oct12–18, using the console's timezone rather than the API's Pacific buckets.

| Daily labels | Reads displayed | Writes displayed | Deletes displayed |
| --- | ---: | ---: | ---: |
| Oct12–18, each of seven cells | 0 | 0 | 0 |
| Oct19–23, each of five cells | 0 | 0 | 0 |
| Oct24 | 0.039k | 0.011k | 0 |
| Oct25 | 2.492k | 0.652k | 0.16k |
| Oct26, incomplete, excluded from weekly comparison | 0.837k | 0.114k | — |

Summing the displayed complete-week cells gives approximately **2,531 reads,
663 writes and 160 deletes** for Oct19–25, against displayed zeros in Oct12–18.
The chart uses abbreviated numeric labels; raw text is retained above. A ratio
against a zero baseline is undefined. This is initial launch activity, not
evidence of a sustained growth problem. Do not compare this weekly total with a
daily allowance. A dash for Oct26 deletes remains missing, never zero.

The subscription table was also populated. Its Oct25 cells showed 21 listeners
and 5 connections, matching the 30-day maxima. Earlier daily subscription columns
were not all successfully retained, so a previous-week peak is not asserted.

A separate, earlier **Last24hours Oct25–26** observation displayed 466 reads,
8 writes, no delete data, 12 peak listeners and 3 peak connections. Its chart
spanned Oct25 14:00–Oct26 13:00, UTC+5:30. This is a different rolling interval,
not a substitute for complete daily or weekly buckets.

The Actions Monitoring API still lacks metric access. The owner's working Chrome
Usage view restores the scheduled review's fallback, not unattended API access.
The weekly prompt now prefers that existing session, preserves the approved Blaze
plan and INR100 warning, and stays quiet for unchanged/non-actionable results.

No sync optimization is justified by these aggregate counts alone. The agreed
10-second local and 60-second cloud trailing idle saves, source provenance,
immutable history and concurrency checks remain unchanged. Continue measurement
through the next complete week; investigate a concrete listener, query, retry or
save mechanism only if the observations support it.
