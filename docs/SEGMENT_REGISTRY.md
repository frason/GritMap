# Optional segment registry (issue #62)

## What this is

An opt-in way to publish an immutable segment definition (reference polyline + matching
parameters only) so it can be discovered and imported by someone else, and to import one
someone else published. Fully additive: unused, it changes nothing about the existing
local-only flow. Per `docs/Grip-Map-app-spec.md`'s "Future sharing model" section and the
library's own "no leaderboard, no shared state" framing.

## Why the registry lives in this repo, not a hosted backend

SPEC.md's guardrails prohibit adding backend/cloud infrastructure as a *default*
dependency for this app. Standing up even a minimal hosted service (database, API,
hosting account) is a real ongoing cost and maintenance commitment that a personal, mostly
single-user app doesn't need yet, and creating that account isn't something to do without
the client present.

Segments are already just JSON files, already resampled/fingerprinted deterministically
(`src/segments/segmentFingerprint.ts`), and already committed to this repo in one form
(`apps/karoo/samples/*.segment.json`). Reusing GitHub itself as the registry — a
`registry/segments/<fingerprint>.json` directory in this same repo — gets a real,
network-reachable, zero-additional-cost "cloud registry" for free:

- **Discovery/import** (`GET`) needs no authentication at all: GitHub's Contents API for
  listing (`api.github.com/repos/.../contents/registry/segments`) and
  `raw.githubusercontent.com` for fetching one file directly.
- **Publishing** (`PUT`) needs a GitHub personal access token with `repo` scope, entered
  once in the app and stored via `expo-secure-store` — the user's own existing GitHub
  identity, not a new account or service.
- No server to run, no database to administer, no bill.

The tradeoff: discovery is a directory listing, not real search, and publishing needs a
manually-created PAT rather than a polished in-app sign-in flow. Acceptable for a small,
mostly-personal registry; revisit if this ever needs real multi-user search/discovery.

## How it works

1. **Publish** (`src/screens/SegmentDetailScreen.tsx` → `registryClient.publishRegistrySegment`):
   checks whether this segment's fingerprint is already published (a plain unauthenticated
   `GET`, since segments are immutable and content-addressed — nothing to overwrite); if
   not, `PUT`s the portable JSON to `registry/segments/<fingerprint>.json` via GitHub's
   Contents API, authenticated with the user's stored PAT.
2. **Discover** (`src/screens/RegistryBrowseScreen.tsx` → `registryClient.listRegistrySegments`):
   lists `registry/segments/*.json`, unauthenticated.
3. **Import** (`registryClient.fetchRegistrySegment` → `src/segments/fromPortableSegmentJson.ts`
   → `src/db/importRegistrySegment.ts`): fetches one file, validates its shape and
   **recomputes its fingerprint locally** rather than trusting the file's own claimed value
   (it's untrusted network input), then inserts it as a segment with no local source ride —
   the schema's `source_ride_id`/`source_start_point_index`/`source_end_point_index`
   columns were already nullable for exactly this case. A fingerprint already present
   locally is reported as already-imported, not re-inserted.

## What's deliberately not built here

- No search beyond a flat directory listing.
- No settings screen for registry owner/repo — `src/registry/registryConfig.ts` hardcodes
  this app's own repo as the default. Fine while there's effectively one publisher; would
  need revisiting for real multi-user use.
- No live, on-device round-trip with a real personal access token was run as part of this
  change (publishing creates a real public commit under the client's GitHub identity —
  not something to trigger autonomously). Covered instead by unit tests against a mocked
  `fetch`, exercising the real client code. **Recommended next step: try one real publish
  and import on-device.**
