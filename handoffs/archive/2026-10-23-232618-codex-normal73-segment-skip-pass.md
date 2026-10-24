# Handoff: normal beta73 installed-segment skip passed

- Updated: `2026-10-23 23:26 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `ce666a8 docs: record approved normal beta73 installation`
- Worktree: documentation-only validation follow-up

## Outcome

Normal0.10.45-bluetooth-beta/code73 skipped the already installed segment, hash-verified plan/rider resources, imported and delivered an acknowledged success receipt. Jason reported the send completed in about10s; Karoo measured5420ms.

## Changed

- No source/APK/install changes. LATEST, this archive and physical acceptance notes updated.

## Verified

- Device GritMapLive log10-23:23:24:08.332 ble_connected mtu=517;23:24:11.128 ble_resource resource=plan bytes=5778;23:24:11.308 ble_resource resource=rider bytes=114;23:24:11.528 ble_imported existing=true durationMs=5420.
- existing=true directly confirms the installed-segment path; no segment resource fetch is required. Resource logs follow exact hash verification, import log follows receipt delivery.
- No automatic test-drop/resume event observed in this normal test. Artifact injection flag was verified0 before installation.
- Normal new/missing-segment transfer on73 has not yet been observed. Diagnostic73 separately passed actual8192-byte link drop/resume and298148-byte new segment import; normal71 previously imported a60833-byte missing segment. Do not conflate those variants.
- No new automated build/tests for documentation-only milestone; existing263 Kotlin+2 monitor tests/lint/signed build QA remains applicable to source46eb5be.

## External state

- Karoo remains normal73, SHA256c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e. Phone internal build5 last reported.
- No uninstall/data-clear/tag/publication. No private segment/ride/RR data committed.

## Goal alignment

- GOALS priority1 Bluetooth beta normal-device validation; no shared contract changes.

## Hazards and blockers

- Finish a normal missing-segment send to validate both normal paths on the exact installed candidate before release approval.
- Earlier full-radio restart failures remain unresolved; controlled GATT-only test passed on diagnostic73. In-ride coexistence owner-waived, not passed.
- Tag/publication still require separate exact approval, then stable Companion link validation before wide invites. H10 export remains unfinished.

## Next safe action

Start read-only monitor, have Jason send a different small missing segment on normal73 with no deliberate interruption, and verify resource hashes/new import/receipt. Then present exact source46eb5be/version73/hash/QA and physical evidence for separate release approval.
