# Handoff: map first-open guard, real ride fixtures untracked, "sections" wording (committed locally, not pushed)

- Updated: `2026-10-09 00:50 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `c60efc4 fix: call the stretches of a pacing plan sections, not zones, in rider-facing text` (handoff committed on top)
- Worktree: clean for phone files; the temporary map-test harness in `App.tsx` was reverted. `apps/karoo/*`, `eas.json`, `app.json` untouched.

## 1. Blank map on first open

**Not reproduced under controlled conditions; a defensive fix is in.** Plainly:
- Cold launch of a Release build straight to each screen (deep link) and after a push, 10/10 for Review Effort; re-installing the app from scratch (empty map cache) before every launch, 4/4; clearing the cache before each
  launch, 20/20 (with 6 to 20 s waits). **Before-fix repro rate at normal machine load: 0 of about 46 cold opens.**
- The blank/partial renders were seen **only while the Mac was under very heavy load** (load average 50 to 90 from a concurrent Xcode build, right after installing the app): 7 of 8 cold launches were not fully drawn at 9 s (a white map box with no
  MapLibre logo on Review Effort, a basemap-less grey hero on Segment Detail, once a fully white screen). That matches the one blank I saw in the dev client. A harder synthetic load (40 busy loops) saturated the machine (load 160+), so the
  app itself would not start in time; that run was inconclusive and I stopped it.
- Likely mechanism (from the code): the native map was created as soon as the screen mounted, and the camera fitted the route once, at creation, to whatever size the view had at that moment (0 x 0 while a screen is still sliding in or on a loaded device);
  nothing refitted it, and a style that was slow or failed to load left it blank for good. `RouteMapView` also swapped between two different trees for an empty and a filled route.
- Fix (`RouteMapView.native.tsx`, shared by every map; no per-screen retries): the native map is created only after the first non-zero layout; the camera is refitted (no animation) when the style has finished loading and when the route or view size changes; a map whose style
  has not loaded after 10 s, or that reports a load failure, is rebuilt (at most twice); one component tree for empty/filled; pins render only once sized.
- **After-fix, normal load, every map on a fresh install (empty cache), 3 times each, checked at 6, 12 and 20 s: 15/15 rendered fully at 6 s** (Segment Detail hero, Ride Detail, Define Segment, Review Effort by cold deep link, Review Effort pushed from Segment Detail). Compare Efforts has no map.
  First-open screenshots: `docs/screenshots/map-first-open/`. The scoring script and raw runs are in the scratchpad, not committed.
- **Caveat:** I could not run a before/after comparison under identical heavy load, so the fix is justified by the mechanism and by not regressing normal load, not by a measured drop from a reproduced failure.

## 2. Real ride fixtures untracked (history not rewritten)

- The 6 FITs and the GPX are removed from the index and git-ignored (`fixtures/fit/*.fit`, `fixtures/gpx/*.gpx`); they remain on disk. `git ls-files fixtures` now shows only `.gitkeep` and `README.md` (README says real rides are local-only).
- The six tests that read them (`parseFitFile`, `parseGpxFile`, `batchImport`, `fitIdentity`, `importRideFile`, `matcher/realSegments`) use `skipUnlessPresent` (`src/testSupport/realFixtures.ts`) and report "N of M real ride fixtures not present (local-only, see fixtures/fit/README.md)".
  Added always-on synthetic coverage using the tracked `docs/beta-review-sample-ride.gpx` (parse + import + duplicate detection).
- `npm test`: **630/630 pass with the files present; 606 pass, 24 skipped, 0 fail with them moved away.** Typecheck and `web:smoke` clean.
- **Commit-message slip:** the fixture deletions were already staged when I committed the map fix, so they landed in `9283e38` ("fix: build the native map only once...") rather than in `5bf44a4` ("chore: stop tracking real ride fixtures..."). The content is right; only the message of `9283e38` is incomplete.
  I could not split them afterwards (a `git reset` was blocked), so tell Jason if he wants them reordered before pushing.
- **Still true:** the earlier commits with the real files remain in history and the repository is public. Rewriting history is a separate decision.

## 3. "Sections" wording (Jason's decision; the hold is lifted)

Sections = stretches of a pacing plan. Zones = power / heart-rate training zones only. Changed (`c60efc4`): the coach-plan validation messages and the share request. The screens already said "section(s)" from earlier work. **Exact rider-facing strings** for Codex to match on the Karoo:

- Segment Detail: "Goal and pacing plan"; `{n} sections · about {W} W on average ({pct}% of your FTP)`; "GritMap's plan: about {W} W on average ({pct}% of your FTP), adjusted for each section's gradient."; "Your pacing plan laid over the climb, one column per section."
- Plan chart: "The number above each column is that section's target power in watts. Scroll sideways to see the whole segment."; legend "Rest: ease off", "Hold: steady", "Push: ride harder"; spoken: "Pacing plan chart over the elevation profile: N sections, target power from X to Y watts."; "Elevation profile, A to B metres, N sections."
- Plan vs actual: "Sections on target", "Power by section", "Each bar is one section of the segment: the power you rode, against the plan's target.", "Section detail", row label "Section N, a–b m. {Over plan|Under plan|On target|No power data}…", note: `"Time" is gained (−) or lost (+) in that section against your best other attempt, from {date}.`, spoken chart: "Bar chart of power per section, N sections…".
- Coach plan import preview: `{n} sections · avg {W} W ({pct}% of your FTP) · {min}–{max} W`.
- Coach plan messages (new): `"zones" (the plan's sections) must be a non-empty list`; `The plan has {n} sections; the maximum is 200`; `section {n} must be an object`; `section 1 must start at 0 m (starts at …)`; `section {n} starts at … but section {m} ends at … (gap|overlap)`; `the sections cover … but the segment is …`; `section {n} must end after it starts`; `sections {a} and {b} differ by {X} W; the Karoo accepts at most 100 W between neighbours`; `Ignored unknown section field "{key}"`.
- Share request to a coach/AI: "Grade by section:", `"zones" lists the plan's sections. They must run in order from 0 m to exactly {m} m with no gaps or overlaps.`, "Each section has either "targetPowerWatts" or "targetPercentFtp"…", "Neighbouring sections may differ by at most 100 W.", "Optional per section: "classification" (REST, HOLD or PUSH) and "instruction"…".
- **Unchanged and still correct:** training zones: "Power zones", "Heart-rate zones", "Time in each zone", "Z1".."Z7", "Your Profile" copy about heart-rate zones.
- **Wire/contract unchanged:** the JSON key and Karoo wire fields stay `zones` / `CoachPlanZone`; documented in `docs/COACH_PLAN_CONTRACT.md` ("Wording"). Codex: check any Karoo label, field or `docs/BETA_KAROO_INSTALL.md` text that calls plan stretches "zones".

## Verified

- `npx tsc --noEmit`, `npm test` (630/630 present; 606 + 24 skipped absent), `npm run web:smoke`: clean. Map runs described above on an iPhone 17 Pro simulator with a Release build and demo data.

## External state

- A second simulator (iPhone 17 Pro) holds a Release test build with a temporary deep-link harness (not in the repo); safe to delete. Metro running for the main QA simulator. Nothing pushed; unpushed local commits include `9283e38`, `5bf44a4`, `c60efc4` on top of `178b532` (+ earlier ones if not yet pushed).

## Goal alignment

- `docs/GOALS.md` Priority 1 (strangers' first-open experience; repository hygiene for the public repo: "never commit personal GPS data"), and the Karoo/phone vocabulary alignment (sections vs zones). Shared contract: coach plan and wire names unchanged; wording only. Codex must align Karoo-side strings.

## Hazards and blockers

- The map fix is not proven against a reproduced failure (see caveat). If blank maps are still reported, capture MapLibre `onDidFailLoadingMap` events (the rebuild path is the place to log).
- Real ride files remain in public git history.
- `9283e38`'s message omits the fixture removal.

## Next safe action

Jason decides on history rewrite for the fixtures and OKs pushing; Codex aligns Karoo strings with the list above; a person runs VoiceOver on a real iPhone.
