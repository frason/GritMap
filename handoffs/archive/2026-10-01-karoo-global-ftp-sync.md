# Handoff: Karoo FTP is now GritMap's global rider FTP

- Updated: `2026-10-01 21:40 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: uncommitted FTP synchronization and launcher UI changes coexist with substantial prior Karoo/phone work.

## Outcome

GritMap now consumes `karoo-ext`'s `UserProfile.ftp` as global rider state. The value is published
in memory, synchronized into the singleton Room rider profile, used by the existing live matcher
candidate/session path, and displayed in Settings as synced from Karoo. A plan's stored FTP remains
provenance only; a mismatch produces `PLAN OUTDATED` and an update recommendation rather than an
import failure or silent target rescaling.

## Changed

- `service/RiderProfileStore.kt`: framework-neutral current Karoo rider-profile state.
- `LiveSegmentService.kt`: consumes FTP/weight/max-HR from `UserProfile`, publishes it, and syncs Room off the main thread.
- `KarooDatabase.kt`: transactional global profile upsert/update that preserves imported threshold HR.
- `TransferPackage.kt`: removed rejection based only on current installed FTP differing from the plan-generation FTP.
- `MainActivity.kt` and `KarooHomeScreen.kt`: Settings shows current Karoo FTP; library/detail views distinguish planned, missing, and outdated plans and label historical FTP as `Generated at`.
- `KarooDatabaseTest.kt`: instrumentation coverage for creating/updating Karoo profile state while retaining threshold HR.
- `app/build.gradle.kts`: version `0.10.27` / code 50.

## Verified

- `./gradlew testDebugUnitTest assembleDebug assembleDebugAndroidTest` with Java 17 — passed.
- `./gradlew connectedDebugAndroidTest` on physical Karoo — 5/5 tests passed.
- `adb install -r` succeeded; device reports `0.10.27`/code 50.
- Live device logs contain `karoo_rider_profile_synced ftp=290`, confirming real `UserProfile` delivery and persistence path.

## External state

- The connected Karoo currently reports FTP **290 W**. This differs from the previously discussed 280 W; GritMap correctly reflects Karoo's configured value.
- Instrumentation/install caused Android's location permission prompt to appear. The user must choose Precise/Approximate and allow location before live matching resumes; Precise is recommended for segment matching.

## Hazards and blockers

- Existing absolute-watt pacing targets are not automatically rescaled when FTP changes. Plans generated at another FTP are marked outdated; regeneration is the safe action.
- Transfer packages can still contain rider history; the next Karoo `UserProfile` event remains authoritative for FTP/weight/max-HR while imported threshold HR/history are preserved.
- Worktree contains concurrent uncommitted changes; do not discard or mass-format it.

## Next safe action

Grant precise location on the visible Karoo prompt, then open Settings and confirm `FTP 290 W · Synced automatically from Karoo settings`; update the Karoo FTP itself if 290 W is not intended.
