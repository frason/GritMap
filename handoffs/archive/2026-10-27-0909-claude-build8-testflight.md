# Handoff: build 8 is in TestFlight (internal group TG), installed by Jason

- Updated: `2026-10-27 09:09 PDT`
- Agent: `Claude`
- Branch: `handoff-build8-shipped` (docs only; build was made from `origin/main` 9369ff4)
- Head: `9369ff4 docs: next Codex task is receiver gating, parser, fixtures and replanner validation` (+ this handoff)
- Worktree: clean apart from this handoff

## Outcome

iPhone build 8 (version 1.0.0, build number 8) is built, uploaded to App Store Connect and installed by Jason from TestFlight as a member of internal group TG. Bluetooth is on by default; the Wi-Fi/IP route is a fallback inside Send to Karoo. Testers need Karoo extension 0.10.45 (version code 73) or newer.

## Changed

- No code changed for the release. Source = `origin/main` 9369ff4; its only difference from 75427dd (build 8 polish, 215b34b content) is `handoffs/LATEST.md`. The redesign branch is not included.
- EAS build: profile `production` (same as build 7), remote buildNumber 7 -> 8 via autoIncrement. https://expo.dev/accounts/gritmap/projects/gritmap/builds/8065f64f-b63c-4ce3-8bc9-c962a55e923b

## Verified

- Clean worktree at origin/main: `tsc --noEmit` clean; `npm test` 764 tests, 740 pass, 0 fail, 24 skipped (need Jason's git-ignored ride files).
- Upload content: `.easignore` leaves out docs/, handoffs/, fixtures/, apps/, state/, android/; `git grep` over the uploaded paths found no identity strings, emails, keys or fine-grained coordinates. Upload was 27.7 MB.
- Jason confirmed on his iPhone that build 8 installed from TestFlight and he is in group TG.
- NOT verified by me: the polish layouts on the simulator (Mac was overloaded), real Bluetooth send, 30 s older-Karoo hint, permission prompt, FIT import, no-power screens, upgrade-from-build-7 data, dark mode/large text/VoiceOver. These are the 12-point device checklist for Jason.

## External state

- EAS submission `644bc791` (https://expo.dev/accounts/gritmap/projects/gritmap/submissions/644bc791-2ff0-47a9-8d84-5fa48384fccc) shows `errored`: EAS_TESTFLIGHT_GROUPS_NOT_FOUND for group "TG". The binary still reached TestFlight; Jason added it to TG by hand. Do not resubmit build 8.
- Not submitted for external/public review. Build 7 is still the external-review build.
- Local worktree `wt-release` and branches `release-build8`, `build8b` exist under the session scratchpad; `build8b` commits d96c7e6/215b34b are content-equivalent to what shipped via main.

## Goal alignment

- docs/GOALS.md priority 1 (direct Bluetooth to beta riders). No shared contract changed. Karoo side needs nothing new; the Karoo labels in the copy match the 0.10.45 tag.

## Hazards and blockers

- git history still contains earlier personal values (forward-scrub only; force-push rewrite not approved).
- Hardware gates still open: reconnect/resume, second central refused, H10 coexistence, MTU/timing on the Karoo.
- Group name for future `eas submit --groups` is not "TG" as EAS sees it; use the exact App Store Connect name or add the group by hand.

## Next safe action

Jason runs the device checklist on build 8 and reports results; then decide external TestFlight review. Next phone task after that: FIT file in the iOS share sheet (native build, branch from main).
