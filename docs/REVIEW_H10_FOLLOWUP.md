# Follow-up review: Codex's H10 work against the first review

- Reviewer: Claude, 2026-10-05 (evening)
- Reviews: `apps/karoo/.../physiology/*`, the H10 wiring in `service/LiveSegmentService.kt`, the manifest, and
  Codex's handoffs `1504` through `2102` (builds 0.10.36 - 0.10.39)
- Against: `docs/REVIEW_KAROO_AI_PHYSIOLOGY.md` (findings B1-B4, H1-H5, M1-M5 and review points 1-8)
- Method: read the code; one behaviour (G1) reproduced with a small simulation of the mapper's arithmetic;
  nothing was run on the Karoo by me. Codex's own physical results (BLE RR + ANT+ HR together, ride-end save)
  are taken from its handoffs, not re-verified.

## Verdict

Codex closed all four blockers and moved capture into the ride service, which was the right order, and
verified it on a real ride. Reading the new wiring found **one finding I would fix before anyone rides in a
group (G8)**, and three more that affect whether the data is trustworthy (G1, G2, G3). None of them stop the
next solo ride.

## Status of the original findings

| # | Finding | Status | Evidence |
|---|---|---|---|
| B1 | Writer truncated a recoverable `.partial` / replaced a final file | **Fixed** | `RrArtifactStore.kt`: `Files.createFile` (fails if present), final-exists check, move without `REPLACE_EXISTING` |
| B2 | 8 KiB buffer, no periodic flush: ~8 min lost on kill | **Fixed** | flush + `fd.sync()` at start, every 30 s of packet time, on close and finalize (`H10CaptureController.kt` `CHECKPOINT_INTERVAL_MS`). Loss window now <= ~30 s. Never tested with a real kill (desk test added to the ride checklist) |
| B3 | Arrival-time timestamps flagged good beats out of order | **Fixed, with a new gap problem (G1)** | `RrPacketTimestampMapper`: cumulative-RR beat clock, arrival nudges by <= 5 ms/packet |
| B4 | Validity was a lifetime ratio | **Fixed** | `RrLiveBuffer.snapshot()` counts valid over the 120 s / 512-sample window; minimum window size |
| H1 | GATT owned by an Activity, scan-based reconnect | **Mostly fixed** | owned by `LiveSegmentService` (`location|connectedDevice`), preferred address in no-backup prefs, direct reconnect. Verified on a ride by Codex. Scan auto-selection is a problem (G8) |
| H2 | Reconnect/backoff, stale callbacks, state races, error on one bad packet | **Partly** | stale-callback guard, `update{}`, malformed-packet counter: done. **Reconnect/backoff: not done (G2)**; GATT status 133 still just ends in ERROR |
| H3 | Disk I/O and exceptions on the GATT callback thread | **Open (G4)** | `fsync` and `append` still run on the Binder thread; append failures are not surfaced |
| H4 | RR rounded to ms at the parser | **Open** | acknowledged by Codex (schema v1) |
| H5 | Timeline vs wall clock vs pauses | **Mostly fine** | header holds wall-clock start; records are monotonic offsets; capture continues through `Paused` |
| M1 | Hash/integrity not durable | **Open** | SHA-256 only in memory/UI; Codex computed it by hand for the verification notes |
| M2 | Salted sensor id | **Not applicable yet** | the raw address lives in no-backup `SharedPreferences` (not Keystore) - acceptable for development |
| M3 | Export path | **Open** | `adb run-as` only |
| M4 | Per-packet window copy | **Trivial** | still `toList()` per packet; harmless at ~1 Hz |
| Points 4, 5 | FIT summary fields; Needle 2 vs 3 | **Untouched** | no code yet |
| Point 6 | Consent, deletion, retention, export | **Open** | no UI; leftover test partials stay |
| Point 7 | Keep physiology out of `LiveSegmentService` until the wiring was reviewed | **Wiring now exists; reviewed below** | |

## New findings

### G8 (high, privacy and correctness): scan auto-selection can bind to someone else's strap
`selectAutomaticH10Device` (`H10AutoConnectPolicy.kt`) returns the single device whose name contains "polar" or
"h10", **or the only heart-rate device of any kind**. `LiveSegmentService.handleAutomaticH10State` connects to
whatever it returns after the 12 s approach scan when no address is saved, and `H10BleClient` then **saves that
connection as the preferred device** (`onConnectedDevice`). Bluetooth straps advertise to anyone, so in a group
ride (or on a trainer-room day) a neighbour's H10, or any chest strap, can be chosen, its heartbeats recorded,
and it becomes the saved sensor.
Fix: never pair from a scan during a ride. Scan only to *locate the saved address* (filter results by it);
establish the sensor once, explicitly, in diagnostics (which already works). If a first-run auto-pick is wanted,
require a strong signal (for example RSSI above -55 dBm) **and** a confirmation tap. Until then, the ride
checklist asks you to save your H10 first and avoid group rides with other straps on the first outing.

### G1 (medium-high): the beat clock never recovers from a dropout and does not mark it
After a lost packet the mapper continues from the last endpoint (it cannot know beats were missed), and arrival
may only correct it by 5 ms per packet. Simulating 1 beat/s with a 3-packet dropout: beat timestamps then lag
real arrival by **~3 s and need about 600 packets (~10 minutes) to catch up**, and no discontinuity is recorded.
Any window spanning the gap treats a missing 3 s as contiguous, which corrupts RMSSD/DFA at the join.
Fix: when `packetElapsedMs - predictedEndpoint` exceeds a threshold (for example max(2 s, 1.5 x the RR)),
re-anchor to arrival and flag the first observation after the gap (a new artifact reason, for example `GAP`) so
`RrLiveBuffer` resets its consecutive-valid run and window metrics skip across it. Add a mapper test for a
3-5 s dropout and a window-metrics test that does not span a gap.

### G2 (medium-high): a mid-segment dropout is never retried
`handleAutomaticH10State` reacts only to `CONNECTED` and the scan-finished `IDLE` state. If the H10 disconnects
or the GATT reports an error while a segment is active (loose strap, status 133), nothing reconnects; the
capture stays "capturing" with no beats until it is released. Fix: while `automaticH10Requested` and a session is
active, retry `connectKnown` with bounded backoff (for example 2, 4, 8, then every 15 s), cap attempts per
segment, record each attempt in the diagnostics log, and resume the same artifact with a `GAP` marker (G1).

### G3 (decision, not a defect): RR is captured around segments, not for the ride
Capture starts about 250 m before a saved segment and ends about 2 minutes after it. That is a sensible,
low-impact first design, but the plan's physiology (HR cost, cardiac drift, durability) benefits from the
minutes *before* the effort. Decide deliberately: keep per-segment for now, or add an option to capture
whenever the ride is recording and an H10 is saved. Storage is negligible (about 60 KB per hour) and the
BLE link is already held during the effort. The ride checklist now says to expect one `.rr` per segment.

### G4 (medium): `fsync` and file finalization on the Binder thread
`H10CaptureController.onMeasurement` runs inside the GATT callback; every 30 s it `fsync`s (and finalization
`fsync`s, renames and SHA-256s) there. A slow flash write blocks the next notifications for its duration, and an
`IOException` from `append` propagates into a platform callback wrapper that logs and continues, leaving a
capture that looks alive but is not writing. Fix: hand observations to a single-thread executor or bounded
`Channel`; surface write failures in `H10CaptureState` and the diagnostics log
(`h10_capture_write_failed`).

### G5 (low-medium): artifacts are not tied to the ride or segment
Automatic captures are still named `h10-diagnostic-<wallclock>` and carry only the capture's start time. The
phone-side comparison (RR vs segment attempt) has to be done by time overlap. Add the segment id and, once
known, the attempt id to a schema v2 header (together with the raw 1/1024 s units from H4) and name files
by role (`segment-<ts>.rr`).

## What I would do next, in order

1. **G8** (a few lines in `H10AutoConnectPolicy` / `LiveSegmentService`) - before group rides or sharing the APK.
2. **G2 + G1 together** (reconnect with a `GAP` marker) - the first real ride will probably contain a dropout.
3. **G4** (writer thread + write-failure state), then **schema v2** (raw units, segment/attempt ids, persisted
   integrity sidecar: H4, M1, G5) in one migration of the artifact format.
4. Export/delete controls and the consent step (point 6) before any build leaves your hands.
5. Decide G3 (per-segment vs whole-ride) with the first ride's data in hand.

## What is good (keep)

- Writes are exclusive and durable, validity is windowed, and parsing/quality/storage are small testable units
  (about 40 focused tests per Codex).
- The H10 coexists with Karoo's ANT+ HR (verified physically), the capture is torn down with the ride, and a
  missing permission or sensor silently falls back to ANT+ without delaying matching.
- Metrics are labelled diagnostic and nothing feeds pacing yet.
- The service/diagnostics split (process-local state bridge, commands as intents) is clean.

## Not checked

- Whether the full Karoo unit suite is green (the earlier `KarooPreviewStateTest` failure was reported unrelated;
  Codex's latest runs are focused subsets).
- Anything about the Needle/FIT items, which have no new code.
- Real-device behaviour of reconnect, because none exists yet.
