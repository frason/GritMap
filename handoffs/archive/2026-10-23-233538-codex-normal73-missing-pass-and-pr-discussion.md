# Handoff: normal beta73 transfer paths pass; discuss plan-free PR fallback

- Updated: `2026-10-23 23:35 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `6326898 docs: confirm normal beta73 installed-segment skip`
- Worktree: documentation-only evidence and requested discussion note

## Outcome

Normal0.10.45-bluetooth-beta/code73 now passes both installed-segment skip and new/missing-segment import with hash verification and success receipts. Diagnostic73 separately passed controlled GATT-link recovery. Jason requested a discussion of the requirement to create a plan before sending: he thinks a segment with no plan should default to PR timing. No implementation or priority change for that request has been made.

## Changed

- No source/APK/install changes; source46eb5be. LATEST, this archive and physical acceptance notes updated.

## Verified

- Normal missing segment, device GritMapLive log10-23:23:33:33.573 ble_connected mtu=517;23:33:39.565 ble_resource resource=segment bytes=12754;23:33:40.777 ble_resource resource=plan bytes=2075;23:33:40.959 ble_resource resource=rider bytes=114;23:33:41.182 ble_imported existing=false durationMs=9962.
- Resource logs follow full expected-byte hash verification; import log follows receipt delivery. No diagnostic drop observed on normal variant. Jason reported done already.
- Prior normal skip: existing=true, plan5778/rider114 bytes,5420ms at23:24:11.528.
- Diagnostic controlled-link pass: actual callback, full manifest equality, offset8192 retained through three retries,298148-byte new segment, receipt and explicit phone success; see prior archive. This is not full-radio recovery.
- Prior normal-config263 Kotlin tests/2 monitor tests/debug+beta lint/signed build/signature/flags QA remains unchanged; no tests/build for documentation-only changes.

## Requested product discussion: sending without a plan / PR timing

- Jason had to create a plan before this send and questioned that requirement. His proposed behavior: send the segment without requiring a pacing plan; if there is no plan, use PR timing.
- The agent's earlier statement that transfer needs a plan described the current implementation too broadly as a product requirement. This is a current sender/contract limitation, not a confirmed desired user flow.
- Existing GOALS priority7 already calls for PR display when no plan, currently post-beta. docs/KAROO_MULTI_SEGMENT_AND_PR.md: plan wins; otherwise rider PR with live ahead/behind; if no PR exists, progress and elapsed time only. PR import/display and segmentRecord contract remain pending; concurrency runtime is default-off.
- Current BLE v2 manifest requires a plan resource; package construction emits baselinePacingPlan. Plan-free transfer needs coordinated phone/Karoo contract, parser/storage/UI work and shared fixtures. Do not silently omit required plan or invent a fake plan/PR.
- Discuss whether to bring segment-only/PR sending forward for beta, potentially independently of concurrent tracking, or retain its post-beta priority. Clarify the no-PR first-attempt behavior using the existing documented fallback.
- This user request is to record/discuss, not authorization to implement the feature or change release scope. No GOALS edits or phone changes. Confirm timing before treating current plan prerequisite as accepted product behavior.

## External state

- Karoo remains normal0.10.45-bluetooth-beta/code73, source46eb5be, SHA256c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e, injection0. Same persistent signature, original installation retained.
- Phone internal build5 last reported. Local normal verification.json updated with actual missing/skip results.
- No tag/publication approval or action. No private ride/segment/RR bytes committed. H10 capture624 samples saved separately; export unfinished.

## Goal alignment

- GOALS priority1 Bluetooth beta validation now covers these normal transfer paths; requested PR discussion aligns with priority7 but its timing remains a decision.

## Hazards and blockers

- Full-radio restart failed on earlier71/72; do not generalize controlled-link recovery to every radio/session failure. In-ride H10 coexistence owner-waived, not passed.
- No public release has been authorized. Exact tag/publication approval remains separate; stable Companion URL/install verification follows release before wide invites.
- Current build still requires a plan for Bluetooth send. PR fallback/segment-only sending is not implemented. Keep this explicitly visible in release discussion.

## Next safe action

Review requested plan-free/PR behavior with Jason and decide release timing/scope. If current scope proceeds, present exact source46eb5be, normal version73/hash and actual QA/physical evidence for separate tagging/publication approval. Never publish diagnostic injection-enabled APK. Preserve app data and validate the stable Companion link after any approved release.
