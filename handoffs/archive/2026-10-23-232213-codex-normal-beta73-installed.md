# Handoff: approved normal Bluetooth beta73 installed

- Updated: `2026-10-23 23:22 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `e68d3cb docs: record controlled BLE resume physical acceptance pass`
- Worktree: documentation-only installation follow-up

## Outcome

Jason approved the exact normal code73 APK. In-place replacement of the diagnostic variant succeeded; installed version and launch verified. Automatic link fault injection is disabled in this normal APK.

## Changed

- No source changes; source46eb5be. LATEST and this archive record installation.

## Verified

- SHA256 rechecked before install: c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e.
- adb install-r: Success, including same versionCode replacement. dumpsys:73/0.10.45-bluetooth-beta.
- firstInstallTime2026-10-09 13:18:34 retained, lastUpdateTime2026-10-23 23:21:27.
- MainActivity am start-W: Status ok, WaitTime3036ms.
- Artifact previously verified BLE_TEST_DISCONNECT_AFTER_BYTES=0, BLE true and concurrent/replanner/ceilings false, persistent signature match. Prior263 Kotlin tests/2 Python tests/lint/signed build pass. No new tests/build for documentation-only milestone.
- Controlled GATT-link recovery passed on diagnostic73 with same manifest/8192 offset/full hashes/import/receipt and Jason phone confirmation; see preceding physical-pass archive. Normal artifact transfer/skip check not yet performed.

## External state

- Karoo now normal0.10.45-bluetooth-beta/code73. Diagnostic APK replaced in place; no uninstall or clear-data.
- Normal artifact /tmp/gritmap-karoo-0.10.45-bluetooth-beta-73/gritmap-karoo.apk; verification.json updated.
- Phone internal build5 last reported. No tag/publication approved or performed.

## Goal alignment

- GOALS priority1 Bluetooth beta validation. No phone/shared contract changes.

## Hazards and blockers

- Normal artifact still needs normal send/installed-segment skip validation. Source is shared with diagnostic physical pass, but do not call normal binary physically validated before testing.
- Earlier full-radio restart failures remain unresolved; controlled GATT-only pass is narrower. In-ride coexistence waived, not passed.
- H10 export unfinished; preserve saved RR/private app data. Retained install timestamp is verified, raw private database/RR contents are not independently inspected.
- Separate exact tagging/publication approval remains required; stable Companion URL validation follows publication before wide invites.

## Next safe action

Have Jason open a fresh Receive from Phone and resend the just-imported segment/plan while read-only monitoring. Verify existing=true/segment skipped, plan/rider hashes, import/receipt and phone success on normal73. Validate a new missing segment normally as needed, then present exact release source/version/APK hash/QA for separate publication approval.
