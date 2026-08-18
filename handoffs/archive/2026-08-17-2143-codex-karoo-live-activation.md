# Handoff: Karoo live activation hardened and awaiting device install

- Updated: `2026-08-17 21:43 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `28d9f21 apps/karoo: harden live segment activation`
- Worktree: Karoo paths clean; unrelated Claude root-app native scaffolding remains active

## Outcome

Live matching now has an explicit location-permission setup, restartable service lifecycle,
extension/profile startup hooks, safe foreground permission handling, and bounded persistent
diagnostics. APK and extension metadata are version 0.2.0/versionCode 2. The data-field split
from 5ae510f is included in the built APK.

## Changed

- `28d9f21` contains the isolated implementation under `apps/karoo/`.
- Added `LiveServiceStarter`, `LiveDiagnostics`, and `BoundedDiagnosticLog`.
- Instrumented service/Karoo/ride/GPS/candidate/attempt/error transitions.
- Added launcher permission and recent-diagnostics UI.
- Added a Coco Jumbo regression trace derived from the user's second car FIT file.

## Verified

- `./gradlew testDebugUnitTest lintDebug assembleDebug` passed.
- A final `./gradlew testDebugUnitTest assembleDebug` passed after the version bump.
- The second FIT matched Coco Jumbo offline with 100% coverage and 0.987088 confidence; its
  derived Android live-matcher regression completes without HR or power.
- No connected instrumentation was run.

## External state

- The Karoo was disconnected when installation was attempted, so it still runs the older APK.
- Coco Jumbo should remain in the existing app database because no install/clear occurred.

## Hazards and blockers

- Do not run `connectedDebugAndroidTest` against the user's active package; it previously
  cleared Room and app-specific files.
- Background service starts requested by the bound extension are caught and logged because
  Android may restrict them; the user-granted launcher start plus `START_STICKY` is the primary
  lifecycle path.

## Next safe action

Reconnect the Karoo, run `adb install -r` with the 0.2.0 debug APK, open the launcher, grant
location permission, confirm Coco Jumbo remains installed, and add/confirm both Pacing Profile
and Target Power fields. Run a short recorded approach and inspect Live diagnostics before any
further code changes.
