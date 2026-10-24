# Handoff: approved BLE recovery code72 installed

- Updated: `2026-10-23 17:30 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `4264ea5 docs: hand off verified BLE recovery candidate 72`
- Worktree: documentation-only installation record

## Outcome

Jason explicitly approved the exact code72 candidate. In-place ADB installation succeeded and MainActivity launched successfully.

## Changed

- No source change. Recovery source0312e10; LATEST and this new archive record installation.

## Verified

- SHA256 rechecked before install:2e15a9543047d65b05c46bec54473e1c5acce81a30815d28e407f7f5d5cbc8f2.
- adb install-r: Success. dumpsys verified versionCode72/versionName0.10.45-bluetooth-resume1.
- firstInstallTime2026-10-09 13:18:34 retained; lastUpdateTime2026-10-23 17:30:30.
- am start-W com.gritmap.karoo/.MainActivity: Status ok, WaitTime3039ms.
- Prior257 tests, debug/beta lint, signed/minified build pass; no source changes since QA.

## External state

- Physical Karoo now72. APK /tmp/gritmap-karoo-0.10.45-bluetooth-resume1-72/gritmap-karoo.apk.
- No uninstall/clear-data. Retained install timestamp confirms in-place update; private database/RR artifacts not independently inspected.
- Phone internal build5 last reported. No tag/publication approved or performed.

## Goal alignment

- GOALS priority1 Bluetooth beta validation. No shared contract or phone changes.

## Hazards and blockers

- Code71 physical recovery failed; code72 physical test remains pending. In-ride coexistence waived, not passed.
- Two-minute receive timeout currently also encloses transfer; assess/fix before public release.
- Saved624-sample H10 capture is separate from FIT; export still unfinished. Preserve app data.

## Next safe action

With Jason, open a fresh Receive from Phone window and prepare the previously failed missing segment. Arm the ADB interruption monitor before Send, then verify same-session offset resume, hashes, import and receipt. No publication until physical gate passes and exact release approval arrives.
