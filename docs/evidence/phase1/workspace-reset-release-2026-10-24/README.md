# Noveliaa full reset — production evidence

Live app: **https://noveliaa.web.app**. Delivered directly from `main`; no branch or PR.

The owner twice explicitly requested a full workspace reset. The first production reset completed at **15:51:02 UTC on24 October2026**. The final idempotent verification completed at **15:56:44 UTC** with the same request and preserved Authentication. The retired root is verified empty: its previous1 writing world,1 collection,4 pages and37 revisions were removed, together with document identities, operations, chunks and blob descriptors. There were0 stored originals. No production manuscript text is retained in this evidence.

- [Successful release40109007622](https://github.com/Wolfrine/creative-workspace/actions/runs/40109007622), job120916589684, application/source commit`42195586cdb57642fb50abfaee04621026ad36cd`.
- [Successful integrity CI40109007618](https://github.com/Wolfrine/creative-workspace/actions/runs/40109007618), job120916589494.
- `workspace-reset-result.json`, `hosted-verification.json` and `rules-release.json` were extracted from the actual successful Actions artifact12566310564. ZIP SHA256:`186e36343219a15e26496fb197330e7dbf22c813a4b538d49aad3b3b36ebfbfa` matched before extraction. `actions-release.json` records release identity; `ci-spark-browser-results.json` reports7 expected,0 unexpected,0 skipped and0 flaky cases.
- `verification.json` independently downloads the current24 public files and verifies the exact Firebase app`1:278082781314:web:9a4b7acef07fa8e4dfb49b`, project/site`noveliaa` and configured JavaScript`assets/index-aL3Avnby.js`. `independent-readback.json` compares those digests with the actual CI artifact and checks the Rules source digest.
- Parent personally inspected the hosted sign-in surface at1440×1000,390×844 and320×844. Actual JPEGs and `hosted-visual-checks.json` record loaded fonts, no horizontal overflow and no development test hook. Authenticated recovery/writing flows were tested with synthetic Auth/Firestore emulator accounts, not a production login bypass. The candidate's58 unit,12 Rules,27 browser and26 evidence checks passed. See [candidate evidence](../workspace-reset-2026-10-24/README.md) for app renders and independent review.

The app repairs the stuck global conflict warning by identifying actual conflicted pages, selecting that page's history, supporting an explicit current-version choice and clearing only reviewed conflicts after acknowledgment. Matching blank versions no longer show two empty comparison panes. Workspace-key rotation and owner Rules block older clients from uploading retired writing.

Close all Noveliaa browser tabs or installed-app windows on each device, then reopen while online. The service worker intentionally keeps an open writer on a coherent existing shell; an older review tab did retain an old shell until closed during this verification. After reopening, the new app learns the active workspace and opens the fresh store. This reset's legacy UID device store is removed online. Other named stores and Firestore SDK caches are isolated rather than indiscriminately deleted; disconnected devices and downloaded archives are outside remote erasure. New writing created after the reset is protected on rerun. Physical-phone keyboard/IME and human author acceptance remain separate.

## Corrections retained

Release40108000833 was cancelled before Firebase authentication/deployment/reset because final review caught a stale-access race. `superseded-release.json` and its screenshot show the skipped cloud steps. The fix coalesces sign-in verification, lets newer confirmed access win and prevents an old named device scope deleting a newer one.

Release40108563399 deployed and verified all24 hosted files and completed the actual reset, then failed in a final log line that referenced the old result-field name. Its three `first-*.json` files are the actual artifact output, verified from ZIP SHA256:`b0b993eab447260df7f523fd8627432b1484b37733e20161ce90c106ed1cb19d`. The reporting line was corrected, its workflow path included and the same idempotent request passed completely in40109007622. No fresh workspace deletion was repeated.

Firebase remains on Spark. Google sign-in, the owner allowlist, project and Hosting site were preserved. Later AI, reader editions and feedback remain out of scope.
