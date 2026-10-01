# Handoff: responsive Karoo secondary fields + phone pacing transfer

- Updated: `2026-10-01 15:16 PDT`
- Agent: `Codex + Claude`
- Branch: `main`
- Head: `cbd23a1 feat: phone-side pacing-plan generator + rider-profile transfer`
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` remain under
  concurrent Codex work (currently mid-flight on a Power/HR Drift Karoo field, with a device
  install follow-up noted since the last handoff -- see
  `handoffs/archive/2026-09-30-power-hr-drift-dashboard.md`) -- untouched by this increment,
  as throughout this whole session. `handoffs/LATEST.md` itself again had a Codex-appended
  note on top of this session's own prior pacing-plan handoff when this increment started;
  that combined content was archived verbatim to
  `handoffs/archive/2026-09-30-2240-claude-pacing-plan-plus-codex-drift-note.md` before being
  replaced by this handoff.

## Karoo cardiac efficiency dashboard update

Codex rebuilt the LARGE GM Cardiac Drift presentation for Karoo `0.10.18`/code 41. It now
uses two primary metrics (HR Drift and HR Cost), an explicit power-steadiness trust banner,
and one normalized efficiency curve with baseline and threshold zones. Actual-size render
inspection, the full JVM suite, and APK assembly passed. The build is now installed on
device `00442GA241760203`, and package inspection confirms `0.10.18`/41. Detailed archives:
`handoffs/archive/2026-10-01-cardiac-efficiency-dashboard.md` and
`handoffs/archive/2026-10-01-cardiac-efficiency-device-install.md`.

After physical-device review showed that the large field still read too small, Codex made
a large-only type-scale pass and installed Karoo `0.10.19`/code 42. HR Cost now has a large
standalone value with its unit moved to the support line; all chart and hierarchy labels
were enlarged. The two compact fields were intentionally untouched. Detailed archive:
`handoffs/archive/2026-10-01-cardiac-dashboard-type-scale.md`.

A second device-led pass is installed as Karoo `0.10.20`/code 43. It removes redundant
HR-cost comparison copy and shortens the footer so the primary values, axes, endpoint, and
labels can grow without collisions. Compact fields remain untouched. Detailed archive:
`handoffs/archive/2026-10-01-cardiac-dashboard-legibility-pass.md`.

## Karoo responsive secondary-field update

Codex completed and installed GritMap Karoo `0.10.17`/code 40 on device
`00442GA241760203`. GM Segment Performance now has a dominant compact finish variance and
a small-wide plan/prediction timeline; GM Power Balance compact views now communicate W′
reserve versus plan without duplicate labels; GM Pacing Coach now uses a one-line compact
action/target hierarchy and adds actual power in small-wide. The full JVM suite and APK
assembly passed. Detailed archive:
`handoffs/archive/2026-09-30-responsive-secondary-karoo-fields.md`.

## Karoo responsive Power/HR Drift update

Codex completed and installed GritMap Karoo 0.10.16/code39 on device
`00442GA241760203`. The `SMALL` field now uses the approved Option A (large signed drift,
trend/status, green/amber/red threshold rail), and `SMALL_WIDE` uses Option C (normalized
Power and HR gauges, 5% reference, drift and rate). Both consume live tracker state rather
than static preview values. Actual-size native-graphics previews were inspected; the full
JVM suite, assembly, and replacement install passed. Detailed archive:
`handoffs/archive/2026-09-30-responsive-power-hr-drift.md`.

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
