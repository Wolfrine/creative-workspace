# Live refinement release — 24 October 2026

Application commit: `ae09cd8f636d985c5a3ec7a7b40fc2dc405e915a`, from `main`.
Live site: https://noveliaa.web.app.

[Deployment attempt 5](https://github.com/Wolfrine/creative-workspace/actions/runs/40086703018/attempts/5)
and [CI attempt 3](https://github.com/Wolfrine/creative-workspace/actions/runs/40086702833/attempts/3)
passed. The existing GitHub Actions identity and Spark deployment route were
preserved. No local deployment or production writing seed was used.

The runner passed 47 client/integration tests, 11 real Firestore Rules/adapter
tests, 5 authenticated Auth/Firestore browser flows, 17 writing/browser checks,
26 evaluator mutation tests, the build and retained source/render verification.
It verified the exact Firebase Web App/site/author binding, read back the new
Rules release with matching SHA-256, published Hosting and compared every one
of its 24 configured build files against the hosted bytes. Selected non-secret
release facts are retained in `verification.json` and the current release
status; the prior account-block screenshots remain historical evidence.

`verification.json` contains an independent HTTP inventory of all 24 live files,
their lengths and SHA-256 values, the exact Firebase app/project identity, and
the successful run/commit. The live HTML references the configured runner build's
`assets/index-OdbRN10S.js`.

The parent inspected the actual deployed public sign-in screen in the Codex
in-app browser at 1440×1000, 390×844 and 320×844. `visual-check.json` retains
DOM measurements and the inspection result. The three JPEGs show these actual
renders. No horizontal overflow, clipped sign-in control, overlapping content
or browser console error was observed. The browser viewport was restored after
the checks.

The authenticated writing surfaces and cross-device behavior were tested through
the actual app with synthetic fixtures and real Auth/Firestore emulators, with
render evidence retained in `../refinement-2026-10-24`. No production Auth bypass,
manuscript read/write or invented production acceptance is claimed. The owner's
production writing session, physical phone keyboard/IME and independent disaster
backup remain separate acceptance evidence.

The service worker keeps an open writer on a coherent app version. After Synced,
close all Noveliaa tabs on each device and reopen to activate this update.
