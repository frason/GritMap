# Handoff: controlled GATT disconnect/resume physical acceptance passed

- Updated: `2026-10-23 23:17 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `30c799a docs: record approved link-only diagnostic73 installation`
- Worktree: documentation-only physical acceptance record

## Outcome

Diagnostic73 passed a real controlled single-GATT-link disconnect, same-transfer manifest verification, offset resume, all resource hashes, one logged new-segment import and acknowledged success receipt. Jason confirmed phone success. This is a controlled-link pass, not proof that the previously failed full-radio restart recovers.

## Changed

- No source/APK/install changes; source46eb5be. LATEST, this archive and physical acceptance notes updated.

## Verified

- Installed0.10.45-bluetooth-linktest1/code73, SHA256c62ad47e80144c51fba5f08e4c35e7fbe214e12f61fd3bb56db44078f6a54e17. Prior normal-config263 Kotlin tests/2 Python tests/lint/signed builds pass; no new automated tests needed for this documentation milestone.
- GritMapLive device log timestamps (10-23):
  -23:12:23.268 ble_connected mtu=517.
  -23:12:27.015 ble_test_disconnect resource=segment completed=8192.
  -23:12:27.024 ble_test_disconnected callback=true (actual callback).
  -23:12:27.032 ble_resume resource=segment offset=8192 attempt=1.
  -23:12:35.340 same offset attempt=2;23:12:43.654 same offset attempt=3.
  -23:12:45.042 ble_connected mtu=517;23:12:45.080 ble_resume_verified resource=segment offset=8192 (complete manifest matched).
  -23:15:12.168 ble_resource resource=segment bytes=298148.
  -23:15:14.819 ble_resource resource=plan bytes=5778.
  -23:15:15.001 ble_resource resource=rider bytes=114.
  -23:15:15.763 ble_imported existing=false durationMs=174327.
- Resource logs occur only after full expected-byte SHA256 verification. ble_imported occurs after import and successful receipt delivery; one observed import result. Private database row counts were not independently inspected.
- Same offset retained across all attempts; verified reconnect ~18s after disconnect callback, within recovery/phone inactivity bounds. No radio toggle used. Bluetooth independently verified enabled:true/state:ON afterward.
- Jason reported progress increasing, then80%, then explicitly confirmed phone success. Phone internal build5 last reported, not independently queried.
-174.327s transfer completion also physically exceeds the old120s discovery budget, confirming that the corrected receive window did not cut off the connected transfer.
- Normal candidate hash rechecked without installation: c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e.

## External state

- Karoo still runs diagnostic73, which automatically drops one transfer link per receive session. It must be replaced with the normal injection0 APK before ordinary use/public validation.
- Diagnostic verification.json in /tmp/gritmap-karoo-0.10.45-bluetooth-linktest1-73 updated with actual pass evidence.
- Normal candidate /tmp/gritmap-karoo-0.10.45-bluetooth-beta-73/gritmap-karoo.apk,3900465 bytes, source46eb5be, persistent beta signature verified, injection0. Prepared but not approved/installed/published.
- No tag/publication, uninstall or clear-data. Private segment/ride/RR bytes not committed. Saved624-sample RR artifact export remains unfinished.

## Goal alignment

- GOALS priority1 Bluetooth beta physical acceptance. No phone/shared-contract/ownership changes.

## Hazards and blockers

- Controlled-link acceptance now passes on the diagnostic variant; normal public binary still needs exact in-place install approval and normal-transfer validation. Never publish the injection8192 diagnostic artifact.
- Full-adapter restart failed on earlier71/72 and is not a pass here; phone ownership/session refusal cause unresolved. Do not promise recovery from every Bluetooth failure.
- In-ride H10 coexistence remains Jason-waived, not passed. No H10 RR continuity assertion from this test.
- Public tagging/publication requires separate exact approval; stable Companion link install/retained-data verification follows publication before wide invites.

## Next safe action

Present normal0.10.45-bluetooth-beta/code73, SHA256c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e, source46eb5be and263-test/lint/signature QA for exact install approval. After approval install-r despite same code (do not uninstall), verify version/launch, and validate normal send/installed-segment skip without fault injection. Then seek separate release approval and validate stable Companion link before wide invites.
