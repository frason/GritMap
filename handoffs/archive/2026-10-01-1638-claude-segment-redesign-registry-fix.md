# Handoff: Strava-style segment screen + registry token-UI fix (verified live)

- Updated: `2026-10-01 16:38 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `cbd23a1 feat: phone-side pacing-plan generator + rider-profile transfer` (this
  increment's own changes are NOT yet committed -- see Changed below)
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` remain under
  concurrent Codex work (several Karoo dashboard/field iterations landed since the last
  handoff -- see `handoffs/archive/2026-10-01-claude-pacing-plan-plus-codex-karoo-updates.md`
  for the full list) -- untouched by this increment, as throughout this whole session.
  `handoffs/LATEST.md` had been substantially rewritten by Codex (retitled, re-attributed to
  "Codex + Claude", four Karoo sections prepended) since this session's own prior handoff;
  that combined content was archived verbatim to
  `handoffs/archive/2026-10-01-claude-pacing-plan-plus-codex-karoo-updates.md` before being
  replaced by this handoff.

## Outcome

Jason shared a Strava segment-detail screenshot and asked for a similar layout, then gave
three rounds of live feedback as it was built out -- each addressed in the same increment
rather than deferred:

1. Initial redesign: hero map, title + elevation sparkline, a Distance/Elevation Gain/Grade
   stat row (replacing the old Distance/Corridor/Coverage row -- those are internal
   matching-algorithm parameters, not rider-facing stats), and a "Your Efforts" summary
   (most recent, personal record, result count, an "analyze effort" preview) above the
   existing full Attempts list.
2. Feedback: needed an actual place to set the goal and see the generated pacing plan (not
   a blind send button), a bigger dedicated elevation view with the quarter-mile breakdown,
   and an explicit answer for where Send to Karoo/Registry landed. Added a real inline
   "Goal & Pacing Plan" section (editable goal, computed zones using the already-built
   `powerDurationAnchor.ts`/`computeZoneGrades.ts`/`buildTargetPowerZones.ts`) and a new
   `ElevationProfileChart` that doubles as the pacing-plan visualization (zone-colored bands
   with target watts once a plan exists, plain elevation + quarter-mile ticks otherwise).
3. Feedback: "I can't reenter the text field" (a real regression -- saving a goal removed
   the only way back into the editor, no "change" affordance existed) plus a request to
   move Send to Karoo/Registry into their own leaf screens behind a three-dot overflow menu
   with more explanation. Fixed the regression (added a "Change"/"Cancel" pair, matching
   `HomeScreen`'s existing goal-edit pattern) and extracted both into dedicated screens
   (`SendToKarooScreen.tsx`, `PublishToRegistryScreen.tsx`), reachable only via a new header
   menu on `SegmentDetailScreen`.

**A second real bug was found and fixed via live testing, not design review**: after
extracting the registry flow, publishing failed with `HTTP 403: Resource not accessible by
personal access token`. Diagnosed from GitHub's own docs + corroborating community reports
as a known GitHub-side bug where a fine-grained PAT's repository-access selection silently
reverts to "Public repositories" after saving -- recommended switching to a classic token
instead (the registry client's own code already expected that type). Separately, once a
token already existed in secure storage, the UI had no way to replace it -- `needsToken`
only ever flipped true on a *first* failed attempt, so a broken stored token could never be
swapped. Added a persistent "Use a different token" link. **Confirmed working end-to-end**:
re-checked `github.com/frason/GritMap/registry/segments` directly and found a real new
commit (`49ee9c1`, "registry: publish Diablo Northgate to Junction") -- the first genuine
live confirmation this feature has ever had.

## Changed

**Not yet committed** -- working-tree changes only. New files:

- `src/segments/computeSegmentElevationStats.ts` (+ test) -- elevation gain (same
  "sum of positive deltas, gap-safe" convention as `persistImportedRide.ts`'s
  `computeTotalAscentMeters`, applied to a segment instead of a ride) and average grade.
- `src/screens/parseTargetDuration.ts` (+ test) -- `parseTargetDurationInput(minutes,
  seconds)`, extracted from `HomeScreen.tsx`'s `GoalSetupForm` so the mm:ss validation rule
  has exactly one implementation; `HomeScreen.tsx` now calls it too.
- `src/screens/ElevationSparkline.tsx` -- small title-row sparkline.
- `src/screens/ElevationProfileChart.tsx` -- the full-width, zone-colored elevation chart.
- `src/screens/SendToKarooScreen.tsx`, `src/screens/PublishToRegistryScreen.tsx` -- the
  extracted leaf screens, each with expanded explanatory copy.

Edited:

- `src/screens/SegmentDetailScreen.tsx` -- full restructure per the three rounds above;
  adds a header three-dot menu (`useLayoutEffect` + a `Modal`-based dropdown, the same core
  `Modal` pattern already used by `DuplicateDecisionModal.tsx`) navigating to the two new
  leaf screens.
- `src/screens/PublishToRegistryScreen.tsx` -- the "Use a different token" fix (tracks
  `hasStoredToken` separately from `tokenFieldVisible`, so the field is reachable even when
  a token is already saved).
- `src/screens/formatRideStats.ts` -- `formatGradePercent`, `formatSpeedMph` (new).
- `src/navigation/types.ts` / `SegmentsStackNavigator.tsx` -- new `SendToKaroo`/
  `PublishToRegistry` routes.
- `src/theme/icons.ts` -- `medal`, `list`, `pulse`, `more` glyphs.

## Verified

- `npm run typecheck`: clean throughout every round of edits.
- `npm test`: 346/346 passing (new `computeSegmentElevationStats` and
  `parseTargetDurationInput` suites; everything else unaffected).
- `npm run web:smoke`: clean after every round.
- **The registry publish path is now verified live** -- not just build-verified: confirmed
  directly on github.com that a real commit landed in `frason/GritMap`'s `registry/segments`
  directory after the fix.
- The rest of the redesign (pacing-plan zone display, elevation chart, effort-summary rows,
  the three-dot menu navigation) has not been checked live against the client's own data --
  a fresh simulator used mid-session had no segments imported, so a screenshot there
  wouldn't have proven anything; this was stated plainly rather than claimed as verified.

## External state

- A GitHub classic personal access token (repo scope) is now the one stored in this app's
  secure storage on the client's device, replacing an earlier fine-grained token that didn't
  work due to a GitHub-side bug. No other device/simulator state changed.

## Hazards and blockers

- `apps/karoo/` and the iOS project file remain under active, live editing by the
  concurrent Codex session (several dashboard iterations since the last handoff) --
  untouched throughout, confirmed again at the end of this increment.
- The Karoo-address field used to be shared between the old "Send to Karoo" section and the
  Pacing Plan section's send action; now that Send to Karoo is its own screen, the Pacing
  Plan section has its own independent address field. Minor duplication, not persisted
  either way -- low-risk, but worth knowing if it's ever surprising in testing.
- Still uncommitted: this increment plus the previous pacing-plan-generator increment are
  both sitting in the working tree together.

## Next safe action

Commit (the client has asked for this already -- about to happen right after this handoff).
After that: a live walkthrough of the rest of the redesign (pacing-plan zone display,
elevation chart, goal editing) against the client's own real segments, since only the
registry-publish path has had genuine end-to-end confirmation so far.
