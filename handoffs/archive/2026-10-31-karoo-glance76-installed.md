# Handoff: signed Karoo screen preview76 installed and starts successfully

- Updated: `2026-10-31 19:32 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-screen-redesign`
- Head before handoff: `7fb53fd`; installed APK source `efaf5f67905d087689cc71cc48a99362c52e95f2`, runtime `e7a7c45`.
- Worktree: only LATEST and this new archive changed. No runtime edits, phone checkout changes or main merge.

## Outcome

Jason answered **approved** to the exact signed76 installation question, including the Room4 rollback consequence and installing this preview ahead of the pending Bluetooth diagnostic ride. Rechecked approved APK hash, connected/authorized device and installed73, then installed in place with `adb -s <connected Karoo> install -r /tmp/gritmap-glance-beta76-efaf5f6/gritmap-karoo.apk`: **Success**. No uninstall, data clear, downgrade or phone/receiver edits.

## Changed

Device now runs **76 / 0.10.46-screen-preview**, persistent beta signer, exact SHA256 `f172fc88c941d7739ff43e02318ee393274510248b538be65b64cd0630b69c92`. This is the signed/minified beta76 candidate, not the earlier debug76 APK. No source changes since candidate verification. Experimental ceilings, records, live replanner and concurrency remain OFF; direct BLE ON, injection0 as verified before install. Default/public source version and latest GitHub release unchanged.

## Verified

Fresh package dumpsys reports versionCode76, versionName0.10.46-screen-preview, firstInstallTime2026-10-09 13:18:34 retained, lastUpdateTime2026-10-31 19:31:22. `am start -n com.gritmap.karoo/.MainActivity` succeeds; process running (PID4926 at check). Recent AndroidRuntime error window (last160 filtered entries) empty. Native screenshot inspected locally: Segments screen shows **7 installed · 7 ready**, Every installed segment has a pacing plan. This verifies library availability after opening the new database; no direct private DB inspection or before/after row-by-row comparison. Actual ride data-field rendering and physical readability were not tested.

Earlier frozen runtime280 tests/debug lint/debug build and new signed assembleBeta/beta vital lint remain passing evidence; no tests rerun for a device-only installation. Signature matched installed73 before upgrade. Build emitted the previously documented upstream R8 warning, not a failure.

## External state

Fresh authorized Karoo, physical display480x800/density300. GritMap MainActivity left open after verification. Private on-device screenshot `/tmp/gritmap-glance-beta76-efaf5f6/installed-main-screen.png`, installed-version.txt, install-result.txt and updated verification.json remain local only. No screenshot, GPS, raw sensor data, personal names or ride data committed. No tag, release, public upload or Companion stable-link update. Public remains73; this device now76.

## Goal alignment

Approved Karoo readability preview with merged pacing aliases and Performance/Cardiac Drift/Power Balance. No shared contract or phone action required for display changes; all experimental pacing flags remain off. This installation does not validate live replanning or the phone sender.

## Hazards and blockers

App opened source using Room4 migration; direct rollback to public73/Room3 remains unsupported. Never clear/uninstall to downgrade. Prior diagnostic74 exact approval remains a separate older experiment; do not blindly attempt downgrade from76 to74. Its sender/readiness and supervised Bluetooth ride still unverified in this chat. Jason explicitly approved UI preview installation first; this does not claim that ride milestone passed or enable any experimental flags. Existing segment slots/type IDs retained; duplicate Coach/Profile placements both show merged pacing. No ride started and no page configuration changed here.

## Next safe action

Jason opens his riding profile and reviews the redesigned Pacing, Performance, Cardiac Drift and Power Balance fields at actual sizes. Record clipping/readability feedback before any broader rollout. Keep pending Bluetooth/replanner test separate; prepare a newer versioned candidate if needed rather than downgrading or substituting old74. No public release approval implied.
