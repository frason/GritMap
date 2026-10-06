# Handoff: versioned rider profile + coach-plan contract implemented (phone app, uncommitted)

- Updated: `2026-10-05`
- Agent: `Claude`
- Branch: `main`
- Head: `d739851 docs: review of Karoo AI/physiology plan and H10 RR foundation` -- **everything below is uncommitted**
- Worktree: `apps/karoo/`, `ios/`, `docs/PLAN_*`, `handoffs/LATEST.md` edits by Codex and the
  other archives are not mine and were not touched by this work.

## Outcome

The phone can now take pacing guidance from the rider, a human coach, or an AI coach through one
validated document (`gritmap-coach-plan` v1), preview it, store it as the segment's active plan,
and send it to the Karoo as an ordinary baseline plan. The rider profile now carries a version,
and plans record the version/FTP they were written against and are flagged outdated when FTP moves.
Full contract: `docs/COACH_PLAN_CONTRACT.md`. **No Karoo change is required.**

## Changed

- Migrations **v10** (`athlete_profile.profile_version`, bumped in `setAthleteProfile`'s upsert
  only when FTP/weight/max HR changes) and **v11** (`segment_plans` table, one active plan per
  segment via a partial unique index). Schema `user_version` is now **11**.
- `src/pacing/coachPlan.ts` -- parser/validator (mirrors the Karoo's `AiPlanValidator` rules:
  contiguous from 0 to segment length, <= 150% FTP, <= 100 W step, instruction <= 80 chars;
  fingerprint must match the segment; snaps rounding-sized geometry errors; reports all problems;
  accepts fenced AI output). `buildCoachPlanRequest.ts` -- shareable request + pre-filled template.
- `src/pacing/buildBaselinePacingPlan.ts` -- new `toBaselinePlanWire` is the single place a plan
  becomes the Karoo's JSON (generated and imported share it). `buildTargetPowerZones.ts` exports
  `classifyAgainstAnchor`.
- `src/db/segmentPlans.ts` -- save (retires the previous active plan in one transaction), get
  active, deactivate, mark sent, `isSegmentPlanOutdated` (outdated == FTP changed).
- `src/karoo/sendGuidancePackageToKaroo.ts` -- optional 7th arg `importedPlan`; `targetDurationMs`
  may be `undefined` when a plan is supplied; refuses an FTP mismatch without sending.
- UI: new `ImportCoachPlanScreen` (3-dot menu "Import coach plan": Share request / paste / Check /
  preview chart / Use this plan); `SegmentDetailScreen` shows the active plan (source, summary,
  outdated warning, Replace, send, "Use GritMap's generated plan instead");
  `ElevationProfileChart` accepts any zone shape.

## Wire compatibility (important for Codex)

The Karoo's parsers reject unknown properties and unknown `generator.type`, so imported plans go
out as `generator.type: "manual"` with provenance in `modelVersion` (`self` / `human-coach` /
`ai-coach`). The richer encoding (new generator types, `riderProfileVersion`, a capability
handshake) needs Karoo changes -- proposed in `docs/COACH_PLAN_CONTRACT.md`, **not implemented**.

## Verified

- `npm run typecheck` clean; `npm test` **417/417** (was 367); `npm run web:smoke` clean.
- New tests: 26 parser, 11 persistence, 5 profile-version, 4 send-path (including the exact Karoo
  key set and RECOVER translation), 3 request builder (template parses as-is), migration v10/v11.
  A test caught a real bug while writing the send path (a misspelled spread key silently dropped
  `targetFinishTimeSeconds`; TypeScript does not flag excess properties through a spread).
- **Not live-checked on a device**: `ImportCoachPlanScreen`, the segment-detail plan section and
  the Share sheet have only typecheck/web-export verification. An end-to-end send of an imported
  plan to a real Karoo has not been done.

## External state

- Metro dev server still running from this session (JS-only changes; reload the app, migrations
  v10/v11 run on launch).

## Hazards and blockers

- **Commit boundary:** `src/karoo/sendGuidancePackageToKaroo.ts` mixes my change with Codex's
  uncommitted `karooTransferEndpoint` import. Committing it requires also committing
  `src/karoo/karooTransferEndpoint.ts` and `.test.ts` (and `sendSegmentToKaroo.ts`,
  `SendToKarooScreen.tsx`, which use it) or HEAD will not build. That endpoint fix is tested and
  was verified live earlier.
- Plans given as `targetPercentFtp` are converted to watts at import; after an FTP change they must
  be re-imported (no automatic re-derivation yet).
- Only the active plan's history is kept (inactive rows accumulate, no UI to browse or restore them).
- `profile_version` is phone-local until the Karoo accepts it.

## Next safe action

Reload the phone app; open a segment -> 3-dot menu -> Import coach plan; share the request to
yourself, paste back the template (or an edited one), Check, Use this plan, then send to the Karoo
with the receive screen open and confirm it imports. Codex: review the proposed Karoo-side
extension in `docs/COACH_PLAN_CONTRACT.md` when convenient.
