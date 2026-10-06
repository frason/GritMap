# Handoff: next-ride test checklist + follow-up review of the H10 work (docs only)

- Updated: `2026-10-05`
- Agent: `Claude`
- Branch: `main`
- Head: `a47e928 feat: coach-plan import, versioned rider profile, saved Karoo address` (pushed)
- Worktree: this entry adds only `docs/NEXT_RIDE_TEST_CHECKLIST.md`, `docs/REVIEW_H10_FOLLOWUP.md` and this
  archive (committed together with this archive). Codex's Karoo work, `ios/`, other archives and `LATEST.md` edits untouched.

## FOR CODEX

1. **Please read and correct `docs/NEXT_RIDE_TEST_CHECKLIST.md`.** It is the rider's checklist for the next
   ride on Karoo `0.10.39`. I derived its log-event sequence and file expectations from the 0.10.39 source
   (`segment_approaching` -> `h10_auto_reconnect|h10_auto_scan` -> `h10_auto_capture_started` ->
   `attempt_started` -> `attempt_finished` -> `h10_capture_saved reason=segment-ended` + `h10_auto_released`,
   `reason=ride-ended` only if a capture is still running). Fix anything that does not match the build, add
   Karoo-side checks I cannot know, and after the ride record the results in a dated archive entry.
2. **Follow-up review of your H10 work: `docs/REVIEW_H10_FOLLOWUP.md`.** B1-B4 are confirmed fixed. New
   findings, in priority order:
   - **G8 (high):** `selectAutomaticH10Device` falls back to *any single HR sensor*, and the client saves
     whatever connects as the preferred device, so in a group ride a stranger's strap can be recorded and
     remembered. Never pair from a ride-time scan; scan only to locate the saved address.
   - **G1/G2:** the beat clock lags ~3 s for ~10 min after a 3-packet dropout (simulated) and marks no gap;
     a mid-segment disconnect is never retried.
   - **G3:** capture is per segment (approach -> +2 min), not per ride -- decide whether that is intended.
   - **G4/G5:** fsync/finalize on the Binder thread; artifacts are not tied to segment/attempt ids.

## Why this matters now

No preferred H10 is saved on the Karoo yet (no `shared_prefs/h10_preferred_device.xml`, checked 2026-10-05
via `adb run-as`), so the first ride would exercise the scan auto-pick path that G8 warns about. The
checklist therefore has the rider connect and save their own H10 in H10 Diagnostics first and ride solo.

## Verified

- Read-only: Karoo database copy (earlier), `physiology/*`, `LiveSegmentService` H10 wiring, manifest, the
  device's `files/` and `shared_prefs` listing, `BoundedDiagnosticLog` (256 KB cap with rotation; holds
  several hours, unlike the 1 MiB logcat buffer which overwrites in ~20 min).
- G1 is a simulation of the mapper's arithmetic, not a Kotlin test run; nothing was run on the Karoo by me.
- Not checked: whether the full Karoo suite is green.

## External state

- Karoo `00442GA241760203` runs `0.10.39`, ADB-connected at the time of writing. I only read from it
  (`run-as ... cat/ls`); nothing was installed, changed or deleted.

## Hazards and blockers

- `LATEST.md` is Codex's heavily edited file and is deliberately not committed by Claude; it carries a short
  FOR CODEX note and this archive carries the full text.

## Next safe action

Rider: run section 1 of the checklist (including saving the H10 as the preferred sensor), then the ride.
Codex: confirm/correct the checklist, then G8, then G2+G1.
