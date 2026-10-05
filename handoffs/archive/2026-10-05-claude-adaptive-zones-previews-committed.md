# Handoff: adaptive zones, ride previews (with v9 backfill), segment-creation redesign committed

- Updated: `2026-10-05`
- Agent: `Claude`
- Branch: `main`
- Head: parent `d2befcb Merge remote-tracking branch 'origin/main'`; this work is the commit on top
- Worktree: `apps/karoo/`, Codex's phone-side URL fix, `ios/`, `docs/PLAN_*`, `handoffs/LATEST.md`
  and most other archives remain uncommitted and were not staged.

## Outcome

Everything described in `2026-10-02-0910-claude-adaptive-zones-for-codex.md` is now committed
(adaptive pacing-zone length, scrollable zone chart, ride-list route thumbnails, Start/Finish
segment creation with full-ride elevation chart and map-synced zoom). The client confirmed on a
real phone that everything worked except ride thumbnails; that was a gap, now fixed (below).

## Changed

- **New migration v9 `backfill_ride_preview_polyline`** (`src/db/migrations.ts`). v8 only filled
  `rides.preview_polyline_json` for rides imported after it shipped, so every earlier ride kept the
  generic icon. v9 fills it in SQL from `ride_points` using the same selection as
  `computePreviewPolylineJson` (all GPS points when <= 35, else index `round(k*(n-1)/34)`).
  Rides with no GPS fix stay NULL. This supersedes the "no backfill" note in the earlier archive.
- Schema `user_version` is now 9 (`migrations.test.ts`, `initializeDatabase.test.ts`).
- `SegmentDetailScreen.tsx` also carries Codex's one-line Karoo-address placeholder change
  ("IP or full Karoo URL"); it shared a file with my hunk and is harmless on its own.

## Verified

- `npm run typecheck` clean; `npm test` 367/367 (new test compares the SQL backfill against the
  import-time sampling on a 1,000-point ride with gaps in GPS, a 3-point ride, and a no-GPS ride).
- Client device: zone chart, tabs, map->chart zoom sync, segment detail all confirmed working.
  Thumbnails confirmed missing before v9; **not yet re-confirmed after v9**.

## External state

- Metro dev server running on :8081 from this session (background task).
- Nothing pushed by this session.

## Hazards and blockers

- v9 runs once on next app launch; cost scales with ride count x points (SQL window functions).
- Per-100m grade noise on short segments is still untested against real data.
- Codex's `physiology/` work and `rr-foundation` archives exist while the AI/physiology plan
  review requested of Claude is still outstanding.

## Next safe action

Reload the phone app and confirm thumbnails appear on older rides; then push. After that, do the
requested review of `docs/PLAN_KAROO_AI_PHYSIOLOGY.md` as a separate document.
