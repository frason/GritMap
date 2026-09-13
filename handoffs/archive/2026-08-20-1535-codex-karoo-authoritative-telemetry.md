# Handoff: Karoo telemetry accounting made authoritative and stale-safe

- Updated: `2026-08-20 15:35 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: Karoo 0.8.1 milestone and three Codex handoff files are uncommitted; root-app files are clean.

## Outcome

GritMap now applies the central correctness lesson from 7Climb v3.0.2. Sensor callbacks only
replace the current in-memory values. The GPS cadence provides the physical telemetry tick;
that tick is sanitized against the three-second freshness status before matching, aggregates,
cardiac drift, or adaptive guidance receive it. A timestamp can be accounted once only, and
plan/UI/completion state changes cannot increment telemetry counts.

## Changed

- `LiveTelemetry.sanitized()` converts stale GPS/sensor values to missing values.
- `ActiveAttemptSession.accept()` was replaced by the explicit, duplicate-guarded
  `recordTelemetryTick()` plus the existing `updateUiState()` state-only path.
- Plan changes and completion now use only `updateUiState()`.
- The service passes a sanitized sample to the coordinator and records that same sample in
  aggregates and cardiac drift.
- Added `TelemetryAccountingTest`: 8 callback-shaped admissions per second for 60 seconds
  produce exactly 60 samples; state-only changes produce zero; stale retained power/HR never
  enter aggregates.
- Extended sensor-freshness tests and migrated existing tests to the explicit tick API.
- Updated README and bumped to versionName 0.8.1/versionCode 12.

## Verified

- `./gradlew clean testDebugUnitTest` with Homebrew Java 17: **BUILD SUCCESSFUL**.
- `./gradlew assembleDebug`: **BUILD SUCCESSFUL**.
- APK: `apps/karoo/app/build/outputs/apk/debug/app-debug.apk` (31 MB).

## External state

- Installation of 0.8.1 was attempted while the Karoo was connected, but the device
  disconnected during the command and returned no install result. The last confirmed installed
  version remains 0.8.0/versionCode 11. Do not claim 0.8.1 is installed until rechecked.

## Hazards and blockers

- The authoritative tick follows GPS cadence rather than an independent timer. The captured
  Karoo log showed about 1 Hz GPS delivery, which matches the product contract. A later change
  to a higher-rate location source must retain the duplicate/rate boundary.
- Paused elapsed time still counts by design, while stale sensor values are now absent.
- Karoo source changes remain uncommitted and must be staged separately from future root work.

## Next safe action

Reconnect the Karoo, install the 0.8.1 APK in place, confirm versionCode 12, then run the
power/HR test with GritMap launched before ride recording.
