# Handoff: isolated RR capture/storage foundation implemented

- Updated: `2026-10-05 14:29 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: heavily dirty from existing mixed work; this milestone added only new physiology
  source/tests and updated the AI/physiology plan and handoffs

## Outcome

The first H10-independent RR foundation is implemented without touching active Bluetooth,
service, Room, UI, phone, or existing cardiac-drift files. It preserves raw observations, flags
hard acquisition failures, keeps a bounded 120-second/512-sample live window, calculates quality
gates, and stores crash-recoverable versioned artifacts outside Room.

## Changed

- Added `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/RrModels.kt`.
- Added `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/RrLiveBuffer.kt`.
- Added `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/RrArtifactStore.kt`.
- Added three focused test files under the matching test package.
- Updated `docs/PLAN_KAROO_AI_PHYSIOLOGY.md` implementation status.
- Updated `handoffs/LATEST.md`.

## Verified

- Focused command passed all 6 tests:
  `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*'`
- `git diff --check` passes for the physiology and plan/handoff paths.
- Full `:app:testDebugUnitTest` compiled the new code but finished 137/138 because
  `KarooPreviewStateTest > preview traverses recover hold and push zones` fails at line 26.
- That preview test also fails when run alone; no preview code was touched in this milestone.

## External state

- No APK was built or installed.
- No Karoo settings, data or sensor pairing changed.

## Hazards and blockers

- RR is not yet being acquired; the module accepts observations supplied by a future BLE layer.
- Artifact storage is not yet wired to app-private directories or ride lifecycle cleanup.
- The initial interval bounds and quality thresholds are conservative version-one research values,
  not medical thresholds.
- Do not modify the unrelated preview test as part of H10 work without coordinating ownership.

## Next safe action

Claude should review the new physiology file boundary. Codex can then implement a direct standard
BLE Heart Rate Service parser/client behind an interface, still without wiring it into the active
ride service until permissions and connection ownership are agreed.
