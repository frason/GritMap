# Handoff: pacing-plan generator + rider-profile transfer (weight capture added)

- Updated: `2026-09-30 22:40 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `b0d08a1 docs: hand off historical trend/band comparison view (#68)` (this increment's
  own changes are NOT yet committed -- see Changed below)
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` remain under
  concurrent Codex work (currently mid-flight on a Power/HR Drift Karoo field, with a device
  install follow-up noted since the last handoff -- see
  `handoffs/archive/2026-09-30-power-hr-drift-dashboard.md`) -- untouched by this increment,
  as throughout this whole session. `handoffs/LATEST.md` itself again had a Codex-appended
  note on top of this session's own prior pacing-plan handoff when this increment started;
  that combined content was archived verbatim to
  `handoffs/archive/2026-09-30-2240-claude-pacing-plan-plus-codex-drift-note.md` before being
  replaced by this handoff.

## Outcome

Direct continuation of the previous increment (phone-side pacing-plan generator, see
`handoffs/archive/2026-09-30-2203-claude-pacing-plan-generator.md`). That increment left one
real gap, surfaced when the client asked where the Karoo's required rider profile was
actually supposed to come from: **nowhere, currently**. Checked the Karoo's Kotlin source
directly -- there is no on-device settings screen for FTP/weight at all; the only path
(`RiderHistoryJsonParser.kt`) is importing a `riderHistory` block from the phone, and
nothing in this app's `src/` ever built one. So a fresh Karoo has no way to get a rider
profile at all, which would make the just-built "send pacing plan" action fail to import
every time.

This increment closes that gap: adds a manually-entered weight field (the one thing
`RiderHistoryJsonParser` requires that wasn't already tracked), and has the pacing-plan send
action also build and transfer the `riderHistory` block alongside the segment and the
baseline plan. Per the client's explicit direction, weight is captured now as a plain
manual field, but designed so a future Apple HealthKit / Google Health Connect sync (#69/
#70) can keep the *same* `athlete_profile.weight_kg` column current later rather than
needing a separate mechanism -- no "source" column or sync-status field was added ahead of
that integration actually existing, since that would be building for a requirement that
isn't real yet.

## Changed

**Not yet committed** -- working-tree changes only, continuing from the previous increment's
also-uncommitted changes. New since the last handoff:

- `src/db/migrations.ts` -- version 7, `athlete_profile.weight_kg` (nullable REAL, same
  singleton-row pattern as `ftp_watts`/`max_heart_rate_bpm`).
- `src/pacing/buildRiderHistoryPackage.ts` (+ test) -- builds the exact JSON
  `RiderHistoryJsonParser.parse()` expects (`schemaVersion`, `profile.ftpWatts`/`weightKg`/
  optional `maxHeartRateBpm`, empty `trainingLoads`/`samples` arrays -- the parser only
  requires those arrays to exist, not to be non-empty; this app computes neither yet).

Edited:

- `src/db/getAthleteProfile.ts` / `setAthleteProfile.ts` (+ tests) -- added `weightKg`,
  following the exact existing optional-field pattern.
- `src/screens/ZonesSettingsScreen.tsx` -- added a "Weight (kg)" field (decimal-pad, allows
  fractional values unlike the integer-only FTP/max-HR fields) with inline copy noting it's
  manual for now and meant to be kept current by HealthKit/Health Connect later, not
  replaced.
- `src/karoo/sendGuidancePackageToKaroo.ts` (+ test) -- signature changed from a bare
  `ftpWatts` parameter to a `GuidancePackageRiderInput` object (`ftpWatts`, `weightKg`,
  optional `maxHeartRateBpm`); now also builds and includes `riderHistory` in the transfer
  JSON via `buildRiderHistoryPackage`.
- `src/screens/SegmentDetailScreen.tsx` -- loads the full `AthleteProfile` (not just
  `ftpWatts` as before) and gates the "Pacing plan" section on FTP *and* weight both being
  set (a new "Set your weight to send a pacing plan to the Karoo" prompt -> `ZonesSettings`,
  alongside the existing FTP and goal prompts) before building the rider input for
  `sendGuidancePackageToKaroo`.
- `src/db/migrations.test.ts` / `initializeDatabase.test.ts` -- hardcoded expected
  `PRAGMA user_version` bumped from 6 to 7.

## Verified

- `npm run typecheck`: clean.
- `npm test`: 333/333 passing (was 326 after the previous increment; +7 -- the new
  `buildRiderHistoryPackage` suite, plus the existing `getAthleteProfile`/
  `setAthleteProfile`/`sendGuidancePackageToKaroo` suites extended in place rather than
  duplicated).
- `npm run web:smoke`: a real Metro web bundle succeeds with the new weight field and
  updated Pacing plan section.
- **Still not live-verified on a real Karoo.** This increment makes that verification
  *meaningfully closer to possible* (a fresh Karoo can now actually receive a rider profile
  from this app, where before it had no path to get one at all), but it hasn't been tried
  against a real device. No Karoo/Kotlin code was touched.

## External state

No device/simulator state changed by this increment.

## Hazards and blockers

- The rider profile is now sent on *every* pacing-plan send, unconditionally overwriting
  whatever profile (if any) was previously installed on that Karoo -- there's no merge or
  "only if different" logic, matching how `sendSegmentToKaroo` already behaves for segments.
  Should be fine for a single-rider device, but worth knowing if the Karoo is ever shared.
- Weight is still just a single current value with no history -- same singleton-row
  limitation the FTP/max-HR fields already had, now extended to weight. The original design
  doc's W/kg-normalized reference-ride matching (closest-matching conditions by weight/
  temperature) is explicitly not part of this -- only enough was built to make the transfer
  itself valid.
- `apps/karoo/` and the iOS project file remain under active, live editing by the concurrent
  Codex session -- untouched throughout, confirmed again at the end of this increment.
- Both this increment's changes and the previous pacing-plan increment's changes remain
  uncommitted together. Worth committing soon given how much has accumulated across the two
  increments.

## Next safe action

Review the diff (covers both this increment and the prior pacing-plan generator one), then
commit. After that: get a real weight + FTP into the app and try an actual send to a Karoo
to see whether the transfer imports -- the first genuine end-to-end test this feature has
had a path to.
