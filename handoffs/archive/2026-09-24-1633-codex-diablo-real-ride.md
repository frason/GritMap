# Handoff: First real Diablo pacing ride verified; three follow-up defects identified

- Updated: `2026-09-24 16:33 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `8881fbf docs: hand off Diablo pacing-plan completion + archive Codex's handoff backlog`
- Worktree: no application code changed during this verification; existing unrelated working-tree state was preserved.

## Outcome

The September 13 real ride successfully activated and completed the installed “Diablo Northgate to Junction” segment. The Karoo persisted 99.72% coverage, 25.86 m maximum deviation, and a completed elapsed attempt of 45:48.947. This is the first real-ride completion of the exact Diablo segment paired with the new baseline pacing-plan build.

## Changed

- No application code changed.
- Replaced `handoffs/LATEST.md` with this factual verification and added this archive.
- Read-only analysis used:
  - FIT: `/Users/frason/Downloads/Karoo-Morning_Ride-2026-09-13-0647.fit`
  - Karoo private Room database copied through `adb exec-out run-as`
  - Karoo bounded diagnostics copied through `adb exec-out run-as`
  - Committed fixture: `apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.guidance-package.json`

## Verified

- Connected Karoo runs GritMap 0.8.2/versionCode 13, updated 2026-09-12 20:34.
- Completed attempt ID: `a9e7135b-22f6-41d9-928a-10c4d211aa42`.
- Attempt: 45:48.947 versus 40:30 target, 5:18.947 behind.
- Karoo aggregate metrics: 258.3 W, 151.4 bpm, 79.9 rpm, 3.80 m/s.
- Independent FIT interval: 45:48, 261.9 W, 151.6 bpm, 80.4 rpm; mapped maximum deviation 6.86 m and final reference progress 10,440/10,442.52 m.
- First half: 21:23, 261.8 W, 147.7 bpm.
- Second half: 24:24, 262.1 W, 155.0 bpm.
- The intended second-half power lift did not occur; power stayed flat while HR rose about 7.3 bpm.
- The last zone was executed closely: 290.1 W against 295 W.
- The installed baseline remains correct in Room: 26 contiguous zones, 2,430-second target, FTP 280, segment fingerprint correct.

## External state

- Karoo was connected and authorized during analysis.
- Device database still contains Diablo, its complete plan, rider profile, completed attempt, and checkpoint.
- Bounded diagnostics no longer retain the September 13 lifecycle because later GPS logging rotated it out; Room and FIT provided the durable evidence.

## Hazards and blockers

1. **Attempt loses plan identity.** The completed attempt and checkpoint both have `pacingPlanId=NULL`, even though the baseline plan exists. `RoomAttemptEventSink.kt` hardcodes `pacingPlanId = null` in both writes. Historical plan-versus-actual review therefore cannot prove which plan was active.
2. **Reverse descent false-start.** About 19:54 after completion, descending through the segment start produced a second attempt (`07f093fa-c8ea-4363-a78c-1dc9bf8fbada`) that ran 18 seconds and abandoned as `no-valid-candidate`. FIT confirms 0 W, 107→101 bpm, and 7.1→10.0 m/s while traveling in the reverse direction. Direction must be confirmed before attempt creation/entry alert, not only rejected afterward.
3. **No durable zone-execution samples.** Only attempt aggregates/checkpoints remain. The 26-zone comparison had to be reconstructed from the external FIT. This is consistent with the “do not duplicate full telemetry” rule, but a small per-zone summary would support post-ride plan review without copying the raw ride stream.
4. The 40:30 goal was missed by 5:19. Power was about 15 W below the 276.9 W distance-weighted plan average, and there was no planned second-half lift. Do not automatically raise targets; review conditions, training intent, and HR response first.

## Next safe action

Implement two isolated matcher/persistence fixes before changing the pacing targets: pass the selected baseline plan ID into attempt/checkpoint persistence, and delay entry alert/attempt creation until two or more location samples establish forward projected progress. Add tests for both. Separately decide whether to persist compact per-zone execution summaries.

