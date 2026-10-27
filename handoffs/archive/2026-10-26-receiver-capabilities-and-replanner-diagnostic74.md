# Handoff: receiver contract implemented; diagnostic74 awaits exact approval and phone integration

- Updated: `2026-10-26 17:26 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-receiver-capabilities`
- Head before this documentation: `eac155f fix(transfer): preserve GATT attribute and advertised record limits`
- Worktree: `/Users/frason/.codex/worktrees/karoo-bluetooth-beta/GritMap`; implementation committed. Only this handoff/archive and the PR design status cross-reference will be uncommitted until the documentation commit. Phone primary checkout untouched. No force-push or main update.

## Outcome

Receiver capability advertisement, bounded record parsing/storage, synthetic fixtures and replay validation are implemented in source. Wi-Fi source negotiates before sending ceilings. BLE Karoo writes capabilities to an optional phone-hosted characteristic; **phone native counterpart is not implemented yet**. Current phone BLE still sends baseline only. Signed diagnostic74 and signed flag-off fallback75 are prepared; neither installed or published. Public73 remains unchanged. One supervised ride remains unperformed.

## Changed

- `1328870`: merge origin/main9369ff4 and completed release73 work on own branch, preserving both handoff histories.
- `6d6af67`: receiver capabilities, gated Wi-Fi realistic plan fields, Room4 record tables/migration, strict record parser, optional BLE record resource, synthetic fixtures/tests. Defaults ceilings/records/live-replanner/concurrency off; BLE on; injection0. Default next source version74/0.10.46.
- `eac155f`: preserve512-byte BLE manifest attribute limit for all peers, cap optional record at advertised bytes, reject duplicate/inconsistent capability declarations. Do not raise manifest cap to1024.
- Exact contract: `docs/RECEIVER_CAPABILITIES_CONTRACT.md`; pacing ranges: `docs/PLAN_CEILINGS_CONTRACT.md`.
- Shared public-safe invented fixtures: `fixtures/contracts/receiver-capabilities-v1.json`, `segment-record-v1.json`, `plan-ceilings-transfer-v1.json`, `replanner-shapes-v1.json`. No real GPS, ride or RR data added. Existing ceiling fixture mirrored without changing its targets.
- New tests: `ReceiverExtensionsTest`, `ShapeReplayTest`; migration3→4 and transaction/fastest-only tests in `ReplanStorageTest`; HTTP probe/session and BLE record tests. Phone capability/generation/preflight tests.

## Verified

- Karoo full unit suite:271 tests. Android lint passed. Final verification commands/logs are local `/tmp/gritmap-replanner-fallback-final.log`, `/tmp/gritmap-replanner-quiet-tests.log`, `/tmp/gritmap-replanner-diagnostic-checks.log`, `/tmp/gritmap-replanner-diagnostic-build.log`.
- One full-suite run while R8/lint were competing failed only existing `NeedleAgentManagerTest.timeoutReturnsFallbackWithoutConcurrentInference` at its wall-clock<70ms assertion. No Needle source/test edited. Quiet full-suite rerun passed271/271, lint passed, and signed fallback assembled; diagnostic flag-on suite also passed271/271. The load-sensitive failure is retained as a test limitation.
- Phone219 tests passed: `node --experimental-test-module-mocks --test 'src/transfer/*.test.ts' 'src/karoo/*.test.ts' 'src/pacing/*.test.ts'`. Root `tsc --noEmit` passed. Reused primary installed dependencies via temporary symlink, removed afterward; no dependency changes. Python BLE monitor2 tests pass.
- Replay uses invented short rolling and longer sustained climbing shapes, every later boundary after20W first-section shortfall. Completed targets retained, deficit improves, targets<=ceilings, climbing steps<=20W, ahead unchanged, unreachable estimate finite and bounded. Existing numerical/energy/deadband/missing-grade tests retained. Not calibrated real-world finish validation. Shared contract still allows80W at non-climbing transitions.
- APK version, persistent signature, generated BuildConfig flags and SHA256 independently verified with Android35.0.0 aapt/apksigner. Exact source for BOTH: `eac155f3401d0c689729704260996a1106f38aae`. Not an installation verification.

## External state

- Last device status: `adb devices -l` returned an empty list on2026-10-26. No install, clear-data, uninstall, ride, phone build/upload, tag, release or public flag change performed.
- Installed public73 last confirmed by Jason via Companion; segments retained. Do not claim a fresh independent installed version read.
- Diagnostic74 `0.10.46-replanner-test1`: `/tmp/gritmap-replanner-eac155f/diagnostic74/gritmap-karoo.apk`
  SHA256 `d8bca0eb8c841c5490d11cb6837630cc1918e9087e2e7371a28c168ad69d9d32`.
  Flags `{"BLE_TEST_DISCONNECT_AFTER_BYTES": "0", "CONCURRENT_SEGMENTS_ENABLED": "false", "DIRECT_BLE_V2_ENABLED": "true", "LIVE_REPLANNER_ENABLED": "true", "PLAN_CEILINGS_ENABLED": "true", "SEGMENT_RECORDS_ENABLED": "true"}`.
- Flag-off fallback75 `0.10.46-replanner-off`: `/tmp/gritmap-replanner-eac155f/fallback75/gritmap-karoo.apk`
  SHA256 `3d2cf84e0661e29cbe3600866968ca0e438caf8801964a36d30b1f0bb11dd95d`.
  Flags `{"BLE_TEST_DISCONNECT_AFTER_BYTES": "0", "CONCURRENT_SEGMENTS_ENABLED": "false", "DIRECT_BLE_V2_ENABLED": "true", "LIVE_REPLANNER_ENABLED": "false", "PLAN_CEILINGS_ENABLED": "false", "SEGMENT_RECORDS_ENABLED": "false"}`.
- Both signer certificate SHA256 `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`. Sibling verification.json/BuildConfig.java/signature.txt/SHA256SUMS.txt preserved under each candidate directory. Files are local; not checked into public repo.
- Candidate75 is ONLY a fallback, not public release approval. If75 is ever installed, future updates must respect that installed version;74 is the first candidate to test, not after75.

## Goal alignment

GOALS priority8 / pacing4 and beta-loop1, plus minimal storage prerequisite for7, per coordinator's explicit2026-10-26 priority. Plan-free BLE/PR rendering/local PR merge remain next separate milestone; On Karoo design note later. Needle remains backlogged; readiness/code untouched. H10 saved RR/export and full-radio recovery limitations unchanged.

## Hazards and blockers

- **Phone integration required:** add optional writable-with-response GATT characteristic `9aa66e90-1c9e-46e1-9e52-45fd6a40847a`; Karoo writes JSON before manifest read. Exact v1 keys `v`, `transferV`, `versionCode`, `features`, `maxManifestBytes`, `maxRecordBytes`. Feature names `planCeilingsV1` / `segmentRecordV1`. Native phone must stage baseline/extended variants, claim first central on write OR read, freeze exact resource bytes/hash/manifest, reject another central, and accept identical reconnect capability writes idempotently. Missing characteristic means old baseline flow. TypeScript gate is preparation, not native integration. No BLE ceiling-bearing transfer has been physically validated.
- **Phone wire fields:** `baselinePacingPlan.replan` exactly `schemaVersion`, `criticalPowerWatts`, `wPrimeJoules`, `wPrimeReserveFraction`, `maxStepWatts`, `hardMaxStepWatts`, `stepLimitMinGradePct`; each zone `ceilingPowerWatts`. Current Wi-Fi source sends these only after positive capabilities and only for generated realistic plans. Needs a phone build/update before use.
- Record schema is diagnostic new v1: root `segmentRecord` exactly `schemaVersion`, `riderId`, `segmentFingerprint`, `bestDurationSeconds`, `achievedAtMs`, `effortCount`, `splits`. Splits exact `distanceMeters`/`elapsedSeconds`, explicit origin/finish (or empty), max80 /8192UTF8 bytes. First opaque per-rider16–64char ID pins owner; wrong owner rejects package atomically; strictly faster only replaces. No owner-change UI. Phone persistent ID provisioning/record construction still pending. No PR display or local-attempt merge yet.
- BLE optional descriptor/resource name `record`; plan remains required. Manifest<=512 bytes even after negotiation. Four full descriptors may not fit: omit record / use Wi-Fi, or omit rider only when matching profile installed. Never truncate hashes or silently drop needed rider data. Bigger manifests need a separately versioned chunked protocol.
- Wi-Fi GET/capabilities does not consume POST receive window; old405/error stays baseline. POST200 still means received, not imported.
- **Room4 backout:** migration adds tables, preserves existing segments/plans/H10. Once opened, public73/Room3 cannot reopen DB. Disable with signed flag-off75/Room4 in-place, never uninstall or clear data. Physical migration/retained data not yet verified on this device.
- **No exact install approval yet.** Build approval/installation/ride success/public enablement must not be inferred from source authorization.

## Next safe action

Present exact diagnostic74 source/version/hash/signature/flags to Jason for installation approval, explain Room4/fallback75. Before ONE supervised on-bike run, have phone side integrate the documented BLE handshake (or updated Wi-Fi source), transfer a generated ceiling-bearing plan and independently verify retained metadata. Current phone BLE baseline cannot exercise replanning headroom. Install only after exact approval and a connected device; collect boundary/target/estimate evidence, then decide whether to disable via75. Keep all public flags off. Phone primary session should pick up this branch's contract/fixtures, not send new fields to public73. No messages to another chat were sent.
