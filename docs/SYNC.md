# Writing save and sync contract

Owner-approved on 24 October 2026. Changes stay within Phase 1 and Firebase Spark.

| Trigger | Device | Cloud |
| --- | --- | --- |
| Actual content edit | Memory and reset idle timers | Reset deadline; no upload |
| 10 seconds after last edit | Replace this tab's durable recovery draft | Nothing |
| 60 seconds after last edit | Immutable checkpoint of latest writing and durable outbox | Upload eligible revisions |
| Background, navigate or sign out | Immediate recovery draft safety save | Keep the idle deadline |
| Manual sync | Checkpoint current writing | Upload immediately if online |
| History, restoration or complete archive | Explicit version boundary | Read full history when online; no early upload |
| Reconnect/restart | Keep acknowledged writing and recover drafts | Refresh heads, then respect the last-edit deadline |
| Confirm a collection rename | Atomically retain metadata and queued intent | One guarded collection write when due; competing names require a choice |
| Open private Read mode | Local-only recovery flush and frozen reading projection | No early upload |
| Turn reader pages/change appearance | Device reading position/preferences only | No writing revision or write request |

The timers are trailing idle debounces, never periodic intervals or maximum-wait
saves. They are independent: 60 seconds is measured from the edit, not the local
save. Continuous typing postpones both. Native typing, formatting and Unicode
input change editor state; individual characters/timestamps are not stored as
cloud operations. Automatic in-flight work may complete after typing resumes;
that acknowledgement cannot mark newer words saved.

Mutable drafts are private IndexedDB records, outside the Firestore SDK's write
cache. Otherwise the SDK could upload the ten-second recovery draft before the
cloud deadline. Per-tab keys preserve concurrent drafts. A restart promotes
surviving drafts into immutable recoverable versions; ordinary local pauses do
not add versions. The IndexedDB upgrade adds a store; cloud format and all earlier
immutable history/originals are unchanged. Undoing exactly to the checkpoint
creates no new cloud revision.

Three long-lived data listeners watch heads, universes and collections. Access
has its own existing listener. Cached/optimistic events cannot earn cloud
receipts. Existing verified bytes are reused; unchanged metadata events do not
trigger reloads. History/export explicitly requests full revisions/originals.
Cold starts still validate head ancestry, so large histories need future measured
optimization. Clean devices advance silently. Unsaved memory, device drafts and
outbox branches block destructive head adoption; genuine concurrent variants
remain recoverable and require an author choice.

A normal small cloud revision on an existing page still needs approximately five
document writes: chunk, manifest, revision, operation receipt and head. Large
payloads, new identities and catalog records add operations. The save frequency
and listener scope improve here; a two-write schema is not introduced. No-op
replays may perform reads without new writes.

The header uses a static icon with an accessible name, without inline helper text
or an assertive/live status announcement on typing. Tap it for details or manual
sync. Actual errors keep the existing recovery/export path visible.

## Recovery limits

The approved background safety save is local only and best effort. Browser or OS
termination before a device transaction completes can still lose in-memory
changes; background timers may be suspended. Closing the app before the cloud
deadline leaves the latest writing on that device until it runs again. Browser
data clearing removes device drafts; downloadable archives of all locally available writing remain the portable
recovery path. Export requests full cloud history when available; a cloud read
failure cannot block a device archive. Typing during that read is checkpointed
before encoding the archive. Physical-phone force-kill/keyboard acceptance is separate
from Chromium viewport and emulator evidence.

## Evaluation

- Fake-clock boundary and continuous-typing tests: nothing before 10/60 seconds;
  each edit resets deadlines, reconnect/hide cannot upload early, and old save
  completions cannot acknowledge new typing.
- Device recovery: latest exact Unicode draft after restart, both tab variants,
  failed-write acknowledgement, existing history and migration preservation.
- Actual Auth/Firestore emulator browsers: clean device refresh, live changes,
  offline recovery, genuine conflict branches, exact originals and export.
- Rendered desktop/mobile: quiet icon, details, focus/formatting, 320/390/1440px,
  no overflow or per-keystroke animation/announcements.
- Weekly [aggregate production review](operations/firestore-usage.md): usage
  trends, listener pressure, quota signals and evidence gaps. Do not infer client
  latency or billed usage from document metrics.

Sources: [CKEditor debounce semantics](https://ckeditor.com/docs/ckeditor5/latest/api/module_autosave_autosave-Autosave.html),
[Firebase long-lived listeners](https://firebase.google.com/docs/firestore/real-time_queries_at_scale),
[offline behavior](https://firebase.google.com/docs/firestore/manage-data/enable-offline),
and [browser lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).
The 10/60-second values are owner policy, not a universal research constant.
