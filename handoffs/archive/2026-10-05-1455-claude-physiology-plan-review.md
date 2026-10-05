# Handoff: Karoo AI/physiology plan reviewed (findings only, no code changed)

- Updated: `2026-10-05 14:55 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `d74c58a Merge remote-tracking branch 'origin/main'` (my phone work `89b0648` is pushed)
- Worktree: only `docs/REVIEW_KAROO_AI_PHYSIOLOGY.md` and this archive were added by me; all
  other uncommitted paths (Karoo, `ios/`, `docs/PLAN_*`, other archives, `LATEST.md` edits by
  Codex) are not mine and were not staged.

## Outcome

`docs/REVIEW_KAROO_AI_PHYSIOLOGY.md` answers the eight review points in
`docs/PLAN_KAROO_AI_PHYSIOLOGY.md`. By review time Codex had already implemented the RR
foundation, a BLE client and a diagnostics screen, so the review covers that code too (file:line
citations). The plan's architecture stands; the existing implementation has four defects to fix
before any ride wiring.

## Findings in one line each

- **B1** `RrArtifactStore.kt:51` truncates an existing `.partial` on reopen (and `:85,88` replace a
  finalized file): a restart destroys the file recovery needs. Use CREATE_NEW + part files.
- **B2** 8 KiB buffer, `checkpoint()` only on Activity destroy: a process kill loses ~8 min of RR.
  Timer flush (~5 s) + periodic fsync.
- **B3** RR endpoints derived from notification arrival time can go "out of order" after a delivery
  stall, flagging good beats invalid and resetting the quality timer. Use a cumulative-RR beat clock.
- **B4** `RrLiveBuffer.kt:49` validity is a lifetime ratio, not windowed.
- **H1-H5** service-owned, ride-state-driven connection with saved address and no ride-time scans;
  reconnect/backoff + stale-callback guard + atomic state updates; writer thread + write-error
  state; store raw 1/1024 s units; store wall-clock + monotonic anchors (pauses).
- **FIT:** karoo-ext only writes single numeric developer fields (no arrays, no arbitrary
  messages), so raw RR never goes through the SDK; FIT has a native `hrv` message (id 78) the plan
  overlooked -> post-ride export tool.
- **Needle:** upstream primary is now Needle 3 (`needle3.cact`); plan pins Needle 2 (legacy
  `generation=2`). Android ships `libneedle.a` + `needle.h`; repo scaffolding targets Cactus
  `libcactus_engine.so` (matches neither). Make a deterministic controller the shadow-mode baseline.
- **Privacy:** consent step, deletion incl. partials + orphan sweep, export format, salted sensor
  hash, no RR in logs/telemetry, never over the unauthenticated LAN transfer channel.
- **Coupling:** H10 touches `AndroidManifest.xml`, `MainActivity.kt`, `KarooHomeScreen.kt`, all
  carrying other uncommitted Codex work; pre-existing `KarooPreviewStateTest` failure.

## Verified

- Read, did not run: all of `physiology/`, manifest, `data_extraction_rules.xml`, vendored
  karoo-ext `FitEffect.kt`/`Device.kt`/`KarooExtension.kt`, `MODEL_PROVENANCE.md`.
- Web: Needle repo/README/`llms.txt`, HF `needle2`/`needle3` cards, Needle devices guide (read
  through a summarizer; no GitHub releases to inspect), Polar H10 manual (2 BLE + ANT+), FIT `hrv`
  message description. Polar SDK minimum-API claim in the plan could not be confirmed.
- No tests run; B3/B4 are code-reading conclusions with a described reproduction.

## External state

- Nothing installed or changed on any device. Metro dev server still running from earlier.

## Hazards and blockers

- Review not yet accepted by the owner. Per the plan, do not wire the H10 path into the active
  ride service until B1-B4 and H1-H3 are addressed and the diagnostics APK has been run on the Karoo
  (it also settles whether Karoo shows the Bluetooth runtime-permission dialog to a sideloaded app).

## Next safe action

Codex: fix B1-B4 inside `physiology/` with tests (kill-recover, burst delivery, windowed validity),
update the plan per review points 4-6, commit `physiology/` separately from the shared-file hunks.
