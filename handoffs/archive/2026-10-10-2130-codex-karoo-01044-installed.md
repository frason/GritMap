# Handoff: large-field visual pass installed as Karoo 0.10.44-beta

- Updated: `2026-10-10 21:30 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `c1866fb docs: record first public Karoo beta release`
- Worktree: uncommitted renderer, BLE transfer, launcher icon, docs, tests, and handoff changes

## Outcome

The approved large-field typography/density pass, stable `GM PACING PROFILE` title, launcher icon,
and bounded Bluetooth receiver are installed in place on Jason's connected Karoo as
`0.10.44-beta` (version code 67). Android retained the original installation timestamp, the main
activity launched, and Hammerhead reconnected the extension without a fatal exception.

## Changed

- No source changed specifically for installation.
- Built the current worktree with version name `0.10.44-beta` and version code `67` using the
  persistent GritMap Beta signing key.
- Installed `apps/karoo/app/build/outputs/apk/beta/app-beta.apk` with `adb install -r`.

## Verified

- Signed/minified `:app:assembleBeta` passed, including release vital lint/R8.
- APK identity before installation: package `com.gritmap.karoo`, min/target SDK 31, version
  `0.10.44-beta`/67.
- Signing certificate SHA-256:
  `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6` (same GritMap Beta key).
- Before install, device reported `0.10.43`/66.
- `adb install -r` returned `Success`.
- After install, device reported `0.10.44-beta`/67; `firstInstallTime` remained
  `2026-10-09 13:18:34`, confirming an in-place upgrade.
- `MainActivity` displayed in 839 ms; process remained alive; Hammerhead logged the extension as
  connected; recent logcat contained no `FATAL EXCEPTION` for GritMap.
- Source QA immediately before packaging: 189/189 JVM tests, Android lint, debug build, and
  `git diff --check` passed.

## External state

- Physical device `k24` serial `00442GA241760203` now has `0.10.44-beta`/67 installed.
- GritMap was left open on the Karoo for visual review.
- The public GitHub release remains `0.10.43`; this APK was not published or copied to the public
  release asset.

## Goal alignment

- Delivers the cross-field legibility milestone to physical hardware for acceptance testing.
- Also places the documented bounded BLE receiver on the device, but that transport remains
  unusable end to end until the phone advertiser and HTTPS capsule service exist.
- No phone/Karoo shared data schema changed during installation.

## Hazards and blockers

- Device installation proves packaging and startup, not visual acceptance. Review the five large
  fields in Karoo's page editor/live preview and capture screenshots if any text clips.
- The current device build includes several uncommitted milestones. Do not treat it as reproducible
  from `main` until the worktree is committed.
- `0.10.44-beta` is not publicly downloadable yet.

## Next safe action

Open the five large fields on the Karoo, confirm their titles/type scale/density, then commit the
current milestones and publish a new signed beta only after that physical review passes.
