# Handoff: build 12 candidate (redesign + Karoo mark, nav, Segments page work), local only

- Updated: `2026-10-27 22:29 PDT`
- Agent: `Claude`
- Branch: `claude/redesign-foundation`
- Head: `6e04ee5 feat(segments): Efforts is the first tab on the segment page`
- Worktree: `ios/Podfile.lock` modified, not mine, never commit it. Everything else is committed.

## Outcome

Six local commits on top of the pushed tip 346b860 carry the build-12 asks. None of them is pushed; origin has only 346b860. Main is still build 8 (75427dd).

- Bare check + "Karoo" mark on the segment list, Home Sent cards and the segment page. "Older plan on Karoo" warning unchanged.
- Tab press pops that tab's stack to its list; Home last-ride card draws the segment lines overlay (these two are in the pushed 346b860).
- Ride detail: full height, bare "<" back, round course thumbnails on segment rows, a segment tap opens the segment page with that effort highlighted, match-algorithm detail hidden behind `SHOW_MATCH_DETAIL = false`.
- Segment page: Efforts is the default and first tab (order Efforts, Plan, Course); "Your results" dot chart with fastest/middle/slowest time labels and gridlines; Send to Karoo is always in the 3-dot menu and the Plan-tab Send button is gone; coach import sits in the goal card; the goal editor is a bottom sheet.
- Comparison: elevation card removed; time-in-zone as doughnuts; power and HR have a quarter-mile / detailed toggle (default quarter mile).
- Home: "Latest ride", "Pinned segment" above "Latest segments" (up to three segments with a goal or active plan and a counted effort, newest first).
- Course tab (item 9) is NOT built; proposal is option (a) for build 13.

## Changed

- bf9a054 bare Karoo mark: `src/plans/karooMarks.ts`, `planView.ts`, `SegmentCard.tsx`, `PlanTab.tsx`, `SegmentDetailScreen.tsx`, tests.
- dec2414 group A: `SegmentPageScreen.tsx`, `src/plans/segmentMenu.ts` (+ test), `PlanTab.tsx`, `AttemptComparisonScreen.tsx`, `HomeScreen.tsx`, `RidesStackNavigator.tsx`.
- 2a61adf group B: goal bottom sheet, `src/screens/ZoneDonut.tsx` + `donutArcs.ts` (+ test), `src/plans/RideSegmentRow.tsx`, `RideDetailScreen.tsx`, `src/navigation/types.ts` (`highlightAttemptId`), `src/plans/featureFlag.ts`.
- 9703058 group C: `src/plans/ResultsChart.tsx`, `resultsView.ts` (+ test), `src/comparison/binSeries.ts` (+ test), `segmentInsights.ts` (+ test), `loadSegmentInsights.ts`.
- 44fe117 results chart y-axis time labels and gridlines (`resultsView.ts` `axisTicks`, `ResultsChart.tsx`).
- 6e04ee5 tab order in `SegmentPageScreen.tsx`.

## Verified

- `npm test`: 984 tests, 960 pass, 0 fail, 24 skipped (run 2026-10-27 at 6e04ee5).
- `npm run typecheck`: clean at 6e04ee5.
- iPhone 17 simulator (Release build, test data): tab reset to list, Home segment-line overlay, Home order and labels, ride detail full height with bare back, round thumbnails, ride to segment highlight, 3-dot menu, Efforts-default segment page, results chart with time labels.
- NOT seen on screen (typecheck and unit tests only): goal bottom sheet, doughnuts, quarter-mile toggle, Latest segments, Plan tab, the bare Karoo mark on list / Home / segment page, the thumbnail border, and the Efforts-first tab order (6e04ee5). The simulator has no FTP/power data or a valid send.
- No device run. No native build or TestFlight upload was made.

## External state

- Origin has `claude/redesign-foundation` at 346b860 only. Build 11 is installed on Jason's phone.
- Simulator iPhone 17 (694299A2-AD95-4A4D-99C0-9F682C34DEE6) holds fabricated efforts (sim-att-1..4) in its own DB; not in the repo.
- The coordinator (`local_7c51e619-0821-451c-bebc-310243afe06b`) has not been told about 44fe117 or 6e04ee5.

## Goal alignment

- Redesign track on the phone app (`docs/GOALS.md` beta polish); no shared contract touched (segment JSON, `gritmap-transfer`, coach plan, profile, pairing all unchanged). Karoo side needs no action.

## Hazards and blockers

- Push of bf9a054..6e04ee5 needs Jason's own chat yes; a peer cannot approve. Push only `claude/redesign-foundation`, no force.
- A `plan_sends` row with `plan_json='{}'` crashed the app on launch in the simulator (my invalid test data); the crash path was not investigated.
- Never `git add` `ios/Podfile.lock`.
- Build 12 also needs the BLE sender work, which this branch does not include.

## Next safe action

Get Jason's yes to push `claude/redesign-foundation` (tip 6e04ee5), tell the coordinator about 44fe117 and 6e04ee5, then do a device pass starting with the unseen items listed under Verified.
