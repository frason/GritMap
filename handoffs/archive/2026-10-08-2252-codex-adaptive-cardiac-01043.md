# Handoff: adaptive cardiac guidance and signed 0.10.43 beta candidate

- Updated: `2026-10-08 22:52 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d38057f feat(karoo): adapt cardiac guidance by effort length`
- Worktree: Claude-owned phone edits remain uncommitted in `App.tsx` and `src/screens/RouteMapView.native.tsx`; Karoo and milestone documentation are clean.

## Outcome

`GM Cardiac Drift` now remains useful across effort lengths without overclaiming physiology: it shows HR response while building the baseline, emerging drift from three minutes, and full cardiac drift from six minutes. On long efforts, qualified H10 data appears as supplemental alpha-1 context; the dedicated `GM H10 Cardiac` field remains available. RR qualification now requires approximately two clean minutes and 95% valid intervals.

All rider-facing Karoo pacing-plan stretches are now called **sections**, while internal `zone` identifiers and shared JSON contracts remain unchanged. A signed `0.10.43-beta`/code 66 candidate is ready, but it has not been installed on the physical Karoo.

## Changed

- Commit `d38057f`.
- Cardiac state/tracking/rendering: `LiveUiState.kt`, `CardiacDriftTracker.kt`, `CardiacDriftBitmapRenderer.kt`.
- H10 quality gates: `RrLiveBuffer.kt`, `RrWindowMetrics.kt`.
- Rider-facing sections wording: Pacing Coach, segment library/detail, combined field copy, accessibility resources, and `docs/BETA_KAROO_INSTALL.md`.
- Version defaults: `0.10.43` / code 66 in `apps/karoo/app/build.gradle.kts`.
- Physical checklist: `docs/H10_RIDE_VALIDATION_CHECKLIST.md`.
- Beta problem instructions now request version/build, FIT, field photos, refreshed diagnostics, and H10 progression details.

## Verified

- Focused cardiac and pacing-renderer JVM tests passed.
- Final command passed: `./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleBeta` with JDK 17, Android SDK, persistent beta signing properties, version code 66, and version name `0.10.43-beta`.
- JVM result: **183 tests, 0 failures, 0 errors, 0 skipped**.
- Debug lint passed; signed/minified beta assembly and vital lint passed.
- APK signature verified with the persistent GritMap Beta certificate; APK reports `versionCode=66`, `versionName=0.10.43-beta`.
- SHA-256: `bfd21b83b5bbabdb95128329499b9f9ac6be9abea258af47969ab5f70f0005a2`.
- `git diff --check` passed. Karoo and milestone documentation match commit `d38057f`.
- No instrumentation or physical ride validation ran.

## External state

- Candidate APK: `/Users/frason/Documents/CS Agent Team for ChatGPT/GritMap Beta Builds/gritmap-karoo-0.10.43-beta.apk`.
- Physical Karoo remains on verified `0.10.42-beta`/code 65. The candidate was deliberately not installed without checking device state.

## Goal alignment

- Serves the parallel `docs/GOALS.md` H10/cardiac-physiology track and beta reporting readiness.
- No shared transfer contract changed. Phone code does not need a compatibility update.

## Hazards and blockers

- The adaptive dashboard and H10 context strip are JVM-renderer tested but have not been inspected on the physical Karoo.
- Alpha-1 stability, dropout recovery, and comparison with the saved RR artifact still require the physical validation ride.
- Do not stage or overwrite Claude's current phone edits.

## Next safe action

Install `0.10.43-beta` on the connected Karoo as an in-place signed upgrade, confirm version/data retention and preview rendering, then use `docs/H10_RIDE_VALIDATION_CHECKLIST.md` for the physical H10 ride.
