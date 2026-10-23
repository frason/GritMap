# Handoff: approved Bluetooth beta71 installed in place

- Updated: `2026-10-23 14:15 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `d2d8bb9 docs: record verified Bluetooth beta71 candidate and approval gates`
- Worktree: `/Users/frason/.codex/worktrees/karoo-bluetooth-beta/GritMap`; source unchanged, this installation handoff pending commit. Phone checkout unchanged.

## Outcome

Jason explicitly approved installation of the exact candidate presented in chat. In-place install succeeded on connected Karoo. Device now reports **0.10.45-bluetooth-beta / code71**, and MainActivity launches successfully. No tag/publication approval granted or acted on. Physical H10/reconnect gates remain pending rider/phone readiness.

## Changed

- Device install only from code source `be98b8d486893f51649c019877f8172924c18ea0`; no source edits or version change after approved build.
- Current handoff and local `/tmp/gritmap-karoo-0.10.45-bluetooth-beta-71/verification.json` installation status updated. No APK modification.

## Verified

- Rechecked SHA256 immediately before installation: `d6b6e87e13f7aa73644badeb1bed1a9ec4e5802d2eb2e104342a12304ae0977a`.
- `adb devices -l` confirms serial00442GA241760203.
- `adb -s 00442GA241760203 install -r /tmp/gritmap-karoo-0.10.45-bluetooth-beta-71/gritmap-karoo.apk`: **Success**.
- Postinstall dumpsys: versionCode71, versionName0.10.45-bluetooth-beta; firstInstallTime2026-10-09 13:18:34 retained; lastUpdateTime2026-10-23 14:13:05.
- `adb shell am start -W -n com.gritmap.karoo/.MainActivity`: Statusok, activitycom.gritmap.karoo/.MainActivity, completed3056ms. UI XML retrieval unavailable; do not claim physical Inbox labels/segment contents inspected. Labels were verified statically in prior candidate QA.
- Prior unchanged-source full default250tests, debug/beta lint, signed/minified build, flags and signature match passed; not repeated for installation. See2026-10-23-1411 candidate archive.

## External state

- Karoo now runs71. No uninstall/clear-data; in-place update retains app data/installation identity. Private Room/RR file contents not inspected. APK remains at `/tmp/gritmap-karoo-0.10.45-bluetooth-beta-71/gritmap-karoo.apk`.
- Bluetooth enabled; concurrent/replanner/ceilings flags remain off. No model activation.
- Candidate source/evidence branch was pushed to origin/codex/karoo-bluetooth-beta. Installation handoff push follows this commit, only from this worktree.

## Goal alignment

GOALS priority1 public Bluetooth beta preparation. This installation follows Jason's exact approval; it does not constitute approval to tag/publish. Phone production checkout untouched.

## Hazards and blockers

- H10 RR coexistence during a receive and deliberate mid-transfer disconnect/resume are **not run**. Both must pass before wide Bluetooth invites. No substitute from normal transfer history or ANT+ BPM.
- Async readiness question is pending: whether H10 is powered/worn and phone Bluetooth Send-to-Karoo is available. Do not assume either is ready without the rider's response. No transfer/disconnect initiated this milestone.
- H10 recordings export and private RR artifact confirmation remain separate pending work. Preserve app data.
- Tagging/publication require separate explicit approval and physical test evidence; subsequent public stable-link Companion installation also remains pending.

## Next safe action

Once Jason confirms H10/phone readiness, run GateA in `docs/KAROO_BLUETOOTH_RC_TESTS.md`, observe actual RR continuity during receive, then perform controlled GateB disconnect/resume with recorded offsets/receipt. Record actual outcomes and keep publication pending.
