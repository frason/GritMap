# Handoff: Phone build 19 in TestFlight and installed (flag off)

- Updated: `2026-11-04 16:32 PST`
- Agent: `Claude`
- Branch: `claude/gritmap-product-alignment-558542`
- Head: `5331cdf docs: phone build 19 cut from 540cd1f (flag off), pending TestFlight confirmation`
- Worktree: clean (phone repo: nothing uncommitted)

## Outcome

iOS build 19 (version 1.0.0) is in TestFlight and installed on Jason's iPhone. Open Segments account flag is OFF: no sign-in, Liked or publishing, only dormant client code.

## Changed

- Built by Jason from commit `540cd1f7d049af90c891f115c7d4e6faee833a2e` (branch `phone-build18` = `548de1c` + comment-only scrub commit). EAS build `54a5bd6e-057b-407e-92e5-42f1130a1c97`, production profile, SDK 57.0.0. Build 17 was `86bae63f`; number 18 was skipped (cause not checked).
- Contents: map previews follow light/dark, segment cards show maps, power meter + HR requirement line.

## Verified

- Phone session, fresh worktrees at that commit: clean tree, no `image` key in eas.json, Podfile.lock identical to c96ff10, plutil OK, flag false, no native/config diff vs build 17, tsc clean, npm test 1234 pass / 0 fail / 24 skipped, Swift script 128 ok, identity scan only the handle lines. Nothing rerun after the build started.
- Jason confirmed build 19 in TestFlight and installed. Behaviour on device not yet reported by him.

## External state

- Jason ran the build and the `eas submit` himself; added to the internal group by hand.
- Phone branches `phone-build18`, `phone-liked-segments` (84d43b5, not in build), `phone-build13` are local only, not pushed.

## Goal alignment

- Phone release track; no shared contract touched (flag off).

## Hazards and blockers

- Known issue: Rides/Segments lists can rarely stop responding to taps; restarting the app fixes it. Cause unproven, fix deferred.
- Sign-in/Liked wait on Open Segments Codex items (hosted likes release, native sign-in plan and security review, safe publish test mode).

## Next safe action

Jason tries build 19 on his iPhone and reports problems; then push the phone branches only with his yes.
