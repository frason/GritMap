# Handoff: Simplified Power Balance installed; phone MVP complete; matcher risk remains

- Updated: `2026-08-25 09:13 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a74752d docs: hand off advanced review + comparison screens (#11, #13)`
- Worktree: substantial uncommitted work remains under `apps/karoo/`; preserve it. Claude's phone work is committed and did not touch these files.

## Outcome

The large Karoo Power Balance field now removes its redundant engine percentage and uses a simplified visual hierarchy. Its only external outcome header is projected `FINISH N%`; the bitmap owns action, current-versus-plan reserve, flow, battery, and relative status. This revision is tested and installed on the connected Karoo. Separately, Claude's matcher triggers, advanced review, and attempt-comparison screens remain complete on local `main`.

## Changed

- Large Power Balance external title is hidden and its value is centered as `FINISH N%`.
- Added a large comparison row: `YOU N%   PLAN N%   ±N%`.
- Battery interior is reduced to `W′ N%`; its actual and planned level markers retain separate `YOU`/`PLAN` leader labels.
- Detailed status is now relative to reserve plan (`ON RESERVE PLAN`, `N% ABOVE RESERVE PLAN`, or `N% BELOW RESERVE PLAN`) rather than a potentially contradictory raw recovery state.
- Large footer is compressed to one line: `ACT ±N • PLAN ±N J/s`, preserving rate direction.
- Active flow paths remain blue over dim inactive paths; battery and chevrons remain fixed-color.
- Phone commits already present: `f945754` matcher triggers, `041c5cf` diagnostic review, `7e9c2eb` comparison UI, and `a74752d` handoff.

## Verified

- Focused `WPrimeBalanceBitmapRendererTest` and `CombinedDataTypesTest` plus debug APK assembly: `BUILD SUCCESSFUL in 44s`.
- Claude phone work: 170 tests pass, typecheck clean, and web smoke test succeeds.

## External state

- Installed debug APK on Karoo `00442GA241760203`; adb reported `Success`.
- Package manager confirms `versionName=0.8.2`, `versionCode=13`, and `lastUpdateTime=2026-08-25 09:13:06`.
- `origin/main` was 16 commits behind local `main` at the prior combined handoff; no push was performed here.
- Phone UI now depends on `react-native-svg` and still needs a new native rebuild/visual pass.

## Hazards and blockers

- **Matcher risk for Claude:** real Morning Climb orchestration found two candidates against the real 8.5k-point source ride, but both were rejected as `backward-progress` / `reverse-traversal`. Before changing the 30 m backward tolerance, inspect candidate slices, projected-progress traces, reference direction/fingerprint, and whether the geometry contains a real loop/hairpin. Natural real-data acceptance has not yet been demonstrated.
- The simplified Power Balance layout is installed but not yet visually reviewed; line wrapping and marker collisions must be judged on-device.
- The phone review/comparison touch flows and chart gap rendering remain visually unverified.
- CP=95% FTP, W′=20 kJ, and tau=546 s remain estimates pending phone-supplied calibration.
- Preserve unrelated and pre-existing uncommitted work.

## Next safe action

Capture the newly installed large Power Balance field through at least two preview states and decide whether to keep or revert this isolated readability pass. Claude should separately diagnose the Morning Climb projection trace before any matcher threshold tuning.
