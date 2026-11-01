# Handoff: signed screen preview76 ready; not installed

- Updated: `2026-10-31 19:24 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-screen-redesign`
- Head before documentation: `efaf5f67905d087689cc71cc48a99362c52e95f2`
- Worktree: only this new archive and LATEST changed; no runtime source edits.

## Outcome

Jason connected the Karoo while discussing installation of the new screen design. ADB now detects an authorized Karoo. Prepared a persistent-beta-signed, minified screen preview76 for an in-place update. Not installed: exact-candidate approval and the previously recorded diagnostic-ride sequencing decision remain pending. The old debug76 artifact remains unsuitable for in-place installation; use only the newly verified signed candidate after approval.

## Changed

No runtime changes. Source remains efaf5f6 (runtime e7a7c45); signed package uses CLI version overrides, not changed public defaults. This archive and LATEST record candidate and live read-only device evidence.

## Verified

`JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/frason/Library/Android/sdk apps/karoo/gradlew -p apps/karoo :app:assembleBeta -PgritmapBetaSigningProperties=<existing private persistent properties> -PgritmapVersionCode=76 -PgritmapVersionName=0.10.46-screen-preview --max-workers=2 --no-daemon`: BUILD SUCCESSFUL, including beta vital lint and R8. An upstream kotlinx-serialization R8 field-rule warning was nonfatal. Previous frozen runtime verification remains 280 tests, zero failures, debug lint/build passed; no runtime changes since then and tests were not redundantly rerun for this packaging-only step.

`apksigner verify --print-certs` matches installed APK and persistent certificate `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`. `aapt dump badging` verified code76/name0.10.46-screen-preview. Generated beta BuildConfig checked: direct BLE true; plan ceilings, segment records, live replanner, concurrency false; disconnect injection0. SHA256 `f172fc88c941d7739ff43e02318ee393274510248b538be65b64cd0630b69c92`. Evidence/APK/log/config at `/tmp/gritmap-glance-beta76-efaf5f6/`.

## External state

Fresh ADB: connected/authorized. Installed package: code73/name0.10.45-bluetooth-beta. Pulled installed APK only, no private app database or ride/sensor data accessed. Installed APK SHA256 c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e; signer is persistent beta identity. This installed file hash differs from the previously published download hash, so do not claim identical APK bytes. Physical display read by wm: 480x800, density300; actual extension field viewSize and legibility remain unmeasured.

Candidate `/tmp/gritmap-glance-beta76-efaf5f6/gritmap-karoo.apk` not installed, launched, tagged, publicly released, or sent through Companion. No app clear/uninstall. No transfer/ride test performed. No phone checkout or receiver branch changed.

## Goal alignment

Owner-requested Karoo readability preview, with phone/Karoo responsibility split and shared contracts unchanged. All experimental pacing flags remain off; this is not the earlier flag-on diagnostic74 ride test.

## Hazards and blockers

Current source uses Room4, while public73 uses Room3. The additive 3→4 migration is registered and retains existing rows; once opened, returning directly to73 is unsupported. Never clear data/uninstall to downgrade. This consequence must be included in exact install approval. Existing receiver/diagnostic74 sender readiness and supervised Bluetooth ride have not been newly confirmed; earlier LATEST orders that ride before redesign installation. Ask Jason explicitly whether to install the screen preview first, rather than silently treating the milestone as done. New signed76 does not inherit approval of diagnostic74. No logging/instrumentation build or public flags enabled.

## Next safe action

Present exact signed candidate76/source/hash/QA plus Room4 rollback consequence and ask Jason to approve in-place screen-preview installation ahead of the recorded diagnostic ride. If approved, recheck hash, device and installed version, install -r only, verify version/startup/retained segments, then append a new handoff. Do not ask again once that exact action is approved.
