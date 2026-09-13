# Handoff: Phone MVP screens complete; real-route matcher issue flagged; Karoo UI in progress

- Updated: `2026-08-25 09:00 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a74752d docs: hand off advanced review + comparison screens (#11, #13)`
- Worktree: substantial uncommitted work remains under `apps/karoo/`; preserve it. Claude's phone matcher/screens work is committed and did not touch the Karoo files.

## Outcome

Claude completed the matcher-trigger wiring plus the advanced review and attempt-comparison screens. Every screen required by `docs/MVP.md` now has an implementation. Concurrently, Codex has been iterating the Karoo graphical fields, most recently the large W′ Power Balance design. The latest Power Balance revision is built and tested but was not installed because the Karoo disconnected.

## Changed

- Commit `f945754`: importing/replacing a FIT ride scans every segment; creating a segment scans every ride; accepted/borderline matches persist idempotently.
- Commit `041c5cf`: attempt diagnostics, confirm/reject workflow, route overlay, attempt list, and matcher rerun action.
- Commit `7e9c2eb`: two-attempt selection and distance-aligned SVG charts for time gap, power, HR, and elevation.
- Commit `a74752d`: Claude handoff for #11/#13.
- Uncommitted Karoo work includes W′ estimation, cardiac drift, responsive graphic fields, stable light/dark palettes, and iterative Power Balance rendering.
- Latest uncommitted Power Balance renderer:
  - fixed-color horizontal `YOU` battery with PLAN/RIDE flow model;
  - chevrons use a monotonic animation phase rather than battery percentage;
  - active routes illuminate blue over dim inactive routes;
  - plan and actual reserve levels use separate marker/leader labels;
  - REST/HOLD/PUSH banner and framework-neutral W′ state remain deterministic.
- A simplified large-field readability layout was discussed but has **not** been implemented yet; current renderer is preserved as the fallback.

## Verified

- Claude phone work: 170 tests pass, `npm run typecheck` clean, and `npm run web:smoke` succeeds.
- Claude exercised the matcher/review/comparison data pipelines against copies of the real live SQLite database.
- Latest Codex Power Balance revision: focused renderer test plus debug APK assembly succeeded (`BUILD SUCCESSFUL in 1m 54s`).
- Earlier monotonic chevron phase fix: focused W′ engine/renderer tests plus APK assembly succeeded (`BUILD SUCCESSFUL in 1m 16s`).

## External state

- `origin/main` is 16 commits behind local `main`; these commits are not pushed.
- Phone UI added `react-native-svg`; a new native device/simulator build is required before visual verification.
- Live phone database still has zero naturally produced `segment_attempts` rows.
- Karoo was disconnected at the latest install attempt. Last confirmed installed package was version 0.8.2/versionCode 13 at `2026-08-24 21:13:28`; the active-route/dual-marker build exists at `apps/karoo/app/build/outputs/apk/debug/app-debug.apk` but is not installed.

## Hazards and blockers

- **Matcher issue to track:** running the real orchestration against the real Morning Climb segment and its 8.5k-point source ride found two candidates, but both were rejected as `backward-progress` / `reverse-traversal`. This may be legitimate geometry near a loop/hairpin, an incorrect reference direction, candidate-window selection, or an overly brittle progress rule. Do not loosen the documented 30 m backward tolerance without first inspecting the candidate slices, projected-progress trace, reference direction/fingerprint, and diagnostic reasons. The synthetic accept/persist path passes, but natural real-data acceptance is not yet demonstrated.
- The new phone screens have not been exercised through real touch flows, and comparison gap rendering has not been visually observed.
- Power Balance remains an uncommitted design iteration. CP=95% FTP, W′=20 kJ, and tau=546 s are estimates pending phone-supplied values.
- The current large Power Balance screenshot still has hierarchy/readability problems; the proposed next pass would remove redundant large-layout RemoteViews text and let the bitmap own a simpler comparison hierarchy.
- Preserve all unrelated and pre-existing uncommitted files.

## Next safe action

For Claude: create or prioritize a narrowly scoped real-route matcher diagnostic task before threshold tuning—capture candidate point ranges and projected-progress traces for Morning Climb, verify segment direction, and determine whether the rejects are correct. Separately, rebuild the phone app with `react-native-svg` and visually exercise review/comparison flows. For Codex: reconnect Karoo, install the already-built active-route APK, then continue the reversible large Power Balance readability pass.
