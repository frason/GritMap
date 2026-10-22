# Karoo concurrent segments and PR display: implementation design

2026-10-20, Codex. **Development runtime integrated behind a default-off flag; PR import/display pending.** Implements the direction in
`GOALS.md` priority 7 and reviews `KAROO_MULTI_SEGMENT_AND_PR.md`. This is post-beta work. The installed
`0.10.44-ble2`/69 and public beta are unchanged.

## Implementation checkpoint

`matching/ConcurrentSegmentTracker.kt` provides the pure lifecycle and headline selector. The new
`service/ConcurrentLiveRide.kt` connects it to per-attempt sessions, bounded start-sample replay,
immutable macro-event snapshots and an ordered retry outbox. `RoomConcurrentRide.kt` supplies discovery
and persistence; `LiveSegmentService` selects it only with `-PgritmapConcurrentSegments=true` (default
false for every build type). H10 stays ride-scoped and is not released while any concurrent attempt
remains. Performance fields show the headline and a secondary-segment line; unplanned segments show
elapsed/progress while PR support is pending.

Observation and confirmation timestamps are separate; PRs use sampled elapsed time, not interpolated
crossings. The matcher may choose different boundary samples from the phone. No PR storage/curve/import
or wire changes are implemented. Ride-level W′ is pending and disabled in this development path to
avoid restarting a physical reserve for every overlapping segment. Physical validation and release
readiness remain pending.

## Findings from the current code

- `service/LiveSegmentCoordinator.kt` discovers only when `candidates.isEmpty()`, selects one candidate
  through a 50 m lock, and clears all candidates on completion. A segment beginning inside another is missed.
- `service/LiveSegmentService.kt` owns one `activeSession`, global checkpoint/inference bookkeeping,
  single-session begin/update/finish callbacks, and clears the shared UI on exit. Changing discovery alone
  would overwrite attempts and disrupt the display and H10 lifecycle.
- The runtime session is `service/ActiveAttemptSession.kt`; the similarly named `matching/` class is a
  separate aggregate helper. Runtime attempt statistics and UI histories must remain per attempt.
- Coordinator `uiState()` creates a provisional plan whenever imported zones are absent. This would mask
  the requested PR/first-attempt mode. A provisional plan must not count as a rider plan or win selection.
- `RoomAttemptEventSink` already writes by attempt ID, but asynchronous entry/checkpoint/exit calls are
  independently launched and exit uses wall-clock persistence time. PR timing cannot rely on write time.
- `TransferPackageParser` rejects `segmentRecord` today; the BLE manifest accepts only plan/segment/rider,
  with plan required. Both need explicit compatibility handling before a phone sender can change.

## Concurrency and ownership

Use a ride-scoped orchestrator with a map keyed by segment fingerprint. Each entry owns its definition,
matcher, forward-start gate, first start-crossing sample/time, immutable baseline/record snapshot,
optional confirmed `ActiveAttemptSession`, and checkpoint state. Local segment IDs remain persistence
keys; fingerprints identify the geometry/version. Never recreate a matcher for an existing entry.

For each serialized telemetry tick:

1. Discover nearby starts even while other attempts run. Keep indexed start-bound queries bounded and
   cache definitions outside the hot path. Start with every distinct valid GPS fix for correctness;
   only throttle after measuring missed starts and query cost. Approach discovery retains its own cadence.
2. Update each candidate's directed matcher. Retain the existing forward-progress guard before starting
   an attempt. Preserve the first valid start sample rather than resetting time at confirmation; retain
   the small confirmation buffer so early telemetry is counted once.
3. Begin every independently confirmed forward traversal, update each session once, and emit terminal
   events for completed/abandoned entries. Remove only that entry. A brief start-zone rearm guard prevents
   duplicate entries from lingering GPS fixes; genuine repeat traversals remain possible after leaving
   and re-entering the start zone. Reverse and mid-route entry remain ineligible.
4. Select the headline from the surviving active set and publish one aggregate display snapshot. Finishing
   the headline immediately exposes another active segment; it never clears that segment's history.

Jason approved a cap of four active sessions (2026-10-20). A fifth is not tracked and produces a diagnostic. Never evict an active attempt to admit a fifth; diagnose
capacity misses and avoid claiming that an untracked segment was recorded. Bound tentative candidates
separately and define admission ordering by start timestamp then fingerprint, independent of Room order.
Use synthetic stress fixtures to verify the approved four-session bound before public rollout.

Keep a single sensor stream, Bluetooth/H10 connection and ride-level RR artifact. Headline changes must
not start/stop capture, replace its identity with whichever segment wins, or release Bluetooth while
another segment is active/approaching. Associate overlapping attempt IDs through explicit metadata rather
than opening duplicate RR recordings. Audit existing H10 identity updates before implementation.

All begin/update/finish operations carry attempt ID. Deliver immutable entry/checkpoint/exit snapshots
through one ordered persistence queue, so a finalization cannot overtake its insert. No per-second Room
writes. Ride stop/service teardown finalizes each session exactly once and resets all matchers. Keep the
existing sensor computations' semantics explicit: per-attempt histories may be separate, but a physical
ride-level W′ balance must not be multiplied or reset on headline changes. On-device AI remains deferred.

## Headline and rendering

Pure selector: eligible active attempts with an imported, valid baseline plan first; within that group,
choose smallest remaining route distance (`length - progress`), then stable fingerprint as tie-breaker.
If none has a plan, apply the same distance ordering to all active attempts. “Ends first” means remaining
route distance here, not a noisy predicted arrival time. Start confirmation is required; proximity alone
must not steal the headline. Test deterministic ties and finish handover.

Publish explicit `PLAN`, `PERSONAL_RECORD`, or `FIRST_ATTEMPT` presentation mode, headline attempt ID,
and a bounded list of secondary names/remaining distances. Existing fields and map consume that same
snapshot, avoiding different headline choices. Show one short “Also: …” line on large fields; compact
fields show a count if names do not fit. Preserve safety/sensor warnings and rider-facing “sections”.

- PLAN: existing imported targets/pacer presentation. No provisional fallback in this feature path.
- PERSONAL_RECORD: PR finish time, elapsed/progress and signed live delta against the PR curve.
  Define `aheadSeconds = referenceElapsedAtCurrentDistance - currentElapsed`; positive displays “ahead”.
  Interpolate between reference anchors, never extrapolate outside [0, segment length]. Use confirmed
  monotonic progress for comparison; suppress delta when GPS is uncertain. Do not label PR as a plan.
- FIRST_ATTEMPT: progress and elapsed only, with an explicit no-record state and no invented target.

Freeze the reference for the duration of an attempt, including imported plans/PRs received mid-ride.
A faster completed valid effort can replace the local best after finalization, without changing another
ongoing attempt's reference. The map uses the same chosen reference; hide the pacer when no reference exists.

## Contract review: conditional acceptance; details to settle before sender work

The optional top-level `segmentRecord` is appropriate for Wi-Fi packages, including record-only sends,
but the proposal is not yet a complete interoperable contract. Keep unknown-key rejection and atomic
import. Add a bounded strict parser and persistent record/split model, then shared fixtures, before the
phone emits this field. Omission preserves existing data; it must not implicitly delete a PR or plan.

Required decisions and recommended constraints:

- Bind the record to the packaged or already-installed segment fingerprint and active local rider.
  Specify single-rider ownership, replacement/reset behavior and source provenance. Never infer rider
  identity from FTP alone. A stale phone record must not overwrite a faster eligible local record.
- Define “best” by the phone’s accepted-or-manually-approved effort filter.
  `effortCount` is phone summary metadata, not a value the Karoo can safely increment/merge on repeat send.
- Confirmed time basis: sampled elapsed time including pauses, from the matched start/end ride-point
  timestamps; see the proposal’s phone code review. Do not interpolate or round imported PR durations.
  The concurrent path persists observation/sample timestamps rather than direction-confirmation/write
  times. Boundary matching may differ from the phone. Existing local rows may remain displayable
  as historical estimates but cannot supply a trustworthy split curve by themselves.
- Positive finite best duration, positive integer achieved timestamp, nonnegative integer effort count;
  strict split keys, finite coordinates, strictly increasing distances/times, bounds checked against actual
  segment length, and final anchor matching best duration. Origin is `(0,0)`; encode it or define it as
  implicit consistently. Reject malformed records atomically, including otherwise-valid plan packages.
- Fixed 250 m splits with 80 entries do not cover segments over 20 km. Recommend adaptive anchors with
  at most 80 encoded entries **including origin and finish**, exact end distance, and documented
  interpolation. Distance is segment-relative metres, time is seconds with agreed precision.
- Enforce byte and numeric limits in both implementations; define ties, out-of-order updates and whether
  missing splits are valid. Recommend allowing best-time-only records with no live delta, clearly labeled.
- Record-only packages must resolve an installed or packaged segment and work without a baseline plan.
  Include import-result/UI feedback for record updated/unchanged. Capability/version negotiation or an
  explicit minimum Karoo version must prevent new payloads reaching old strict parsers.

**Bluetooth stays unchanged for this milestone.** A fourth resource is not just a new optional field:
it affects the strict manifest, resource enum, hashes, package builder, size caps, receipt timing and the
required-plan assumption. Review with the phone session and settle version/capability negotiation and
PR-only sessions before writing either sender or receiver. Preserve existing v2 fixtures and success paths.

## Implementation order and acceptance checks

1. Time basis and four-session cap are decided. Settle rider/record semantics with the phone side before sender work.
2. Add pure selector/concurrent lifecycle logic and a dedicated development flag defaulting off in
   public beta; do not couple this feature to the Bluetooth enable flag. Keep legacy path intact.
3. Integrate service ownership, ordered persistence, H10 lifecycle and aggregate UI. Replay synthetic
   overlapping routes: A starts, B starts 950 m later, A finishes while B continues. Expect two distinct
   attempt IDs, independent progress/statistics, one finish per attempt and correct headline handover.
4. Add Room migration and Wi-Fi `segmentRecord` parser/import support with shared positive/negative
   fixtures; verify old packages and record-only packages before enabling phone sends.
5. Add PR/first-attempt rendering and small/large preview checks. Test interpolation, equality, pauses,
   uncertain GPS, stale/shorter records, missing split curves and changes received during an attempt.
6. Run Karoo unit tests, lint, signed dev build, migration checks and physical overlap/H10 checks before
   enabling any public behavior. No installation or release is part of this design-only milestone.

Additional lifecycle tests: reverse start, missed start, capacity overflow, deterministic Room ordering,
same-tick dual completion, abandoned headline, stop/service teardown, re-entry, delayed persistence and
one telemetry tick counted once in each independently active session. Keep personal GPS fixtures out of Git.
