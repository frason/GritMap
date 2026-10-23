# Handoff: Bluetooth candidate source prepared; host stall blocks QA

- Updated: `2026-10-23 13:58 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `be98b8d feat(karoo): prepare Bluetooth beta release candidate 71`
- Worktree: `/Users/frason/.codex/worktrees/karoo-bluetooth-beta/GritMap`; source committed, this handoff uncommitted. Phone checkout left unchanged. No push.

## Outcome

Prepared candidate source for `0.10.45-bluetooth-beta` / code71 in a separately attached managed worktree. **No completed APK, APK hash or QA pass is available yet.** The host stalled multiple unrelated Git/ADB/gh/clang processes while the build was running. Do not install/tag/publish this candidate based on previous milestone QA.

## Changed

`be98b8d`: Gradle defaults code71/base0.10.45, BLE enabled, concurrent/replanner/plan-ceilings flags false. Explicit PLAN_CEILINGS_ENABLED gate discards valid imported metadata unless opted in; original targets preserved. Import/storage tests opt in explicitly; new disabled-gate regression. Release workflow names APK0.10.45-bluetooth-beta, asserts generated beta flags, keeps tagkaroo-beta-0.10.45. Updated installation/release guides and new `docs/KAROO_BLUETOOTH_RC_TESTS.md`; exact Inbox labels preserved. No phone production edits.

## Verified

- Baseline source2c9ae90, separate branch/worktree created and source committed asbe98b8d. BLE fix67bfc60 is an ancestor.
- `git diff --check` and staged check clean at source commit. Workflow YAML parsed successfully using Ruby YAML.
- Full default QA started from committed worktree: JDK17/Android SDK, `:app:testDebugUnitTest :app:lintDebug :app:assembleBeta -PgritmapBetaSigningProperties=<existing persistent signing properties> -PgritmapVersionCode=71 -PgritmapVersionName=0.10.45-bluetooth-beta --no-daemon`.
- **Still incomplete**, log `/tmp/gritmap-bluetooth-beta71-qa.log`; stalled around configureCMakeRelWithDebInfo while Git/ADB/gh also stall. Gradle exec session53959. Compiler PID61436, parentCMake61430, Gradle daemon61372 at observation; several processes showUE and near-zeroCPU. IDs are ephemeral; inspect before signalling anything.
- Disk check shows33GiB available. No compiler error or test-failure conclusion established. Do not claim QA passed. A macOS prompt question is pending with Jason; no response assumed.
- Read-only adb devices listed Karoo00442GA241760203. pm path returned installedAPK path, but chained dumpsys/metadata command stalled before version confirmation. Last separately verified install remains code70/0.10.44-fields1.
- Public release metadata queried: karoo-beta-0.10.44, APK3864825bytes, GitHub digest6b07e5151581c4d1996ef579f12812a6c32ee0409369c8b1f5c899283e5e1af5. Download exists at `/tmp/gritmap-public-01044/gritmap-karoo.apk`. Certificate comparison not completed.

## External state

No installation, uninstall, data clearing, tag, publication or push. Existing device data untouched. Pending build/read-only processes may still be present; do not start overlapping release builds or kill unrelated phone-session/app processes.

## Goal alignment

GOALS priority1 and coordinator2026-10-23 Bluetooth release request. Replanner/Needle rollout deferred. Phone labels match source: Inbox; Receive from Phone; Legacy Wi-Fi Receive; WAITING FOR PHONE; Cancel Receiving; Bluetooth closes automatically after2minutes. Production phone sender not changed.

## Hazards and blockers

- Host process stall prevents finishing QA, signed APK verification/hash and branch push. Exact cause unknown; do not assume a code failure or successful completion.
- H10 coexistence during receive and deliberate disconnect/resume on this candidate remain unperformed; **both must pass before wide Bluetooth invites**. Public stable-link Companion install also remains required after publication.
- Latest handoff explicitly requires Jason's approval for exact install/tag/publication steps, presenting version/APKsha256/QA first. General “lets go” authorized preparation, not an unseen APK install or public release.

## Next safe action

Resolve/clear the host process stall with Jason, inspect existing build/process state and complete or cleanly rerun the committed candidate's full default QA. Verify signature against public beta, code/name, flags and APKsha256. Only then ask approval to install that exact candidate for the two physical gates. Keep all pushes on this worktree's branch.
