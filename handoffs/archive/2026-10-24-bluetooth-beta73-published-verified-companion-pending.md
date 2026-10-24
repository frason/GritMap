# Handoff: approved Bluetooth beta73 published and public asset verified; Companion check pending

- Updated: `2026-10-24 (client session date)`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-release-73`
- Head: `b51a913 docs: record approved release73 tag and active workflow`
- Worktree: docs-only publication follow-up; tagged runtime source unchanged

## Outcome

Jason's exact approved release is public as karoo-beta-0.10.45 /0.10.45-bluetooth-beta/code73. CI passed; latest release/stable download/checksum/version/signature and approved source/notes verified independently. Final user-operated Companion update/retained-segment check remains pending before wide invites.

## Changed

- Approved annotated tag at0e95e8443c5bdfd1f4ed0e8ddfd8224cf697f292, published by Actions40073513782.
- docs/BETA_KAROO_INSTALL.md now names public73 and the live stable link; docs/KAROO_BETA_RELEASE.md records actual publication and pending Companion check. LATEST and this archive updated. No tagged source/runtime changes.

## Verified

- Release https://github.com/frason/GritMap/releases/tag/karoo-beta-0.10.45; publishedAt2026-10-24T07:21:45Z; not draft/prerelease, GitHub latest points to this tag.
- Workflow https://github.com/frason/GritMap/actions/runs/40073513782 completed success, including tests/lint/signed build, public flags, signature/version verification, artifact staging and publication.
- Remote annotated tag dereferences to exact approved0e95e8443c5bdfd1f4ed0e8ddfd8224cf697f292. Published release body matches reviewed docs/releases/KAROO_BLUETOOTH_BETA_0.10.45.md exactly after whitespace trimming.
- Downloaded actual stable URL https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk; HTTP200, latest tag verified.
- Public APK3900457 bytes, SHA256 `73aa7e2f497243b4022f3012edb20eda6fe53cbbea5cf9a822350d11ac36ca69`, matches published SHA256SUMS.txt. aapt com.gritmap.karoo /73/0.10.45-bluetooth-beta; apksigner verifies persistent certificate `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`.
- Local approved/physically tested APK hashc371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e differs from CI public hash. Only changed APK ZIP entry:lib/arm64-v8a/libgritmap_needle_bridge.so. ELF comparison: only .comment compiler-identification text and .note.gnu.build-id differ; .text/.rodata and every other ELF section match. All other ZIP entries match exactly. Do not claim byte-identical APKs; executable code/data are identical. This is compiler/build metadata variation between local and CI toolchains.
- CI asserts BLE enabled; fault injection0; concurrent/replanning/ceilings false. Prior source-identical263 Kotlin+2 monitor tests/local lint/build pass. Normal missing/skip and separate diagnostic controlled-link physical passes retained as evidence; no new device install after publication yet.

## External state / coordination

- Public APK and evidence downloaded to /tmp/gritmap-public-karoo-beta-0.10.45/ (gritmap-karoo.apk, SHA256SUMS.txt, release.json, verification.json, native-comparison.json).
- User was explicitly asked to long-press stable link on iPhone > Share Link > Hammerhead, accept in-place Karoo update, then confirm version and retained segments. Await actual response; do not mark Companion validation passed by inference from HTTP/ADB.
- Karoo last verified running normal73 local hashc371...; public hash73aa... update has not been independently observed.
- Tell Jason/phone session: public0.10.45-bluetooth-beta/versionCode73 now exists for build8's requirement text. Inbox > Receive from Phone; Legacy Wi-Fi Receive fallback; WAITING FOR PHONE, Cancel Receiving, Bluetooth closes automatically after 2 minutes unchanged.
- No private GPS/ride/raw RR files committed; H10 app-private saved recordings retained. No messages sent to another chat/app.

## Goal alignment

- GOALS priority1 public Bluetooth beta now published, pending final installation route validation. Approved gap documented: Bluetooth needs a plan, segment-only via Wi-Fi, PR/plan-free Bluetooth later together.

## Hazards and blockers

- Stable URL/download verification is not a Companion installation pass. Complete user physical Share Link update/retained-data check before wide invites.
- Full-radio restart recovery unresolved; controlled-GATT-only pass is narrower. H10 in-ride coexistence owner-waived, not passed; RR export/phone ingestion unfinished. Do not publish diagnostic variant or enable experimental flags.
- Preserve signing identity/data. No uninstall/clear-data; if Companion fails, retain error and investigate rather than deleting data.

## Next safe action

Wait for Jason's Companion check result. If successful, read-only verify version/update timestamp via ADB if available and record what Jason confirmed about retained segments (do not infer raw RR integrity). Update docs/handoff with actual install outcome and relay public version/labels through Jason for phone build8. If unavailable, leave Companion check explicitly pending.
