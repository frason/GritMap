# Handoff: signed Karoo beta 0.10.42 is tagged, installed and documented

- Updated: `2026-10-08 15:16 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `1eb405f feat: prepare signed Karoo beta distribution`
- Worktree: Claude's phone redesign remains uncommitted under `src/`, `scripts/` and
  `docs/screenshots/redesign/`; no Karoo or beta-guide work is uncommitted

## Outcome

Karoo beta `0.10.42-beta` (code 65) is signed with a persistent private beta identity, tagged as
`karoo-beta-0.10.42`, and installed on physical Karoo `00442GA241760203`. A clean install of signed
`0.10.41-beta` followed by an in-place upgrade to `0.10.42-beta` succeeded; Android retained the
same `firstInstallTime` (`2026-10-08 14:53:42`) and logged `Retain data and using new`. The exact
tagged artifact launches to the empty Segments screen and Karoo OS connects its extension service.

`docs/BETA_KAROO_INSTALL.md` gives a stranger the official iPhone Companion sideload path, ADB
fallback, recommended pages/fields, graceful-degradation expectations, and the exact phone-transfer
flow: **GritMap** -> **Inbox** -> **Receive from Phone**, then **Send plan to Karoo** on the phone.

## Changed

- Commit `1eb405f`:
  - `apps/karoo/app/build.gradle.kts`: property-driven beta version, mandatory external signing
    properties, and a minified `beta` build type.
  - `apps/karoo/app/src/main/res/xml/karoo_extension_info.xml`: registers the already-implemented
    `h10-cardiac-stability` field. Before this fix, GM H10 Cardiac could not appear in the picker.
  - `apps/karoo/app/src/main/res/values/karoo_ui_strings.xml`: labels it
    **GM H10 Cardiac (Experimental)**.
  - `ProfileBitmapRenderer.kt`: an idle large Pacing Profile now says **WAITING FOR SEGMENT** and
    **Start a recorded ride** instead of returning a uniform blank bitmap.
  - `ExtensionInfoTest.kt`: asserts all 10 implementation IDs are registered uniquely.
  - `BetaEmptyStateRenderersTest.kt`: renders all six graphical fields without a segment or
    optional sensors and rejects blank/uniform results. Existing tests cover the four numeric
    fields' `Searching` behavior without inventing zero values.
  - `docs/BETA_KAROO_INSTALL.md`: beta install, update, field layout and transfer guide.
- Annotated tag: `karoo-beta-0.10.42` -> commit `1eb405f`.
- Private signing material (not in Git, mode 0600):
  `/Users/frason/Documents/CS Agent Team for ChatGPT/GritMap Signing/`.
- Final tagged APK (not in Git):
  `/Users/frason/Documents/CS Agent Team for ChatGPT/GritMap Beta Builds/gritmap-karoo-0.10.42-beta.apk`.
- APK SHA-256:
  `90822e8fdf26b951852808137fb37436cd3619e0d2431f6325576a45021c7c1e`.
- Signing-certificate SHA-256:
  `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`.

## Verified

- Full Karoo JVM suite, lint and debug build:
  `JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.20/libexec/openjdk.jdk/Contents/Home ./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug`
  — passed. The suite contains 176 tests after the two beta tests were added.
- Signed/minified build from a clean detached worktree at tag `karoo-beta-0.10.42`:
  `JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.20/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/frason/Library/Android/sdk ./gradlew :app:assembleBeta -PgritmapBetaSigningProperties='/Users/frason/Documents/CS Agent Team for ChatGPT/GritMap Signing/beta-signing.properties' -PgritmapVersionCode=65 -PgritmapVersionName=0.10.42-beta`
  — passed, including R8 and beta lint-vital.
- `apksigner verify --verbose --print-certs` — v2 signature verified with one RSA-4096 signer.
- Physical Karoo clean install and upgrade — both `adb install` and `adb install -r` succeeded;
  package reports `versionCode=65`, `versionName=0.10.42-beta`.
- Physical Karoo first launch — empty Segments screen rendered, extension connected, rider FTP 280
  synced, and no fatal exception appeared in the launch log.
- Hammerhead's current official Companion guidance was checked while writing the guide: latest Karoo
  only, KOS 1.538.2049+, iPhone Companion 1.12.0+, share an APK file to Companion, then confirm
  Install on Karoo.

## External state

- Physical Karoo now runs the exact APK built from tag `karoo-beta-0.10.42`.
- The beta library is empty because Android cannot preserve private app data when moving once from
  the old debug signing key to a new beta signing key. The previous debug data was backed up at
  `/private/tmp/gritmap-karoo-prebeta-data.tar`, but a non-debug signed app cannot accept a
  `run-as` restore. Segments/plans must be resent from the phone. This one-time loss does not recur
  for future APKs signed with the stored beta key.
- The signing key and properties need a secure backup. Losing them would force every beta tester to
  uninstall before installing a later build.

## Goal alignment

- Directly serves `docs/GOALS.md` priority 1: a tagged, reproducible, upgradeable Karoo beta and a
  stranger-readable path through install, data fields and phone-to-Karoo transfer.
- H10 stays optional and explicitly experimental; GM Cardiac Drift stays the default physiology
  recommendation. Nothing here makes H10 or power a prerequisite for route matching.
- The shared transfer contract was not changed. Phone onboarding and this guide use the same names:
  **GritMap**, **Receive from Phone**, **Send plan to Karoo**, `:8734`, and a 10-minute receive window.
  No phone action is required beyond keeping that copy consistent.

## Hazards and blockers

- The APK is stored privately, not yet attached to a public/private GitHub release. Testers need the
  file delivered to them before following the guide.
- The six graphical no-input states were exercised by native-graphics Robolectric tests and the
  exact minified extension was launched/connected on Karoo. A human did not manually place all 10
  fields on physical ride pages during this pass.
- GM H10 Cardiac still needs the separate physical exercise validation already recorded in the
  product goals; it must remain advisory.
- The old pre-beta backup in `/private/tmp` is temporary and should not be considered durable.

## Next safe action

Resend one known segment and plan from the phone to the now-empty signed beta, then perform a short
recorded-ride smoke test with the recommended beta pages before distributing the APK to strangers.
