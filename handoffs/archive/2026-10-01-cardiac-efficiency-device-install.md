# Handoff: cardiac efficiency device install

- Updated: `2026-10-01 14:07 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `cbd23a1 feat: phone-side pacing-plan generator + rider-profile transfer`
- Worktree: unchanged from the preceding cardiac-efficiency milestone; shared Karoo visual work remains uncommitted.

## Outcome

The already-tested GritMap Karoo `0.10.18`/code 41 APK containing the new large cardiac-efficiency dashboard is installed on the physical Karoo 3.

## Changed

- No source files changed in this follow-up. Device state and handoff documentation only.

## Verified

- `adb install -r apps/karoo/app/build/outputs/apk/debug/app-debug.apk`: `Success`.
- `adb shell dumpsys package com.gritmap.karoo`: reports `versionCode=41` and `versionName=0.10.18`.

## External state

- Device `00442GA241760203` has GritMap Karoo `0.10.18`/41 installed.

## Hazards and blockers

- Actual light/dark Karoo screenshots have not yet been reviewed.

## Next safe action

Open GM Cardiac Drift in a large data-field slot, run its preview loop, and capture light- and dark-theme screenshots for typography and contrast review.
