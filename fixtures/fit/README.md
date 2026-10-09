# Real Karoo FIT fixtures (local-only)

**These ride files are not in the repository.** They are one rider's real GPS recordings, so they are git-ignored
(`fixtures/fit/*.fit`, `fixtures/gpx/*.gpx`) and absent from a fresh clone. The tests that read them
(`parseFitFile`, `parseGpxFile`, `batchImport`, `fitIdentity`, `importRideFile`, `matcher/realSegments`) are reported as **skipped**
with a message when the files are missing, and run when the maintainer has them locally. Never commit a real ride here.
The history of this repository still contains the earlier commits that added them.

The notes below describe the maintainer's local set.

## Files

- `Karoo-Morning_Ride-2026-08-02-0837.fit`, `Karoo-Morning_Ride-2026-08-09-0844.fit` —
  provided by the client on issue #2 (2026-08-13) for the FIT parser spike (issue #3).
  Confirmed by issue #60's real-fixture matcher pass (see `src/matcher/realSegments.test.ts`):
  neither ride covers any of the client's three currently-defined real segments (Diablo,
  Relize, Coco Jumbo), so they're used as negative-control fixtures there, not as segment
  matches. Still useful for parser/import tests that don't need a segment match.
- `Karoo-Morning_Ride-2026-07-18-0908.fit` — the client's first real completion of the
  Diablo Northgate-to-Junction climb, predating the Karoo pacing-plan build.
- `Karoo-Morning_Ride-2026-09-13-0647.fit` — the client's first Karoo-paced Diablo
  completion (45:48 vs a 40:30 target), followed ~20 minutes later by a reverse descent
  back down through the same segment.
- `Karoo-Morning_Ride-2026-08-22-0828.fit` — the client's real Relize completion, 6:21
  against a 6:54 target.
- `Karoo-Morning_Ride-2026-08-29-0648.fit` — a ride that briefly brushes the Coco Jumbo
  corridor without actually riding it; a real false-accept risk, kept as a negative-control
  fixture.

All four added 2026-09-28 for issue #60 (tune the matcher against real fixtures); see
`src/matcher/realSegments.test.ts` for the assertions and
`handoffs/archive/2026-09-28-*-claude-matcher-real-fixture-validation.md` for the full
writeup, including ground-truth sourcing.
