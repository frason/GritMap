# Handoff: first public Karoo beta release published and independently verified

- Updated: `2026-10-09 12:24 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `8959916 fix: avoid removed Android SDK tools package`
- Worktree: `clean`

## Outcome

GitHub Actions successfully published `GritMap Karoo 0.10.43 beta` with a stable
`gritmap-karoo.apk` asset and `SHA256SUMS.txt`. The public APK was downloaded again from GitHub and
independently verified for checksum, package version, and the persistent GritMap Beta signing
certificate.

## Changed

- Commit `8959916` stops `android-actions/setup-android` from requesting Google's removed `tools`
  package; it installs only `platform-tools`, followed by the workflow's exact SDK/NDK/CMake list.
- The failed tag was deleted and recreated at `8959916`; the corrected tag is
  `karoo-beta-0.10.43`.

## Verified

- Corrected Actions run `37979085132` passed every step: environment setup, tag/version validation,
  signing-secret restoration, tests/lint/signed minified build, signature/package verification,
  artifact upload, and GitHub release publication.
- Public release: `https://github.com/frason/GritMap/releases/tag/karoo-beta-0.10.43`.
- Public APK: `https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk`.
- GitHub asset digest: `sha256:1f0d298f218d445b03596bb429a02f15e86c266058303b208ecda2f684ba9254`.
- Downloaded `SHA256SUMS.txt` validates the downloaded APK.
- APK reports `com.gritmap.karoo`, code 66, `0.10.43-beta`.
- Signing certificate SHA-256 remains `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`.

## External state

- GitHub repository secrets are configured and worked; their values were never printed or committed.
- Release is public, non-draft, and deliberately not marked GitHub prerelease so `/releases/latest`
  remains a stable Hammerhead Companion link.
- No physical Karoo installation from the public asset has been attempted yet.

## Goal alignment

- Completes the public-distribution portion of `docs/GOALS.md` priority 1 for the Karoo beta.
- No shared phone/Karoo contract changed.

## Hazards and blockers

- The CI-built APK hash differs from the earlier locally built candidate, which is expected from
  non-reproducible Android release metadata; both use the same source version and persistent signing
  certificate. The GitHub checksum is authoritative for the public artifact.
- Hammerhead Companion installation from the public URL still needs one physical Karoo 3 test.
- Real screenshots and the external TestFlight public link remain pending.

## Next safe action

Open the stable APK URL on a paired phone, share it to Hammerhead Companion, install it as an
in-place update on Karoo 3, and confirm version `0.10.43-beta`, existing data retention, and field
previews before inviting other testers.
