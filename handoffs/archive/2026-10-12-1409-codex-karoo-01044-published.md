# Handoff: Karoo 0.10.44 published and independently verified

- Updated: `2026-10-12 14:09 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `ca6ea4f build(karoo): bump beta version to 0.10.44`
- Worktree: clean and synchronized with `origin/main`

## Outcome

Karoo `0.10.44` is committed, tagged, pushed, and published as a signed GitHub release. The stable
README/install-guide URL now resolves to the human-readable `gritmap-karoo.apk` asset. Local main
was rebased onto the nine incoming GitHub commits without conflicts; the remote screenshot paths
and the preserved direct-link Companion installation guidance are both present.

## Changed

- Rebased the eight local commits onto `origin/main` and pushed the reconciled history.
- `534db4d docs: clarify Karoo Companion update install` preserves the direct-link sideloading
  guidance and uses the stable latest-release asset URL.
- `ca6ea4f build(karoo): bump beta version to 0.10.44` changes Gradle defaults to version name
  `0.10.44` and version code `67`.
- Annotated tag `karoo-beta-0.10.44` resolves to `ca6ea4f`.
- GitHub release: `https://github.com/frason/GritMap/releases/tag/karoo-beta-0.10.44`.

## Verified

- Before pushing, the rebased `apps/karoo` tree was byte-for-byte identical to the originally
  reviewed source commit.
- Local default-version `:app:assembleDebug` passed.
- Corrected GitHub workflow `38308093435` completed successfully in 6m40s:
  tag/version validation, signing identity restoration, tests, lint, signed/minified build,
  asset verification, artifact upload, and GitHub release publication all passed.
- Release asset `gritmap-karoo.apk`: 3,864,825 bytes, SHA-256
  `6b07e5151581c4d1996ef579f12812a6c32ee0409369c8b1f5c899283e5e1af5`.
- `SHA256SUMS.txt` was also published.
- Repository was clean and `main` matched `origin/main` before this handoff-only update.

## External state

- Public release `karoo-beta-0.10.44` is live.
- Stable install URL:
  `https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk`.
- Physical Karoo already had an earlier locally built `0.10.44-beta`/67 installed; the public APK
  has not yet been installed over it through Hammerhead Companion.

## Goal alignment

- Completes the reproducible, tagged, publicly installable Karoo beta requirement in
  `docs/GOALS.md` before starting further Karoo Bluetooth work.
- No direct-BLE v2 Karoo implementation was added during release reconciliation.

## Hazards and blockers

- The first workflow run `38307707410` failed safely before building because the tag/version guard
  detected the stale Gradle default. It published no release. The corrected run is the authoritative
  one.
- GitHub emitted maintenance warnings about Node 20 actions, `setup-java@v4`, and the future
  `ubuntu-latest` migration. They did not affect this release but the workflow should be updated
  separately.
- Physical installation of the public asset remains a useful final smoke test; install in place and
  do not uninstall, so segments and settings are preserved.

## Next safe action

Install the stable public `0.10.44` APK over the existing extension through Hammerhead Companion,
confirm segments/settings remain, then begin the direct-BLE v2 contract review before modifying the
Karoo receiver.
