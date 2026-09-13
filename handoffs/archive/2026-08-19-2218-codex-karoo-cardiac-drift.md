# Handoff: Karoo cardiac-drift graph built and verified

- Updated: `2026-08-19 22:18 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `4b84972 ui/define-segment-screen: distance-based scrubber + save flow (issue #7)`
- Worktree: Karoo cardiac-drift changes are uncommitted alongside Claude's unrelated root-app work.

## Outcome

Karoo 0.8.0 adds a registered **GM Cardiac Drift** graphical data field. It waits 45 seconds,
uses the first complete 30-second rolling power/HR efficiency window as a baseline, and plots
the percentage efficiency change over segment progress. Positive values mean efficiency has
fallen. The field shows Stable below 3%, Drifting from 3% to below 5%, and High strain at 5%
or above. These are coaching display bands, not clinical thresholds.

## Changed

- Added `CardiacDriftTracker`, bounded framework-neutral history on `LiveUiState`, and service
  integration without Room writes.
- Added `CardiacDriftBitmapRenderer`, `karoo_cardiac_drift_field.xml`, extension registration,
  preview data, and live-demo data.
- Updated `apps/karoo/README.md` and bumped the app to versionName 0.8.0/versionCode 11.
- Added focused tracker and Robolectric renderer tests.
- Commit was attempted but the approval service rejected the Git write because the current
  Codex usage limit was reached. No workaround was attempted.

## Verified

- `./gradlew clean testDebugUnitTest` with Homebrew Java 17: **BUILD SUCCESSFUL**; 56 tests.
- App-only focused drift tests plus `:app:assembleDebug`: **BUILD SUCCESSFUL**.
- APK: `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- A broad filtered Gradle invocation failed only because its `--tests` selectors were also
  applied to `:vendor:karoo-ext`, which has no matching tests; it was replaced by the successful
  app-only invocation above.

## External state

- APK 0.8.0 has not been installed on a Karoo in this milestone.
- The connected-device state was not checked.

## Hazards and blockers

- Cardiac drift is a live trend, not formal aerobic decoupling. Short segments, HR lag,
  temperature, hydration, sensor errors, and variable pacing can move it.
- The Karoo files remain uncommitted. Stage only `apps/karoo/` plus this handoff when committing;
  do not absorb or revert Claude's root-app files.

## Next safe action

Commit the isolated Karoo and handoff paths, install 0.8.0, then use **Start data-field demo**
to inspect GM Cardiac Drift at small, medium, and large field sizes before the real sensor ride.
