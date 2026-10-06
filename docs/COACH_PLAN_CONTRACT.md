# Coach plan contract v1 and the versioned rider profile

Status: implemented on the phone (2026-10-05). The Karoo needs **no change** to receive these
plans; a proposed Karoo-side extension is listed at the end.

Why: `docs/PLAN_KAROO_AI_PHYSIOLOGY.md` says GritMap accepts pacing guidance from the rider, a
human coach, or an AI coach through one validated, versioned contract, and that plans record the
rider-profile version that produced them. This is that contract
(`docs/REVIEW_KAROO_AI_PHYSIOLOGY.md` point M5: extend what exists, don't add a parallel schema).

## Data flow

```
coach / AI / rider ──paste──▶ gritmap-coach-plan JSON
                                   │  parseCoachPlan()  (src/pacing/coachPlan.ts)
                                   ▼
                     validated, normalized to absolute watts      ◀── rider FTP, segment geometry
                                   │  preview (chart + summary), user confirms
                                   ▼
                     segment_plans row, active   (src/db/segmentPlans.ts)
                                   │  Send to Karoo
                                   ▼
        gritmap-transfer.baselinePacingPlan, generator.type = "manual"
                                   (toBaselinePlanWire → Karoo's existing parsers)
```

Provenance is stored for review and shown in the UI; it never changes runtime behaviour. The
generated plan is not stored: it is recomputed from FTP + goal. An active imported plan overrides
it for that segment until the rider switches back.

## The document: `gritmap-coach-plan`, schemaVersion 1

```json
{
  "schemaVersion": 1,
  "packageType": "gritmap-coach-plan",
  "source": "human-coach",
  "author": "Sam",
  "notes": "Settle for the first mile, then build.",
  "segmentFingerprint": "64 hex characters, copied from the request",
  "targetFinishTimeSeconds": 2340,
  "zones": [
    { "startDistanceMeters": 0, "endDistanceMeters": 402.3, "targetPowerWatts": 255 },
    { "startDistanceMeters": 402.3, "endDistanceMeters": 804.7, "targetPercentFtp": 98,
      "classification": "HOLD", "instruction": "Settle in" }
  ]
}
```

| Field | Rule |
|---|---|
| `packageType`, `schemaVersion` | exactly `"gritmap-coach-plan"`, `1` |
| `source` | `self`, `human-coach`, or `ai-coach` |
| `author`, `notes` | optional text, at most 60 / 500 characters |
| `segmentFingerprint` | must equal the segment the plan is imported onto (case-insensitive); prevents applying a plan to the wrong segment |
| `targetFinishTimeSeconds` | optional positive number |
| `zones` | 1-200 entries, in order |
| zone distances | first starts at 0 (+/-5 m is snapped), each starts where the previous ends (+/-1 m snapped, more is an error), last ends at the segment length (+/-5 m snapped) |
| zone power | exactly one of `targetPowerWatts` or `targetPercentFtp`; whole watts after rounding; 0 to 150% of FTP |
| neighbours | at most 100 W apart (the Karoo's hard cap; the generator's own softer limit is 80 W) |
| `classification` | optional `REST` / `HOLD` / `PUSH` (`RECOVER` accepted as REST); derived at 90% / 110% of the plan's distance-weighted mean power when absent |
| `instruction` | optional, at most 80 characters (longer is shortened with a warning); defaults to Rest / Hold / Push |
| unknown keys | ignored with a warning, never interpreted |

The rules are quoted from the Karoo's own gate (`AiPlanValidator.kt`,
`TransferPackageParser.parseBaseline`) so a plan that passes on the phone is not rejected on the
Karoo after the phone already received an HTTP 200. Input may be wrapped in a markdown code fence
(AI tools do this). All problems are reported together, not just the first.

"Import coach plan" (segment screen, 3-dot menu) has a **Share request** button: it builds a
message with the segment's distance, grade-by-section table, the rules above, and a template that
already imports (`buildCoachPlanRequest.ts`) -- pre-filled with GritMap's generated plan when a goal
exists -- to paste to a coach or an AI assistant.

## Wire mapping (what the Karoo receives today)

`toBaselinePlanWire` (`src/pacing/buildBaselinePacingPlan.ts`) is the single place a plan becomes
the Karoo's `baselinePacingPlan`, for generated and imported plans alike (REST is sent as
`RECOVER`; watts are whole numbers).

| Origin | `generator.type` | `generator.modelVersion` |
|---|---|---|
| GritMap generator | `phone-ai` | `pacing-anchor-grade-v2` |
| rider / human coach / AI coach | `manual` | `self` / `human-coach` / `ai-coach` |

The Karoo's parsers reject unknown properties and unknown `generator.type` values
(`TransferPackage.kt`), so provenance rides in `modelVersion` (any non-blank string up to 100
characters). `targetFinishTimeSeconds` is omitted when the document had none. The phone refuses to
send a plan whose FTP differs from the rider's current FTP (the Karoo requires the plan FTP to
match its installed profile).

## Versioned rider profile

`athlete_profile.profile_version` (migration v10) starts at 1 and is bumped by
`setAthleteProfile` in the same SQL statement, only when FTP, weight, or max HR actually changes
(re-saving identical values never bumps; several changes in one save bump once).
`getAthleteProfile` returns `profileVersion`. Each saved plan records the `profile_version` and
`ftp_watts` it was written against (`segment_plans`, migration v11).

A plan is **outdated** exactly when the rider's FTP has moved
(`isSegmentPlanOutdated`): absolute watt targets depend on FTP, and the Karoo refuses an FTP
mismatch. A weight or max-HR edit bumps the version but does not invalidate watts. An outdated
plan blocks sending and tells the rider to import an updated plan or switch back to the generated
one. (Plans given as `targetPercentFtp` are converted to watts at import, so they also need
re-importing after an FTP change; automatic re-derivation is a possible follow-up.)

## Proposed Karoo-side extension (for Codex; not implemented, not required)

The phone cannot send any of this until the Karoo build accepts it, because the current parser
fails on unknown properties and there is no capability handshake.

1. Accept `generator.type` values `self`, `human-coach`, `ai-coach` (alongside `phone-ai`,
   `cloud-ai`, `manual`), stored in `PacingPlanEntity.source`.
2. Accept an optional `riderProfileVersion` (positive int) in `riderHistory` and in the baseline
   plan; persist it with the installed profile and the plan, and show a "plan built for an older
   profile" hint when they differ. This is the Karoo half of the plan's "versioned rider profile".
3. Before the phone switches to the richer values, add a way for it to learn the Karoo's
   transfer-schema capability (for example the receive screen's address page or an HTTP `GET
   /capabilities`), so a new phone never sends fields an old Karoo build rejects.

Until then provenance in `modelVersion` is the compatible encoding, and the stored
`segment_plans.source` / `profile_version` keep the phone's own record exact.

## Not covered

- No cloud service, no direct LLM call, no API key: the AI coach is whatever the rider pastes in.
- No automatic plan revision from ride results; no per-zone editing UI (edit the JSON, re-import).
- Source, author and notes are not sent to the Karoo (only the source word, in `modelVersion`).
