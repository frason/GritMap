# Handoff: Karoo overlay replaced by native alert and data fields

- Updated: `2026-08-18 11:23 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `5a4d504 apps/karoo: replace overlay with entry alert`
- Worktree: not clean; unrelated root navigation/ride-screen work remains uncommitted

## Outcome

The system overlay no longer appears during segments, so GritMap cannot cover Karoo's native ride
fields. Segment detection instead produces a four-second native Karoo alert. Riders keep persistent
guidance by adding GritMap Pacing Profile and/or GritMap Target Power to their ride page. The app's
primary page now displays its installed version.

## Changed

- `5a4d504 apps/karoo: replace overlay with entry alert`
- Removed the `SYSTEM_ALERT_WINDOW` manifest permission and overlay-permission launcher button.
- Removed all `OverlayWindowHost` calls from the live service.
- Added a native `InRideAlert` at attempt entry with a unique attempt ID, segment name, distance,
  and validated target/instruction when available. It auto-dismisses after four seconds.
- Added alert colors and pure alert-contract tests.
- Bumped APK to versionName 0.3.0/versionCode 4 and exposed `BuildConfig.VERSION_NAME` in the
  launcher.

## Verified

- `:app:testDebugUnitTest --tests com.gritmap.karoo.service.SegmentEntryAlertTest :app:assembleDebug`:
  passed.
- Verified APK: `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- The non-fatal SDK XML version warning remains present.

## External state

- The Karoo disconnected before installation. Device currently has version 0.2.1, not 0.3.0.
- Coco Jumbo and app data remain on the device; no uninstall, clearing, or instrumentation occurred.

## Hazards and blockers

- Hammerhead's Climber bottom sheet is not exposed through public `karoo-ext` 1.1.9 APIs. A custom
  bottom system overlay would still cover rather than reflow native content.
- Uncommitted root app files belong to the parallel Claude track and must be preserved.

## Next safe action

Reconnect the Karoo and install 0.3.0 with `adb install -r`, then verify segment entry shows one
four-second alert and leaves all configured ride-page fields unobscured.
