# Handoff: Coach/Profile update installed on Karoo

- Updated: `2026-10-22 16:18 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `ec38f81 docs: correct the profile-history handoff timestamp and filename`
- Worktree: prior feature changes and handoffs remain uncommitted; no source edits this milestone.

## Outcome

Connected Karoo updated in place to `0.10.44-fields1` / versionCode 70. Includes the 1.5× Coach active row, horizontal actual-work fill with vertical planned line, Profile title/action timing/elevation/readability refinements and prior work/cardiac/H10 display changes.

## Changed

- Device install only plus this handoff and `docs/KAROO_FIELD_WORK_FILL.md` installation status. No commit, push, tag or public release.
- Source details: `handoffs/archive/2026-10-21-2230-codex-coach-horizontal-profile-visibility.md` and previous field-work handoff.

## Verified

- JDK17 `:app:assembleBeta -PgritmapBetaSigningProperties=<existing persistent signing properties> -PgritmapVersionCode=70 -PgritmapVersionName=0.10.44-fields1 -PgritmapDirectBleV2=true -PgritmapConcurrentSegments=false --no-daemon`: BUILD SUCCESSFUL in 4m9s, including beta vital lint. Log `/tmp/gritmap-fields1-beta.log`.
- Generated beta BuildConfig confirms code70, BLE true, concurrent false.
- apksigner verify passed; aapt confirms package/version.
- `adb -s 00442GA241760203 install -r apps/karoo/app/build/outputs/apk/beta/app-beta.apk`: Success. Postinstall dumpsys confirms version70 / 0.10.44-fields1.
- Prior full226 tests and final focused renderer/layout tests/debug lint passed; not repeated for packaging-only version overrides.

## External state

- USB Karoo serial00442GA241760203 now runs signed beta70. In-place install preserves app data; no uninstall or clear-data. BLE remains enabled; concurrent runtime remains disabled.

## Goal alignment

- User explicitly requested installing the completed readability changes. No wire/phone contract change.

## Hazards and blockers

- Outdoor readability, actual ride work-fill behavior, cardiac stability and H10 display still require rider validation. No live ride exercised this milestone.
- Prior concurrent and other feature source remains uncommitted. H10 recording export/list remains pending.
- Next device/public build must use versionCode >=71.

## Next safe action

Open the Karoo Coach/Profile fields and validate the updated layout on a ride, preserving device data.
