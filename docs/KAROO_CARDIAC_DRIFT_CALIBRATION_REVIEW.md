# Cardiac Drift stays collecting: source review and proposed correction

2026-11-02. Read-only runtime investigation requested in main handoff at `6826089`.
No app edits, build, test execution, device access, log pull, FIT read or installation in this review.
This note concerns GM Cardiac Drift; GM H10 Cardiac is a separate RR-quality pipeline.

## Conclusion and version correction

The code supports several indefinite waiting paths. It does **not** establish which path occurred
on the owner's reported ride without ride/evidence correlation. A confirmed presentation defect is
that unavailable drift after a previously valid baseline is labelled **COLLECTING BASELINE**, just
like a baseline that has never existed. A higher steady workload can leave that label indefinitely.

The coordinator's assumption of version 70 is stale. This chat verified an approved in-place install
of **76 / 0.10.46-screen-preview** on October 31, built from `efaf5f6` (runtime `e7a7c45`), and verified
startup and a library of 7 installed / 7 ready segments. That is the last known installed version,
not proof of what was running during the reported ride if any later update happened elsewhere.
Installation evidence: `handoffs/archive/2026-10-31-karoo-glance76-installed.md`.
Version76 uses `CardiacDriftDataType` → `GlanceGraphicDataType` → `GlancePresentation` /
`GlanceFieldRenderer`. The old `CardiacDriftBitmapRenderer` is no longer the registered field renderer.
No literal CALIBRATING exists in that version 76 rendering path: it says BASELINE, HR RESPONSE,
COLLECTING BASELINE/COLLECTING, or a sensor warning. Exact field title and words matter.

## Input and lifetime gates

Source paths below are under `apps/karoo/app/src/main/java/com/gritmap/karoo/`.

| Stage | What prevents progress / changes the result | Source |
|---|---|---|
| Service startup | Fine-location permission missing; service start/foreground failure; Karoo connection/ride events unavailable | `service/LiveServiceStarter.kt:10`, `service/LiveSegmentService.kt:347` |
| Recording | Consumers start only for RideState Recording **or Paused**. Paused is not separately excluded. Ended/other stops consumers and finishes attempt. | `service/LiveSegmentService.kt:421` |
| Tick cadence | Only location callback calls onTelemetry. Power/HR callbacks update retained values but do not enqueue their own processing ticks. Channel is conflated; slow work can drop intermediate ticks. | `service/LiveSegmentService.kt:174`, `:362`, `:383`, `:444` |
| Sensor freshness | Power, HR and GPS values must have timestamps at most 3000ms old and not in the future. Sanitization nulls stale values. | `service/ActiveAttemptSession.kt:31`, `:42` |
| Segment scope | Coordinator returns without valid lat/lng or a viable candidate. Starting requires a stored start near rider, valid direction and forward confirmation. Drift tracker is owned by each ActiveAttemptSession, not the entire ride. No matched attempt means no ride-wide drift computation. | `service/LiveSegmentCoordinator.kt:56`, `:115`, `:224`; `service/ActiveAttemptSession.kt:93` |
| Restart/reset | New/replaced/finished/abandoned attempts discard the tracker. Ride end and service destruction clear UI. A succession of short efforts does not combine into one baseline. | `service/LiveSegmentService.kt:236`, `:275`; `service/LiveSegmentCoordinator.kt:115` |
| Drift update | updateAttempt calls session.recordCardiacDrift only for the matched attempt. Concurrent path also uses per-session tracker, but concurrency is OFF in installed 76. | `service/LiveSegmentService.kt:453`; `service/ConcurrentLiveRide.kt:191` |

GPS is thus an upstream processing dependency even though the drift formula itself uses power/HR.
When GPS updates stop, the state can freeze rather than producing a new reason every second. A
field visible during a whole ride does not imply a tracker ran for that entire ride. Idle state
has no current HR and can show NO HR; do not equate every absent value with baseline collection.

## Exact tracker gates (installed defaults)

`pacing/CardiacDriftTracker.kt:22–125`:

1. Non-increasing timestamps are ignored. Timestamp advancement comes from wall-clock time in
   the live service; a backwards clock step can freeze progress until timestamps catch up.
2. A gap between processed samples **greater than 10s** clears baseline, current drift, response,
   history and accumulated eligible time. Exactly 10s is not this reset case.
3. Only finite **power >=100 W and HR >=80 bpm** qualify. These are hard-coded absolute thresholds,
   unrelated to FTP or HR zones. Missing, NaN, low-power pedalling and coasting fail eligibility.
4. Any invalid sample breaks the paired-time chain. More than 10s of continuous invalid samples
   clears baseline/history/paired time. Shorter interruptions do not count invalid duration; they
   may temporarily retain an older result while enough rolling samples remain.
5. Eligible duration sums intervals between consecutive eligible processed samples, each capped
   at 2s. At least 180000ms is required. It is **not three minutes since ride start**, and at sparse
   cadence eligible time can advance slower than elapsed time.
6. Rolling eligible samples older than 120s are removed. At least 60 samples must remain. A tick
   every 3s yields only 41 eligible samples in that window, so it cannot establish a baseline,
   however long the ride lasts. Sensor callback cadence and GPS cadence are distinct.
7. Baseline establishment also requires power coefficient of variation <=0.12 over that rolling
   sample window. Persistent variable power can prevent establishment forever even with hours
   of eligible time and 100% paired samples. There is no timeout or forced baseline.
8. After establishment, a drift result still requires >=60 rolling samples, positive baseline,
   CV<=0.12, and current rolling mean power within 15% of the **frozen** baseline mean power.
   If the rider establishes 200W then settles at 300W, the eventual stable 300W window is still
   incomparable. No automatic reference change occurs; drift becomes null indefinitely until
   power returns near baseline or a reset happens.
9. Paired percentage is cumulative since a timestamp-gap reset (invalid-duration reset does not
   reset both counters); it is not the rolling coverage or a baseline-readiness guarantee.

No direct gate requires an FTP, HR zone, stored pacing plan, H10 BLE RR, DFA alpha1, maxHR,
profile weight or H10 enhanced availability. FTP/plan affect other metrics, not these baseline
conditions. Native Karoo HEART_RATE/POWER streams supply this metric; H10 RR capture does not
backfill a missing native HR stream. Native HR can originate from an H10 connected to Karoo,
but that is different from the extension's independent RR client.

## Display gates and known ambiguity

`ui/state/LiveUiState.kt:69` and `ui/GlancePresentation.kt:69`:

- Missing current HR → WAITING_FOR_HR / NO HR. Missing both rolling and current power → HR RESPONSE.
- Null drift **or** validSeconds < 180 → HR RESPONSE / BASELINE / COLLECTING BASELINE.
- Non-null drift with 180–359 eligible seconds → DRIFT FORMING / EARLY TREND.
- Non-null drift with >=360 eligible seconds → mature drift display.
- Active field missing-power/missing-HR sensor flags override verdict/support with explicit warnings;
  renderer may hold a neutral LAST value up to 5s, then --. Idle/nonactive paths have different overrides.

In particular, validSeconds>=360 does not guarantee a number: power comparability and CV can
null it again. Treating all those cases as initial baseline collection is the presentation defect.

## Is it fixed later?

`d38057f` added progressive HR-response/early/mature presentation, keeping180s baseline,120s rolling,
60 samples,100W/80bpm defaults. `c9da364` later added elapsed-paired time, strict resets,12% baseline
steadiness and15% comparable-power restrictions. Those restrictions reduce misleading drift but
also create the indefinite no-result paths above. Version76 changed UI without changing tracker.

At fetched main `6826089`, CardiacDriftTracker bytes match the installed-source tracker exactly
(SHA256 `55825d67d10f7d1b36f46354446573d9f55953acf7a7aff397dff9410d780858`).
The coordinator/service paths reviewed also have no later changes from installed source. There
is no known later tracker fix on main. This review does not treat the unmerged screen branch as main.

## Proposed correction (not implemented)

1. Add explicit tracker readiness/reason state and counts: no active segment, unavailable HR/power,
   low eligible power/HR, interrupted sample stream, collecting eligible seconds, insufficient rolling
   samples, variable power, comparable, and power differs from reference. Expose baseline-present,
   eligible seconds and coverage without relying on nullable drift. Define precedence deliberately.
2. Render the actual reason. Continue useful HR BPM / HR response when drift is unavailable; say
   POWER VARYING or DIFFERENT EFFORT when those gates fail, never COLLECTING BASELINE for an
   already-established but incomparable reference. Small fields get concise equivalents; accessibility
   carries full reason. Do not invent0% or display stale drift as current.
3. Keep current quality thresholds initially. Do not fix indefinite waiting by arbitrarily loosening
   CV, shortening baseline, counting coasting, or silently rebasing. Those change metric meaning.
   If ride evidence shows low-power exclusion or short-segment resets dominate, make the metric's
   scope/normalization a separate explicit decision. A ride-wide tracker would change today's
   per-segment meaning and needs a defined pause/stop/effort-change policy.
4. Decouple measurement ticking/freshness reporting from GPS-only callbacks if tests confirm
   starvation. Use a bounded monotonic 1 Hz sampler of native sensor state, calculate freshness
   independently, update ride physiology separately from route matching, and never count repeated
   stale data as fresh. This is a second step, not an assumption that the reported ride lost GPS.
5. Optional diagnostic instrumentation, if approved later: transition-only reasons, eligible seconds,
   rolling sample count, CV, relative workload and reset causes; omit GPS/rawHR/segment identity.
   Existing live logs do not record the tracker decision reason, so they cannot prove CV gates alone.

## Proposed synthetic replays BEFORE a runtime fix

Add failing contract tests to the real Kotlin tracker/presentation pipeline in a future approved
implementation. Use synthetic data only, default thresholds and 1 Hz ticks unless noted:

| Replay | Existing behavior to reproduce | Desired assertion |
|---|---|---|
| Stable200W/140bpm for 600s | baseline at180s, forming180–359, mature>=360 | Positive control, numeric drift≈0; no physiological claim beyond metric |
| Alternate150/250W each second,140bpm for 1200s | CV≈25%, no baseline although eligible time advances | Reason POWER VARYING, useful HR, never endless generic collection |
| 200W/140bpm for 240s then300W/140bpm for 600s | baseline exists; after transition current stable but mean exceeds reference by 50%; drift stays null | DIFFERENT EFFORT, baseline-present true, not collecting; no auto-rebase |
| 170s valid then 12s at 0 W, repeated 20 times | each coast resets eligible time; no baseline | Explicit interruption/collecting reason and reset count; no fake drift |
| 90W/140bpm for 1200s | HR exists but no eligible power samples | Low eligible effort distinct from disconnected meter |
| Identical new 120s segment sessions, repeated 10 times | per-attempt tracker never reaches180s | Explicit segment scope; no claim of ride-wide elapsed calibration |
| 200W/140bpm every 3s for 1200s | <=41 samples in rolling120s; no baseline | Insufficient coverage reason; cadence regression for proposed sampler |
| Stable control with duplicate, backwards timestamp, staleHR>3s, GPS/sample gap>10s | ignored ticks / sanitized HR / reset | Deterministic reason, no stale numeric value, recovery follows valid gates |
| Established baseline then brief/long sensor outages, boundary100W/80bpm,10s and180/360s | Exact boundary behavior | Preserve qualified transitions and reset semantics intentionally |

Existing tracker tests cover steady baseline, coasting, power step rejection and long gaps;
presentation tests cover180/360 transitions. They do not assert a reason for indefinite no-result
states or integrate GPS cadence + repeated short sessions. **No replay/tests were executed or
added during this read-only review.** Table predictions are source-derived, not measured ride results.

## Minimal evidence and exact collection steps

1. Provide the ORIGINAL Karoo FIT exported for the **reported ride** ride (the previously mentioned
   reported ride FIT is a different ride). Attach the downloaded .fit here. Do not send an Intervals.icu
   re-encoded copy: it can alter timing/fields. FIT stays local, outside Git. It can test native
   power/HR/cadence/timer plausibility, but cannot prove extension stream freshness or app lifecycle.
2. Give exact field title and wording (GM Cardiac Drift vs GM H10 Cardiac; literal CALIBRATING vs
   BASELINE/COLLECTING) and whether the problem occurred during an actively matched segment.
   A photo is useful if available; no new ride is required merely to answer.
3. On Karoo, open **GritMap → Settings**, read the version at the bottom, then **Refresh Diagnostics**
   under DIAGNOSTICS and photograph the last 8 events. Existing install evidence says 76, not 70;
   manually confirming detects any later update. This does not ask this agent to read the device.
4. If fresh log capture is later approved or the owner chooses to run it himself, connect/unlock/authorize
   USB debugging and run the following on his Mac before a reproduction. Stop with Ctrl-C afterward:

   ```sh
   /opt/homebrew/bin/adb -s DEVICE_SERIAL logcat -v threadtime -s GritMapLive:I AndroidRuntime:E > LOCAL_ARTIFACT_PATH
   ```

   This captures future events, not a guaranteed recovery of Sunday's logs. GritMapLive can contain
   GPS/segment IDs: keep the file private/local and never commit it. There is no reason to clear logcat
   first. No new ride, device pull or logging build is authorized by this document.

Exact ride cause remains unconfirmed until evidence is correlated. The code-level ambiguity and
replay plan are ready for review. Nearby Segments design and reverse-BLE sync feasibility remain
separate queued tasks; no work on them is claimed here.


## Private recording analysis — public summary

Private recording analysis was performed locally. Its contents, timestamps, identity, metadata and derived findings are omitted from public history. It cannot establish the live field, active-attempt boundaries or callback freshness. The public engineering evidence is the synthetic regression/control behavior described elsewhere; private artifacts remain outside Git.

Two synthetic controls against unchanged tracker code passed: steady200W/140bpm at1Hz reaches baseline180s and zero drift at600s; a200W to300W step can retain null drift at840s because effort differs from the frozen reference. These synthetic values are not rider measurements.

## Conclusion and version correction

The code supports several indefinite waiting paths. It does **not** establish which path occurred
on the owner's reported ride without ride/evidence correlation. A confirmed presentation defect is
that unavailable drift after a previously valid baseline is labelled **COLLECTING BASELINE**, just
like a baseline that has never existed. A higher steady workload can leave that label indefinitely.

The coordinator's assumption of version 70 is stale. This chat verified an approved in-place install
of **76 / 0.10.46-screen-preview** on October 31, built from `efaf5f6` (runtime `e7a7c45`), and verified
startup and a library of 7 installed / 7 ready segments. That is the last known installed version,
not proof of what was running during the reported ride if any later update happened elsewhere.
Installation evidence: `handoffs/archive/2026-10-31-karoo-glance76-installed.md`.
Version76 uses `CardiacDriftDataType` → `GlanceGraphicDataType` → `GlancePresentation` /
`GlanceFieldRenderer`. The old `CardiacDriftBitmapRenderer` is no longer the registered field renderer.
No literal CALIBRATING exists in that version 76 rendering path: it says BASELINE, HR RESPONSE,
COLLECTING BASELINE/COLLECTING, or a sensor warning. Exact field title and words matter.

## Input and lifetime gates

Source paths below are under `apps/karoo/app/src/main/java/com/gritmap/karoo/`.

| Stage | What prevents progress / changes the result | Source |
|---|---|---|
| Service startup | Fine-location permission missing; service start/foreground failure; Karoo connection/ride events unavailable | `service/LiveServiceStarter.kt:10`, `service/LiveSegmentService.kt:347` |
| Recording | Consumers start only for RideState Recording **or Paused**. Paused is not separately excluded. Ended/other stops consumers and finishes attempt. | `service/LiveSegmentService.kt:421` |
| Tick cadence | Only location callback calls onTelemetry. Power/HR callbacks update retained values but do not enqueue their own processing ticks. Channel is conflated; slow work can drop intermediate ticks. | `service/LiveSegmentService.kt:174`, `:362`, `:383`, `:444` |
| Sensor freshness | Power, HR and GPS values must have timestamps at most 3000ms old and not in the future. Sanitization nulls stale values. | `service/ActiveAttemptSession.kt:31`, `:42` |
| Segment scope | Coordinator returns without valid lat/lng or a viable candidate. Starting requires a stored start near rider, valid direction and forward confirmation. Drift tracker is owned by each ActiveAttemptSession, not the entire ride. No matched attempt means no ride-wide drift computation. | `service/LiveSegmentCoordinator.kt:56`, `:115`, `:224`; `service/ActiveAttemptSession.kt:93` |
| Restart/reset | New/replaced/finished/abandoned attempts discard the tracker. Ride end and service destruction clear UI. A succession of short efforts does not combine into one baseline. | `service/LiveSegmentService.kt:236`, `:275`; `service/LiveSegmentCoordinator.kt:115` |
| Drift update | updateAttempt calls session.recordCardiacDrift only for the matched attempt. Concurrent path also uses per-session tracker, but concurrency is OFF in installed 76. | `service/LiveSegmentService.kt:453`; `service/ConcurrentLiveRide.kt:191` |

GPS is thus an upstream processing dependency even though the drift formula itself uses power/HR.
When GPS updates stop, the state can freeze rather than producing a new reason every second. A
field visible during a whole ride does not imply a tracker ran for that entire ride. Idle state
has no current HR and can show NO HR; do not equate every absent value with baseline collection.

## Exact tracker gates (installed defaults)

`pacing/CardiacDriftTracker.kt:22–125`:

1. Non-increasing timestamps are ignored. Timestamp advancement comes from wall-clock time in
   the live service; a backwards clock step can freeze progress until timestamps catch up.
2. A gap between processed samples **greater than 10s** clears baseline, current drift, response,
   history and accumulated eligible time. Exactly 10s is not this reset case.
3. Only finite **power >=100 W and HR >=80 bpm** qualify. These are hard-coded absolute thresholds,
   unrelated to FTP or HR zones. Missing, NaN, low-power pedalling and coasting fail eligibility.
4. Any invalid sample breaks the paired-time chain. More than 10s of continuous invalid samples
   clears baseline/history/paired time. Shorter interruptions do not count invalid duration; they
   may temporarily retain an older result while enough rolling samples remain.
5. Eligible duration sums intervals between consecutive eligible processed samples, each capped
   at 2s. At least 180000ms is required. It is **not three minutes since ride start**, and at sparse
   cadence eligible time can advance slower than elapsed time.
6. Rolling eligible samples older than 120s are removed. At least 60 samples must remain. A tick
   every 3s yields only 41 eligible samples in that window, so it cannot establish a baseline,
   however long the ride lasts. Sensor callback cadence and GPS cadence are distinct.
7. Baseline establishment also requires power coefficient of variation <=0.12 over that rolling
   sample window. Persistent variable power can prevent establishment forever even with hours
   of eligible time and 100% paired samples. There is no timeout or forced baseline.
8. After establishment, a drift result still requires >=60 rolling samples, positive baseline,
   CV<=0.12, and current rolling mean power within 15% of the **frozen** baseline mean power.
   If the rider establishes 200W then settles at 300W, the eventual stable 300W window is still
   incomparable. No automatic reference change occurs; drift becomes null indefinitely until
   power returns near baseline or a reset happens.
9. Paired percentage is cumulative since a timestamp-gap reset (invalid-duration reset does not
   reset both counters); it is not the rolling coverage or a baseline-readiness guarantee.

No direct gate requires an FTP, HR zone, stored pacing plan, H10 BLE RR, DFA alpha1, maxHR,
profile weight or H10 enhanced availability. FTP/plan affect other metrics, not these baseline
conditions. Native Karoo HEART_RATE/POWER streams supply this metric; H10 RR capture does not
backfill a missing native HR stream. Native HR can originate from an H10 connected to Karoo,
but that is different from the extension's independent RR client.

## Display gates and known ambiguity

`ui/state/LiveUiState.kt:69` and `ui/GlancePresentation.kt:69`:

- Missing current HR → WAITING_FOR_HR / NO HR. Missing both rolling and current power → HR RESPONSE.
- Null drift **or** validSeconds < 180 → HR RESPONSE / BASELINE / COLLECTING BASELINE.
- Non-null drift with 180–359 eligible seconds → DRIFT FORMING / EARLY TREND.
- Non-null drift with >=360 eligible seconds → mature drift display.
- Active field missing-power/missing-HR sensor flags override verdict/support with explicit warnings;
  renderer may hold a neutral LAST value up to 5s, then --. Idle/nonactive paths have different overrides.

In particular, validSeconds>=360 does not guarantee a number: power comparability and CV can
null it again. Treating all those cases as initial baseline collection is the presentation defect.

## Is it fixed later?

`d38057f` added progressive HR-response/early/mature presentation, keeping180s baseline,120s rolling,
60 samples,100W/80bpm defaults. `c9da364` later added elapsed-paired time, strict resets,12% baseline
steadiness and15% comparable-power restrictions. Those restrictions reduce misleading drift but
also create the indefinite no-result paths above. Version76 changed UI without changing tracker.

At fetched main `6826089`, CardiacDriftTracker bytes match the installed-source tracker exactly
(SHA256 `55825d67d10f7d1b36f46354446573d9f55953acf7a7aff397dff9410d780858`).
The coordinator/service paths reviewed also have no later changes from installed source. There
is no known later tracker fix on main. This review does not treat the unmerged screen branch as main.

## Proposed correction (not implemented)

1. Add explicit tracker readiness/reason state and counts: no active segment, unavailable HR/power,
   low eligible power/HR, interrupted sample stream, collecting eligible seconds, insufficient rolling
   samples, variable power, comparable, and power differs from reference. Expose baseline-present,
   eligible seconds and coverage without relying on nullable drift. Define precedence deliberately.
2. Render the actual reason. Continue useful HR BPM / HR response when drift is unavailable; say
   POWER VARYING or DIFFERENT EFFORT when those gates fail, never COLLECTING BASELINE for an
   already-established but incomparable reference. Small fields get concise equivalents; accessibility
   carries full reason. Do not invent0% or display stale drift as current.
3. Keep current quality thresholds initially. Do not fix indefinite waiting by arbitrarily loosening
   CV, shortening baseline, counting coasting, or silently rebasing. Those change metric meaning.
   If ride evidence shows low-power exclusion or short-segment resets dominate, make the metric's
   scope/normalization a separate explicit decision. A ride-wide tracker would change today's
   per-segment meaning and needs a defined pause/stop/effort-change policy.
4. Decouple measurement ticking/freshness reporting from GPS-only callbacks if tests confirm
   starvation. Use a bounded monotonic 1 Hz sampler of native sensor state, calculate freshness
   independently, update ride physiology separately from route matching, and never count repeated
   stale data as fresh. This is a second step, not an assumption that the reported ride lost GPS.
5. Optional diagnostic instrumentation, if approved later: transition-only reasons, eligible seconds,
   rolling sample count, CV, relative workload and reset causes; omit GPS/rawHR/segment identity.
   Existing live logs do not record the tracker decision reason, so they cannot prove CV gates alone.

## Proposed synthetic replays BEFORE a runtime fix

Add failing contract tests to the real Kotlin tracker/presentation pipeline in a future approved
implementation. Use synthetic data only, default thresholds and 1 Hz ticks unless noted:

| Replay | Existing behavior to reproduce | Desired assertion |
|---|---|---|
| Stable200W/140bpm for 600s | baseline at180s, forming180–359, mature>=360 | Positive control, numeric drift≈0; no physiological claim beyond metric |
| Alternate150/250W each second,140bpm for 1200s | CV≈25%, no baseline although eligible time advances | Reason POWER VARYING, useful HR, never endless generic collection |
| 200W/140bpm for 240s then300W/140bpm for 600s | baseline exists; after transition current stable but mean exceeds reference by 50%; drift stays null | DIFFERENT EFFORT, baseline-present true, not collecting; no auto-rebase |
| 170s valid then 12s at 0 W, repeated 20 times | each coast resets eligible time; no baseline | Explicit interruption/collecting reason and reset count; no fake drift |
| 90W/140bpm for 1200s | HR exists but no eligible power samples | Low eligible effort distinct from disconnected meter |
| Identical new 120s segment sessions, repeated 10 times | per-attempt tracker never reaches180s | Explicit segment scope; no claim of ride-wide elapsed calibration |
| 200W/140bpm every 3s for 1200s | <=41 samples in rolling120s; no baseline | Insufficient coverage reason; cadence regression for proposed sampler |
| Stable control with duplicate, backwards timestamp, staleHR>3s, GPS/sample gap>10s | ignored ticks / sanitized HR / reset | Deterministic reason, no stale numeric value, recovery follows valid gates |
| Established baseline then brief/long sensor outages, boundary100W/80bpm,10s and180/360s | Exact boundary behavior | Preserve qualified transitions and reset semantics intentionally |

Existing tracker tests cover steady baseline, coasting, power step rejection and long gaps;
presentation tests cover180/360 transitions. They do not assert a reason for indefinite no-result
states or integrate GPS cadence + repeated short sessions. **No replay/tests were executed or
added during this read-only review.** Table predictions are source-derived, not measured ride results.

## Minimal evidence and exact collection steps

1. Provide the ORIGINAL Karoo FIT exported for the **reported ride** ride (the previously mentioned
   reported ride FIT is a different ride). Attach the downloaded .fit here. Do not send an Intervals.icu
   re-encoded copy: it can alter timing/fields. FIT stays local, outside Git. It can test native
   power/HR/cadence/timer plausibility, but cannot prove extension stream freshness or app lifecycle.
2. Give exact field title and wording (GM Cardiac Drift vs GM H10 Cardiac; literal CALIBRATING vs
   BASELINE/COLLECTING) and whether the problem occurred during an actively matched segment.
   A photo is useful if available; no new ride is required merely to answer.
3. On Karoo, open **GritMap → Settings**, read the version at the bottom, then **Refresh Diagnostics**
   under DIAGNOSTICS and photograph the last 8 events. Existing install evidence says 76, not 70;
   manually confirming detects any later update. This does not ask this agent to read the device.
4. If fresh log capture is later approved or the owner chooses to run it himself, connect/unlock/authorize
   USB debugging and run the following on his Mac before a reproduction. Stop with Ctrl-C afterward:

   ```sh
   /opt/homebrew/bin/adb -s DEVICE_SERIAL logcat -v threadtime -s GritMapLive:I AndroidRuntime:E > LOCAL_ARTIFACT_PATH
   ```

   This captures future events, not a guaranteed recovery of Sunday's logs. GritMapLive can contain
   GPS/segment IDs: keep the file private/local and never commit it. There is no reason to clear logcat
   first. No new ride, device pull or logging build is authorized by this document.

Exact ride cause remains unconfirmed until evidence is correlated. The code-level ambiguity and
replay plan are ready for review. Nearby Segments design and reverse-BLE sync feasibility remain
separate queued tasks; no work on them is claimed here.


## Private recording analysis — public summary

Private recording analysis was performed locally. Its contents, timestamps, identity, metadata and derived findings are omitted from public history. It cannot establish the live field, active-attempt boundaries or callback freshness. The public engineering evidence is the synthetic regression/control behavior described elsewhere; private artifacts remain outside Git.

Two synthetic controls against unchanged tracker code passed: steady200W/140bpm at1Hz reaches baseline180s and zero drift at600s; a200W to300W step can retain null drift at840s because effort differs from the frozen reference. These synthetic values are not rider measurements.

## Conclusion and version correction

The code supports several indefinite waiting paths. It does **not** establish which path occurred
on the owner's reported ride without ride/evidence correlation. A confirmed presentation defect is
that unavailable drift after a previously valid baseline is labelled **COLLECTING BASELINE**, just
like a baseline that has never existed. A higher steady workload can leave that label indefinitely.

The coordinator's assumption of version 70 is stale. This chat verified an approved in-place install
of **76 / 0.10.46-screen-preview** on October 31, built from `efaf5f6` (runtime `e7a7c45`), and verified
startup and a library of 7 installed / 7 ready segments. That is the last known installed version,
not proof of what was running during the reported ride if any later update happened elsewhere.
Installation evidence: `handoffs/archive/2026-10-31-karoo-glance76-installed.md`.
Version76 uses `CardiacDriftDataType` → `GlanceGraphicDataType` → `GlancePresentation` /
`GlanceFieldRenderer`. The old `CardiacDriftBitmapRenderer` is no longer the registered field renderer.
No literal CALIBRATING exists in that version 76 rendering path: it says BASELINE, HR RESPONSE,
COLLECTING BASELINE/COLLECTING, or a sensor warning. Exact field title and words matter.

## Input and lifetime gates

Source paths below are under `apps/karoo/app/src/main/java/com/gritmap/karoo/`.

| Stage | What prevents progress / changes the result | Source |
|---|---|---|
| Service startup | Fine-location permission missing; service start/foreground failure; Karoo connection/ride events unavailable | `service/LiveServiceStarter.kt:10`, `service/LiveSegmentService.kt:347` |
| Recording | Consumers start only for RideState Recording **or Paused**. Paused is not separately excluded. Ended/other stops consumers and finishes attempt. | `service/LiveSegmentService.kt:421` |
| Tick cadence | Only location callback calls onTelemetry. Power/HR callbacks update retained values but do not enqueue their own processing ticks. Channel is conflated; slow work can drop intermediate ticks. | `service/LiveSegmentService.kt:174`, `:362`, `:383`, `:444` |
| Sensor freshness | Power, HR and GPS values must have timestamps at most 3000ms old and not in the future. Sanitization nulls stale values. | `service/ActiveAttemptSession.kt:31`, `:42` |
| Segment scope | Coordinator returns without valid lat/lng or a viable candidate. Starting requires a stored start near rider, valid direction and forward confirmation. Drift tracker is owned by each ActiveAttemptSession, not the entire ride. No matched attempt means no ride-wide drift computation. | `service/LiveSegmentCoordinator.kt:56`, `:115`, `:224`; `service/ActiveAttemptSession.kt:93` |
| Restart/reset | New/replaced/finished/abandoned attempts discard the tracker. Ride end and service destruction clear UI. A succession of short efforts does not combine into one baseline. | `service/LiveSegmentService.kt:236`, `:275`; `service/LiveSegmentCoordinator.kt:115` |
| Drift update | updateAttempt calls session.recordCardiacDrift only for the matched attempt. Concurrent path also uses per-session tracker, but concurrency is OFF in installed 76. | `service/LiveSegmentService.kt:453`; `service/ConcurrentLiveRide.kt:191` |

GPS is thus an upstream processing dependency even though the drift formula itself uses power/HR.
When GPS updates stop, the state can freeze rather than producing a new reason every second. A
field visible during a whole ride does not imply a tracker ran for that entire ride. Idle state
has no current HR and can show NO HR; do not equate every absent value with baseline collection.

## Exact tracker gates (installed defaults)

`pacing/CardiacDriftTracker.kt:22–125`:

1. Non-increasing timestamps are ignored. Timestamp advancement comes from wall-clock time in
   the live service; a backwards clock step can freeze progress until timestamps catch up.
2. A gap between processed samples **greater than 10s** clears baseline, current drift, response,
   history and accumulated eligible time. Exactly 10s is not this reset case.
3. Only finite **power >=100 W and HR >=80 bpm** qualify. These are hard-coded absolute thresholds,
   unrelated to FTP or HR zones. Missing, NaN, low-power pedalling and coasting fail eligibility.
4. Any invalid sample breaks the paired-time chain. More than 10s of continuous invalid samples
   clears baseline/history/paired time. Shorter interruptions do not count invalid duration; they
   may temporarily retain an older result while enough rolling samples remain.
5. Eligible duration sums intervals between consecutive eligible processed samples, each capped
   at 2s. At least 180000ms is required. It is **not three minutes since ride start**, and at sparse
   cadence eligible time can advance slower than elapsed time.
6. Rolling eligible samples older than 120s are removed. At least 60 samples must remain. A tick
   every 3s yields only 41 eligible samples in that window, so it cannot establish a baseline,
   however long the ride lasts. Sensor callback cadence and GPS cadence are distinct.
7. Baseline establishment also requires power coefficient of variation <=0.12 over that rolling
   sample window. Persistent variable power can prevent establishment forever even with hours
   of eligible time and 100% paired samples. There is no timeout or forced baseline.
8. After establishment, a drift result still requires >=60 rolling samples, positive baseline,
   CV<=0.12, and current rolling mean power within 15% of the **frozen** baseline mean power.
   If the rider establishes 200W then settles at 300W, the eventual stable 300W window is still
   incomparable. No automatic reference change occurs; drift becomes null indefinitely until
   power returns near baseline or a reset happens.
9. Paired percentage is cumulative since a timestamp-gap reset (invalid-duration reset does not
   reset both counters); it is not the rolling coverage or a baseline-readiness guarantee.

No direct gate requires an FTP, HR zone, stored pacing plan, H10 BLE RR, DFA alpha1, maxHR,
profile weight or H10 enhanced availability. FTP/plan affect other metrics, not these baseline
conditions. Native Karoo HEART_RATE/POWER streams supply this metric; H10 RR capture does not
backfill a missing native HR stream. Native HR can originate from an H10 connected to Karoo,
but that is different from the extension's independent RR client.

## Display gates and known ambiguity

`ui/state/LiveUiState.kt:69` and `ui/GlancePresentation.kt:69`:

- Missing current HR → WAITING_FOR_HR / NO HR. Missing both rolling and current power → HR RESPONSE.
- Null drift **or** validSeconds < 180 → HR RESPONSE / BASELINE / COLLECTING BASELINE.
- Non-null drift with 180–359 eligible seconds → DRIFT FORMING / EARLY TREND.
- Non-null drift with >=360 eligible seconds → mature drift display.
- Active field missing-power/missing-HR sensor flags override verdict/support with explicit warnings;
  renderer may hold a neutral LAST value up to 5s, then --. Idle/nonactive paths have different overrides.

In particular, validSeconds>=360 does not guarantee a number: power comparability and CV can
null it again. Treating all those cases as initial baseline collection is the presentation defect.

## Is it fixed later?

`d38057f` added progressive HR-response/early/mature presentation, keeping180s baseline,120s rolling,
60 samples,100W/80bpm defaults. `c9da364` later added elapsed-paired time, strict resets,12% baseline
steadiness and15% comparable-power restrictions. Those restrictions reduce misleading drift but
also create the indefinite no-result paths above. Version76 changed UI without changing tracker.

At fetched main `6826089`, CardiacDriftTracker bytes match the installed-source tracker exactly
(SHA256 `55825d67d10f7d1b36f46354446573d9f55953acf7a7aff397dff9410d780858`).
The coordinator/service paths reviewed also have no later changes from installed source. There
is no known later tracker fix on main. This review does not treat the unmerged screen branch as main.

## Proposed correction (not implemented)

1. Add explicit tracker readiness/reason state and counts: no active segment, unavailable HR/power,
   low eligible power/HR, interrupted sample stream, collecting eligible seconds, insufficient rolling
   samples, variable power, comparable, and power differs from reference. Expose baseline-present,
   eligible seconds and coverage without relying on nullable drift. Define precedence deliberately.
2. Render the actual reason. Continue useful HR BPM / HR response when drift is unavailable; say
   POWER VARYING or DIFFERENT EFFORT when those gates fail, never COLLECTING BASELINE for an
   already-established but incomparable reference. Small fields get concise equivalents; accessibility
   carries full reason. Do not invent0% or display stale drift as current.
3. Keep current quality thresholds initially. Do not fix indefinite waiting by arbitrarily loosening
   CV, shortening baseline, counting coasting, or silently rebasing. Those change metric meaning.
   If ride evidence shows low-power exclusion or short-segment resets dominate, make the metric's
   scope/normalization a separate explicit decision. A ride-wide tracker would change today's
   per-segment meaning and needs a defined pause/stop/effort-change policy.
4. Decouple measurement ticking/freshness reporting from GPS-only callbacks if tests confirm
   starvation. Use a bounded monotonic 1 Hz sampler of native sensor state, calculate freshness
   independently, update ride physiology separately from route matching, and never count repeated
   stale data as fresh. This is a second step, not an assumption that the reported ride lost GPS.
5. Optional diagnostic instrumentation, if approved later: transition-only reasons, eligible seconds,
   rolling sample count, CV, relative workload and reset causes; omit GPS/rawHR/segment identity.
   Existing live logs do not record the tracker decision reason, so they cannot prove CV gates alone.

## Proposed synthetic replays BEFORE a runtime fix

Add failing contract tests to the real Kotlin tracker/presentation pipeline in a future approved
implementation. Use synthetic data only, default thresholds and 1 Hz ticks unless noted:

| Replay | Existing behavior to reproduce | Desired assertion |
|---|---|---|
| Stable200W/140bpm for 600s | baseline at180s, forming180–359, mature>=360 | Positive control, numeric drift≈0; no physiological claim beyond metric |
| Alternate150/250W each second,140bpm for 1200s | CV≈25%, no baseline although eligible time advances | Reason POWER VARYING, useful HR, never endless generic collection |
| 200W/140bpm for 240s then300W/140bpm for 600s | baseline exists; after transition current stable but mean exceeds reference by 50%; drift stays null | DIFFERENT EFFORT, baseline-present true, not collecting; no auto-rebase |
| 170s valid then 12s at 0 W, repeated 20 times | each coast resets eligible time; no baseline | Explicit interruption/collecting reason and reset count; no fake drift |
| 90W/140bpm for 1200s | HR exists but no eligible power samples | Low eligible effort distinct from disconnected meter |
| Identical new 120s segment sessions, repeated 10 times | per-attempt tracker never reaches180s | Explicit segment scope; no claim of ride-wide elapsed calibration |
| 200W/140bpm every 3s for 1200s | <=41 samples in rolling120s; no baseline | Insufficient coverage reason; cadence regression for proposed sampler |
| Stable control with duplicate, backwards timestamp, staleHR>3s, GPS/sample gap>10s | ignored ticks / sanitized HR / reset | Deterministic reason, no stale numeric value, recovery follows valid gates |
| Established baseline then brief/long sensor outages, boundary100W/80bpm,10s and180/360s | Exact boundary behavior | Preserve qualified transitions and reset semantics intentionally |

Existing tracker tests cover steady baseline, coasting, power step rejection and long gaps;
presentation tests cover180/360 transitions. They do not assert a reason for indefinite no-result
states or integrate GPS cadence + repeated short sessions. **No replay/tests were executed or
added during this read-only review.** Table predictions are source-derived, not measured ride results.

## Minimal evidence and exact collection steps

1. Provide the ORIGINAL Karoo FIT exported for the **reported ride** ride (the previously mentioned
   reported ride FIT is a different ride). Attach the downloaded .fit here. Do not send an Intervals.icu
   re-encoded copy: it can alter timing/fields. FIT stays local, outside Git. It can test native
   power/HR/cadence/timer plausibility, but cannot prove extension stream freshness or app lifecycle.
2. Give exact field title and wording (GM Cardiac Drift vs GM H10 Cardiac; literal CALIBRATING vs
   BASELINE/COLLECTING) and whether the problem occurred during an actively matched segment.
   A photo is useful if available; no new ride is required merely to answer.
3. On Karoo, open **GritMap → Settings**, read the version at the bottom, then **Refresh Diagnostics**
   under DIAGNOSTICS and photograph the last 8 events. Existing install evidence says 76, not 70;
   manually confirming detects any later update. This does not ask this agent to read the device.
4. If fresh log capture is later approved or the owner chooses to run it himself, connect/unlock/authorize
   USB debugging and run the following on his Mac before a reproduction. Stop with Ctrl-C afterward:

   ```sh
   /opt/homebrew/bin/adb -s DEVICE_SERIAL logcat -v threadtime -s GritMapLive:I AndroidRuntime:E > LOCAL_ARTIFACT_PATH
   ```

   This captures future events, not a guaranteed recovery of Sunday's logs. GritMapLive can contain
   GPS/segment IDs: keep the file private/local and never commit it. There is no reason to clear logcat
   first. No new ride, device pull or logging build is authorized by this document.

Exact ride cause remains unconfirmed until evidence is correlated. The code-level ambiguity and
replay plan are ready for review. Nearby Segments design and reverse-BLE sync feasibility remain
separate queued tasks; no work on them is claimed here.


## Private recording analysis — public summary

Private recording analysis was performed locally. Its contents, timestamps, identity, metadata and derived findings are omitted from public history. It cannot establish the live field, active-attempt boundaries or callback freshness. The public engineering evidence is the synthetic regression/control behavior described elsewhere; private artifacts remain outside Git.

Two synthetic controls against unchanged tracker code passed: steady200W/140bpm at1Hz reaches baseline180s and zero drift at600s; a200W to300W step can retain null drift at840s because effort differs from the frozen reference. These synthetic values are not rider measurements.

## Conclusion and version correction

The code supports several indefinite waiting paths. It does **not** establish which path occurred
on the owner's reported ride without ride/evidence correlation. A confirmed presentation defect is
that unavailable drift after a previously valid baseline is labelled **COLLECTING BASELINE**, just
like a baseline that has never existed. A higher steady workload can leave that label indefinitely.

The coordinator's assumption of version 70 is stale. This chat verified an approved in-place install
of **76 / 0.10.46-screen-preview** on October 31, built from `efaf5f6` (runtime `e7a7c45`), and verified
startup and a library of 7 installed / 7 ready segments. That is the last known installed version,
not proof of what was running during the reported ride if any later update happened elsewhere.
Installation evidence: `handoffs/archive/2026-10-31-karoo-glance76-installed.md`.
Version76 uses `CardiacDriftDataType` → `GlanceGraphicDataType` → `GlancePresentation` /
`GlanceFieldRenderer`. The old `CardiacDriftBitmapRenderer` is no longer the registered field renderer.
No literal CALIBRATING exists in that version 76 rendering path: it says BASELINE, HR RESPONSE,
COLLECTING BASELINE/COLLECTING, or a sensor warning. Exact field title and words matter.

## Input and lifetime gates

Source paths below are under `apps/karoo/app/src/main/java/com/gritmap/karoo/`.

| Stage | What prevents progress / changes the result | Source |
|---|---|---|
| Service startup | Fine-location permission missing; service start/foreground failure; Karoo connection/ride events unavailable | `service/LiveServiceStarter.kt:10`, `service/LiveSegmentService.kt:347` |
| Recording | Consumers start only for RideState Recording **or Paused**. Paused is not separately excluded. Ended/other stops consumers and finishes attempt. | `service/LiveSegmentService.kt:421` |
| Tick cadence | Only location callback calls onTelemetry. Power/HR callbacks update retained values but do not enqueue their own processing ticks. Channel is conflated; slow work can drop intermediate ticks. | `service/LiveSegmentService.kt:174`, `:362`, `:383`, `:444` |
| Sensor freshness | Power, HR and GPS values must have timestamps at most 3000ms old and not in the future. Sanitization nulls stale values. | `service/ActiveAttemptSession.kt:31`, `:42` |
| Segment scope | Coordinator returns without valid lat/lng or a viable candidate. Starting requires a stored start near rider, valid direction and forward confirmation. Drift tracker is owned by each ActiveAttemptSession, not the entire ride. No matched attempt means no ride-wide drift computation. | `service/LiveSegmentCoordinator.kt:56`, `:115`, `:224`; `service/ActiveAttemptSession.kt:93` |
| Restart/reset | New/replaced/finished/abandoned attempts discard the tracker. Ride end and service destruction clear UI. A succession of short efforts does not combine into one baseline. | `service/LiveSegmentService.kt:236`, `:275`; `service/LiveSegmentCoordinator.kt:115` |
| Drift update | updateAttempt calls session.recordCardiacDrift only for the matched attempt. Concurrent path also uses per-session tracker, but concurrency is OFF in installed 76. | `service/LiveSegmentService.kt:453`; `service/ConcurrentLiveRide.kt:191` |

GPS is thus an upstream processing dependency even though the drift formula itself uses power/HR.
When GPS updates stop, the state can freeze rather than producing a new reason every second. A
field visible during a whole ride does not imply a tracker ran for that entire ride. Idle state
has no current HR and can show NO HR; do not equate every absent value with baseline collection.

## Exact tracker gates (installed defaults)

`pacing/CardiacDriftTracker.kt:22–125`:

1. Non-increasing timestamps are ignored. Timestamp advancement comes from wall-clock time in
   the live service; a backwards clock step can freeze progress until timestamps catch up.
2. A gap between processed samples **greater than 10s** clears baseline, current drift, response,
   history and accumulated eligible time. Exactly 10s is not this reset case.
3. Only finite **power >=100 W and HR >=80 bpm** qualify. These are hard-coded absolute thresholds,
   unrelated to FTP or HR zones. Missing, NaN, low-power pedalling and coasting fail eligibility.
4. Any invalid sample breaks the paired-time chain. More than 10s of continuous invalid samples
   clears baseline/history/paired time. Shorter interruptions do not count invalid duration; they
   may temporarily retain an older result while enough rolling samples remain.
5. Eligible duration sums intervals between consecutive eligible processed samples, each capped
   at 2s. At least 180000ms is required. It is **not three minutes since ride start**, and at sparse
   cadence eligible time can advance slower than elapsed time.
6. Rolling eligible samples older than 120s are removed. At least 60 samples must remain. A tick
   every 3s yields only 41 eligible samples in that window, so it cannot establish a baseline,
   however long the ride lasts. Sensor callback cadence and GPS cadence are distinct.
7. Baseline establishment also requires power coefficient of variation <=0.12 over that rolling
   sample window. Persistent variable power can prevent establishment forever even with hours
   of eligible time and 100% paired samples. There is no timeout or forced baseline.
8. After establishment, a drift result still requires >=60 rolling samples, positive baseline,
   CV<=0.12, and current rolling mean power within 15% of the **frozen** baseline mean power.
   If the rider establishes 200W then settles at 300W, the eventual stable 300W window is still
   incomparable. No automatic reference change occurs; drift becomes null indefinitely until
   power returns near baseline or a reset happens.
9. Paired percentage is cumulative since a timestamp-gap reset (invalid-duration reset does not
   reset both counters); it is not the rolling coverage or a baseline-readiness guarantee.

No direct gate requires an FTP, HR zone, stored pacing plan, H10 BLE RR, DFA alpha1, maxHR,
profile weight or H10 enhanced availability. FTP/plan affect other metrics, not these baseline
conditions. Native Karoo HEART_RATE/POWER streams supply this metric; H10 RR capture does not
backfill a missing native HR stream. Native HR can originate from an H10 connected to Karoo,
but that is different from the extension's independent RR client.

## Display gates and known ambiguity

`ui/state/LiveUiState.kt:69` and `ui/GlancePresentation.kt:69`:

- Missing current HR → WAITING_FOR_HR / NO HR. Missing both rolling and current power → HR RESPONSE.
- Null drift **or** validSeconds < 180 → HR RESPONSE / BASELINE / COLLECTING BASELINE.
- Non-null drift with 180–359 eligible seconds → DRIFT FORMING / EARLY TREND.
- Non-null drift with >=360 eligible seconds → mature drift display.
- Active field missing-power/missing-HR sensor flags override verdict/support with explicit warnings;
  renderer may hold a neutral LAST value up to 5s, then --. Idle/nonactive paths have different overrides.

In particular, validSeconds>=360 does not guarantee a number: power comparability and CV can
null it again. Treating all those cases as initial baseline collection is the presentation defect.

## Is it fixed later?

`d38057f` added progressive HR-response/early/mature presentation, keeping180s baseline,120s rolling,
60 samples,100W/80bpm defaults. `c9da364` later added elapsed-paired time, strict resets,12% baseline
steadiness and15% comparable-power restrictions. Those restrictions reduce misleading drift but
also create the indefinite no-result paths above. Version76 changed UI without changing tracker.

At fetched main `6826089`, CardiacDriftTracker bytes match the installed-source tracker exactly
(SHA256 `55825d67d10f7d1b36f46354446573d9f55953acf7a7aff397dff9410d780858`).
The coordinator/service paths reviewed also have no later changes from installed source. There
is no known later tracker fix on main. This review does not treat the unmerged screen branch as main.

## Proposed correction (not implemented)

1. Add explicit tracker readiness/reason state and counts: no active segment, unavailable HR/power,
   low eligible power/HR, interrupted sample stream, collecting eligible seconds, insufficient rolling
   samples, variable power, comparable, and power differs from reference. Expose baseline-present,
   eligible seconds and coverage without relying on nullable drift. Define precedence deliberately.
2. Render the actual reason. Continue useful HR BPM / HR response when drift is unavailable; say
   POWER VARYING or DIFFERENT EFFORT when those gates fail, never COLLECTING BASELINE for an
   already-established but incomparable reference. Small fields get concise equivalents; accessibility
   carries full reason. Do not invent0% or display stale drift as current.
3. Keep current quality thresholds initially. Do not fix indefinite waiting by arbitrarily loosening
   CV, shortening baseline, counting coasting, or silently rebasing. Those change metric meaning.
   If ride evidence shows low-power exclusion or short-segment resets dominate, make the metric's
   scope/normalization a separate explicit decision. A ride-wide tracker would change today's
   per-segment meaning and needs a defined pause/stop/effort-change policy.
4. Decouple measurement ticking/freshness reporting from GPS-only callbacks if tests confirm
   starvation. Use a bounded monotonic 1 Hz sampler of native sensor state, calculate freshness
   independently, update ride physiology separately from route matching, and never count repeated
   stale data as fresh. This is a second step, not an assumption that the reported ride lost GPS.
5. Optional diagnostic instrumentation, if approved later: transition-only reasons, eligible seconds,
   rolling sample count, CV, relative workload and reset causes; omit GPS/rawHR/segment identity.
   Existing live logs do not record the tracker decision reason, so they cannot prove CV gates alone.

## Proposed synthetic replays BEFORE a runtime fix

Add failing contract tests to the real Kotlin tracker/presentation pipeline in a future approved
implementation. Use synthetic data only, default thresholds and 1 Hz ticks unless noted:

| Replay | Existing behavior to reproduce | Desired assertion |
|---|---|---|
| Stable200W/140bpm for 600s | baseline at180s, forming180–359, mature>=360 | Positive control, numeric drift≈0; no physiological claim beyond metric |
| Alternate150/250W each second,140bpm for 1200s | CV≈25%, no baseline although eligible time advances | Reason POWER VARYING, useful HR, never endless generic collection |
| 200W/140bpm for 240s then300W/140bpm for 600s | baseline exists; after transition current stable but mean exceeds reference by 50%; drift stays null | DIFFERENT EFFORT, baseline-present true, not collecting; no auto-rebase |
| 170s valid then 12s at 0 W, repeated 20 times | each coast resets eligible time; no baseline | Explicit interruption/collecting reason and reset count; no fake drift |
| 90W/140bpm for 1200s | HR exists but no eligible power samples | Low eligible effort distinct from disconnected meter |
| Identical new 120s segment sessions, repeated 10 times | per-attempt tracker never reaches180s | Explicit segment scope; no claim of ride-wide elapsed calibration |
| 200W/140bpm every 3s for 1200s | <=41 samples in rolling120s; no baseline | Insufficient coverage reason; cadence regression for proposed sampler |
| Stable control with duplicate, backwards timestamp, staleHR>3s, GPS/sample gap>10s | ignored ticks / sanitized HR / reset | Deterministic reason, no stale numeric value, recovery follows valid gates |
| Established baseline then brief/long sensor outages, boundary100W/80bpm,10s and180/360s | Exact boundary behavior | Preserve qualified transitions and reset semantics intentionally |

Existing tracker tests cover steady baseline, coasting, power step rejection and long gaps;
presentation tests cover180/360 transitions. They do not assert a reason for indefinite no-result
states or integrate GPS cadence + repeated short sessions. **No replay/tests were executed or
added during this read-only review.** Table predictions are source-derived, not measured ride results.

## Minimal evidence and exact collection steps

1. Provide the ORIGINAL Karoo FIT exported for the **reported ride** ride (the previously mentioned
   reported ride FIT is a different ride). Attach the downloaded .fit here. Do not send an Intervals.icu
   re-encoded copy: it can alter timing/fields. FIT stays local, outside Git. It can test native
   power/HR/cadence/timer plausibility, but cannot prove extension stream freshness or app lifecycle.
2. Give exact field title and wording (GM Cardiac Drift vs GM H10 Cardiac; literal CALIBRATING vs
   BASELINE/COLLECTING) and whether the problem occurred during an actively matched segment.
   A photo is useful if available; no new ride is required merely to answer.
3. On Karoo, open **GritMap → Settings**, read the version at the bottom, then **Refresh Diagnostics**
   under DIAGNOSTICS and photograph the last 8 events. Existing install evidence says 76, not 70;
   manually confirming detects any later update. This does not ask this agent to read the device.
4. If fresh log capture is later approved or the owner chooses to run it himself, connect/unlock/authorize
   USB debugging and run the following on his Mac before a reproduction. Stop with Ctrl-C afterward:

   ```sh
   /opt/homebrew/bin/adb -s DEVICE_SERIAL logcat -v threadtime -s GritMapLive:I AndroidRuntime:E > LOCAL_ARTIFACT_PATH
   ```

   This captures future events, not a guaranteed recovery of Sunday's logs. GritMapLive can contain
   GPS/segment IDs: keep the file private/local and never commit it. There is no reason to clear logcat
   first. No new ride, device pull or logging build is authorized by this document.

Exact ride cause remains unconfirmed until evidence is correlated. The code-level ambiguity and
replay plan are ready for review. Nearby Segments design and reverse-BLE sync feasibility remain
separate queued tasks; no work on them is claimed here.


## Follow-up: locally supplied FIT and standalone replay (2026-11-02)

Private recording analysis was performed locally. Its contents, timestamps, identity, metadata and derived findings are omitted from public history. It cannot establish the live field, active-attempt boundaries or callback freshness. The public engineering evidence is the synthetic regression/control behavior described elsewhere; private artifacts remain outside Git.

Private recording analysis was performed locally. Its contents, timestamps, identity, metadata and derived findings are omitted from public history. It cannot establish the live field, active-attempt boundaries or callback freshness. The public engineering evidence is the synthetic regression/control behavior described elsewhere; private artifacts remain outside Git.

Two synthetic controls passed against the unchanged Kotlin implementation: constant200W/140bpm
at1Hz yields first drift at180s and0% at600s;200W through240s then300W through840s ends with steady
power and840 eligible seconds but null drift. This second control reproduces the previously
identified post-baseline comparability/display ambiguity. Full proposed regression matrix above
is still unimplemented; only these controls and a private FIT replay were executed. No full unit
suite was rerun; previous280 tests are historical evidence only.

Private report: [private local analysis location omitted]; actual output:
`kotlin/replay-output.txt`; traces and decoded data stay in that private directory. No chart was
produced (plotting package unavailable); no dependencies were installed. Proposed implementation
remains explicit reasons/useful HR-response fallback first, preserving quality thresholds until
metric scope/normalization is explicitly decided. Original Karoo export and field/context evidence
remain needed to establish the live cause; H10 RR behavior is not verified by this file.
