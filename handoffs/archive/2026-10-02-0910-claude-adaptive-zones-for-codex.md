# Handoff: adaptive pacing-zone length + ride previews + segment-creation redesign (phone app)

- Updated: `2026-10-02 09:10 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'` -- **everything below is uncommitted**
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` are Codex's and were not
  touched. The previous LATEST.md (Codex's stacked Karoo entries: Pacing Coach `0.10.28`, global
  FTP sync `0.10.27`, etc.) was archived verbatim to
  `handoffs/archive/2026-10-02-0903-claude-pre-adaptive-zones-plus-codex-pacing-coach.md`;
  read it for the Karoo history.

## FOR CODEX -- the one contract change that touches the Karoo

**`baselinePacingPlan.zones[]` zone length is no longer a fixed quarter mile.** The phone now
picks it from the segment length (`chooseZoneLengthMeters` in `src/pacing/computeZoneGrades.ts`):
aim for ~20 zones, then snap to the nearest of **100m / 200m / 402.336m / 804.672m**.

| Segment | Zone length | Zones |
|---|---|---|
| half mile (805m) | 100m | 8 |
| 2 mi | 200m | ~16 |
| Diablo (10.4km) | 402.336m | 26 (unchanged from before) |
| 25 km+ | 804.672m | capped at half-mile zones |

- **Wire schema is unchanged** -- same fields, still contiguous, first zone starts at 0, last
  ends at the segment length, 80W step limit still applied, `RECOVER`/`HOLD`/`PUSH` still the
  enum. Only the zone *count* (~8-40) and *length* vary per segment. `generator.modelVersion` is
  now `pacing-anchor-grade-v2` (was `-v1`) so you can tell old plans from new.
- **Why**: client asked how this works on short segments; fixed quarter-mile gives a 0.5mi
  segment 2 zones. 100m is the Karoo climber feature's resolution, per the client. A fixed 100m
  was rejected: ~104 zones on Diablo = a new watt target every ~22s, and per-100m grade is noisy.
- **Please verify on the Karoo side** (I only grepped, did not read these paths in depth):
  - `ActiveAttemptSession.kt` has its own hardcoded `QUARTER_MILE_METERS = 402.336` for live
    time-bank splits. That is independent of the plan zones, so nothing breaks, but on short
    segments the plan's 100m target bands won't line up with the Karoo's quarter-mile live splits.
  - The new Pacing Coach "next-zone preview" / zone-progress logic must read zone boundaries
    from the plan (`startDistanceMeters`/`endDistanceMeters`), not assume ~402m. I found no
    `402.8`/zone-length constant or zone-count cap in `apps/karoo/app/src/main/java`, but did not
    trace the preview code.
  - `AiPlanValidator.kt` limits (100W step, 150% FTP, contiguity) are unchanged assumptions; I
    did not find a zone-count cap.
- The 402.336 choice is deliberately the true quarter mile (the previous phone constant was
  402.875, copied from a Needle-era sample fixture) so Diablo's bands now align with the
  Karoo's own 402.336 live splits.
- **Not yet re-sent to a real Karoo** with the new zoning. The first end-to-end transfer
  confirmed earlier used the old fixed-length zones. A resend of Diablo should look identical
  (26 zones); a short segment would exercise the new path.

## Also built this session, uncommitted (phone app only, no Karoo impact)

1. **Quarter-mile breakdown was invisible -- fixed.** `ElevationProfileChart.tsx` squeezed all
   zones into one container width; on Diablo that was 12.6px/zone, under my own 26px label
   threshold, so no watt numbers ever rendered. Zones now get a fixed 36px each in a
   horizontally scrollable chart.
2. **Rides list route-shape thumbnails.** Migration v8 adds `rides.preview_polyline_json`
   (35-point decimated polyline computed once at import in `persistImportedRide.ts`, same
   convention as total distance/ascent); `RidePreviewThumbnail.tsx` draws it (uniform scale +
   cos(lat) correction). Rides imported before v8 keep the generic icon (no backfill).
3. **Segment-creation redesign** (`DefineSegmentScreen.tsx`): Start/Finish tabs at the top (same
   `activeHandle` state), new full-ride `RideElevationChart.tsx` with the selection shaded, and
   chart zoom synced to map zoom via a new `onViewportChange` prop on `RouteMapView.native.tsx`
   (uses `MapRef.getBounds()`, confirmed to exist in the installed MapLibre types; fires on
   `onRegionDidChange` only) -> `computeVisibleDistanceRange.ts`. Native-only: web has no map.
   `DistanceRangeScrubber` kept as a secondary fine-adjust control.

## Verified

- `npm run typecheck` clean; `npm test` **366/366**; `npm run web:smoke` clean.
- Diablo fixture: adaptive zoning yields 26 zones at 402.336m (checked directly).
- Tests added: `chooseZoneLengthMeters`, `computeAdaptiveZoneGrades`, relative remainder-merge,
  `computeVisibleDistanceRange`, ride preview polyline (insert + list), half-mile plan has 100m zones.
- **Not live-checked on a device**: the simulator had no data. The scrolling zone chart, ride
  thumbnails, tabs, and map->chart zoom sync have only automated/code-level verification.
  `batchImport.test.ts` is timing-sensitive (30s ceiling) and flaked once under full-suite load;
  it passes in ~15s alone.

## Hazards

- Per-100m grade from 10m-resampled elevation is noisy; with `GRADE_SENSITIVITY = 0.05`, 1pp of
  grade noise = 5% power jitter on short segments. The 80W step limiter bounds it but
  classifications on 100m zones may flicker. Untested against real short-segment data.
- **Uncommitted and mixed ownership.** Mine: `src/pacing/*`, `src/db/{migrations,persistImportedRide,
  listRides}*`, `src/screens/{ElevationProfileChart,RideListScreen,RidePreviewThumbnail,
  RideElevationChart,DefineSegmentScreen,RouteMapView.*,SegmentDetailScreen}.tsx`,
  `src/segments/computeVisibleDistanceRange*`. Appear to be Codex's phone-side URL fix, also
  uncommitted: `src/karoo/{sendSegmentToKaroo,sendGuidancePackageToKaroo}.ts`,
  `karooTransferEndpoint*`, `SendToKarooScreen.tsx` -- whoever commits should not sweep the
  other's files. `docs/PLAN_KGHOST_IPHONE_UPDATES.md` is untracked and not mine.
- Schema migration v8 runs automatically on next app launch; no native rebuild needed (JS only).

## Next safe action

Client: reload the phone app, open Diablo, confirm watt labels are visible/scrollable; define a
short segment and check the 100m zones. Codex: check the Pacing Coach next-zone preview against
variable zone lengths, then resend a short segment to the Karoo to exercise the new zoning.
