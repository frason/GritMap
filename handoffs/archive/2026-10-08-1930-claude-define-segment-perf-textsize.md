# Handoff: Define Segment redesigned; progress-over-time load 7.5 s -> ~0.05 s; text size reflows live (committed locally, not pushed)

- Updated: `2026-10-08 19:30 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `ba8419e feat: Define Segment on the design system; fast progress-over-time; live text-size reflow` (handoff committed on top)
- Worktree: clean for phone files. `apps/karoo/*` untouched.

## Outcome

1. **Define Segment** (`DefineSegmentScreen`, `DistanceRangeScrubber`, `RideElevationChart`) uses theme components only. Plain steps:
   "Pick the part of this ride to track" -> 1. Choose Start or Finish -> 2. Tap the map -> drag the handles -> 3. Name it and
   save. No "corridor"/"coverage" anywhere rider-facing (those stay as fixed constants). Loading, "this ride can't make a
   segment" (no GPS) and error states; name/save problems are inline instead of native alerts; keyboard no longer hides the name field.
   Handles are 44 pt touch targets (28 pt visible); each is a VoiceOver "adjustable" element named "Segment start"/"Segment
   finish" whose value reads e.g. "0.9 miles into the ride, 376 feet elevation", with Move further/Move back actions. The
   VoiceOver step is now ~1% of the ride (min 10 m) instead of a fixed 10 m, which would have needed hundreds of swipes. Map pins
   got 44 pt hit areas and the label "Finish" (was "End").
2. **Progress over time load time** (measured on the iPhone 17 simulator, dev client, load average ~3-4, 3 efforts of 2,517/2,620/2,795
   points): loading the tracks 85 ms; computing the three bands **7,486 ms before, 45-83 ms after** (~100x). Cause:
   `interpolateChannel`/`interpolateTimestamp` rebuilt the full observation list from every ride point on each of ~1,000 samples x
   3 channels x 3 attempts. They now build it once per prepared array (WeakMap keyed by the array, in `resampleChannel.ts`).
   Results are identical (all comparison tests pass); this also speeds up Compare Attempts, which used the same functions.
   Regression test added (3 x 2,500-point efforts, three channels, under 2 s in node).
3. **Text size changes mid-session** now reflow without a relaunch for all design-system text: `useFontScale()` (Dimensions
   "change") is used as a `key` on `AppText`, so text is rebuilt and re-measured when the size changes. Verified live on Home,
   Segment Detail and Define Segment (default <-> largest). **Limitation:** screens/components still using raw `Text` (Attempt
   Review, Attempt Comparison, Publish, Open Segments, Rides list rows) can still show a squeezed layout until
   relaunch; they get the fix when they move to `AppText`.

## Changed

- `ba8419e`: `DefineSegmentScreen.tsx`, `DistanceRangeScrubber.tsx`, `RideElevationChart.tsx`, `RouteMapView.native.tsx` (pin hit area/label),
  `comparison/resampleChannel.ts` (+ test in `computeHistoricalBand.test.ts`), `theme/useFontScale.ts`, `theme/components/AppText.tsx`
  (key), `Button.tsx` (removed a fixed `fontSize` override), `docs/screenshots/define-segment/{before,after}/`.
- Behavior: native alerts on Define Segment -> inline errors; no change to how a segment is built, fingerprinted, saved or matched.
  Saved a test segment through the new screen on the simulator: it matched the 3 demo efforts; I deleted it afterwards.

## Verified

- `npx tsc --noEmit` clean; `npm test` 617/617; `npm run web:smoke` clean (machine load ~2.6).
- Simulator screenshots on demo data (Diablo registry route, synthetic rides): `docs/screenshots/define-segment/before/` (default and
  largest text, the old UI is clipped/broken at largest) and `after/` (default top/middle, name error, dragged handle, largest text
  top/handles/bottom). Handle drag moved Start to 0.9 mi and updated "Segment length"; tab/Start-Finish selection, map tap placement not
  re-screenshotted individually.
- **Not done:** a person's VoiceOver pass; the map's own paint colors (MapLibre line layers) still use the static light palette.

## External state

- Simulator DB: demo data only (Diablo segment, 3 synthetic efforts). Metro is running (`/tmp/metro.log`). Nothing pushed.
  Local commits not pushed: `be21320`, `3b3e590`, `078e131`, `854e224`, `ba8419e` (+ this handoff).

## Goal alignment

- `docs/GOALS.md` Priority 1 (step 2 of the beta loop, "define a segment", is on the stranger path; design practice) and the
  progress-over-time part of the loop (step 7; also Priority 5 groundwork). I did not change "zones"/"sections" wording (coordinator hold);
  this screen uses neither word. No shared contract touched.

## Hazards and blockers

- `resampleChannel`'s cache assumes a prepared points array is not mutated after first use (true for all current callers; arrays come
  from `preparePoints`, a fresh copy). Do not mutate arrays passed to `interpolateChannel`.
- Raw-`Text` screens above still don't reflow live.
- Dynamic Type max-size layouts were checked on Define Segment, Home, Segment Detail only.

## Next safe action

Jason OKs pushing the local commits. Then migrate the remaining old-style screens (Attempt Review / Comparison, Publish, Open Segments,
Rides list rows) to the theme, which also gives them live text-size reflow; then a VoiceOver pass on a real iPhone.
