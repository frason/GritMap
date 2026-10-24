# Handoff: public Bluetooth beta73 Companion installation confirmed

- Updated: `2026-10-24 (client session date)`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-release-73`
- Head: `7993ee6 docs: record published Bluetooth beta73 and verified public asset`
- Worktree: documentation-only final installation verification

## Outcome

Jason confirmed the final public stable-link Companion update: Installed; segments retained. This answers the explicit request to Share Link through Hammerhead, accept the in-place update, verify0.10.45-bluetooth-beta and retain existing segments. The final Companion route check is complete by owner confirmation.

## Changed

- LATEST, this dated archive and docs/KAROO_BETA_RELEASE.md now record actual Companion confirmation; no runtime/tag/release-asset changes.

## Verified

- Owner response to exact public-install/version/retained-segments question: Installed; segments retained.
- Read-only adb get-state attempted afterward: unavailable. Do not claim fresh independent dumpsys version/timestamps or an on-device APK digest after the Companion update.
- Previously verified public release karoo-beta-0.10.45 at source0e95e8443c5bdfd1f4ed0e8ddfd8224cf697f292; CI40073513782 success; stable URL HTTP200; public APK73aa7e2f497243b4022f3012edb20eda6fe53cbbea5cf9a822350d11ac36ca69 matches published checksum, version73/0.10.45-bluetooth-beta and persistent certificate.
- Public/local APK differences limited to native compiler-identification/build-id metadata; executable code/data identical. Normal new/skip and diagnostic controlled-link tests,263 Kotlin+2 monitor tests/lint/build evidence unchanged.
- No additional automated tests/build for documentation-only changes.

## External state

- Owner confirms public73 update via Companion and existing segments retained. Raw private RR artifacts/database integrity not independently inspected; no uninstall/clear-data performed by this session.
- Public release https://github.com/frason/GritMap/releases/tag/karoo-beta-0.10.45 and stable APK https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk remain the phone onboarding targets.
- Local /tmp/gritmap-public-karoo-beta-0.10.45/verification.json updated with owner-confirmed Companion outcome and unavailable ADB qualification.

## Goal alignment

- GOALS priority1 public Bluetooth beta release and required stable Companion installation route validated within approved scope. Phone build8 can reference public0.10.45-bluetooth-beta/versionCode73. No phone build/upload action authorized or performed here.

## Hazards and blockers

- Known release gaps remain documented: Bluetooth requires a plan, segment-only uses Wi-Fi; plan-free Bluetooth and PR later together. Full-radio restart recovery unresolved; controlled GATT-link recovery is the passed case. H10 in-ride coexistence waived, RR export unfinished.
- Segment retention is owner-observed; no assertion that all private H10/Room records were independently verified. Maintain in-place upgrades and persistent signing identity.
- ADB currently unavailable; no further device changes needed merely to record the confirmed install.

## Next safe action

Jason can return to the phone/Claude session with public release0.10.45-bluetooth-beta/code73 and confirmed stable Companion route. Read this release branch's LATEST. Keep Inbox > Receive from Phone / Legacy Wi-Fi Receive and WAITING FOR PHONE / Cancel Receiving / Bluetooth closes automatically after 2 minutes unchanged. Follow the phone session's build8 approval process; do not implement deferred PR/plan-free sending here.
