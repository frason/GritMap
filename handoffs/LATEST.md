# Handoff: Segment-definition increment complete (issues #6, #7 closed)

- Updated: `2026-08-19 22:37 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `ed0c539` (7 commits ahead of `origin/main` at last check — **not yet pushed**, ask the
  user to run `git push origin main`).
- Worktree: clean for all root-app (`src/`, `docs/`) files. `apps/karoo/` has Codex's own
  concurrent in-progress work (cardiac-drift field) — not touched by this update.

## Outcome

All 6 commits from `docs/PLAN_segment_definition_increment.md` are implemented and verified,
closing issues #6 ("Render ride GPS track on MapLibre map") and #7 ("Segment definition: map
handles + scrubber, persist directed segment"):

1. `38e062a` `db/ride-track-query` — `getRideTrack.ts`.
2. `4253c24` `map/route-map-view` — `RouteMapView.native.tsx`/`.web.tsx`, wired into
   `RideDetailScreen`. Confirmed via `grep` on the exported web bundle that MapLibre's native
   code never leaks into it (zero matches).
3. `2d0b942` `segments/resample-and-fingerprint` — `resamplePolyline.ts`,
   `segmentFingerprint.ts`. The fingerprint canonicalization was verified against
   `apps/karoo`'s real `SegmentJsonParser.kt`/`SegmentFingerprint.compute()` by actually
   running Java's `Double.toString()` (which Kotlin calls directly on the JVM) side-by-side
   with Node's, not assumed — a real gap was found and fixed (`toJavaDoubleString.ts`: Java
   keeps a trailing `.0` on whole numbers, JS drops it). A real conformance fixture with a
   JVM-verified SHA-256 is asserted in the test suite.
4. `6bced22` `db/insert-and-query-segments` — migration v4 drops the `UNIQUE` on
   `segments.fingerprint` (rebuilds `segments`/`segment_reference_points`/
   `segment_attempts`/`match_diagnostics` together, since SQLite has no `ALTER TABLE DROP
   CONSTRAINT`). **Found and fixed a real data-loss bug before it shipped**: a naive rebuild
   where new tables reference the *old* parent table name causes `DROP TABLE`'s implicit
   cascade-delete to silently wipe the freshly-copied child rows — verified with a throwaway
   3-level parent/child/grandchild script before writing the real migration. Also verified on
   the actual on-device `gritmap.db` (2 real rides, 19596 `ride_points`): `user_version` now
   4, zero `PRAGMA foreign_key_check` violations, all data intact.
5. `4b84972` `ui/define-segment-screen` — `DistanceRangeScrubber.tsx` (two-thumb range control
   on React Native's built-in `PanResponder`, no gesture-handler/reanimated added, per the
   plan's decision), `DefineSegmentScreen.tsx`. Fixed a real bug before it shipped: the
   `PanResponder.create()` closures were frozen to the first render via `useMemo(..., [])`,
   which would have used stale distance state mid-drag — fixed with a "latest ref" pattern.
6. `ed0c539` (+ `aaea4bf`, split by a concurrent-commit index reset, see below)
   `ui/segment-detail-and-list` — `SegmentsStackNavigator`, `SegmentDetailScreen.tsx`,
   `SegmentListScreen.tsx`, `deleteSegment.ts`, and the cross-stack post-save navigation
   (`DefineSegmentScreen` → `SegmentDetail`, via `navigation.getParent()` to the root tab
   navigator).

## Verified end-to-end on a real device, not just simulated

Created two segments from two different real imported fixtures in the iOS Simulator:
- **"Morning Climb"**: dragged the scrubber's end thumb, watched the map highlight shrink live
  and the distance/elevation readout update in real time (25.3mi/946ft), saved. Confirmed in
  `gritmap.db` afterward: a real 64-char SHA-256 fingerprint (first real on-device use of
  `expo-crypto`'s `digestStringAsync` in this app), `source_start/end_point_index` (29→6502)
  matching the drag, and exactly 4066 reference points spanning 0–40644.9m (matches a 10m
  resample of that range).
- **"Full Loop"**: saved with the default full-track range from a second ride, to test that
  path too. Confirmed cross-stack navigation landed directly on its detail screen (back button
  correctly read "Segments", proving the stack switch worked), which correctly rendered its
  own resampled polyline via `RouteMapView` (reused, not a second map component).
- Both segments then appeared correctly in `SegmentListScreen` (newest first). Deleted "Full
  Loop" via its list-row delete action + confirmation alert; confirmed its reference points
  cascade-deleted while "Morning Climb" (4066 points), both source rides, and
  `PRAGMA foreign_key_check` all stayed clean afterward.

## One process note: a concurrent-commit index reset split a commit

While staging files for the final commit, a concurrent Codex commit in this shared checkout
appears to have reset the staged index between `git add` and `git commit` — the same thing
happened once earlier this session (mid-`handoffs/LATEST.md` editing). The first attempt
(`aaea4bf`) landed with only one file (a deletion); the rest surfaced back as unstaged
working-tree changes, not lost, and were committed immediately after in `ed0c539`. Nothing was
lost, but if this keeps recurring, it's worth Codex and Claude agreeing on a lighter-touch
convention (e.g. always `git status` immediately post-commit, which is what caught it both
times) rather than assuming a `git add && git commit` pair is atomic in this shared checkout.

## Next safe action

Ask the user to `git push origin main` (7 commits pending). After that:
- Issue #7's own "Done when" is fully met; issue #6 too.
- Natural next phase: wiring the matcher into a UI (currently `matchSegment()` is fully built
  and tested but has no screen calling it against real ride/segment pairs — "Detected
  segments" on `RideDetailScreen` and "Attempts" on `SegmentDetailScreen` are both still
  honest empty-state placeholders). This would need a scanning trigger (issue #30: "Wire
  matcher into segment-creation and ride-import triggers") and likely the diagnostic review
  screen (issue #11) to be useful.
- `docs/PLAN_segment_definition_increment.md` can be archived/closed out now that all 6
  commits are done — nothing else references it as in-progress.

## Parallel Karoo status (carried forward, full history in `handoffs/archive/`)

Codex is actively working on `apps/karoo/` again as of this update (cardiac-drift field work
in progress — `CardiacDriftTracker.kt`, `CardiacDriftBitmapRenderer.kt`, new tests, not yet
committed at last check). See `handoffs/archive/2026-08-19-2218-codex-karoo-cardiac-drift.md`
and later archive entries for Codex's own detailed status.
