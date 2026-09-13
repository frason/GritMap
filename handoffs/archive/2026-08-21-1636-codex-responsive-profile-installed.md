# Handoff: Responsive Pacing Profile installed on Karoo

- Updated: `2026-08-21 16:36 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: uncommitted responsive-profile work plus pre-existing cardiac-drift and telemetry work

## Outcome

The verified responsive Pacing Profile/native Watts/HR APK is installed on the user's Karoo and ready for page-editor screenshot validation.

## Changed

- No source changed during installation; source details are in `handoffs/archive/2026-08-21-1625-codex-responsive-pacing-profile.md`.

## Verified

- ADB identified device `00442GA241760203` as authorized.
- `adb install -r apps/karoo/app/build/outputs/apk/debug/app-debug.apk` returned `Success`.
- `dumpsys package com.gritmap.karoo` reports `versionName=0.8.1`, `versionCode=12`.
- `am start -n com.gritmap.karoo/.MainActivity` returned successfully.

## External state

- Karoo now runs GritMap 0.8.1/version code 12 with prior app data preserved.

## Hazards and blockers

- Responsive layouts and the native Watts/HR formatter have not yet been visually verified on-device.

## Next safe action

Use Karoo's page editor preview to capture the Pacing Profile in each available shape and GM W/HR once; no ride or sensors are required.
