# Karoo current to-do reviews complete locally; proposals await approval

- Updated: `2026-11-04 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-screen-redesign`
- Head before this documentation: `f828191 docs(handoff): record verified reviewed-branch push`
- Worktree: three new review documents plus this latest/archive update; documentation commit follows.

## Outcome

Fetched origin/main ea4290b and followed its FIRST section CODEX CURRENT TO-DO, ONE LIST for this Karoo session. Completed both queued read-only source reviews and the tester APK proposal. Read GOALS and relevant main tester/map sections; feasibility work supports the planned Karoo responsibilities without promoting deferred reverse sync into beta scope. Liked-segments/web/phone tasks remain owned elsewhere.

## Changed

- docs/KAROO_MAP_DISPLAY_FEASIBILITY_20261104.md: current active-only line/marker, vendor styling/count/rate limits of evidence, missing upcoming collection and stale-GPS watchdog; proposed bounded active+next display, planless line handling, navigation-aware membership, style/freshness/teardown, one shared target under replanning and synthetic future test matrix. No map implementation/tests added because the current instruction is docs-only.
- docs/KAROO_REVERSE_BLE_SYNC_FEASIBILITY_20261104.md: current v2 roles/strict receipts versus new reverse data; persisted summaries, RR files/sidecars and existing phone RR decoder; staged foreground summary/RR return, resumable durable acknowledged import, privacy/authentication review and full native FIT acquisition blocker. No protocol fixtures or native receiver implemented.
- docs/KAROO_TESTER_APK_CANDIDATE_PLAN_20261104.md: proposed version79/0.10.49-tester-candidate conditional on latest-version check; existing persistent beta signing, exact artifact manifest, migration3/4→5/no downgrade, forward recovery, full frozen/minified variant QA, exact install approval, earliest proposed supervised ride2026-11-07, separate public release decision. No signed artifact/hash fabricated or generated.
- This handoff and new dated archive record actual completion and outstanding approvals.

## Verified

Inspected PacerMapLayer, map subscription, LiveUiState.targetProgressMeters, AttemptReplanner, vendored MapEffect/Symbol/OnNavigationState/RideState/FitEffect and current PacerMapLayerTest. Inspected DirectBleGattClient/v2 contract, iOS peripheral write dispatch/TransferSession receipt constraints, Room completion entities/sink, RR store/catalog/identity, phone postRideAnalysis decoder, build.gradle.kts beta settings and DatabaseProvider migrations.

Checked documentation for original personal identifiers and unsafe local paths; clear. Verified Saturday date, no runtime/phone/native file changes, and git diff --check. No unit tests, build, sign, device trial or performance measurement run: documentation-only task. Proposed behavior and acceptance tests are clearly separated from existing implementation. Prior runtime/screenshot validation remains recorded below; it does not validate future proposals or a newly signed beta variant.

## External state

No push, deploy, hosted release, provider setting, native change, signing access/change, device query/install or cross-session message. Remote Karoo branch remains the previously verified0ae52da. Local f828191 push-result handoff and this documentation commit are not pushed. Private history backup stays local. Last observed installed76/Room4 unchanged; current public73 status is handoff-reported, not freshly fetched from a release endpoint.

## Goal alignment

Map is Karoo-owned live display; summary/RR return is planned phone sharing/parallel H10 feasibility, not a replacement for beta manual FIT import. Tester proposal supports beta-loop reliability. No new shared payload contract, API, permission, provider or runtime state changed.

## Hazards and blockers

No task blocked finishing these docs. Implementation gates: owner map/nearby policy decisions; reverse private-data peer authentication/encryption and shared phone native/storage contract; supported native FIT acquisition; named candidate build/version freeze, hardware validation and explicit install/release approval. Owner must decide whether the Karoo candidate accompanies the initial phone tester rollout. Hardware map count/performance, line stacking/contrast and BLE write throughput remain unmeasured. Map target currently evenly follows original goal time; independently substituting replanned finish would disagree with the field.

Nearby Segments radius/ordering/row content remain unapproved. No new discovery implementation or install should start on the strength of this review. Never use diagnostic74 as a downgrade from76. No uninstallation/data clearing. No secrets, personal ride values, GPS samples or private reports added.

## Next safe action

Present exact local documentation commit/file inventory and privacy scan, then ask the owner for yes before any new push. Review proposed map defaults and whether to authorize a frozen tester candidate build afterward; any install/deploy/release is a separate approval. Do not start another session's work.
