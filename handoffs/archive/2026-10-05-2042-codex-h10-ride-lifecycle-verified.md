# Handoff: H10 ride lifecycle verified end to end

- Updated: `2026-10-05 20:42 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d739851 docs: review of Karoo AI/physiology plan and H10 RR foundation`
- Worktree: `uncommitted mixed worktree; Karoo physiology/service/manifest/version changes are Codex work`

## Outcome

GritMap `0.10.38` passed the complete physical ride lifecycle for simultaneous Polar H10 BLE RR
capture and Karoo ANT+ HR: the service retained BLE after leaving diagnostics, captured during
Recording and Paused, then atomically finalized the RR artifact and disconnected BLE on Idle.
Karoo GPS/telemetry and ANT+ HR continued throughout. This closes the Activity-ownership defect
that previously disconnected H10 after eight seconds.

## Changed

- No additional code after the service-owned milestone; this handoff records the completed physical
  ride-end verification of `H10ServiceBridge.kt`, `H10DiagnosticActivity.kt`,
  `LiveSegmentService.kt`, the manifest service type, and build 0.10.38.
- `docs/PLAN_KAROO_AI_PHYSIOLOGY.md` updated with the verified lifecycle outcome.

## Verified

- Diagnostics log sequence:
  - `ride_state state=Paused`
  - `ride_state state=Idle`
  - `h10_capture_saved reason=ride-ended samples=265`
  - `telemetry_consumers_stopped`
- Active partial became `h10-diagnostic-1791257561267.rr`; no corresponding partial remains.
- Exact size 3,726 bytes = 16-byte header + 265 fixed 14-byte records.
- Header: `GMRR`, schema version 1.
- Artifact SHA-256:
  `5678fde1a34a9930869b10b8ec89f871bc94651ce66efc8b8a8da77ddee2ae43`.
- BLE H10 disconnected at 20:36:56 on ride end.
- `LiveSegmentService` remains start-requested for future Karoo events but is no longer foreground;
  this is expected outside Recording/Paused.
- No fatal app, GATT status, or artifact-save error observed.

## External state

- Karoo `00442GA241760203` runs GritMap 0.10.38 / code 61.
- The new finalized 265-record artifact and the earlier 163-record artifact remain app-private.
- The older two-record `.partial` from the failed Activity-owned experiment remains recoverable and
  was not deleted.

## Hazards and blockers

- First pairing/start remains manual through H10 Diagnostics. Saved sensor identity, automatic
  reconnect/backoff and an explicit H10-enabled setting are still needed before normal ride use.
- RR uses a capture-relative monotonic timeline, not yet a versioned ride/pause alignment contract.
- Raw sensor 1/1024-second values are rounded to milliseconds in schema v1.
- There is no user-facing RR export/delete/retention workflow yet.
- This was a short stationary ride. A longer outdoor ride should validate radio stability, battery,
  process pressure, and BPM agreement with Karoo's ANT+ stream.

## Next safe action

Add a persisted, privacy-safe selected-H10 identity and bounded reconnect policy so a rider can
enable H10 Enhanced once and have the ride service reconnect without opening diagnostics; retain a
manual disconnect/disable escape hatch.
