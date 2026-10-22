# Handoff: concurrent foundation and installed fields committed

- Updated: `2026-10-22 16:24 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `c9da364 feat(karoo): add opt-in concurrent attempts and improve live fields`
- Worktree: new replanner design/engine/tests in progress, excluded from this commit.

## Outcome

Committed concurrent foundation/runtime and completed Coach/Profile/cardiac display work. Concurrent runtime defaults off. H10 export is not implemented or included. Shared service/session changes made one coherent feature commit preferable to incomplete split commits.

## Changed

`c9da364` contains explicit Karoo source/test paths, multi-segment design/proposal, field-work semantics, and six previous milestone archives. No wire contract or schema migration in that commit.

## Verified

- JDK17 default `:app:testDebugUnitTest :app:lintDebug :app:assembleDebug --no-daemon`: passed, log `/tmp/gritmap-milestone-default.log`.
- Same tasks with `-PgritmapConcurrentSegments=true`: passed, log `/tmp/gritmap-milestone-concurrent.log`.
- Both full suites cover 226 tests; no failures. Staged diff check clean.

## External state

Karoo remains version70 / 0.10.44-fields1. No device action or release this milestone. Push follows this handoff commit.

## Goal alignment

GOALS priorities7/8 and explicitly approved readability changes. No phone contract action required yet.

## Hazards and blockers

PR contract/import/comparison not implemented. Concurrent runtime stays off; ride-level W′ accounting pending. Existing visual/physiology real-ride validation remains pending. Replanner work not yet verified.

## Next safe action

Push these commits, then implement optional ceiling metadata and a default-off deterministic live replanner, with synthetic replay tests.
