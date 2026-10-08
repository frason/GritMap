# Handoff: Pacing Coach stack order corrected

- Updated: `2026-10-02 12:02 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: interleaved uncommitted Karoo and phone changes; do not bulk-commit or revert.

## Outcome

The Pacing Coach stack now follows travel direction: future target-only zones are above the
current zone and completed zones with frozen averages are below it. Future rows use a neutral
background rather than an effort-colored power fill. Boundary layout is group-anchored, so at
20/20 completed zones 19 and 18 remain visible beneath the current zone.

## Changed

- Updated `PacingCoachBitmapRenderer.kt` ordering, group positioning, and future-row styling.
- Added explicit stack-order tests for first, middle, and final zone boundaries.
- Bumped Android app to `0.10.33`, code `56`.

## Verified

- Focused renderer/demo tests and `:app:assembleDebug` passed (72 tasks).
- Exported preview visually confirms future rows above/current/past rows below.

## External state

- Installed successfully on Karoo `00442GA241760203`; app data preserved.

## Hazards and blockers

- Physical device screenshots remain the final sizing check.

## Next safe action

Run the 20-zone demo through its final zones and confirm the stack direction on-device.
