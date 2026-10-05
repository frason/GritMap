# Review: Karoo AI and Physiology Plan

- Reviewer: Claude
- Date: 2026-10-05
- Reviews: `docs/PLAN_KAROO_AI_PHYSIOLOGY.md` **and** the code Codex has since added under
  `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/` (the plan asked for review before
  implementation; by the time of this review the isolated RR foundation, a BLE client and a
  diagnostics screen already existed, so both are reviewed).
- Status: findings only, no code changed. Nothing here was run on a device; everything marked
  "from reading" is a code-reading conclusion, not a measured failure.

## Verdict

The plan's architecture is sound and I would not rewrite it: deterministic matching stays
authoritative, power stays primary, no per-beat Room writes, a Level A/B/C fallback ladder,
shadow mode before live adaptation, and a benchmark gate before Needle. The standard-BLE
Heart Rate Service choice is right, and the packet parser matches the Bluetooth SIG layout.

The **implementation** that exists is a good desk-test foundation but has four defects that
should be fixed before it is wired to a ride (B1-B4), because each one would silently
invalidate the spike's own acceptance criteria. The rest are design corrections.

## Blockers before wiring into a ride

### B1. Artifact writer can destroy a recoverable file
`RrArtifactStore.kt:51` opens the `.rr.partial` with `Files.newOutputStream(partialPath)`, whose
default is CREATE + TRUNCATE_EXISTING. `RrArtifactStore.kt:85,88` finalize with
REPLACE_EXISTING. The diagnostic path uses a fresh timestamped ride id so it cannot collide, but
the first real integration will use a deterministic per-ride id; after a crash and restart,
constructing the writer **truncates the very file recovery was meant to read**.
Fix: open with CREATE_NEW; on startup recover any `.partial` first, finalize or quarantine it
(`.rr.recovered`), and start a new part file (`<rideId>.partN.rr.partial`). Never
REPLACE_EXISTING a finalized artifact.

### B2. "Crash-safe" is not true as wired: up to ~8 minutes of RR can be lost
The writer wraps a default 8 KiB `BufferedOutputStream` (line 51); records are 14 bytes, so
about 585 records (roughly 8-10 minutes at 1.0-1.2 beats/s) sit in memory. `checkpoint()`
(`RrArtifactStore.kt:69`) is only called from `H10DiagnosticActivity.onDestroy`
(`H10DiagnosticActivity.kt:66`), which does not run on process death. The plan's acceptance
criterion "a process restart recovers an incomplete artifact" would pass the unit test and fail
on a real kill.
Fix: flush on a timer (about every 5 s) and on disconnect/pause/stop; `FileDescriptor.sync()`
(or `FileChannel.force`) about every 30-60 s so device power loss costs seconds, not minutes.
Test with `kill -9`, not just `close()`.

### B3. Timestamp mapping can mark valid beats as artifacts after a delivery stall
`RrPacketTimestampMapper` back-computes each RR endpoint from the *arrival* time of the
notification. `RrObservationValidator` (`RrModels.kt:50-51`) flags any endpoint earlier than the
previous one as `TIMESTAMP_OUT_OF_ORDER`. If Android delivers two notifications back to back after
a stall (connection-interval slip, GC, Karoo CPU load), the second packet's first endpoint is
`arrival - sum(its RRs)`, which can precede the previous packet's last endpoint although the beats
are perfectly good. Those get `valid=false`, `RrLiveBuffer` resets its consecutive-valid timer
(`RrLiveBuffer.kt:34`), and enhanced metrics never become "READY" on a bike with a
noisy radio. From reading; easy to reproduce with a unit test that delivers
`[1000, 1000]`-ms packets 20 ms apart.
Fix: build the beat timeline from the **cumulative RR sum** (the sensor's own clock) anchored at the
first packet and slowly re-anchored to arrival times (e.g. clamp drift correction to a few ms per
packet). Do not use arrival jitter for validity. Keep arrival time as a separate diagnostic field.

### B4. Quality gate is lifetime ratio, not windowed
`RrLiveBuffer.kt:49` computes `validPct` as `validCount / totalCount` over the **whole capture**,
but the plan (and the 120 s window) intend a recent-window gate. After 40 minutes of clean data a
5-minute strap-contact failure still reports >=90 %, so adaptation would stay "allowed" through bad
data; conversely early artifacts hold a good ride below 90 % for a very long time.
Fix: compute valid percentage over the same window used for the metrics (and require a minimum
sample count in that window). Keep lifetime counters only as ride-summary statistics.

## High-priority design corrections

### H1. Connection ownership: the GATT link lives in an Activity
`H10DiagnosticActivity` creates and closes `H10BleClient` in `onCreate`/`onDestroy`. Fine for a
desk test, wrong for a ride. Recommendation:
- Own the connection in a long-lived component driven by Karoo ride state
  (Recording/Paused/Idle from karoo-ext), not by UI. `LiveSegmentService` is foreground with
  `foregroundServiceType="location"`; a BLE link should add `connectedDevice` (a bitmask,
  `location|connectedDevice`). With `targetSdk=31` the Android 14 permission for that type is not
  required, but this combination must be tested on the Karoo, not assumed.
- Persist the chosen sensor address after first selection and reconnect by address
  (`getRemoteDevice`) -- **no scanning during a ride**. A connected H10 with both BLE slots used
  stops advertising, so scan-based reconnect can fail exactly when it is needed, and a
  `SCAN_MODE_LOW_LATENCY` scan on a bike computer that is also running its own sensor scans is
  needless radio contention.
- Alternative worth evaluating after the spike: karoo-ext's sanctioned sensor-source path
  (`ExtensionInfo.scansDevices`, `startScan`, `connectDevice`, `OnDataPoint`,
  `KarooExtension.kt:78-94`). It would let Karoo own pairing UI and surface RR-derived values as
  data types. Its cost: values only reach Karoo as 1 Hz numeric `DataPoint`s, so raw RR still needs
  the side channel in this plan. Do not block the spike on it.

### H2. Reconnect, stale callbacks, and state races
- No reconnect or backoff exists (`connectGatt(..., autoConnect=false, ...)` at
  `H10BleClient.kt:221`; `STATE_DISCONNECTED` just sets a label). The plan requires bounded
  backoff; add it, treat GATT status 133 as retryable, always `close()` the old `BluetoothGatt`
  before creating another, and add an overall connection-attempt timeout.
- Callbacks are not guarded against stale GATT objects (`this.gatt === gatt` is checked only on
  the disconnect branch). After `connect()` calls `gatt?.close()`, a late callback from the old
  object can overwrite the new connection's state.
- `mutableState.value = mutableState.value.copy(...)` is a non-atomic read-modify-write called
  from the main thread (scan) and Binder threads (GATT); updates can be lost. Use
  `MutableStateFlow.update { }`.
- One malformed packet sets `ERROR` (`H10BleClient.kt:165`) while the link is still healthy. Count
  and skip bad packets; reserve ERROR for link failures.

### H3. Disk I/O and exceptions on the GATT callback thread
`onMeasurement` -> `H10CaptureController.onMeasurement` -> `RrArtifactWriter.append` runs on the
Binder thread that delivers notifications. Buffered writes are usually cheap, but flushes/fsync
(B2) are not, and a thrown `IOException` (disk full) would be swallowed by the platform's callback
wrapper and the capture would look healthy while recording nothing. Hand observations to a single
bounded `Channel`/single-thread dispatcher; expose write failures as explicit capture state.

### H4. Do not round RR to milliseconds at the parser
`BleHeartRateMeasurementParser.kt:44` converts 1/1024 s units to a rounded integer ms. The
sensor's resolution is 1/1024 s, so rounding injects up to ~0.5 ms of quantization error into every
interval. For RMSSD-class statistics and artifact detection that matters slightly; storing the raw
`uint16` units costs nothing and lets analysis versions re-derive ms however they like. Change the
artifact record to carry the raw units (schema v2) while keeping ms as a derived value.

### H5. Timeline model: ride-elapsed vs. wall-clock vs. pauses
The plan says "`elapsedMs` relative to the ride timeline", but the controller measures from capture
start (`H10CaptureController.kt:50,70`). Karoo auto-pause and manual
pause stop FIT records while RR keeps flowing. Store, per artifact, a wall-clock epoch anchor and
the device monotonic anchor in the header, and store records as monotonic offsets. Map to Karoo's
FIT timeline at export. Otherwise RR cannot be aligned to power/HR records after any pause.

## Medium

- **M1. Hash and integrity are not durable.** The SHA-256 exists only in the in-memory
  `FinalizedRrArtifact` and the UI (`RrArtifactStore.kt` finalize). The plan's "hash-verifiable
  artifact" needs a persisted sidecar or footer, plus a periodic block checksum so a torn or
  corrupted middle record is detected (today only a trailing partial record is tolerated).
- **M2. Sensor identifiers.** The plan says hash before persistence. A bare SHA-256 of a 48-bit
  Bluetooth address is brute-forceable in seconds. Use a per-install random salt (or HMAC with a
  Keystore-held key).
- **M3. Getting artifacts off the Karoo.** Artifacts live in app-private `filesDir/physiology`
  (`H10DiagnosticActivity.kt:41`). On a debug APK you can pull them with
  `adb run-as com.gritmap.karoo`; a release build offers no way out. Decide the export path now
  (share intent to the phone/files, or a post-ride sync) because it is also the answer to the
  data-portability requirement below.
- **M4. Per-packet allocation.** `RrLiveBuffer.snapshot()` copies the window (`toList()`, up to
  512 elements) on every packet. Harmless at 1 Hz, but hand out a read-only view or compute metrics
  incrementally before adding DFA.
- **M5. Phone-side contract.** The plan's "provider-neutral guidance contract" already exists in
  embryo: `gritmap-transfer` carries `baselinePacingPlan.generator.type`
  (`phone-ai | cloud-ai | manual`, `apps/karoo/TRANSFER_PACKAGE.md:52`) and
  `AiPlanValidator.kt` enforces the 100 W step / 150 % FTP / contiguity bounds. Extend that
  (add `human-coach` / `ai-coach`, a provenance block, a `riderProfileVersion`) instead of
  introducing a parallel schema, and require every imported coach plan to pass the same validator
  on the phone before preview. "Versioned rider profile" is not implemented yet:
  `buildRiderHistoryPackage` sends FTP/weight/max-HR without a version, and Karoo's new
  `RiderProfileStore.kt` is untracked and unreviewed here.

## Answers to the eight requested review points

### 1. Android API 31 feasibility without the Polar SDK
Feasible, and the right call. The H10 exposes the standard Heart Rate Service (0x180D /
0x2A37) with RR in 1/1024 s units; Codex's parser handles the flag bits (16-bit HR 0x01, contact
0x02/0x04, energy 0x08, RR 0x10) and multiple RR per packet correctly. API 31 needs runtime
`BLUETOOTH_SCAN` (with `neverForLocation`) and `BLUETOOTH_CONNECT`; the manifest declares the legacy
`BLUETOOTH`/`BLUETOOTH_ADMIN` with `maxSdkVersion=30` correctly. The deprecated two-argument
`onCharacteristicChanged` and `descriptor.value` are the right pair at API 31. **Unverified:** that
Karoo's OS presents the runtime-permission dialog for a sideloaded extension app. The diagnostics
APK is exactly the test of this -- run it first. I could not confirm the plan's claim that the
current Polar SDK requires a minimum API above 31 (the SDK page I could read did not say); it does
not matter, because the standard-HRS route is preferable regardless.

### 2. Connection ownership alongside Karoo's own ANT+/BLE handling
- Polar documents two simultaneous Bluetooth connections plus ANT+ broadcast on the H10 (the
  "2 Bluetooth devices" setting, on by default). Your existing FIT files show Karoo recording the
  strap over **ANT+**, so Karoo uses none of the BLE slots and GritMap can hold one BLE link while
  a phone/watch holds the other. That is the best configuration; state it as a requirement.
- If a rider's Karoo uses BLE for the strap instead, GritMap takes the second slot and any third
  client (Polar Beat, a watch) is refused. Detect and message this; don't just show ERROR.
- A strap whose BLE slots are full stops advertising -> reconnect by saved address, not scan (H1).
- BPM cross-check: during the spike, log Karoo's HR stream (karoo-ext `HEART_RATE` stream) beside the
  GATT BPM. They should agree within a beat or two; a systematic gap indicates a bug or a
  different sensor.
- Process priority while the Karoo app is foreground is unproven for an Activity-owned link; see H1.

### 3. Crash-safe bounded RR storage
Design is right (fixed 14-byte records, header with magic/schema, `.partial` -> atomic rename,
bounded 512-sample live window). Defects: B1 (truncate on reopen), B2 (buffering + no periodic
flush/fsync), M1 (no durable hash/checksum), H4/H5 (precision and timeline). With B1-B2 fixed it
satisfies the plan's crash and 60-minute-bounded-memory criteria.

### 4. FIT developer-field limits
Correct the plan: it says multiple beat intervals "do not map cleanly" into FIT. FIT has a native
**`hrv` message (id 78)** whose `time` field is an array of up to ~5 `uint16` values in seconds
(scale 1000, 0xFFFF invalid) -- designed precisely for RR. But karoo-ext (vendored 1.1.9) cannot emit
arbitrary messages: `FitEffect` offers only `WriteToRecordMesg` (1 Hz), `WriteToSessionMesg` and
`WriteEventMesg`, each carrying **single numeric `Double` values** keyed by developer fields
(`FitEffect.kt`). Developer fields have no scale/offset, no arrays or strings, and at most 255
field descriptions per extension; the value is cast to the declared FIT base type, so choose a
float32 or an integer base type with your own scaling (e.g. DFA a1 x 1000 as `uint16`).
Therefore:
1. Raw RR -> never through the Karoo SDK. Keep the separate artifact.
2. Derived summaries (DFA a1, valid-RR %, respiration) -> record-level or session developer
   fields via `startFit`; fine for portability, modest size at 1 Hz.
3. For platforms that read `hrv` messages, produce a post-ride **export tool** (phone or desktop)
   that merges the artifact into a copy of the FIT as `hrv` messages. Do not claim in-ride FIT
   fidelity.

### 5. Does the Needle packaging assessment match upstream?
Partly. Matches: Android ships `android-arm64`, `android-armv7`, `android-riscv64` folders each with
a `needle` binary, `libneedle.a` and `needle.h`; native API `needle_load`, `needle_init`,
`needle_complete`; weights are a single `.cact` file mapped in place; the plan's "static library +
`.cact`" and "current JNI targets a general Cactus dynamic runtime" are both correct
(`MODEL_PROVENANCE.md` pins Cactus `v2.0.1`, `libcactus_engine.so`, a model bundle *directory* --
neither shape matches the Needle static library).
Does **not** match: upstream's primary model is now **Needle 3** (`Cactus-Compute/needle3`,
`needle3.cact`, single file 8-29 MB depending on depth, 121M-parameter variant); Needle 2 is kept as
the legacy `generation=2` path. The plan pins "an exact Needle 2 commit". Decide Needle 2 vs 3
deliberately, confirm which Android prebuilts and weights are actually still downloadable for
that choice, and pin by SHA-256. Upstream also states one model per process and not
thread-safe, which agrees with the plan's serialized inference; keep the model in one process
and one inference thread. The Needle 2 model card lists Apache-2.0; I could not read a license for
Needle 3 -- verify at the pinned revision, as the provenance file already says.
Caveat: this comes from model-card/README/devices-guide pages read through a summarizer and
there were no GitHub releases to inspect; the plan's own "pin and hash" step is the real check.

One strategic note: Needle is a tool-calling / structured-extraction model. Whether it beats a
simple deterministic controller (e.g. "freeze unless HR cost drift > x for y minutes, then +/- 10 W")
for these four actions is unproven. Make that deterministic controller the **baseline** in
Phase 5 shadow mode and require Needle to beat it on retrospective rides before it influences
anything.

### 6. Missing privacy, consent, deletion, export requirements
Add to the plan:
- **Classification.** Heart rate and HRV are health data; for any public release get legal review
  (EU/UK special-category rules, US state consumer-health-data laws) before choosing defaults.
  Summaries-only default for public builds, as the plan already says.
- **Consent** as its own step before first capture (what is stored, where, for how long), separate
  from the Android Bluetooth permission. Record the consent version with each artifact.
- **Deletion:** per-ride, bulk, and "delete all physiology data"; include `.partial`/`.recovered`
  parts and sidecars; run an orphan sweep at startup because Room cascades never delete files; the
  "delete after N days" option needs a scheduled job and a visible setting. Note flash storage gives
  no secure erase; if this matters publicly, encrypt artifacts with a Keystore-held key and delete
  the key.
- **Export / portability:** the `GMRR` format is private. Provide a documented export (CSV and
  FIT `hrv`) so users can retrieve their own data (M3).
- **Backup:** already handled -- `allowBackup=false` and `data_extraction_rules.xml` exclude all
  domains for cloud backup and device transfer. Keep that, and keep physiology files out of any
  `external` storage.
- **Logging:** no RR or HR in logcat/Timber, crash reports, or `TelemetryV1`; verify the
  telemetry schema stays free of raw physiology unless a user opts in.
- **Transport:** the phone<->Karoo channel is an unauthenticated plain-HTTP LAN listener (see the
  manifest note). The plan says summaries return to the phone later; no such return path exists
  yet. Never route physiology over that channel without authentication and encryption.
- **Sensor identity:** salted hash (M2). Do not persist the raw address in logs or exports (the
  saved address needed for reconnect stays in app-private storage only).
- **Claims:** DFA a1 thresholds are research constructs; the plan's confidence gate is right, and
  the UI must avoid medical language.

### 7. Unsafe coupling with current uncommitted work
The new `physiology/` sources and tests are new, isolated files -- good. Shared-file touches are
only: `AndroidManifest.xml` (BLE permissions + `H10DiagnosticActivity`), `MainActivity.kt`
(launch intent) and `ui/KarooHomeScreen.kt` (a Settings entry). Hazards:
- All three shared files are *also* carrying other uncommitted Codex work (map pacer, Pacing
  Coach, home screen), so a single `git add` of them mixes the H10 spike into unrelated commits.
  Commit in two steps: (1) `physiology/` + tests + docs; (2) the three shared-file hunks
  separately, or split the pacer/Coach changes out first.
- The full Karoo unit suite has a pre-existing failure,
  `KarooPreviewStateTest > preview traverses recover hold and push zones`. Fix or quarantine it
  under its owner before the H10 milestone so a green baseline exists.
- Nothing in the physiology path touches `LiveSegmentCoordinator`, `ActiveAttemptSession` or
  `CardiacDriftTracker` -- keep it that way until the ride-state wiring (H1) is reviewed.
- Phone side: nothing yet; when the guidance contract (M5) lands it touches
  `src/pacing/buildBaselinePacingPlan.ts` and `src/karoo/buildRiderHistoryPackage.ts`, both mine and
  both now committed (`89b0648`), so this is a clean place to coordinate.

### 8. Minimal file-level boundary for the H10 feasibility spike
Keep what exists; the spike is "run a real ride and prove the acceptance list". Smallest set:

Fix in place (no new surface area):
- `RrArtifactStore.kt` -- B1, B2, M1, H4 (raw units), H5 (anchors); schema v2.
- `RrModels.kt` / `RrPacketTimestampMapper.kt` -- B3 (beat-clock timeline).
- `RrLiveBuffer.kt` -- B4 (windowed validity), M4.
- `H10BleClient.kt` -- H2 (`update{}`, stale-callback guard, packet-error counting, reconnect
  with backoff, connect-by-saved-address).
- `H10CaptureController.kt` -- H3 (single writer thread/channel, write-error state) and a periodic
  checkpoint timer.

Add (new files only):
- `physiology/H10RideSession.kt` -- the one owner: starts/stops on Karoo ride state, holds
  `H10BleClient` + `H10CaptureController`, exposes `PhysiologyState` read-only. Behind a feature
  flag defaulting off.
- `physiology/PhysiologySettings.kt` -- saved sensor address, retain-raw vs summaries-only,
  consent version. App-private, no Room.
- Tests: kill-and-recover test (writer subprocess killed), burst-delivery timestamp test (B3),
  windowed-validity test (B4), and a stale-callback test with a fake GATT.

Do **not** touch for the spike: Room schema, phone app, `LiveSegmentCoordinator`,
`CardiacDriftTracker`, Needle code, FIT effects. A BPM-vs-Karoo-HR comparison is logged to a file
by `H10RideSession` only.

Spike acceptance run (adds to the plan's list): one real ride of 60+ minutes with Karoo on
ANT+; force-kill the extension process mid-ride and confirm recovery of everything but the last
flush interval; deliberately disconnect and re-seat the strap and confirm reconnect without scan;
verify that artifact timestamps are monotonic and that per-minute counts of RR vs.
(BPM/60) agree within a few percent; pull the artifact via `adb run-as`, recompute the SHA-256
from the sidecar, and compare derived mean HR against the Karoo FIT BPM.

## What I would not change

- The Level A/B/C structure and never fabricating HR from stored settings.
- Power-primary; no single metric may change a plan.
- Sparse deltas instead of regenerating a full plan every ten seconds.
- Phase order: spike -> RR research mode (no pacing influence) -> Needle benchmark -> shadow ->
  bounded live. Add the deterministic-controller baseline to the shadow phase.
- Retain-raw for the owner's development install, summaries-only default for public release.

## Suggested acceptance of this review

Codex addresses B1-B4 and H1-H3 in place (all inside `physiology/`), updates the plan with the
FIT correction (point 4), the Needle 2-vs-3 decision (point 5), and the privacy additions
(point 6), and re-runs the focused physiology tests. Then run the diagnostics APK on the Karoo
(this also settles the runtime-permission question in point 1) before any ride wiring begins.
