# Handoff: Relize GPX converted and staged on Karoo

- Updated: `2026-08-22 07:58 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: uncommitted Karoo work from multiple prior milestones plus the new converter and Relize sample; no existing changes were discarded.

## Outcome

The ordered Strava GPX route `/Users/frason/Downloads/Relize.gpx` is now a validated GritMap schema-v1 directed segment. Its source direction was preserved, it was resampled at 10-meter intervals, and the import file was copied to the connected Karoo.

## Changed

- Added `apps/karoo/tools/gpx_to_segment.py`, a standard-library GPX-to-GritMap converter that requires one ordered track segment with elevation, computes haversine distance, linearly interpolates coordinates/elevation, emits exact 10-meter samples, and retains the true endpoint.
- Added `apps/karoo/samples/Relize.segment.json` with ID `relize`, forward direction, 30-meter corridor, 90% required coverage, and 192 reference points.
- Source GPX had 39 points. Generated segment length is 1,906.726 m, with approximately 88.8 m cumulative elevation gain; start is `37.91007,-122.09979` and end is `37.92464,-122.10951`.

## Verified

- Ran the converter against the real supplied GPX.
- Parsed the generated output with `python3 -m json.tool`.
- Asserted schema version, forward direction, matching parameters, start distance zero, strict distance ordering, and WGS-84 coordinate ranges in a Python validation snippet.
- No Android build or Kotlin test suite was needed or run for this data/tool-only milestone.

## External state

- Karoo device `00442GA241760203` was connected and authorized over USB.
- Copied the generated file to `/sdcard/Download/Relize.segment.json`.
- The file is staged on-device but has not been imported through the GritMap document picker; installed-segment count is therefore unchanged until the user imports it.

## Hazards and blockers

- The working tree contains substantial pre-existing uncommitted Karoo UI, cardiac-drift, telemetry, tests, and handoff work. Do not discard or wholesale-replace those files.
- GPX direction is accepted exactly as ordered by the source route. If the desired effort runs from the current endpoint back to the current start, generate a new reversed segment rather than editing this immutable definition.
- Elevation comes from the Strava GPX route and is linearly interpolated; it is not new barometric survey data.

## Next safe action

On the Karoo, open GritMap Karoo, tap **Import segment JSON**, choose **Downloads → Relize.segment.json**, and confirm the installed-segment count increments by one.

