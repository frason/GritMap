# Handoff: short physical ride verifies automatic H10 capture

- Updated: `2026-10-06 08:52 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `e8be5b4 docs: next-ride test checklist and follow-up review of the H10 work`
- Worktree: shared uncommitted Karoo, phone, physiology, UI and documentation changes

## Outcome

The installed 0.10.40 automatic approach/H10 path completed successfully during a short recorded
ride. The ride did not traverse a segment with a plan, so this is a physiology/lifecycle result,
not a matcher or pacing-plan result.

## Changed

- Recorded the physical result in `docs/NEXT_RIDE_TEST_CHECKLIST.md`.
- No application code or device installation changed.

## Verified

- ADB confirmed `versionName=0.10.40`, `versionCode=63`.
- `segment_approaching segment=coco-jumbo` occurred at `1791301334155`.
- H10 request at `1791301334159`, connected at `1791301337367`, capture at `1791301337408`:
  3.208 s to connected and 3.249 s to capture.
- No `h10_auto_retry_started`, `h10_auto_fallback`, GATT error, capture failure or crash occurred.
- Ride end saved `h10-diagnostic-1791301337373.rr` with 236 samples.
- Decoding the artifact found schema 1, 236/236 valid, zero gap markers, 238.327 s duration,
  59.23 bpm RR-derived mean, and zero ignored trailing bytes. File size was exactly
  `16 + 236 * 14 = 3320` bytes.
- Android logcat contained no GritMap fatal exception in the inspected recent window.
- `Karoo-Morning_Ride-2026-10-06-0841.fit` contains 247 parsed points over 293 seconds, including
  238 HR records and no power/cadence records. Its device metadata identifies the Polar strap as an
  ANT+ heart-rate device.
- During the BLE RR artifact's exact wall-clock window, FIT HR averaged 59.60 bpm versus 59.23 bpm
  derived from RR: a -0.37 bpm difference, comfortably inside the checklist's 2 bpm threshold.

## External state

- Karoo remains on 0.10.40/code63; offline 0.10.41/code64 was not installed.
- The new artifact remains app-private on the Karoo. A temporary read-only copy was decoded at
  `/private/tmp/gritmap-latest.rr`.

## Hazards and blockers

- No planned segment was ridden: attempt activation, pacing coach, zone transitions, map pacer and
  completion are still not physically validated by this ride.
- The supplied FIT resolves the HR comparison and confirms Karoo ANT+ HR recording continued while
  GritMap captured RR over Bluetooth.
- Android denied the extension's initial background service start, but the map-layer request
  successfully created the service about 0.8 seconds later. This fallback worked, but a ride with
  neither map layer nor a visible GritMap field could still expose the start restriction.

## Next safe action

Keep 0.10.40 installed until one real planned segment verifies entry, guidance and completion; then install
0.10.41 for the dropout/writer/schema-2 test.
