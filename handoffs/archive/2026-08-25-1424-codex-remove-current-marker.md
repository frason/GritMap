# Handoff: Redundant current-reserve marker removed and installed

- Updated: `2026-08-25 14:24 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a74752d docs: hand off advanced review + comparison screens (#11, #13)`
- Worktree: substantial uncommitted work remains under `apps/karoo/`; preserve it.

## Outcome

The blue current-reserve leader/marker beneath the horizontal battery was removed because the blue fill edge and `W′ N%` already communicate the rider's current level. The amber PLAN marker remains as the only battery comparison line. This revision is tested and installed.

## Changed

- Removed the blue current-reserve leader line and `YOU` pointer label from `WPrimeBalanceBitmapRenderer`.
- Retained `YOU N%` in the comparison row and `W′ N%` inside the battery.
- Retained amber PLAN marker/label, identity-colored nodes, active route lighting, and stable chevrons.

## Verified

- Focused W′ renderer test plus debug APK assembly: `BUILD SUCCESSFUL in 20s`.

## External state

- Installed on Karoo `00442GA241760203`; adb reported `Success`.
- Package manager confirms `versionName=0.8.2`, `versionCode=13`, and `lastUpdateTime=2026-08-25 14:24:38`.

## Hazards and blockers

- Physical light/dark review remains pending.
- Matcher real-route rejection risk remains documented in the prior combined handoff.
- Preserve unrelated and pre-existing uncommitted work.

## Next safe action

Review the battery at device scale and confirm the amber PLAN marker alone provides enough comparison context.
