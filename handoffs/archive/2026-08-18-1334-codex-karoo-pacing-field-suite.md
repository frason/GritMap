# Handoff: Six-field Karoo pacing suite built and installed

- Updated: `2026-08-18 13:34 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `45c357b apps/karoo: add pacing field suite`
- Worktree: not clean; unrelated Claude MapLibre/root native work remains uncommitted

## Outcome

GritMap Karoo now exposes three composite graphical experiences and three compact numeric fields.
All use the same framework-neutral live state and representative editor previews. Live metrics are
derived only when their prerequisites exist; missing targets, insufficient progress, and stale
power yield unavailable values rather than fabricated guidance. Version 0.4.0 is installed on the
physical Karoo with its imported segment database retained.

## Changed

- `45c357b apps/karoo: add pacing field suite`
- Added Pacing Coach: current instruction, target, actual/delta, and next zone target/distance.
- Enhanced Pacing Profile: elevation/zone graph plus current guidance and next-change distance.
- Added Segment Performance: predicted total time, adherence, and progress.
- Added Power Delta and Predicted Finish numeric data types; retained Target Power.
- Extension version now follows `BuildConfig.VERSION_NAME`; APK is 0.4.0/versionCode 5.
- Expanded `LiveUiState` with current power, computed delta, next-zone access, predicted finish,
  and adherence.
- Added deterministic live-metric and rendering tests plus preview coverage.

## Verified

- Focused suite passed:
  `AdditionalNumericDataTypesTest`, `CombinedDataTypesTest`, and `LiveMetricsTest`.
- `:app:assembleDebug`: passed.
- Final stale-power guard retest (`LiveMetricsTest`) and APK assembly: passed.
- `adb install -r apps/karoo/app/build/outputs/apk/debug/app-debug.apk`: success.
- Installed package reports versionCode 5/versionName 0.4.0; no uninstall, clear, or connected
  instrumentation was run.

## External state

- Karoo device `00442GA241760203` has GritMap 0.4.0 installed.
- A private pre-0.3.0 SQLite backup exists under the app's private files; Room database/WAL remained
  present through both in-place updates.
- Root Expo/MapLibre/iOS modifications belong to Claude and remain uncommitted/unaffected.

## Hazards and blockers

- Predicted Finish is a simple elapsed/progress projection after 30 m and 5 seconds, not yet an AI
  terrain model.
- Plan adherence requires a pacing target and fresh power. Power Delta likewise remains unavailable
  without both.
- Ahead/behind needs an explicit target-time contract; effort headroom needs validated physiological
  output. Neither is invented in this release.
- Power-format behavior for negative numeric delta should be confirmed visually on Karoo; the stream
  preserves the signed number in unit tests.

## Next safe action

Open Karoo's ride-page editor and confirm all six GritMap entries appear with sample previews. Check
Power Delta renders a negative signed value correctly, then add Pacing Coach and Segment Performance
to a test page for the next segment pass.
