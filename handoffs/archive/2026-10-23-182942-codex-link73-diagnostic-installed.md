# Handoff: approved code73 link-only diagnostic installed

- Updated: `2026-10-23 18:29 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `3da4213 docs: hand off verified link-only BLE test setup`
- Worktree: documentation-only installation record

## Outcome

Jason approved the exact diagnostic APK. In-place installation succeeded; version and launch verified. Controlled link recovery is still untested on hardware.

## Changed

- No source changes. Source46eb5be; LATEST and this archive record the approved installation.

## Verified

- SHA256 rechecked before install: c62ad47e80144c51fba5f08e4c35e7fbe214e12f61fd3bb56db44078f6a54e17.
- adb install-r: Success; dumpsys versionCode73/versionName0.10.45-bluetooth-linktest1.
- firstInstallTime2026-10-09 13:18:34 retained; lastUpdateTime2026-10-23 18:29:14.
- am start-W com.gritmap.karoo/.MainActivity: Status ok, WaitTime3052ms.
- Prior normal-config263 Kotlin tests,2 monitor tests, debug/beta lint and signed build pass. Separate diagnostic signed build/beta lint/signature/version/flag checks pass; no source changes since QA.

## External state

- Installed diagnostic73 injects one actual GATT-link disconnect at8192 segment bytes per receive session, requires real callback, forces BLE segment transfer for test coverage. Does not restart radio or clear app data.
- APK /tmp/gritmap-karoo-0.10.45-bluetooth-linktest1-73/gritmap-karoo.apk; local verification.json updated.
- Phone internal build5 last reported. No tag/publication approval or action. Private saved RR/database contents not independently inspected.

## Goal alignment

- GOALS priority1 Bluetooth physical validation. No phone or shared-contract changes; ownership checks retained.

## Hazards and blockers

- Diagnostic APK must not be published as public beta; default/public variant disables injection and needs separate validation.
- Prior code72 full-radio recovery failed; code73 controlled-link physical test pending.
- Must use a missing segment >8192 bytes; existing segment skip will not inject. Keep phone foregrounded and do not cancel/restart mid-test.
- Preserve saved H10 data; export unfinished. In-ride coexistence owner-waived, not passed.

## Next safe action

When Jason is ready, start scripts/monitor-karoo-ble.py read-only, open fresh Inbox > Receive from Phone, and Send the previously failed missing segment. No manual radio interruption. Verify actual callback, resume offset8192, full manifest match, hashes, atomic import and phone success receipt. Then separately validate injection0 public candidate and seek exact release approval.
