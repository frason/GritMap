# iPhone lessons and implementation plan from KGhost

Date: 2026-10-01

## Outcome

KGhost's most useful ideas for GritMap's iPhone app are operational rather than visual. The
iPhone should be the authoritative library and planning surface, while the Karoo remains the
live, deterministic execution surface. The phone needs to know which plan was generated,
which rider inputs produced it, whether the Karoo actually installed it, and whether new ride
history or profile changes have made it stale.

The KGhost concepts worth adapting are:

- Separate an authoritative scalar result from its visualization. For GritMap this means a
  persisted plan/benchmark and pace delta must not depend on where a pacer marker is drawn.
- Make degraded data explicit with quality states rather than silently continuing as if live
  data were complete.
- Persist compact checkpoints and summaries, not the complete live telemetry stream.
- Keep imports idempotent, bounded, resumable, and observable.
- Expose useful extension data through stable contracts so other presentation surfaces do not
  duplicate the calculation.

Do not copy KGhost's actual-path ghost matching into GritMap's segment matcher. GritMap's
directed reference-polyline matcher remains authoritative.

## Current iPhone gaps found in the repository

1. A successful transfer currently means only that the Karoo HTTP receiver returned a success
   status. `sendGuidancePackageToKaroo()` explicitly notes that the Karoo can reject the package
   asynchronously after the phone has already received HTTP 200.
2. The iPhone does not persist generated pacing plans. It regenerates a plan from the current
   FTP and goal when rendering/sending, so it cannot show exact provenance or distinguish an
   installed plan from a newly recomputed one.
3. There is no device inventory or receipt model. Segment rows cannot say `Installed`,
   `Outdated`, `Failed`, or `Unknown` for a particular Karoo.
4. The athlete profile has current FTP, weight, and max HR, but generated plans do not have a
   durable freshness relationship to later profile changes.
5. The segment list shows only name and matching corridor. Plan readiness and device state are
   invisible until the rider opens a segment.
6. Attempt history already exists on the phone, which is the correct foundation for best,
   recent, and representative benchmarks. It should not be rebuilt as a large history library
   on the Karoo.
7. Transfer currently uses unauthenticated local HTTP. A same-network sender can post to the
   open receiver while it is active. Reliable acknowledgments should be designed together with
   a short-lived pairing token.

## Domain contracts

### Plan provenance

Persist a generated plan rather than treating it as transient UI output:

- `planId`
- `segmentId` and `segmentFingerprint`
- `schemaVersion` and `generatorVersion`
- `createdAtMs`
- `profileRevision` or the exact FTP/weight/max-HR inputs used
- `targetDurationMs`
- target zones and validation result
- optional source benchmark attempt IDs

Derived phone state:

- `missing`: no plan exists
- `ready`: plan matches current segment fingerprint, goal, and athlete inputs
- `outdated-profile`: FTP/profile changed
- `outdated-goal`: goal changed
- `outdated-segment`: segment fingerprint changed
- `invalid`: stored plan fails current validation

### Device sync state

Track this separately from plan readiness:

- `not-sent`
- `sending`
- `installed`
- `outdated`
- `failed`
- `unknown`

A sync receipt should contain device ID, Karoo app version, package ID, segment fingerprint,
plan ID, import timestamp, and a structured result/error code.

### Guidance quality

Use the same vocabulary on the phone and Karoo:

- `live`: all required signals are current
- `estimated`: a bounded fallback is in use
- `stale`: last value is shown but should not drive adaptation
- `unavailable`: guidance cannot be calculated

The deterministic matcher stays active independently of AI/adaptive guidance quality.

## Delivery plan

### Phase 1 — truthful transfer and pairing

Highest priority because the current success message is ambiguous.

1. Define a versioned transfer response with `received`, `validated`, `persisted`, and
   structured failure results.
2. Change the Karoo receiver so it waits for parsing and the Room transaction before returning
   the final response.
3. Add a short-lived pairing token displayed by the Karoo receive screen and required by the
   phone request.
4. Add a lightweight capabilities/status endpoint returning app version, protocol version,
   device identifier, current FTP availability, installed segment fingerprints, and installed
   plan IDs.
5. Update the iPhone sender to parse the receipt, persist it, and report `Installed` only after
   Karoo confirmation.
6. Preserve a clear timeout/unknown state: a lost response must not be presented as failure or
   installation without a later inventory reconciliation.

Tests: receipt parsing, rejection propagation, timeout-to-unknown, token rejection, idempotent
resend, and inventory reconciliation.

### Phase 2 — persisted plans and readiness UI

1. Add phone migrations for generated pacing plans, plan zones, device records, and sync
   receipts.
2. Move plan construction behind a repository/service that validates and saves an immutable
   plan version.
3. Add pure freshness evaluation comparing the stored plan with the current segment
   fingerprint, active goal, athlete profile, and generator version.
4. Add a compact status badge to each segment row: `No plan`, `Ready`, `Update plan`,
   `Installed`, or `Send again`.
5. Add a Plan Readiness card to segment detail showing goal, generated-for FTP, current FTP,
   plan source/version, generated date, and Karoo state.
6. Replace the manually repeated Karoo address with a remembered paired-device record.

Tests: every freshness transition, old-schema migration, plan replacement without mutating old
receipts, and segment/profile/goal change behavior.

### Phase 3 — attempt summaries and diagnostics back to the phone

1. Define a bounded `SegmentAttemptSummary` transfer contract from Karoo to phone.
2. Include elapsed time, coverage, deviation/gap summary, aggregate sensors, plan adherence,
   guidance-quality intervals, matcher version, plan ID, and completion reason.
3. Do not transfer or duplicate the entire 1 Hz telemetry stream by default.
4. Add an opt-in advanced diagnostic package with bounded samples and explicit privacy copy.
5. Reconcile attempts idempotently by stable attempt ID.
6. Show incomplete/estimated/stale intervals clearly in attempt review.

Tests: duplicate pull, interrupted pull, redaction, bounded payload size, and missing-sensor
attempts.

### Phase 4 — history-derived benchmarks

1. Build best, most recent, and representative/median benchmarks from the phone's existing
   accepted attempts.
2. Compare only attempts matched to the same directed segment definition/fingerprint.
3. Resample benchmark progress by distance, with elapsed time remaining an explicit separate
   series.
4. Let the rider choose the plan basis: goal time, personal best, recent representative effort,
   or fastest sustainable prediction.
5. Record selected benchmark IDs in plan provenance.
6. Send only the compact active benchmark/plan needed for live execution to the Karoo.

Tests: direction/fingerprint isolation, missing sensors, paused-time semantics, benchmark
selection, and deterministic regeneration.

### Phase 5 — device preferences and extensibility

1. Let the phone configure Karoo presentation preferences such as data fields, optional pacer
   marker, units, and alert behavior, while respecting Karoo's own global settings where its API
   exposes them.
2. Publish stable calculated values from the Karoo extension only where third-party consumers
   have a real use; do not duplicate calculation on the phone and Karoo.
3. Add per-Karoo capability negotiation so older extension versions receive compatible
   packages.

## Recommended first implementation slice

Implement Phase 1 before adding any ghost/history UI. The smallest coherent increment is:

1. shared TypeScript/Kotlin transfer receipt schema;
2. synchronous Karoo validation/persistence response;
3. iPhone parsing and accurate user-facing result;
4. idempotent package handling;
5. tests on both sides.

Pairing tokens and inventory can follow immediately in the second increment if keeping the
first diff small is important. Plan persistence and status badges should begin only after the
phone can trust the Karoo's acknowledgment.

## Explicit non-goals

- Do not replace directed segment matching with actual-path ghost matching.
- Do not move the full ride/attempt history onto the Karoo.
- Do not use GPS route similarity for duplicate-ride detection.
- Do not let an AI plan or visual pacer become authoritative for segment start/completion.
- Do not label a package `installed` from network delivery alone.
