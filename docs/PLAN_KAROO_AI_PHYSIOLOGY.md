# GritMap Karoo AI and Physiology Plan

- Status: proposed architecture for review
- Updated: 2026-10-05
- Scope: Polar H10 physiology, standard-HR fallback, RR retention, user-supplied coaching
  guidance, GritMap's future planning product, and bounded on-device Needle adaptation

## Executive decision

GritMap should grow into a complete training and pacing product while remaining the route-aware,
real-time execution layer for segment plans. Until GritMap's own planning intelligence is ready,
the phone accepts structured guidance supplied by the rider, a human coach, or an AI coach.
Deterministic Karoo logic owns segment matching and attempt state; physiology measures the cost
of executing the plan; and Needle may eventually recommend small, validated changes locally.

The next implementation milestone should be a Polar H10 feasibility spike, not active Needle
control. We first need trustworthy physiological inputs and Karoo 3 performance measurements.

### Implementation status — 2026-10-05

The first isolated foundation is implemented under `apps/karoo/.../physiology`:

- Conservative RR acquisition validation that preserves original intervals and flags hard errors.
- A pure standard-BLE Heart Rate Measurement parser for BPM, contact state, and every RR value
  contained in an H10-style notification.
- A duration- and count-bounded live calculation window with lifetime quality counters.
- A crash-recoverable, fixed-record raw RR artifact with schema versioning.
- Atomic finalization, SHA-256 verification and safe ride-ID/path handling.
- Nine passing focused JVM tests covering BLE decoding, validation, quality gating, bounded memory,
  finalization, truncated partial recovery and path traversal rejection.

It is intentionally not wired into Bluetooth, the foreground ride service, Room or UI yet. That
keeps the file boundary isolated while the direct H10 connection lifecycle is reviewed.

The subsequent desk-test diagnostic slice is also implemented but not yet device-verified:

- Android 12 Bluetooth scan/connect permissions.
- Standard Heart Rate Service discovery and notification subscription through GATT.
- A dedicated non-exported H10 diagnostic screen opened from GritMap Settings.
- Sensor discovery/selection, connect/disconnect, live BPM/RR/contact/quality display, and
  start/stop artifact capture.
- Multi-RR packet timestamp mapping and an end-to-end capture-controller test.
- Twelve focused physiology tests pass and a debug APK builds successfully.

This diagnostic path remains separate from the foreground ride service and is not yet used for
live pacing or HR Drift. Physical H10/Karoo validation is the next gate.

```text
GritMap phone app
    -> GritMap-generated or user/coach-supplied baseline plan and rider profile
GritMap deterministic Karoo engine
    -> segment match, route progress, attempt state, pacer, safety
Physiology engine
    -> power, HR, RR, cardiac drift, HR cost, W' and durability
Needle on Karoo
    -> optional bounded recommendation
Deterministic validator
    -> accepted plan delta or unchanged safe plan
Karoo data fields and map pacer
```

## Product boundaries

### Deterministic GritMap logic remains authoritative

- Start candidate discovery and directed segment matching.
- Route progress, corridor deviation and off-route handling.
- Segment selection, locking, completion and abandonment.
- Pacer position, timing and finish projection.
- Sensor validity, confidence gates and safety limits.
- Baseline plan fallback and the last validated plan.

Needle must never start, select, complete or abandon a segment.

### GritMap phone planning layer

- Initially accepts structured plan guidance entered by the rider or supplied by a human or AI
  coach, while validating and normalizing it into GritMap's versioned plan contract.
- Uses route/elevation, current FTP, rider profile and target time to create a complete baseline
  segment pacing plan.
- Eventually incorporates GritMap's own athlete history model, performance prediction, training
  planning and plan-generation intelligence.
- Sends the segment, rider-profile version and plan to Karoo.
- Receives summaries after the ride when connectivity returns.

### Needle on Karoo

- Evaluates a small structured decision every ten seconds or on important events.
- Keeps the plan, freezes adaptation, or proposes a tightly bounded plan delta.
- Operates offline and never becomes a free-form conversational coach during a segment.

## Physiological capability levels

### Level A: Polar H10 Enhanced

GritMap connects directly to the H10 Bluetooth Heart Rate Service and reads:

- Heart rate in BPM.
- Beat-to-beat RR intervals.
- Connection and data-quality state.
- Sensor battery where available.

RR intervals enable research and calculation of:

- DFA alpha 1.
- Beat-level HRV quality.
- Respiration-frequency estimates.
- Artifact rate and signal confidence.
- Aerobic-threshold proximity.
- Better confidence for cardiac drift and durability signals.

The H10 supports two simultaneous Bluetooth connections. The initial device configuration should
prefer leaving normal Karoo HR recording intact while GritMap uses another connection for RR. In
the user's existing FIT files, Karoo recorded the Polar sensor over ANT+; that is an especially
useful arrangement because Karoo can retain ANT+ BPM while GritMap consumes Bluetooth RR.

Use the standard Bluetooth Heart Rate Service first. The current Polar Android SDK advertises a
minimum Android API above this project's API 31 target, and raw 130 Hz ECG is not required for
the first physiological feature set. ECG and accelerometer streaming remain post-spike research.

### Level B: Standard HR

For other heart-rate straps, consume ordinary BPM supplied by Karoo. Provide:

- Current and rolling heart rate.
- Cardiac drift.
- HR cost in BPM per 100 W.
- Power-to-HR efficiency.
- Time above configured thresholds.
- HR response lag and post-effort recovery.
- Confidence-weighted physiological strain.

Do not claim DFA alpha 1, beat-level HRV or RR-derived respiration without valid beat intervals.

### Level C: No HR sensor

Continue deterministic operation using power, W' balance, cadence, speed, route progress,
plan adherence and pacer position. Stored HR settings do not become fabricated live HR data.

## Global rider profile

FTP and physiological settings belong to one versioned rider profile, not individual segments:

- FTP.
- Weight.
- Maximum HR.
- Resting HR.
- Lactate-threshold HR, optional.
- Aerobic-threshold HR, optional.
- Preferred HR sensor and H10 device identifier.
- H10 Enhanced mode enabled/disabled.
- Automatic threshold suggestions requiring user confirmation.

Value precedence should be:

1. A versioned rider profile sent by the phone.
2. GritMap global settings on Karoo.
3. Karoo user settings exposed by the SDK.
4. Conservative estimates clearly labeled as estimates.

Plans reference the rider-profile version that generated them. A material FTP/profile change
marks dependent plans outdated instead of silently changing absolute targets.

## H10 live data pipeline

### Connection lifecycle

1. Discover or reconnect to the configured H10.
2. Subscribe to standard Heart Rate Measurement notifications.
3. Extract BPM and every RR value contained in each notification.
4. Cross-check BPM against Karoo's HR stream when both exist.
5. Expose `H10 Enhanced`, `Standard HR`, `Signal poor`, and `Disconnected` states.
6. Reconnect with bounded backoff without blocking ride recording, rendering or matching.
7. Fall back to Karoo BPM immediately if the direct connection disappears.

### Signal cleaning

- Reject impossible RR values and discontinuities.
- Detect likely missed/extra beats and transient contact artifacts.
- Preserve the raw sample and attach a validity/artifact flag rather than destructively rewriting it.
- Track valid-RR percentage and consecutive valid duration.
- Require a minimum quality threshold before exposing RR-derived guidance.
- Freeze RR-derived adaptation when quality falls below that threshold.

### Calculation windows

Initial values to validate with real rides, not permanent clinical constants:

- Responsive BPM: 5-15 seconds.
- HR cost: 1-3 minutes.
- Cardiac drift: longer stable-power comparisons.
- DFA alpha 1: approximately two minutes of artifact-cleaned RR.
- Respiration estimate: a rolling RR-derived window.
- Physiological baseline: only after sufficient stable and valid data.

## RR storage and privacy

### Research/MVP behavior

For the owner's development installation, retain the raw RR stream by default so algorithms can
be re-evaluated against the same ride. For an eventual public release, default to summaries only
and require an explicit opt-in to retain raw physiological data.

### Storage design

Do not insert every heartbeat into Room. During a ride:

- Keep only the working calculation window in memory.
- Append raw RR observations to a compact temporary artifact off the main thread.
- Bound memory regardless of ride duration.
- Finalize the artifact atomically at ride end.
- Preserve a recoverable incomplete artifact after a crash or process death.

The artifact is associated with the source ride and contains only physiology timing data:

```text
RrObservation
- elapsedMs relative to the ride timeline
- rrIntervalMs
- valid
- artifactReason, optional
```

Store indexed summaries in Room:

```text
RidePhysiologySummary
- rideId
- schemaVersion
- algorithmVersion
- sourceType
- sensorIdHash
- totalRrCount
- validRrPct
- averageHeartRate
- average/minimum DFA alpha 1, optional
- average respiration rate, optional
- threshold crossing summaries
- artifact count
- rawArtifactPath, nullable
- rawArtifactHash, nullable
```

### Retention controls

- `Summaries only`.
- `Retain raw RR`.
- `Delete raw physiology after N days`, optional.
- `Delete physiological data for this ride`.
- No cloud upload without an explicit user action and documented destination.
- Sensor identifiers are hashed before persistence.

### FIT behavior

Existing Karoo FIT files do not contain RR/HRV messages. A local audit of all 12 FIT files in the
owner's Downloads folder found ordinary heart-rate records but no FIT HRV messages, RR fields,
DFA alpha 1 fields or respiration fields. The 2026-09-13 ride identified the Polar sensor as an
ANT+ heart-rate device and recorded BPM on every record.

GritMap may write compact derived summaries such as DFA alpha 1, valid-RR percentage and
respiration into FIT developer fields for portability. The complete raw RR artifact remains a
separate local file because multiple beat intervals per second do not map cleanly to ordinary
one-second ride records.

## Physiology engine contract

The calculation layer emits immutable framework-neutral state:

```text
PhysiologyState
- source: H10_ENHANCED | STANDARD_HR | NONE
- heartRateBpm
- signalQuality
- validRrPct, optional
- hrCostBpmPer100W, optional
- cardiacDriftPct, optional
- efficiencyIndex, optional
- dfaAlpha1, optional
- respirationRate, optional
- aerobicThresholdState, optional
- durabilityState
- confidence
- adaptationAllowed
```

Power remains the primary pacing signal. HR measures physiological cost, W' estimates finite
capacity above critical power, and DFA alpha 1 adds an experimental autonomic/aerobic signal.
No one metric is permitted to change a plan independently.

## GritMap planning product direction

GritMap should eventually provide its own athlete model, performance predictions, training-plan
generation, readiness context and route-specific pacing recommendations. It must not depend on
another coaching or planning product.

The interim input path is deliberately provider-neutral:

- The rider can enter guidance manually.
- A human coach can supply a pacing prescription.
- An AI coach can supply the same versioned structured guidance.
- GritMap validates, normalizes and previews every imported plan before it reaches Karoo.
- Source/provenance is recorded for review, but it never changes the runtime contract.

Regardless of where guidance originates, the product architecture remains:

- Historical modeling and full-plan creation run in the GritMap phone application or future
  GritMap services.
- Concrete, versioned power prescriptions are sent to Karoo.
- Focused immediate signal processing and safe bounded adaptation run locally.
- Power is primary; HR/RR describe the cost and sustainability of that output.
- Karoo remains functional offline during the ride.

## Needle decision contract

Needle receives only compact current context:

- Current/target watts and current/next zones.
- Time and distance ahead/behind.
- W' reserve versus plan.
- HR cost and cardiac drift.
- DFA alpha 1 and respiration only when valid.
- Cadence, speed, remaining distance/elevation and sensor confidence.

Allowed structured actions:

```text
KEEP_PLAN
ADJUST_CURRENT_TARGET
ADJUST_FUTURE_ZONES
FREEZE_ADAPTATION
```

REST/HOLD/PUSH is an instruction enum, not unrestricted generated prose. Initial target changes
should be capped around +/-10-15 W, subject to existing FTP and transition constraints. Every
response is parsed, validated, clamped or rejected atomically. Ahead/behind status alone does
not justify changing power.

The current concept of regenerating a complete pacing plan every ten seconds should be replaced
with sparse deltas. Unchanged decisions do not produce database writes.

## Needle implementation and benchmark gate

The existing repository contains scaffolding for model installation, hashing, timeout fallback,
serialized inference, telemetry, response parsing and validation. It does not currently ship or
run Needle. The current JNI bridge targets a general Cactus dynamic runtime and model directory,
while official Needle 2 deployment provides an Android ARM64 static library plus a `.cact`
artifact.

Required implementation:

1. Pin an exact Needle 2 commit, Android ARM64 library, header, model artifact, hashes and license.
2. Replace or isolate the general-Cactus JNI bridge with a Needle-specific static bridge.
3. Package/copy/hash-verify the model in private storage.
4. Wire the guidance engine into the active attempt lifecycle.
5. Enforce structured output, offline operation and non-concurrent inference.
6. Add a complete feature kill switch and deterministic fallback.

Before live adaptation, benchmark on Karoo 3:

- Cold initialization time.
- Warm inference p50/p95.
- Additional process RSS and native allocation.
- CPU, thermal and battery impact over a simulated hour.
- Rendering/map responsiveness while inference and H10 processing run.
- Timeout, malformed-output and native-failure recovery.

Compatibility appears plausible, but operational suitability remains unproven until this gate.

## Delivery phases

### Phase 1: deterministic physiology foundation

- Versioned global rider profile.
- Stable BPM ingestion.
- HR cost, cardiac drift, efficiency, quality and confidence contracts.
- Standard HR and no-HR fallbacks.

### Phase 2: H10 Enhanced feasibility spike

- Direct standard-BLE HR/RR connection on Karoo 3.
- Simultaneous normal Karoo HR recording.
- Raw RR artifact writer and Room summaries.
- Artifact filtering, valid-RR percentage and connection UI.
- Real ride with power and comparison to FIT BPM.

### Phase 3: RR-derived research mode

- DFA alpha 1 and respiration estimates.
- Versioned algorithms and diagnostic review.
- Compare derived metrics against independently calculated fixtures and repeatable ride replays.
- No pacing influence yet.

### Phase 4: Needle benchmark

- Pinned Needle 2 integration.
- Structured action schema.
- Karoo performance, memory, battery and thermal measurements.

### Phase 5: shadow adaptation

- Needle recommendations are logged but do not alter the visible plan.
- Evaluate validity, oscillation, rejection rate and retrospective usefulness.

### Phase 6: bounded live adaptation

- Apply only validated small deltas under adequate confidence.
- Explain plan changes in concise deterministic UI language.
- Freeze immediately on missing/stale physiology while retaining safe deterministic pacing.

### Phase 7: GritMap planning product

- Phone supports manual, human-coach and AI-coach guidance through one validated plan contract.
- GritMap progressively adds its own rider-history model, performance predictions, training
  planning and baseline plan generation.
- Phone sends the complete baseline plan, provenance and profile version.
- Karoo adapts locally and remains offline during the ride.
- Completed summaries return later.

## Verification criteria for the H10 spike

### Current implementation checkpoint (2026-10-05)

Karoo build `0.10.38` contains a private diagnostic and ride-service path for standard Bluetooth Heart Rate
Service capture. It scans with a bounded timeout, connects to the HRS measurement characteristic,
parses BPM/contact/multiple RR values, derives clearly labelled diagnostic HR/RMSSD/SDNN values,
and retains raw observations in an app-private fixed-record artifact. The recent 120-second window
drives the validity gate; lifetime counters remain summary-only. RR timing advances from sensor
intervals with only a bounded correction toward notification arrival time, so Android delivery
jitter cannot move valid beats backward.

Partial files are created exclusively and never overwrite a recoverable capture. The writer makes
the header and 30-second checkpoints durable with `FileDescriptor.sync()`, finalizes without
replacing an existing artifact, and exposes incomplete captures in the diagnostic screen. BLE
state updates are atomic, stale GATT callbacks are ignored, and malformed packets are counted and
skipped without falsely declaring the live connection failed. Eighteen focused JVM tests, Android
lint, and the debug APK build pass. A first physical H10 desk capture succeeded with 163 RR
observations, the enhanced gate READY, exact artifact length/header and SHA-256 verified, and no
app/GATT error. Service ownership and the complete recorded-ride lifecycle are now physically
verified: BLE RR capture remained active after returning to the native ride screen while ANT+ HR
continued, persisted through Paused, then finalized 265 records and disconnected on Idle. This
remains a feasibility spike: process-kill recovery, saved-address reconnect/backoff, ride-timeline
alignment, export/deletion, and raw 1/1024-second preservation are not yet verified or complete.

Build `0.10.39` adds automatic approach preparation: a throttled 250 m coarse lookup reconnects a
locally remembered H10 and begins RR warm-up without changing the 30 m directed matcher. With no
confirmed device it never scans during a ride, preventing capture of another rider's strap, and
silently falls back to standard HR.
An abandoned approach releases H10 after three minutes; segment completion provides a two-minute
grace for nearby segments. Unit/lint/build verification passes; a moving approach test is pending.

Build `0.10.40` hardens that preparation with bounded 2/5/10-second recovery for a GATT error or
unexpected disconnect. Exhaustion is explicit and retains standard Karoo HR rather
than looping. Diagnostic events cover approach request through capture, retry, fallback and release.
The RR artifact format and matching thresholds remain unchanged pending the moving test.

The offline `0.10.41` candidate adds explicit RR discontinuity handling. A clear dropout immediately
re-anchors the beat clock, persists the first returning interval as `GAP_AFTER_DROPOUT`, resets the
clean-window gate, and prevents variability calculations from pairing beats across invalid data.
This candidate remains off-device until the staged 0.10.40 approach test is complete.

The same offline candidate now completes the next storage/analysis boundary. RR persistence is
owned by a bounded, ordered background writer, so the Bluetooth callback performs no file I/O;
overflow or sink failure is surfaced explicitly and leaves the partial capture recoverable. Each
capture has a UUID identity that can be enriched with the selected segment and attempt, and a
finalized artifact receives an atomic JSON sidecar containing those IDs, its schema, sample count,
start time and SHA-256. Artifact schema 2 preserves the H10's native 1/1024-second interval value;
the reader and post-ride analyzer remain backward-compatible with schema 1 millisecond artifacts.
A new TypeScript CLI combines a FIT ride, service log and one or more RR artifacts into a human and
JSON report covering approach latency, retries/fallback, capture/attempt timing, RR gaps/quality and
RR-vs-FIT heart rate. These changes are source-only and have not replaced device build 0.10.40.

- Karoo records uninterrupted ordinary HR while GritMap receives RR.
- No loss of power, GPS or cadence subscriptions.
- RR capture survives a 60-minute simulated/live session with bounded memory.
- Reconnect does not block matching or UI updates.
- Invalid RR is flagged rather than silently corrected.
- A process restart recovers an incomplete artifact without declaring it complete.
- Summary-only mode leaves no raw artifact after finalization.
- Retain-raw mode produces a hash-verifiable artifact aligned to the ride timeline.
- Removing the H10 causes a clean fallback to Standard HR or No HR.
- No medical or threshold conclusion is displayed below the quality/confidence gate.

## Decisions requiring later validation

- Exact RR artifact encoding and compression format.
- Minimum valid-RR percentage and stable duration for each metric.
- DFA alpha 1 algorithm/library and artifact-correction method.
- Whether Karoo and GritMap should use ANT+ plus BLE or two BLE connections in production.
- Which derived summaries should be written into FIT developer fields.
- Public default retention duration for raw RR.
- Quantitative Needle benchmark acceptance thresholds.

## Research references

- [Needle 2 model card](https://huggingface.co/Cactus-Compute/needle2)
- [Needle repository](https://github.com/cactus-compute/needle)
- [Polar H10 SDK capabilities](https://github.com/polarofficial/polar-ble-sdk/blob/master/documentation/products/PolarH10.md)
- [Polar BLE SDK](https://github.com/polarofficial/polar-ble-sdk)
- [Polar H10 user manual](https://support.polar.com/e_manuals/h10-heart-rate-sensor/polar-h10-user-manual-english/manual.pdf)
- [Hammerhead karoo-ext](https://github.com/hammerheadnav/karoo-ext)

## Requested Claude review

Claude should review this plan before implementation and return concrete findings, not a rewrite.
Please focus on:

1. Android API 31 feasibility of direct standard-BLE H10 HR/RR capture without the current Polar SDK.
2. Connection ownership and lifecycle hazards alongside Karoo's own ANT+/BLE sensor handling.
3. Crash-safe, bounded raw RR artifact storage without per-beat Room writes.
4. FIT developer-field limitations for derived physiology summaries.
5. Whether the Needle 2 native packaging assessment matches the current upstream ABI/artifacts.
6. Missing privacy, consent, deletion or export requirements for physiological data.
7. Any unsafe coupling with current uncommitted Karoo and phone work.
8. A recommended minimal file-level implementation boundary for the H10 feasibility spike.

Claude should record its review in a separate document and update `handoffs/LATEST.md`; it should
not begin implementation until the review is accepted.
