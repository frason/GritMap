# Real Karoo FIT fixtures

Provided by the client on issue #2 (2026-08-13), for the FIT parser spike (issue #3) and
downstream real-fixture matcher validation (issue #10).

## Files
- `Karoo-Morning_Ride-2026-08-02-0837.fit`
- `Karoo-Morning_Ride-2026-08-09-0844.fit`

Two real Karoo-exported rides, one week apart, similar naming ("Morning Ride") — possibly
the same route/climb repeated, which would be ideal for matcher self/cross-match testing
in issue #10. Not yet confirmed which (if either) covers the target hill-climb segment, or
whether they carry power/HR data — that's exactly what issue #3's parser spike should
establish and report on.

Only 2 files were provided (docs/MVP.md's delivery order just says "real Karoo files";
the original ask in issue #2 suggested 2-5 for variety). If issue #3 or #10 turns up gaps
(e.g. no power/HR data, or these two rides aren't actually the same stretch of road),
flag it in that issue's output — the lead will follow up with the client for more samples.
