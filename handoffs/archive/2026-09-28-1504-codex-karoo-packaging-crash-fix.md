# Handoff: Karoo extension crash loop fixed in 0.8.5

- Updated: `2026-09-28 15:04 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `71ef851 docs: hand off attempt-persistence and reverse-descent fixes`
- Worktree: 0.8.3 HR-drift, 0.8.4 telemetry-load, and 0.8.5 packaging changes are uncommitted; unrelated iOS change preserved.

## Outcome

Diagnosed the user-visible error as a fatal restart loop caused by an omitted DEX class definition. Clean-built and installed 0.8.5; the extension stays bound without crashes or sustained CPU load.

## Changed

- Moved `CardiacDriftDataType` and helpers into their own `CardiacDriftDataType.kt` source unit.
- Version bumped to 0.8.5/code16.
- Prior telemetry-conflation and HR-drift improvements remain included.

## Verified

- Failed device log: repeated `NoClassDefFoundError` every ~8 seconds starting with ride recording.
- Faulty D8 intermediate lacked `CardiacDriftDataType.dex`.
- Clean Gradle build succeeded; 98 tests passed.
- `dexdump` verified the corrected concrete class definition.
- On-device 0.8.5 bound and connected with no crash; CPU samples 0.0%, 0.0%, 1.6%, 0.0%.

## External state

- Karoo runs 0.8.5/code16.
- Database contains 3 restored segments and 2 plans; no attempts.

## Hazards and blockers

- The attached quick ride exercised faulty 0.8.4, not corrected 0.8.5.
- One more short recording is required to validate telemetry consumer start/stop.
- Changes are uncommitted; preserve unrelated iOS work.

## Next safe action

Record 20–30 seconds on 0.8.5 and confirm one six-consumer start, one stop, and no AndroidRuntime crash.
