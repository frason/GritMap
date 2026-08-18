# Handoff: Karoo segment activation crash diagnosed, fixed, and installed

- Updated: `2026-08-18 08:50 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `ef2c066 apps/karoo: fix Compose overlay owners`
- Worktree: not clean; unrelated root Expo/iOS/import work remains uncommitted

## Outcome

The first real drive test successfully detected Coco Jumbo and started a segment attempt. The app
then crashed twice while attaching its Compose system overlay. Android's historical crash report
identified the exact missing view-tree owner. The overlay host now provides all owners required by
Compose, the corrected APK builds, and version 0.2.1 is installed on the physical Karoo without
clearing imported data.

## Changed

- `ef2c066 apps/karoo: fix Compose overlay owners`
- `OverlayWindowHost` now installs a `LifecycleOwner`, `SavedStateRegistryOwner`, and
  `ViewModelStoreOwner` on every WindowManager-hosted `ComposeView`.
- The saved-state controller is attached/restored before composition, the ViewModel store is
  cleared on teardown, and detach is safe when the overlay never attached.

## Verified

- Device diagnostics: `candidate_discovered segment=coco-jumbo nearby=1`, followed by selection
  and `attempt_started`.
- `dumpsys activity exit-info`: two `APP CRASH(EXCEPTION)` exits at 08:37:21 and 08:37:24.
- `dumpsys dropbox --print data_app_crash`: both current crashes were the same missing
  `ViewTreeSavedStateRegistryOwner` exception.
- `:app:testDebugUnitTest --tests com.gritmap.karoo.ui.OverlayWindowHostTest :app:assembleDebug`:
  passed.
- `adb install -r .../app-debug.apk`: success.
- Installed package reports `versionCode=3`, `versionName=0.2.1`; app launches successfully.
- Private Room main database and WAL remain present after installation.

## External state

- Physical Karoo device `00442GA241760203` has corrected GritMap 0.2.1 installed.
- Coco Jumbo and other app data should remain in the retained Room database.
- Historical crash and persistent diagnostic logs remain on device for comparison.

## Hazards and blockers

- The fix is structurally verified but the overlay attachment path requires another real segment
  pass to prove it on Karoo's WindowManager environment.
- Do not uninstall, clear app data, or run connected instrumentation.
- Uncommitted root app changes belong to the parallel Claude track and must be preserved.

## Next safe action

Run one forward Coco Jumbo drive/ride with recording active. Confirm the overlay/profile remains
visible after `attempt_started`. If it fails, retrieve exit-info, DropBox, and the persistent
diagnostic log before changing the install.
