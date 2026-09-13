# Handoff: Version 0.8.2 device verification

- Updated: `2026-08-24 16:33 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted work remains; this increment changes only Karoo version metadata and handoff records after the battery-flow implementation.

## Outcome

The user reported Power Balance appeared unchanged. The connected-device inspection initially failed because ADB had dropped the device. After reconnecting, the battery-flow build was bumped to 0.8.2/versionCode 13, rebuilt, installed, package-manager verified, and GritMap restarted. An ADB screenshot confirms the main page displays `Version 0.8.2`.

## Changed

- `apps/karoo/app/build.gradle.kts`: versionCode 12 → 13; versionName 0.8.1 → 0.8.2.

## Verified

- APK assembly: `BUILD SUCCESSFUL in 4m 14s`.
- ADB install: `Success`.
- Package manager: `versionCode=13`, `versionName=0.8.2`, `lastUpdateTime=2026-08-24 16:33:18`.
- GritMap was force-stopped/restarted; captured main screen visibly shows version 0.8.2.

## External state

- Device `00442GA241760203` has 0.8.2 installed and GritMap MainActivity open.

## Hazards and blockers

- Karoo may retain an existing graphical-field RemoteViews instance across an in-place extension update.
- Preserve unrelated/pre-existing uncommitted work.

## Next safe action

Exit/reopen the page editor and remove/re-add Power Balance once if necessary, then capture the large view.
