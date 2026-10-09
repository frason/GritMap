# Handoff: Attempt Review and Attempt Comparison on the design system; cross-tab Back-button fix (committed locally, not pushed)

- Updated: `2026-10-08 21:55 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `cbec882 feat: Attempt Review and Attempt Comparison on the design system` (handoff committed on top)
- Worktree: clean for phone files; `apps/karoo/*` and `fixtures/` untouched.

## Outcome

- **Compare Efforts** (`AttemptComparisonScreen`): the two efforts are named at the top ("This effort", "Compared with", each with date and time) and each opens a sheet to swap it for
  another confirmed effort on the segment (the other effort is marked "already chosen"). A sentence says who finished ahead ("You finished 1:43 ahead of the other effort."). The time-gap chart
  is titled **Ahead or behind** with a plain explanation (above zero = behind, below = ahead, a break in a line = no data); Power/Heart rate/Elevation say "This effort" vs "Other effort"; missing data
  shows as line gaps and a plain "No power was recorded in either effort." Zone bars use one hue getting stronger with the zone number (the old fixed hex colours are gone). Loading, missing and error states.
  Every chart is one VoiceOver element with a spoken summary (averages for power/heart rate, the finish gap for time gap) via a new `ChannelChart.summary`.
- **Review Effort** (`AttemptReviewScreen`): segment name, date, time, source file; a status note ("Needs your review. GritMap isn't sure this ride followed the whole segment...");
  the map; "Why GritMap isn't sure" with plain sentences for each reason; "How well it matched" with renamed, explained rows (Match, **Route followed** (was Coverage), **Furthest off the route** (Max
  deviation), **Usually off the route by** (Median deviation), **Backtracking** (Backward movement), **GPS dropouts**, **Longest dropout**); "Matcher version" is now a quiet footnote ("match analysis version 3").
  **Confirm this effort** and **Remove this effort** each say what they do; removing asks for confirmation in the screen (not a native alert). 44 pt buttons, all `AppText`.
- Wording/titles: "Review Attempt" -> "Review Effort", "Compare Attempts" -> "Compare Efforts", "Compare two attempts" -> "Compare two efforts", Reject -> Remove. "zones" wording untouched (hold); "Power zones", "Heart-rate zones", "Z4 97%" are unchanged.
- `describeAttemptMatch.ts` / `describeComparison.ts` (+ tests) hold the wording and summaries so they are unit-tested.

## Bug found and fixed (separate commit `c6808dd`)

Opening a segment, effort or comparison from **Home** (and from Import, Ride detail, and after saving a new segment) made that screen the only one in its tab: **no Back button**, and tapping the tab again did not
reset it, so a rider could be stuck on Compare/Review with no way to the segment list. All cross-tab `navigate("SegmentsTab"|"RidesTab", { screen })` calls now pass `initial: false`. Verified: Home > Compare best attempts now shows
"< Segments" and goes back to the segment list. (This also explains the earlier screenshot of a freshly saved segment with no Back button.)

## Behavior changes beyond restyling

- The back-button navigation fix above. Reject's native alert became an in-screen confirmation (same two outcomes). Confirm is hidden for an effort you already approved (it did nothing). An accepted effort's Confirm text says it
  locks the effort in. Everything else (confirm/reject DB calls, comparison maths, zone breakdown) is unchanged.

## Verified

- `npx tsc --noEmit` clean; `npm test` 628/628 (new tests for the wording/summaries); `npm run web:smoke` clean.
- Simulator, demo data (Diablo registry route, synthetic efforts). To show a borderline review I temporarily made one demo effort borderline with two reasons in the simulator DB, then restored it (3 accepted efforts again).
  Screenshots `docs/screenshots/attempts/{before,after}/`: comparison default and largest text, picker, charts; review default, middle, actions, remove-confirm, largest text. Before shots show the old clipped layout at largest text.
- **Not run:** VoiceOver by a person; the loading/error states on device; the empty "don't overlap enough" state.

## External state

- Simulator DB restored to demo data. Nothing pushed; local unpushed commits: `be21320`, `3b3e590`, `078e131`, `854e224`, `ba8419e`, `d4aa1af`, `8e66df4`, `4106a8e`, `8ea294c`, `d033cc2`, `c6808dd`, `cbec882` (+ this handoff).

## Goal alignment

- `docs/GOALS.md` Priority 1 (beta-loop screens meet design practice; Home's main button now lands on a compliant screen), and groundwork for Priority 5/6. No shared contract touched.

## Hazards and blockers

- The map on Review Effort rendered blank on the first open once (it rendered on re-entry); the MapLibre view can race with the screen push. I did not find the cause (the same screen had rendered it before my change).
- Segment Detail's "Compare two efforts" still says "Select two efforts (n/2)" etc.; wording only.
- Rides list rows and a few older components still use raw `Text` (no live text-size reflow there).
- Still no VoiceOver pass by a person.

## Next safe action

Jason answers the pending decisions (fixtures in the public repo, Open Segments sharing) and OKs pushing; then a VoiceOver pass on a real iPhone, and migrate the Rides list rows.
