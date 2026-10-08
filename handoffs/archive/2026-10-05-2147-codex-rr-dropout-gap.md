# Handoff: RR dropout clock recovery built offline

- Updated: `2026-10-05 21:47 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a47e928 feat: coach-plan import, versioned rider profile, saved Karoo address`
- Worktree: mixed uncommitted work; this milestone is uncommitted

## Outcome

The offline GritMap Karoo `0.10.41` candidate fixes the RR beat-clock drift described as G1 in
Claude's H10 follow-up. When notification arrival exceeds the RR-predicted endpoint by more than
`max(2000 ms, 1.5 * last RR)`, the mapper immediately re-anchors that packet to monotonic arrival
time rather than recovering at only 5 ms per packet. The first returning interval is preserved but
marked invalid with `GAP_AFTER_DROPOUT`; live enhanced metrics reset, and RMSSD never joins valid
beats across any invalid observation. A cumulative gap count emits `h10_rr_gap` diagnostics.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/RrPacketTimestampMapper.kt`
- `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/RrModels.kt`
- `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/H10CaptureController.kt`
- `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/RrWindowMetrics.kt`
- `apps/karoo/app/src/main/java/com/gritmap/karoo/service/LiveSegmentService.kt`
- Corresponding timestamp, controller and metrics tests.
- `apps/karoo/app/build.gradle.kts`: source candidate 0.10.41 / code 64.

The fixed-record schema layout remains version 1 and record size remains 14 bytes. Reason code 4 is
an additive value; existing observations and artifacts remain readable.

## Verified

- `./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*' --tests 'com.gritmap.karoo.service.*' :app:lintDebug :app:assembleDebug`
- Result: 49 tests, zero failures/errors; lint and assembly passed.
- `git diff --check` passed.
- Offline 0.10.41 APK SHA-256:
  `892a80258c625a4bf3a11de34425264652fc19e82b3136a9e5a6e323da3adf80`

## External state

- The new APK was deliberately not installed.
- Read-only device confirmation: Karoo `00442GA241760203` still reports 0.10.40 / code 63 for the
  clean moving approach test tomorrow.

## Hazards and blockers

- The 2-second / 1.5x threshold is conservative but requires validation against real H10 packet
  batching and an induced dropout before release.
- Gap records are encoded in the existing schema layout; raw 1/1024-second preservation and full
  schema-v2 metadata remain future work.
- Disk append/fsync remains on the Bluetooth callback path (review finding G4).

## Next safe action

Run tomorrow's staged 0.10.40 moving approach test first. After evidence is collected, install
0.10.41 for a controlled desk dropout test, confirming `h10_rr_gap`, immediate timestamp re-anchor,
and recovery of enhanced metrics only after a new clean window.
