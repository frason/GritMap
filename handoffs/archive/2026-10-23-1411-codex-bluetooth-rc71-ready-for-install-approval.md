# Handoff: signed Bluetooth beta71 ready for installation approval

- Updated: `2026-10-23 14:11 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `be98b8d feat(karoo): prepare Bluetooth beta release candidate 71`
- Worktree: `/Users/frason/.codex/worktrees/karoo-bluetooth-beta/GritMap`; source committed, only handoff updates pending this commit. Phone checkout unchanged.

## Outcome

Committed-source candidate **0.10.45-bluetooth-beta / code71** built successfully, with Bluetooth enabled and concurrent segments/replanning/ceilings disabled. APK signatures match public beta0.10.44 and installed code70. Ready to request approval for an in-place installation and physical testing. **Not installed, tagged or published.**

## Changed

- `be98b8d`: versionCode71/baseversion0.10.45, public BLE enabled by default; explicit default-off PLAN_CEILINGS_ENABLED (validated metadata discarded unless opted in); existing concurrent/replanner flags remain defaultoff. New regression and explicit opt-ins in ceiling import/storage tests.
- Release workflow produces0.10.45-bluetooth-beta from future tagkaroo-beta-0.10.45 and verifies generated beta feature flags before publication. No tag created/pushed.
- `docs/BETA_KAROO_INSTALL.md`, `docs/KAROO_BETA_RELEASE.md`, `docs/KAROO_BLUETOOTH_RC_TESTS.md`, `docs/KAROO_LIVE_REPLANNER.md`: Bluetooth/permissions/in-place upgrade, Wi-Fi fallback, candidate gates and experimental ceiling behavior. Source labels Inbox/Receive from Phone/Legacy Wi-Fi Receive/WAITING FOR PHONE/Cancel Receiving/Bluetooth closes automatically after2minutes preserved and checked statically against phone's handoff.

## Verified

- Full default QA from this worktree with JDK17, ANDROID_HOME=/Users/frason/Library/Android/sdk: `./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleBeta -PgritmapBetaSigningProperties=<existing persistent signing properties> -PgritmapVersionCode=71 -PgritmapVersionName=0.10.45-bluetooth-beta --no-daemon`: **BUILD SUCCESSFUL in18m38s**, 169tasks. **250 tests, zero failures/errors**, debug lint and beta vital lint pass. Log `/tmp/gritmap-bluetooth-beta71-qa.log`.
- Earlier transient host Git/ADB/gh/compiler stall cleared without restarting/killing processes; original build resumed to completion. Jason reported no visible prompt. Previous stalled-state archive is historical; no outstanding QA blocker now.
- apksigner verify passed on candidate, public0.10.44 and installed70. All share certificateSHA256 `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`.
- aapt confirms packagecom.gritmap.karoo, code71, name0.10.45-bluetooth-beta. Generated betaBuildConfig: DIRECT_BLE_V2_ENABLED=true; CONCURRENT_SEGMENTS_ENABLED=false; LIVE_REPLANNER_ENABLED=false; PLAN_CEILINGS_ENABLED=false.
- Workflow YAML and all run scripts syntax checked; exact tag/version extraction executed locally and returns base0.10.45/code71 forkaroo-beta-0.10.45. GitHub Actions publication workflow has **not** been run.
- BLE fix67bfc60 is an ancestor. Source/staged diff checks clean. No extra tests repeated after the passing build; subsequent changes are handoff records only.

## External state

- APK: `/tmp/gritmap-karoo-0.10.45-bluetooth-beta-71/gritmap-karoo.apk` (3894553bytes).
- APK SHA-256: `d6b6e87e13f7aa73644badeb1bed1a9ec4e5802d2eb2e104342a12304ae0977a`.
- Exact source: `be98b8d486893f51649c019877f8172924c18ea0`. Evidence/SHA256SUMS beside APK: `/tmp/gritmap-karoo-0.10.45-bluetooth-beta-71/verification.json`, `SHA256SUMS.txt`.
- Public APK downloaded read-only to `/tmp/gritmap-public-01044/gritmap-karoo.apk`; installed70 APK copied read-only to `/tmp/gritmap-installed-code70.apk` for certificate comparison. Device app/data unchanged.
- Connected USB serial00442GA241760203; dumpsys still code70 /0.10.44-fields1. No installation, uninstall, clear-data, tag or publication. Push only this worktree's codex branch after this handoff commit, never phone main.

## Goal alignment

GOALS priority1 Bluetooth beta loop. Phone build with Bluetooth must wait for a public compatible Karoo release. No phone production code changed; no experimental runtime/ceiling activation or Needle model included. Numeric future tagkaroo-beta-0.10.45; explicit Bluetooth APK name0.10.45-bluetooth-beta.

## Hazards and blockers

- **Physical gates pending on this candidate:** H10 RR coexistence during receive (ANT+ BPM/stale alpha1 alone is insufficient evidence); deliberate disconnect/reconnect with same-central ownership, last-complete-offset resume, verified hashes/import and receipt. Both must pass before wide Bluetooth invites. Prior normal transfers on69/70 do not establish these gates.
- Candidate is signed/minified release output, so preserve private app/recording data and do not rely on run-as or uninstall for inspection. Existing H10 export feature remains pending.
- Exact approval required before install/tag/publication by coordinator2026-10-23 item4. Current request authorizes preparation only. A future tag push triggers automatic publication; obtain explicit approval covering that action before pushing it, with reviewed source/hash/QA.
- After publication, test stable-link Companion Share Link install and retained data before wide invites. No published-release or fresh-install hardware claim yet.

## Next safe action

Present version71, APK SHA256 and250-test/lint/signed-build evidence to Jason; obtain explicit approval to install this exact candidate in place, then perform both physical gates with him. Keep tagging/publication pending separate approval and completed physical evidence.
