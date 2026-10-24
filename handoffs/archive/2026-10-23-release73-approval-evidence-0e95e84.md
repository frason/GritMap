# Handoff: normal Bluetooth beta73 release evidence; tag/publication approval pending

- Updated: `2026-10-23 (client release-session date)`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-release-73`
- Head / exact proposed release source: `0e95e8443c5bdfd1f4ed0e8ddfd8224cf697f292 docs: select reviewed release notes by tag version`
- Worktree: documentation-only evidence follow-up; source committed, primary phone checkout untouched

## Outcome

Updated origin/main release decisions read and applied: ship the current plan requirement as a documented gap; plan-free Bluetooth and PR timing stay together for later. The exact normal73 APK is ready for separate tag/publication approval, and matches the installed/physically tested APK byte for byte. No tag/publication has occurred or been approved.

## Changed

- Fetched origin/main throughab2ecb7 (phone build8 commit022bc70 plus scope/GOALS decisions). Original published codex/karoo-bluetooth-beta remains3175784; no force-push.
- Created new release branch and rebased the18 beta commits onto origin/main. Only two LATEST prepend conflicts, resolved preserving coordinator decisions and all beta evidence. Archived files are byte-unchanged versus the original beta branch. Old commit IDs in archives remain historical references available on the preserved original branch.
- Exact Android source tree is identical between original tested beta branch and rebased release branch: ffec24254921384e959caa73708fff0897c70a88. Phone src/modules match origin/main; no phone code edits by this release work.
- a7c387f adds approved scope to docs/BETA_KAROO_INSTALL.md and docs/KAROO_BETA_RELEASE.md, plus reviewed docs/releases/KAROO_BLUETOOTH_BETA_0.10.45.md. Workflow now publishes reviewed notes via --notes-file.
-0e95e84 chooses notes by exact tag version, preventing future tags from silently reusing this version's notes. No runtime changes after tested source46eb5be.

## Verified

- Rebased source normal QA: JDK17/Android SDK, apps/karoo/gradlew-p apps/karoo :app:testDebugUnitTest :app:lintDebug :app:assembleBeta with existing private signing properties, code73/name0.10.45-bluetooth-beta. BUILD SUCCESSFUL in8s, Gradle reuses unchanged tests/build outputs from cache where valid.263 tests,0 failures/errors/skips; debug lint, beta lint, signed/minified build pass. Log /tmp/gritmap-release73-rebased-qa.log.
- After final workflow/docs-only commit0e95e84, :app:assembleBeta pass in6s. Log /tmp/gritmap-release73-final-assemble.log. No Android/test changes between these commits.
- python3-B scripts/test-monitor-karoo-ble.py freshly rerun:2 pass.
- Workflow YAML parsed, all7 run shell blocks passed bash-n after replacing GitHub expression placeholders; reviewed exact0.10.45 notes file exists. Actions itself has not run for this candidate.
- apksigner verifies normal APK; signer certificate SHA256 `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`, matching installed/public persistent identity.
- aapt:com.gritmap.karoo / versionCode73 / versionName0.10.45-bluetooth-beta.
- Generated beta flags: DIRECT_BLE_V2_ENABLED=true; BLE_TEST_DISCONNECT_AFTER_BYTES=0; CONCURRENT_SEGMENTS_ENABLED=false; LIVE_REPLANNER_ENABLED=false; PLAN_CEILINGS_ENABLED=false. No Needle model activated.
- Exact APK `3900465` bytes; SHA256 `c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e`. Byte-identical to approved normal APK installed/tested on Karoo; changed ZIP entries:none.
- Normal missing segment:23:33:41.182 existing=false,12754 segment/2075 plan/114 rider bytes hash-verified, import/acknowledged receipt in9962ms.
- Normal existing segment:23:24:11.528 existing=true, plan5778/rider114 bytes hash-verified, import/acknowledged receipt in5420ms.
- Separate diagnostic controlled-GATT test: real callback after8192 bytes, three bounded attempts at same offset, same complete manifest verified,298148-byte segment/5778 plan/114 rider hash-verified, new import/receipt in174327ms; Jason explicitly confirmed phone success. This test's diagnostic APK is not the proposed public APK.
- Proposed tag karoo-beta-0.10.45 absent from origin as checked before this record.

## Exact step to request approval for

Create/push annotated tag `karoo-beta-0.10.45` pointing specifically at0e95e8443c5bdfd1f4ed0e8ddfd8224cf697f292, invoking the existing signed build/test/release workflow for0.10.45-bluetooth-beta/code73. Publish only the normal injection0 APK and reviewed notes; never the diagnostic variant. Current approved-for-presentation candidate SHA256 is `c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e`. The CI-generated asset must be reverified/reported; no claim that a remote runner has already reproduced it.

## External state / phone coordination

- Local exact candidate /tmp/gritmap-release-0.10.45-bluetooth-beta-73-0e95e84/gritmap-karoo.apk; sibling SHA256SUMS.txt/verification.json. This new location preserves the reviewed artifact.
- Karoo still runs the byte-identical normal0.10.45-bluetooth-beta/code73; no new install during rebase/release preparation.
- Tell Jason/phone session: testers need **0.10.45-bluetooth-beta / versionCode73** for this release. Final copied labels remain **Inbox**, **Receive from Phone**, **Legacy Wi-Fi Receive**; receiver text remains **WAITING FOR PHONE**, **Cancel Receiving**, **Bluetooth closes automatically after 2 minutes**. Source labels checked against phone onboardingCopy.
- Phone hardware tests used reported internal build5; origin/main now includes build8 phone work, but build8 upload/availability is not asserted here.
- No user messages sent to another chat/app. No private GPS/ride/RR files committed; saved H10 artifacts retained.

## Goal alignment

- GOALS priority1 Bluetooth-first beta with Wi-Fi fallback. Updated priority7 keeps plan-free Bluetooth and PR timing together later. No PR/optional-plan implementation now.

## Hazards and blockers

- **Current plan requirement** documented in install guide and release notes; segment-only sending stays in Wi-Fi fallback. Do not claim PR fallback implemented.
- **Full-radio restart recovery** failed on71/72; controlled single-GATT resume passed on diagnostic73. Do not promise recovery from all Bluetooth resets.
- **H10 in-ride coexistence waived** by Jason, not passed; send before recording. H10 RR capture saves separately (624 samples observed), export/phone ingestion unfinished and raw RR absent from supplied native FIT.
- Concurrent/replanning/ceilings/test injection disabled for release. Diagnostic APK must not be published.
- Tag/publication not yet approved. Public stable-link Companion install and preserved-data/version verification remain unperformed and follow an approved release before wide invites.

## Next safe action

Present this exact source/version/hash/signature/flags/QA/physical evidence and known limitations to Jason for separate tag/publication approval. If approved, tag exact0e95e84 (not an arbitrary later handoff commit), follow Actions, verify final public asset/version/signature/hash and stable Companion URL, and update install/release/handoff docs after actual verification. If CI artifact differs from the reviewed local artifact, report the exact difference rather than claiming byte identity.
