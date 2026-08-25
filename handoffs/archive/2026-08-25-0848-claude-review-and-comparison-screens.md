# Handoff: Advanced review + attempt comparison screens (closes #11, #13)

- Updated: `2026-08-25 08:48 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `7e9c2eb ui/attempt-comparison: distance-aligned chart with diff band (closes #13)`
- Worktree: substantial uncommitted work remains in `apps/karoo/` (Codex's concurrent
  W′/cardiac-drift/UI work) — untouched by this increment.

## Outcome

The last two required MVP screens exist and are wired end-to-end: the advanced diagnostic
review workflow (confirm/reject a borderline candidate, rerun the matcher) and the attempt
comparison chart. Combined with the matcher-trigger wiring from the prior handoff, every
piece of `docs/MVP.md`'s "Required screens" list now has a real implementation:
1. FIT import — done (earlier increment)
2. Ride list / detail — done (earlier increment)
3. Segment definition — done (earlier increment)
4. Segment detail with attempts — done (this session, #30 + this increment)
5. Advanced diagnostic review — **this increment (#11)**
6. Attempt comparison — **this increment (#13)**

## Changed

**#11 (commit `041c5cf`):**
- `src/db/getAttemptDetail.ts`, `src/db/listAttemptsForSegment.ts`, `src/db/reviewAttempt.ts`
  (all with tests) — read one attempt's full diagnostics, list a segment's attempts, and
  confirm/reject an attempt. Reject deletes the `segment_attempts` row (cascading
  `match_diagnostics`) — mirrors the removal `persistMatchCandidate.ts` already does when a
  newer automatic rescan rejects an attempt.
- `src/screens/AttemptReviewScreen.tsx` (new) — route/reference overlay via the existing
  `RouteMapView` + `highlightRange`, every diagnostic field from `docs/MVP.md`'s contract,
  Confirm/Reject buttons.
- `SegmentDetailScreen.tsx`'s "Attempts" placeholder is now a real, tappable list, plus a
  "Rerun matcher" button — re-invokes `runMatcherForSegment` (from the #30 increment) under
  the current `MATCHER_VERSION`, which is the "reevaluate under a new version" trigger the
  issue asks for. No new reevaluation logic needed — `persistMatchCandidate` already only
  refreshes a stored attempt when the incoming version is strictly newer.

**#13 (commit `7e9c2eb`):**
- Added `react-native-svg` as a dependency (`npx expo install`) — nothing suitable existed in
  the project; no full charting library needed.
- `src/db/getAttemptTrack.ts` (new, tested) — feeds `src/comparison/compareAttempts.ts`
  (already built in the closed #12), re-basing each attempt's `ride_points` slice so distance
  starts at 0 at its own start point.
- `src/screens/ChannelChart.tsx` (new) — hand-rolled SVG line chart. One component covers all
  four MVP channels (time-gap, power, HR, elevation): two lines + a shaded difference band for
  power/HR/elevation; the time-gap channel reuses the same component with a `primary = 0`
  baseline, so the band falls out for free instead of needing separate chart logic. A run of
  `null` samples (real gaps, per `compareAttempts`' >30s rule) breaks the line rather than
  interpolating across it.
- `SegmentDetailScreen.tsx` — "Compare two attempts" enters a selection mode (tap up to two
  rows) and navigates to the new `AttemptComparisonScreen`.
- Commits, in order on local `main`: `f945754` (#30) → `b86ab3a` (#30 handoff) → `041c5cf`
  (#11) → `7e9c2eb` (#13). None of this is pushed yet — `origin/main` is now 16 commits
  behind.

## Verified

- **#11**: 9 new tests (suite at 167 total after this commit). Typecheck and web:smoke clean.
  Ran `listAttemptsForSegment`/`getAttemptDetail`/`confirmAttempt`/`rejectAttempt`
  against a copy of the phone app's real live database with a realistic fixture row (real
  segment id, real ride id, real point indices) — the join, every diagnostic field, and both
  review actions all worked correctly under the real schema's FK constraints.
- **#13**: 3 new `getAttemptTrack` tests (suite at 170 total). `npm run web:smoke` confirms `react-native-svg`
  links and bundles cleanly for web (this was the real risk of adding a new native
  dependency, and it was checked, not assumed). Ran the full real pipeline
  (`getAttemptDetail` → `getAttemptTrack` → `compareAttempts`) against a copy of the live
  database, seeded with two realistic attempts on the real "Morning Climb" segment from its
  two real rides: 2901 real ride points each, correctly re-based and resampled into 1919
  clean 10m samples with real power/HR/elevation values.
- **Gap-rendering specifically was not exercised by the real-data run** — this particular
  real ride data has continuous sensor coverage, so every sample resolved. The gap-handling
  path is covered by `compareAttempts.ts`'s own existing unit tests from #12 (a >30s dropout
  producing a `null` sample), and `ChannelChart.tsx`'s line-breaking logic was written and
  reasoned through against that contract, but never watched render on an actual chart.
- **Not verified for either issue**: the actual on-screen tap flow on a real device (Segment
  Detail → tap an attempt row → Confirm/Reject; Segment Detail → Compare two attempts →
  select two rows → see the rendered chart). The iOS Simulator MCP tool's touch injection was
  still broken as of the #30 handoff and wasn't re-tested here. Every screen added in this
  increment is a thin, direct read of query modules that were independently verified above.

## External state

- No device/simulator state changed — all "real data" verification ran against **copies** of
  the simulator's SQLite file in scratch space, never the live file. The live phone database
  still has zero real `segment_attempts` rows from natural matcher activity.
- `node_modules` now includes `react-native-svg` — a real device/simulator rebuild
  (`npx expo run:ios` or `--device`) is needed before this UI can actually render on a device;
  it hasn't been rebuilt with this dependency yet in this session.

## Hazards and blockers

- The iOS Simulator MCP control tool's touch injection was broken as of the last two
  handoffs and was not re-tested here. A real-device build remains the working fallback if
  interactive verification is wanted (code-signs automatically with `jfrason@gmail.com`'s
  Apple Development identity).
- `ChannelChart.tsx` is unstyled/unpolished by design (issue explicitly deprioritizes chart
  polish) — worth a pass once the underlying comparison logic is confirmed correct on-device.
- Comparing two attempts currently requires manually selecting two rows; MVP.md's stated
  default ("newest vs. previous valid attempt") isn't pre-selected anywhere — a small,
  easy follow-up if that default matters in practice.

## Next safe action

A real on-device pass is the natural next step for both: import a FIT file or view an
existing segment's attempts, confirm/reject one, then select two attempts and confirm the
comparison chart actually renders as expected (colors, gap breaks, legend) on a real screen
— none of this increment's UI has been visually confirmed yet, only its data pipeline.
Beyond that, remaining backlog is `#14` (UX cleanup, performance validation, acceptance
testing) — likely the natural wrap-up issue now that every required MVP screen exists.
