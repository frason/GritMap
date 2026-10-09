# Handoff: public Karoo beta distribution and tester README prepared

- Updated: `2026-10-09 11:33 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `2dad59a docs: prepare public Karoo beta distribution`
- Worktree: `clean`

## Outcome

The repository now has a public beta landing page covering the Karoo 3 extension, Hammerhead
Companion/ADB installation, five data-field screenshot placeholders, and a safe request path for
the future iPhone TestFlight external group. A tag-driven GitHub Actions workflow can test, lint,
sign, verify, checksum, and publish the Karoo APK with a stable asset name.

## Changed

- Commit `2dad59a`.
- Added root `README.md`.
- Added `.github/workflows/karoo-beta-release.yml` for `karoo-beta-*` tags.
- Added `docs/KAROO_BETA_RELEASE.md` with required secrets and release procedure.
- Added screenshot instructions and five SVG placeholders under `docs/screenshots/karoo-fields/`.

## Verified

- Workflow YAML parses successfully.
- All five placeholder SVG files pass `xmllint --noout`.
- All local README targets exist.
- Workflow version extraction returns `0.10.43` / code 66 from the current Karoo build.
- `git diff --check` passed before commit.
- The GitHub workflow has not run because no tag was pushed and repository signing secrets are not configured yet.

## External state

- No GitHub release, tag, signing secret, or TestFlight group was created.
- Existing signed local `0.10.43-beta` candidate remains unchanged.

## Goal alignment

- Serves `docs/GOALS.md` priority 1: a reproducible beta-ready Karoo distribution and clear
  onboarding for strangers; also exposes the iPhone TestFlight recruitment path.
- No shared phone/Karoo contract changed.

## Hazards and blockers

- GitHub Actions requires four repository secrets before the first tag: keystore base64, store
  password, key alias, and key password.
- The TestFlight external group/public link is not live; the README currently routes volunteers to
  a prefilled GitHub issue and warns them not to post private Apple account details.
- Placeholder images must be replaced with privacy-reviewed physical Karoo screenshots.
- The workflow is syntactically checked but cannot be end-to-end proven until its first tagged run.

## Next safe action

Configure the four Actions secrets, push commit `2dad59a`, then tag and push
`karoo-beta-0.10.43`; inspect the workflow and test the resulting public APK through Hammerhead
Companion before sharing it with testers.
