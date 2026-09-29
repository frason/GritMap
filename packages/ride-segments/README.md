# ride-segments

Directed GPS segment matching for cycling/running ride data. Given a reference route and a
recorded ride, finds every traversal of that route in the ride — same direction only,
GPS-jitter tolerant, with a diagnostic confidence score for anything short of a clean match.

Extracted from [GritMap](https://github.com/frason/GritMap), a goal-first cycling
performance app, where it remains the first consumer. This package has no dependency on
GritMap's app, storage, or platform: it is pure TypeScript in, pure TypeScript out.

## Scope

This is a matching **algorithm**, not a platform:

- No backend, no accounts, no hosting. It's a library, called with data and returning a
  result.
- No shared or central state. Every consumer stores its own segment definitions and match
  results however it likes (SQLite, files, memory).
- No leaderboards. A leaderboard requires reconciling everyone's times in one place, which
  is exactly the centralized-backend problem this package deliberately avoids.

Ride-file parsing (FIT, GPX, TCX) is also out of scope — hand this package plain
`{ lat, lng, timestampMs }` points from whatever source you already parse.

## Install

Not yet published. Within this monorepo it's consumed as an npm workspace package; outside
it, copy `src/` (AGPL-3.0, see below) or wait for a published release.

## API

```ts
import { matchSegment, toMatcherRidePoints } from "ride-segments";
import type { RidePoint, SegmentDefinition, MatchCandidate } from "ride-segments";

// Build matcher input from your own parsed ride points, preserving each point's
// original array position through any GPS-fix filtering you do first.
const ridePoints: RidePoint[] = toMatcherRidePoints(parsedPoints);

const segment: SegmentDefinition = {
  id: "my-segment",
  corridorMeters: 30,
  requiredCoveragePct: 0.9,
  referencePolyline: [{ lat, lng, distanceMeters: 0 }, /* ...resampled every 10m */],
};

const candidates: MatchCandidate[] = matchSegment(ridePoints, segment);
```

### Matching contract

1. Store each segment as a complete directed reference polyline, resampled every 10 meters.
2. Search the ride for every candidate start point within the segment's corridor of the
   segment's start.
3. Evaluate ride points forward only from each candidate start.
4. Project ride points onto the reference polyline, tracking perpendicular deviation and
   progress distance along the reference.
5. Require progress to move mostly monotonically forward. A bounded amount of backward
   projected movement is tolerated for GPS jitter; more than that makes a completed
   candidate borderline or invalid.
6. Require a minimum fraction of the reference route to be covered inside the corridor for
   automatic acceptance.
7. Tolerate GPS gaps up to a bounded duration; a longer gap makes an otherwise-completed
   candidate borderline.
8. Reject reverse traversal, and paths that reach both endpoints via a materially
   different route.
9. Return every valid traversal in one ride — including repeats — while deduplicating
   overlapping detections of the same physical traversal (see `isSamePhysicalTraversal`).
10. Ignore incomplete traversals that enter the corridor but never reach the segment end.
11. Automatically accept candidates that pass every rule; mark completed, same-direction
    candidates that fail a coverage/continuity/ambiguity threshold as `"borderline"` rather
    than silently accepting or discarding them.
12. Attach a diagnostic confidence score (`confidenceScore`, 0–1) built from route
    coverage, direction/order, corridor adherence, and GPS continuity — for surfacing to a
    human reviewer, not for making the accept/reject decision itself.

`MATCHER_VERSION` bumps whenever matching decisions, diagnostics, or confidence scoring
change, so a consumer can tell when a stored result was produced by an older algorithm
version and may be worth re-evaluating.

## Development

```sh
npm test        # node --test, pure Node, no build step
npm run typecheck
```

## License

AGPL-3.0-only. See [LICENSE](./LICENSE). This package has no server component, so the
license's usual network-use trigger doesn't really apply here — the practical effect is
that a derivative work must also be released under the AGPL, including if built into a
closed commercial product.
