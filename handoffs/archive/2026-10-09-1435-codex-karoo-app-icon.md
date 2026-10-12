# Handoff: approved GritMap icon installed on the Karoo

- Updated: `2026-10-09 14:35 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `c1866fb docs: record first public Karoo beta release`
- Worktree: uncommitted Karoo launcher-icon resources and manifest change, plus the previously uncommitted `README.md` and `docs/BETA_KAROO_INSTALL.md` release-link edits

## Outcome

The Karoo launcher now uses Jason's approved dark bike-and-arrow GritMap artwork. The existing
single-color extension glyph remains in place for notifications and Karoo data-field selectors.
A signed beta APK was installed in place on the connected Karoo, preserving app data, and GritMap
was reopened so the launcher can refresh the icon.

## Changed

- `apps/karoo/app/src/main/AndroidManifest.xml` now points `android:icon` and `android:roundIcon`
  to the launcher mipmaps.
- `apps/karoo/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/` contains launcher and
  round-launcher exports derived from the approved 1024 px artwork in Claude's product-alignment
  worktree commit `98e7a58`.
- No shared phone/Karoo transfer contract changed.

## Verified

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew :app:lintDebug :app:assembleDebug` — passed.
- Signed/minified `:app:assembleBeta` with the local persistent beta signing properties — passed.
- `adb install -r app/build/outputs/apk/beta/app-beta.apk` — `Success` on Karoo
  `00442GA241760203`; installed package remains code 66 / 0.10.43.
- GritMap was force-stopped and relaunched after installation.

## External state

- The physical Karoo has the signed icon update installed in place.
- This local APK is not a new public GitHub release; the public 0.10.43 asset still predates the
  icon change.

## Goal alignment

- Serves the public beta/distribution track by replacing the placeholder launcher identity.
- No shared JSON, pairing, plan, rider-profile, or transfer schema changed.

## Hazards and blockers

- Changes are not committed yet.
- The public beta APK does not receive the icon until these changes are committed and a newer
  release tag is published.
- Android launchers can cache icons briefly; reopening or returning to the app grid refreshes it.

## Next safe action

Visually confirm the icon in the Karoo app grid, then commit the icon resources and publish them in
the next beta release rather than overwriting the immutable 0.10.43 release.
