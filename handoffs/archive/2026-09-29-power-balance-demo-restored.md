# Handoff: Power Balance battery demo restored

- Updated: `2026-09-29 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `85026b2 docs: hand off post-MVP backlog cleared (#60-#63)`
- Worktree: shared dirty worktree; this increment changed the demo-state generator, its test, app version, and handoffs while preserving unrelated edits

## Outcome

GritMap Karoo 0.10.8/code31 is installed. Starting the physical-device data-field demo no
longer replaces GM Power Balance's battery visualization with the old fallback bar.

## Changed

- `LiveDemoController.demoPlanState()` now includes changing estimated W-prime state:
  actual and planned reserve, projected finish, history, live/plan flow rates, and animation.
- `LiveDemoControllerTest` now requires this W-prime state to remain complete.
- Bumped version to 0.10.8/code31.

## Verified

- Full `:app:testDebugUnitTest :app:assembleDebug`: passed.

## External state

- Replacement-installed APK on Karoo `00442GA241760203`; package reports 0.10.8/code31.

## Hazards and blockers

- The old Actual-vs-Target renderer intentionally remains a fallback outside a segment
  when no W-prime state exists. During preview/demo and an active powered segment, the
  battery renderer is authoritative.
- Work remains uncommitted in the shared dirty worktree.

## Next safe action

Start the data-field demo from the GritMap app and reopen GM Power Balance in the Karoo page
editor; confirm the large battery/Plan/Ride visualization animates.
