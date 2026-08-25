# Handoff: Real-data matcher rejection diagnosed and fixed — hairpin/switchback bug

- Updated: `2026-08-25 12:28 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `441f329 matcher: fix false backward-progress rejects on real switchbacks`
- Worktree: substantial uncommitted work remains under `apps/karoo/` (Codex, concurrent) —
  untouched by this change. Codex's own last handoff (`2026-08-25-0913-codex-readable-power-
  balance-installed.md`) and two Karoo archive files are also currently uncommitted in the
  working tree; left as-is, not committed here.

## Outcome

This directly resolves the "matcher risk" Codex flagged in the prior combined handoff. The
real "Morning Climb" segment's own defining ride now matches correctly instead of being
rejected. Root cause: a genuine hairpin/switchback in the real route, not a data or
direction bug — `docs/MVP.md`'s acceptance criterion "find every known valid same-direction
traversal" was genuinely failing for any segment with a tight switchback (a very common shape
for a climbing segment, this app's core use case).

## Changed

- `src/matcher/matchSegment.ts` — `projectOntoPolyline()` now takes an optional
  `previousProgressMeters` hint. When given, among every candidate polyline segment within
  `PROJECTION_AMBIGUITY_MARGIN_METERS` (5m) of the globally closest one, it picks whichever
  continues smoothly from the previous point's own resolved progress, instead of always
  taking the merely closest one. `evaluateForward()` threads each point's resolved progress
  through as the next point's hint, seeded at 0 (safe, since a candidate only ever starts near
  the segment's own beginning). `findReverseTraversals()` and every other caller pass no hint
  and are byte-for-byte unaffected.
- `src/matcher/matchSegment.test.ts` — two new tests: a genuine mid-ride reversal on a plain
  straight segment still rejects (the fix doesn't mask real backward movement), and a
  synthetic switchback fixture that reproduces the exact failure class and now accepts
  cleanly.
- Commit `441f329`, on local `main`, **not yet pushed** (18 commits ahead of `origin/main` now).

## Verified

- **Root-caused against the real data before touching any code**, per the ask: traced actual
  projected-progress values point-by-point through the real ride using the real reference
  polyline and real GPS points (via a scratch script against a copy of the live database, not
  the live file itself). Found the route's latitude peaks and reverses around reference
  distance ~4000m while longitude barely moves — a real switchback — and that ride points near
  the apex occasionally land measurably closer to the wrong (sequentially earlier) leg despite
  sub-2m deviation from the actual road the whole time.
- Full suite (172 tests, incl. the 2 new ones) and `npm run typecheck` pass.
- Confirmed the new switchback test is a real regression test, not a tautology: temporarily
  reverted just this fix (`git stash` on `matchSegment.ts` alone) and re-ran the identical
  fixture — it fails with `backward-progress` (`maxBackwardMeters` ~147) exactly as predicted,
  then passes again once the fix is restored.
- Re-ran the real orchestration (`runMatcherForSegment`) against a fresh copy of the live
  database: the source ride that previously produced two rejects now persists as one
  `borderline` `segment_attempts` row (100% coverage, confidence 0.80, correctly flagged for
  a real 39-second GPS gap near the start — a genuine, separate, pre-existing dropout, not
  related to the switchback fix) instead of nothing.
- An initial synthetic reproduction attempt (perfectly parallel hairpin legs) failed to
  reproduce the bug at all — worth noting for future matcher work: pure parallel-line
  proximity can't create this ambiguity, since the nearer leg always wins outright. The real
  mechanism needs the two legs' resampled polyline chords to be close *and* for GPS/curvature
  noise to occasionally flip which one is nearest — reproduced synthetically only after making
  the "wrong" leg's projected point a fixed, unambiguous amount closer than the "right" one.

## External state

- No device/simulator state changed — all verification ran against scratch copies of the
  simulator's SQLite file. The live phone database is untouched by this fix; the next real FIT
  import or segment save/rerun on-device is what will actually exercise this in production.

## Hazards and blockers

- `PROJECTION_AMBIGUITY_MARGIN_METERS = 5` was chosen to comfortably cover the real deviation
  gaps observed (well under 2m) with headroom, not derived from a broader dataset — worth
  revisiting if a different real segment's switchback turns out tighter or looser than this
  one.
- This fix only changes `evaluateForward`'s sequential forward scan. `findReverseTraversals`'s
  own start/end proximity checks were deliberately left unchanged — no evidence they're
  affected by the same class of bug, and expanding scope there wasn't justified by anything
  observed.
- Phone review/comparison touch flows and chart gap rendering remain visually unverified on a
  real device (per the prior two handoffs) — this fix doesn't change that state.

## Next safe action

Proceed with issue #14 (UX cleanup, performance validation, full `docs/MVP.md` acceptance
checklist) — this fix directly unblocks one of its acceptance criteria
("find every known valid same-direction traversal") for real climbing-segment data.
