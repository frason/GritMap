# Handoff: phone BLE sender contract questions answered

- Updated: `2026-10-27 12:39 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-receiver-capabilities`
- Head before this documentation: `f509c7a docs: answer two-plan behavior and require Bluetooth diagnostic test`
- Worktree: clean before documentation; only contract, LATEST and this archive changed.

## Outcome

Read own LATEST and coordinator origin/main4e1de6c. All four sender questions answered below; current pacing test needs ceilings only, not PR records. No implementation or approved APK changes.

## Answers for phone session

1. **Manifest / record:** for the supervised pacing test, send rider + plan with ceilings, OMIT record when it does not fit; omission is a nonfatal optional-feature note, not a failed pacing send. Never drop the rider, truncate hashes, shorten existing descriptor keys, raise the512-byte cap, or infer installed rider state from phone send history. For the later plan-free BLE+PR milestone, choose a **separately versioned chunked-manifest protocol**, jointly designed/tested before either side ships it. Do not make current pacing work wait for inventory or PR. No BLEv2 wire change now.
2. **Stable owner:** phone owns generation: create one opaque ID per logical rider, suggested16 cryptographically random bytes encoded as32 lowercase hex characters, during explicit initial record-owner setup. Persist/read it through non-synchronizing iOS Keychain storage, not only app_settings; reuse it across segments, transfers and profile/FTP edits. Do not regenerate on lookup errors, upgrades or reinstall. Do not promise OS storage can never be lost: missing/unreadable identity for an existing owner means withhold the optional record and require explicit recovery; baseline/ceilings remain usable. Diagnostic74 has **no owner reset UI or reset endpoint**. First accepted record pins the owner; mismatch rolls the whole package back. A future owner-change flow must require explicit user confirmation and atomically clear only the old owner+record tables, preserving segments/plans/attempts/H10. That flow and sender record construction are deferred to PR work; keep production record sending disabled for this test. An opaque ID is an ownership namespace, not BLE authentication.
3. **Capabilities write:** YES, accept a malformed/unsupported INITIAL advertisement from the owning central with ATT success and freeze baseline. The Karoo does not swallow write failure: a refused/non-success write, start failure, disconnect or timeout fails that connection/open path, so do not use ATT failure merely to mean unsupported JSON. Ownership checks still apply; do not accept another central. Karoo writes capabilities in Connection.open on **every connection**, including resource and receipt reconnects, whenever the characteristic exists, after service discovery and **before first manifest read**. Old phone with no characteristic skips the write. Identical reconnect bytes must succeed idempotently with no manifest/resource/progress change; changed bytes after freeze are refused. The phone's writeCapabilities implementation at remote e0bacb1 follows that ordering/idempotence pattern by inspection; this is not native/device validation.
4. **Actual receipt codes in approved74:** imported: `ok`, `ok_segment_existing`. Rejected: `timeout`, `bad_hash`, `bad_segment`, `bad_plan`, `fingerprint_mismatch`, `ftp_mismatch`, `too_large`, `other`. **No `bad_replan`, `bad_record` or `record_owner_mismatch` exists.** Mapping is message-based and precedence matters: timeout exception → hash mismatch → message contains segment → plan → fingerprint → FTP → size/large → other. Thus bad replan metadata normally yields `bad_plan`; malformed record parser failures are prefixed Invalid segment record and normally yield `bad_segment`; Record belongs to another rider yields `other`. Some fingerprint/FTP errors are masked by earlier segment/plan wording. UI should use broad truthful wording (bad_segment = segment or attached record rejected; other = transfer rejected, inspect Karoo details), not infer a specific owner failure. Unknown future codes need generic fallback. Connect/capability/invalid-manifest failures before a usable manifest may have **no receipt at all**; transport failure is not an imported/rejected receipt. Do not wait for finer codes to test ceilings; adding typed reasons later would change receiver code and require a new exact candidate approval.

## Changed

Documentation only: `docs/RECEIVER_CAPABILITIES_CONTRACT.md` gets these clarifications and the observed phone source branch status; `handoffs/LATEST.md` gets the short response. No receiver/phone source, native build, tag, public release or flag change.

## Verified

Source read at approved receiver eac155f: DirectBleGattClient.open/write/checkStatus, DirectBleTransferReceiver.receive/reconnect/deliverReceipt/rejectionCode, SegmentRecord parser and TransferPackage owner transaction. All listed codes/order are literal receiver source. No tests/build run for documentation-only work; earlier271 Karoo/219 phone/lint evidence remains historical, not newly run.

Remote **origin/ble-pacing-fields now exists at e0bacb1** (includes1dead18), so the coordinator's not-pushed wording is superseded. Spot-read its TransferSession.writeCapabilities and TypeScript gate/record validator. Phone-reported762 TS tests/123 Swift checks are coordinator reports, not independently rerun here; no full sender code review or native/device success claim. No native sender-build availability confirmation received from Jason.

## External state

Approved diagnostic74 remains unchanged: source eac155f3401d0c689729704260996a1106f38aae, SHA256 d8bca0eb8c841c5490d11cb6837630cc1918e9087e2e7371a28c168ad69d9d32. No installation, transfer, ride, device query or APK rebuild in this turn. Public73 last owner-confirmed installed, not freshly read. Fallback75/Room4 backout constraint unchanged. No messages sent to another chat.

## Goal alignment

Unblocks phone-owned sender for the Bluetooth-only supervised pacing test (GOALS1/4/8), while record identity/framing and plan-free PR remain the following milestone. No inventory implementation, Needle work or public experimental enablement.

## Hazards and blockers

Do not conflate pushed phone source/unit tests with a native phone build installed on the device. Installation condition remains: Jason confirms sender build exists and Karoo connected/unlocked/authorized. His exact74 approval persists. There is no owner reset today, and no granular pacing/record rejection codes. A missing record must not block ceiling transfer. Do not change approved74 to add codes/reset without a new reviewed candidate.

## Next safe action

Phone session reads this response/contract from origin/codex/karoo-receiver-capabilities, keeps records withheld, builds the matching native sender and reports its exact version/readiness through coordinator. After Jason confirms sender and Karoo readiness, verify approved74 hash, install in place without repeating approval, send via Bluetooth, verify retained ceilings, then ONE supervised ride. No Wi-Fi substitution for the test.
