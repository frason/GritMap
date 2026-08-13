# Goal: Build the GritMap MVP

`SPEC.md` is already settled (Phase: build) — the discovery/interrogation pass happened
before this repo existed. Do not re-run discovery. Read `SPEC.md` first, then the two
source documents it's built from for full detail:

- [docs/MVP.md](docs/MVP.md) — authoritative executable MVP slice. Its "MVP capabilities"
  (1–6), "Persistence model", and "Delivery order" sections are the actual scope and
  sequencing to decompose into issues.
- [docs/Grip-Map-app-spec.md](docs/Grip-Map-app-spec.md) — broader product context and
  post-MVP roadmap, for background only. Do not queue anything from its "out of scope for
  MVP" list.

## What to do this pass

1. This is an empty repo — **scaffold first**, per your own rules: queue a single issue to
   initialize the Expo (React Native, TypeScript) project with an Expo development build
   (not Expo Go), targeting iOS + Android, with the SQLite dependency and
   `@maplibre/maplibre-react-native` wired in enough to build/run empty. Nothing functional
   yet — just a project that builds on both platforms so later issues have something real
   to extend.
2. Then decompose `docs/MVP.md`'s "Delivery order" (7 steps) into GitHub Issues, using
   `depends_on` to preserve that sequencing:
   1. FIT parser spike using real Karoo FIT files (ask the client for sample files if none
      are in the repo — use `agent-question`, don't block everything else on it).
   2. SQLite schema + migrations, original-file retention, batch import, duplicate handling.
   3. Route rendering + segment-selection prototype (MapLibre/OSM).
   4. Directed matcher (the 10-rule contract in `docs/MVP.md` section 4) with synthetic
      and real fixtures.
   5. Diagnostic review screen + matcher-version reevaluation.
   6. Distance resampling, cumulative time-gap calculation, comparison chart.
   7. UX cleanup, performance validation, acceptance testing against `docs/MVP.md`'s
      "Acceptance criteria" list.
3. Keep each issue worker-sized (one Haiku run). Split any of the 7 steps above further if
   it doesn't fit that bar — e.g. the matcher (step 4) is dense enough it probably wants to
   be 2-3 issues, not one.
4. Target date is **October 3, 2026** (fixed, ~7 weeks out) — sequence for that, and flag
   in `state/STATUS.md` if the scaffold + steps 1-2 alone are eating enough of the runway
   that steps 5-7 look at risk.
