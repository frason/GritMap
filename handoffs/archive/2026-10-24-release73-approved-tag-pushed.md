# Handoff: exact release approved; tag pushed and Actions running

- Updated: `2026-10-24 (client session date)`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-release-73`
- Head: `8bde298 docs: present rebased Bluetooth beta73 release evidence`
- Worktree: documentation-only release progress record

## Outcome

Jason explicitly approved tagging/publishing the exact presented release. Annotated tag karoo-beta-0.10.45 was created at0e95e8443c5bdfd1f4ed0e8ddfd8224cf697f292 and pushed. Actions is running at that exact source; publication not yet verified.

## Changed

- Git tag karoo-beta-0.10.45 created/pushed; no runtime source changes.
- LATEST and this archive record approval and active operation.

## Verified

- Tag absent remotely before push; clean isolated release branch; GitHub authentication available.
- gh run list --commit confirms run40073513782, Karoo beta release, headSha0e95e8443c5bdfd1f4ed0e8ddfd8224cf697f292, in_progress.
- Workflow https://github.com/frason/GritMap/actions/runs/40073513782.
- Approved local normal APK version0.10.45-bluetooth-beta/code73, SHA256c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e. Prior263+2 tests/lint/build/signature/flag and physical evidence in previous release-evidence archive unchanged.

## External state

- Exact approved annotated tag is on origin. No new device installation; installed normal73 remains unchanged.
- CI may publish after successful build; do not start a duplicate release or retag. Run status must be checked before claiming public release complete.

## Goal alignment

- GOALS priority1 approved Bluetooth beta release. Plan requirement documented; plan-free Bluetooth/PR later.

## Hazards and blockers

- CI-generated APK/hash/signature/version/flags not yet independently verified. Diagnostic artifact must never be published.
- Stable Companion URL/install/retained-data validation remains pending before wide invites.
- Known gaps unchanged: full-radio restart recovery unresolved; H10 coexistence waived, RR export unfinished.

## Next safe action

Wait for run40073513782 completion, inspect failures if any, verify public release asset and stable latest download URL, verify downloaded APK signature/version/hash against published checksums and approved source, then record actual outcome. Coordinate Companion Share Link installation with Jason after presenting exact public artifact; no duplicate release or tag movement.
