# Handoff: work-based Coach, larger Profile, qualified cardiac display

- Updated: `2026-10-20 23:31 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `ec38f81 docs: correct the profile-history handoff timestamp and filename`
- Worktree: these field changes plus prior concurrent-runtime/design work remain uncommitted. No commits this milestone.

## Outcome

User-approved work-based Coach fill and horizontal planned-work line implemented; active row/content doubled in height. Profile middle PACE card removed, TARGET/ACTUAL enlarged along with other numerical annotations. Cardiac drift now qualifies steady/comparable windows and ages/resets missing data. H10 connection/collection status is visible sooner without weakening RR qualification. Not installed or hardware-validated.

## Changed

- New `pacing/SectionWorkTracker.kt` and test under `apps/karoo/app/src/`; integrates joules and crossing intervals, rejects duplicated/stale/missing actual power.
- `service/ActiveAttemptSession.kt`, `service/LiveSegmentService.kt`, `ui/state/LiveUiState.kt`: per-session work samples and H10 connection state; both existing and development concurrent paths use enrichment.
- `ui/PacingCoachBitmapRenderer.kt`: full-block actual-work fill, horizontal target-work line, doubled active geometry/content, smaller surrounding rows, estimated/missing-goal/data-gap/overflow captions.
- `ui/ProfileBitmapRenderer.kt`: two larger power cards, larger compact/route/axis values, no middle PACE card.
- `pacing/CardiacDriftTracker.kt`: steady baseline, comparable-power gate, elapsed-time EMA, stale-window expiry, interruption reset and paired valid-time accounting; regression tests.
- `ui/CardiacDriftBitmapRenderer.kt`: visible H10 status earlier, qualified alpha independent of the old long-effort display gate; status tests.
- Renderer tests export synthetic previews. Details/semantics: `docs/KAROO_FIELD_WORK_FILL.md`.

## Verified

- JDK 17 in `apps/karoo`: `./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --no-daemon`: BUILD SUCCESSFUL; **224 tests, zero failures/errors**, lint and debug/native build pass. Log `/tmp/gritmap-field-final.log`.
- Subsequent profile-only annotation/axis enlargement: `./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.ui.ProfileBitmapRendererTest' :app:assembleDebug --no-daemon`: BUILD SUCCESSFUL. Log `/tmp/gritmap-profile-final.log`.
- Initial run exposed an old coasting expectation retaining a stale drift value. Updated the test to require withholding the value when the paired window is insufficient; the full run above passed.
- Inspected `/tmp/gritmap-coach-ahead.png`, `/tmp/gritmap-coach-behind.png`, `/tmp/gritmap-profile-two-cards.png`; readable active values, visible work comparison, no card/axis clipping in the 480x624 previews.
- `git diff --check` clean. No actual ride replay/RR artifact validation, physical display check, signed beta build or installation run.

## External state

- `adb devices -l` returned no devices. Last verified installed version remains `0.10.44-ble2`/69.
- Final output is a local debug APK, not a beta-signed update. No tag, release, push, uninstall or data clear.
- No new personal ride/GPS/RR files added to Git.

## Goal alignment

- User explicitly requested these field legibility/behavior changes, overriding the general deferral of extra visual polish in GOALS. H10 changes serve the optional experimental cardiac track, not automatic pacing changes.
- Existing adaptive sections retained. No phone/transfer/BLE/plan contract change; exact per-section timing anchors would need a separate shared contract change.

## Hazards and blockers

- White-line rate is target-power work over observed elapsed time. Full-scale section budget is distance-proportional planned time and explicitly estimated, not terrain-specific timing. Work above/below line is not route-time ahead/behind.
- Missing actual power leaves that section's work unknown; no fabricated fill. Long gaps and changed zones may reset/invalidate the display.
- Cardiac qualification thresholds and smoothing are unvalidated engineering choices; real-ride signal behavior and H10 availability still need hardware verification. ANT+ HR alone is insufficient.
- Prior concurrent/PR work remains incomplete/uncommitted; concurrent feature stays default off. H10 export remains requested, unimplemented. Next public version code must be >=70 until a newer device test install changes that requirement.

## Next safe action

Review the synthetic field previews with Jason, then reconnect the Karoo and build a beta-signed development APK with code >=70 for in-place installation and real H10/work-fill checks, preserving all app data. Do not claim this field update is on the device yet.
