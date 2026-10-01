# Handoff: phone-side pacing-plan generator built (guidance engine, primary layer)

- Updated: `2026-09-30 22:03 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `b0d08a1 docs: hand off historical trend/band comparison view (#68)` (this increment's
  own changes are NOT yet committed -- see Changed below)
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` remain under
  concurrent Codex work (currently mid-flight on a Power/HR Drift Karoo field, see
  `handoffs/archive/2026-09-30-power-hr-drift-dashboard.md`) -- untouched by this increment,
  as throughout this whole session. `handoffs/LATEST.md` itself had a Codex-appended note
  on top of this session's own prior #68 handoff when this increment started; that combined
  content was archived verbatim (not discarded) to
  `handoffs/archive/2026-09-30-2203-claude-historical-band-plus-codex-note.md` before being
  replaced by this handoff.

## Outcome

The client shared a refined design doc (from a separate Claude chat session) for the
not-yet-built "guidance engine": push/rest cues per quarter mile on the Karoo, with a
primary layer that precomputes a target-power table from a segment's elevation grade and
goal pace -- "a lookup and threshold check, not live re-optimization," heavy computation
done once on the phone. Checked against the app first: per-segment ride history (that
doc's item 1) turned out to already be built (`SegmentDetailScreen.tsx`'s existing
"Attempts" section). This increment builds the actual missing piece: a phone-side
generator that turns FTP + a goal time + a segment's elevation profile into a per-quarter-
mile target-watts table, and a new "Send pacing plan to Karoo" action that transfers it
using the companion Karoo app's existing (previously unpopulated) `baselinePacingPlan` JSON
schema slot.

Deliberately not a physics simulation: the app tracks no rider weight/CdA/rolling
resistance (and the client explicitly deprioritized that context data this session), so an
average-power anchor comes from FTP + goal duration via a standard, named cycling
power-duration relationship, modulated per zone by that zone's grade relative to the
segment's own average grade -- see the approved plan at
`/Users/frason/.claude/plans/precious-frolicking-petal.md` for the full algorithm and the
reasoning behind each constant.

**Load-bearing discovery made during planning, not assumed**: read the Karoo's real Kotlin
source (`apps/karoo/app/.../pacing/PacingModels.kt`, `.../ai/AiPlanValidator.kt`) rather
than trusting the one sample fixture. Found that the wire enum is `RECOVER`, not `REST`
(Kotlin's own UI maps `RECOVER -> "REST"` for display, so "REST" stays this app's internal
vocabulary, translated only at the JSON-building boundary); that there's a hard 150% FTP
ceiling and a **100W max adjacent-zone step** the plan has to respect or the Karoo rejects
the whole transfer; and that `riderHistory` requires a `weightKg` this app doesn't have, so
it's omitted entirely -- meaning **the Karoo must already have a rider profile installed
separately with a matching FTP**, or the baseline plan import fails silently from this
app's point of view (see Hazards below).

## Changed

**Not yet committed** -- working-tree changes only, by design (not asked to commit this
session). New files:

- `src/pacing/powerDurationAnchor.ts` (+ test) -- FTP x goal-duration -> anchor watts, via a
  named Coggan/Allen power-duration lookup table, log-interpolated.
- `src/pacing/computeZoneGrades.ts` (+ test) -- chunks a segment's reference polyline into
  402.875m (quarter-mile) zones and computes each one's grade, splitting a leg's elevation
  delta proportionally at zone boundaries so nothing double-counts.
- `src/pacing/buildTargetPowerZones.ts` (+ test) -- grade modulation, clamp, renormalize,
  step-limit (the 80W-under-the-Karoo's-100W-cap pass), classify (REST/HOLD/PUSH),
  instruction text.
- `src/pacing/buildBaselinePacingPlan.ts` (+ test) -- assembles the exact wire JSON the
  Karoo's parsers expect, including the REST->RECOVER translation.
- `src/karoo/sendGuidancePackageToKaroo.ts` (+ test) -- sibling to `sendSegmentToKaroo.ts`;
  posts segment + baseline plan to the same `/transfer` endpoint (confirmed
  `SegmentInboxProcessor` already dispatches on `packageType`, no Karoo-side change needed).

Edited:

- `src/screens/SegmentDetailScreen.tsx` -- new "Pacing plan" section next to "Send to
  Karoo": prompts to set FTP (-> `ZonesSettings`) or set a goal for this segment (-> Home
  tab) when either is missing, otherwise a "Send pacing plan to Karoo" button reusing the
  existing Karoo-address field and the same hedged send-status copy pattern.

## Verified

- `npm run typecheck`: clean.
- `npm test`: 326/326 passing (was 292 before this increment; +34 across the five new test
  files above). Notably includes an end-to-end test against the real
  `apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.guidance-package.json` fixture's
  actual reference polyline, asserting the generated plan's zones are contiguous and no
  adjacent step exceeds 80W.
- `npm run web:smoke`: a real Metro web bundle succeeds with the new screen section.
- **Not live-verified on a real device, and not verifiable end-to-end from this app alone**:
  actually seeing a sent plan display correctly on the Karoo requires a rider profile with
  a matching FTP already installed on that device (see Hazards). No Karoo/Kotlin code was
  touched by this increment, so no Android build/install was needed or attempted here.

## External state

No device/simulator state changed by this increment.

## Hazards and blockers

- **The Karoo import can fail invisibly from this app's perspective.** `TransferPackage.kt`
  requires a rider profile already installed on the Karoo whose `ftpWatts` exactly matches
  what this app sends, or it rejects the whole baseline plan (and that rejection happens
  async, after this app's HTTP POST already got a 200). The UI copy says "Sent — check the
  Karoo screen to confirm it imported" for exactly this reason, but there's no way from the
  phone to know ahead of time whether that profile exists or matches.
- The grade-modulation sensitivity constant (`GRADE_SENSITIVITY = 0.05` in
  `buildTargetPowerZones.ts`) and the REST/HOLD/PUSH thresholds (90%/110% of anchor) are
  reasonable starting points, not calibrated against any real ride data yet -- worth
  revisiting once a plan has actually been ridden.
- `apps/karoo/` and the iOS project file remain under active, live editing by the
  concurrent Codex session (mid-flight on an unrelated Power/HR Drift field) -- untouched
  throughout, confirmed again at the end of this increment.
- This increment's files are uncommitted. If Codex's session commits something in the
  meantime, these working-tree changes are still independent (different files) but should
  be committed before too much more local drift accumulates.

## Next safe action

Review the diff, then commit (not done automatically this session -- no commit was
requested). After that: either calibrate the pacing math against a real ride once one
exists, or move to the "danger zone" secondary layer (compare live pacing to a specific
past ride, flag known blow-up points) -- which is close to what #68's historical band
already computes, per the client's own design doc.
