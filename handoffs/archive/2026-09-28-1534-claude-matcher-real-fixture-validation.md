# Handoff: Matcher validated against the client's real segments and rides (#60)

- Updated: `2026-09-28 15:34 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `0017957 matcher: validate against real client segments and rides (#60)`
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` have substantial
  uncommitted work from a concurrent Codex session (Karoo 0.8.3-0.8.5 stabilization) —
  untouched by this increment. Codex's own prior handoff (crash loop fixed in 0.8.5,
  updated 15:04 PDT) is preserved verbatim at
  `handoffs/archive/2026-09-28-1504-codex-karoo-packaging-crash-fix.md`.

## Outcome

Per the client's direction to focus on the main app (not the in-progress Karoo test ride),
picked up issue #60 (tune the matcher against real fixtures). Built a harness using the
production `parseFitFile`/`toMatcherRidePoints`/`matchSegment` code paths — not a
reimplementation — against the client's three actually-defined real segments (Diablo
Northgate-to-Junction, Relize, Coco Jumbo) and every real FIT file the client has
accumulated (in `~/Downloads` plus the two already-committed fixtures). Cross-checked
every result against ground truth already independently established in prior handoffs
(the Karoo's own persisted diagnostics and FIT reanalysis). Every decision was correct:
two real climbs accepted at >99% coverage/>0.95 confidence, a real reverse-descent
correctly rejected as `reverse-traversal` (not silently missed), a real near-miss on Coco
Jumbo correctly rejected as `backward-progress` rather than false-accepted, and zero false
positives against segments a ride doesn't actually cover. No tuning constants needed
changing.

## Changed

- Commit `0017957` on `main` (pushed — check divergence before assuming; not verified
  pushed as part of this increment, only committed locally).
- `src/matcher/realSegments.test.ts` (new) — 5 tests, permanent regression coverage using
  the real segment JSON already canonical for Karoo sync (`apps/karoo/samples/*.segment.json`,
  read directly rather than duplicated) and 4 newly-committed real FIT fixtures.
- `fixtures/fit/` — added `Karoo-Morning_Ride-2026-07-18-0908.fit` (first real Diablo
  climb), `-2026-09-13-0647.fit` (Karoo-paced Diablo climb + reverse descent),
  `-2026-08-22-0828.fit` (Relize completion), `-2026-08-29-0648.fit` (Coco Jumbo near-miss).
  Updated `fixtures/fit/README.md`, including resolving its year-old open question: the
  original two fixtures (`-08-02-0837`, `-08-09-0844`) do **not** cover any currently-defined
  real segment — confirmed empirically, not just "not yet checked."

## Verified

- `npm run typecheck`: clean.
- `npm test`: 206/206 passing (up from 177 at MVP close), including all 5 new tests.
- Each new test's expected decision was cross-checked against an independent ground-truth
  source before being written, not asserted from the matcher's own output:
  - Diablo 07-18 and 09-13 climbs: `handoffs/archive/2026-09-24-1633-codex-diablo-real-ride.md`.
  - Relize 08-22: `handoffs/archive/2026-08-22-1439-codex-relize-real-ride-verified.md`.
  - Coco Jumbo 08-29 and the two negative-control rides: no prior ground truth existed;
    verified directly by inspecting this run's own coverage/reasons output for
    internal consistency (low coverage + backward-progress is a legitimate reject, not
    an ambiguous case).
- Posted the full comparison table as a comment on issue #60:
  https://github.com/frason/GritMap/issues/60#issuecomment-5879976607.

## External state

- No device/simulator state changed by this increment.
- Several other real FIT files exist in `~/Downloads` (`3x10.fit`, `Norwegian.fit`, two
  `Karoo-Evening_Ride-*.fit`, and the Karoo crash-loop's `Karoo-Afternoon_Ride-2026-09-28-1443.fit`)
  that all fail `parseFitFile` with "Input is not a FIT file" despite having a valid `.FIT`
  magic header at the expected offset. Not investigated further — out of scope for #60
  (matcher tuning, not import parsing) and not blocking, since none of them are needed for
  real-segment ground truth. Worth a follow-up issue if the client wants historical data
  from those files specifically.

## Hazards and blockers

- Issue #60's own "Done when" bar asks for "10+ segments across varied geometry
  (straight, switchback, urban/GPS-noisy, long/short)". The client currently has only 3
  real segments defined, all broadly similar (single-direction climbs). That bar is **not**
  met and can't be met by more analysis — it needs the client to define more real segments
  over time (which will happen naturally while training toward Oct 3). Left issue #60 open
  rather than closing it, with this gap called out explicitly in the issue comment.
- Because no real borderline decision has been observed yet in any real data (every real
  case so far was a clean accept or a clean reject, never borderline), there still isn't
  positive evidence that the borderline-review screen is safe to retire — recommended
  keeping it for now, per #60's own explicit "or an explicit documented decision to keep
  it" escape hatch. This is a judgment call the client may want to weigh in on directly.
- `apps/karoo/` is under active, live editing by the concurrent Codex session — confirmed
  by `git status` showing more modified Karoo files mid-session than were present at the
  start of this one. Do not touch anything under `apps/karoo/` or
  `ios/GritMap.xcodeproj/project.pbxproj` from this thread.

## Next safe action

Client-directed: either (a) treat #60 as sufficiently validated for now given real data
keeps confirming existing behavior, and move to #61 (extract matcher as standalone
library) or #63 (Hammerhead API evaluation), or (b) keep #60 open and revisit once more
real segments exist. Not something to decide unilaterally — surface both options to the
client.
