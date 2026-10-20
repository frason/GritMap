# Handoff: H10 recordings list and export requested

- Updated: `2026-10-19 22:46 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a915233 docs: coordinator next task for Codex`
- Worktree: prior BLE implementation/tests and handoffs remain uncommitted; documentation only for this request.

## Outcome

Jason asked to record the next H10 usability task: add a rider-facing H10 recordings list with export, so saved beat-to-beat RR data can be viewed and shared with Claude or another analysis tool. This is a requested task, not an implemented feature.

## Changed

- This archive and `handoffs/LATEST.md` only. No source changes or commits.
- Requested scope: list saved recordings with date/time, duration, sample count and available quality/capture status; allow selection and export in an analysis-friendly format (for example CSV plus metadata), preserving original artifacts. Clearly distinguish no recording, incomplete/recoverable recording and finalized recording. Inspect existing storage/schema before settling export fields or UI placement.
- First establish whether the October 18 ride has a separate RR artifact; do not assume it exists.

## Verified

- Prior read-only inspection this session: latest Karoo FIT `/sdcard/FitFiles/1e901b84-53c7-4b33-b53e-51d788abc668.fit`, pulled to `/tmp/gritmap-latest-ride.fit` and decoded with local `@garmin/fitsdk` without decoding errors.
- Ride began October 18 at 08:01:34 PDT; 8173 positive HR samples, average 137 bpm, max 171 bpm. Device information identifies Polar via ANT+. No HRV/RR messages or DFA alpha-1 developer fields found.
- Source: `LiveSegmentService.kt` initializes H10 storage at `filesDir/physiology`; `RrArtifactStore.kt` and `RrArtifactCatalog.kt` define storage/catalog behavior.
- `adb shell run-as com.gritmap.karoo ls files` refused: installed beta is not debuggable. Therefore separate RR artifact existence/content remains unverified.
- No build/tests run for this documentation-only update.

## External state

- Last verified Karoo install `0.10.44-ble2`/69, app data retained. No device modifications for this request.
- Personal ride FIT is only in `/tmp`; do not commit it, GPS, or personal RR data to this public repository.

## Goal alignment

- Supports the optional experimental H10/cardiac parallel track in `docs/GOALS.md`: inspect saved RR artifacts for physical validation and subsequent analysis. Must not block the beta loop.
- No shared contract changed. Export format and any phone integration require design during implementation; automatic Karoo-to-phone ride sync remains deferred.

## Hazards and blockers

- Regular Polar BPM in FIT does not prove enhanced BLE RR capture ran or saved successfully.
- No implemented recordings list/export yet. Preserve app data; do not uninstall or clear data to obtain private artifacts.
- BLE H10 coexistence and deliberate transfer reconnect/resume tests remain open; this request does not mark them complete.

## Next safe action

Inspect the RR artifact catalog and existing diagnostic UI, then implement a non-destructive recordings list/export that can establish whether the October 18 capture exists and produce a shareable analysis artifact.
