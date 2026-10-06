# Handoff: Import Segment JSON on the phone (done; phone app, uncommitted)

- Updated: `2026-10-06`
- Agent: `Claude`
- Branch: `main`
- Head: `71f3c32 feat: predicted finish time for imported pacing plans` (pushed). Also uncommitted from earlier today:
  the `plan_sends` work (`2026-10-06-claude-plan-sends-recorded.md`).
- Worktree: Codex's `apps/karoo/`, `ios/`, `src/diagnostics/`, `docs/NEXT_RIDE_TEST_CHECKLIST.md`, other archives and
  `LATEST.md` edits untouched. The Karoo build and its installed `0.10.40` were not touched.

## Task (from LATEST.md): "import portable segment JSON, starting with Coco Jumbo" -- DONE

## Outcome

Import screen (Rides tab -> Import) now has **Import Segment JSON**. Pick a segment `.json` (for example
`Coco_Jumbo.segment.json` AirDropped to the iPhone and saved to Files); it is validated, added to Segments, existing
rides are matched against it, and Segment Detail opens so a plan can be created/imported and sent back to the Karoo.
An already-present segment says "Already in your library" with an "Open it" action. Failures show the reason.

## One deviation from the handoff text, and why

The handoff said to pass the file through `fromPortableSegmentJson` + `importRegistrySegment` unchanged. The Karoo's own
segment files have **no `fingerprint` field** (`Coco_Jumbo.segment.json` keys: schemaVersion, id, name, direction,
matching, referencePolyline), and `fromPortableSegmentJson` rejected that outright ("Missing or invalid fingerprint").
So `fromPortableSegmentJson`/`importRegistrySegment` gained an opt-in `allowMissingFingerprint`: when the file has no
fingerprint the locally computed one is used; when it **has** one it must still match (tamper check unchanged); the
registry path leaves the option off and still requires it. Nothing about validation of every other field changed, and
there is no Coco Jumbo seed.

## Conformance check (the point of the fingerprint)

The phone's fingerprint algorithm is byte-for-byte the Karoo's (`segmentFingerprint.ts`). For `Coco_Jumbo.segment.json` it
computes `ed56296f099c2f53aed3fbd55932b2b55bf39f24228fc6a2688a796062f94366`, **identical to the fingerprint in the Karoo's
database** (read from the 2026-10-05 copy). So the phone's imported Coco Jumbo is the same segment the Karoo already has,
and a plan sent from it attaches to the installed segment rather than creating a Relize/Realize-style duplicate. A test
asserts this value.

## Also accepted

A whole `gritmap-transfer` package (e.g. `Relize.6m54.guidance-package.json`): only its `segment` is used. A leading
byte-order mark is tolerated; files over 2 MB are refused before parsing.

## Verified

- `npm run typecheck` clean; `npm test` **493/493** (was 482); `npm run web:smoke` clean.
- New tests (11): real Coco Jumbo import (fingerprint equals the Karoo's, 55 reference points); already-imported;
  fingerprint present: correct accepted / tampered coordinate rejected / wrong fingerprint rejected; no fingerprint and a
  different route imports as its own segment (nothing to verify against); guidance-package wrapper; BOM; a table of
  invalid inputs (not JSON, array, number, reverse direction, missing matching, one point, blank name, non-text
  fingerprint) all rejected with a reason and nothing written; oversize; plus 3 parser-option tests.
- **Not live-checked on a device** (picker, Files/AirDrop behaviour, the navigation hop into Segment Detail).

## Hazards and blockers

- A file with **no fingerprint cannot be tamper-checked** (there is nothing to compare with); it is trusted as the route it
  describes. A modified route then imports as a different segment rather than being rejected. Files that carry a
  fingerprint are fully verified.
- The document picker uses `*/*` like the FIT/GPX import, so any file can be chosen; non-segments are rejected with a reason.
- Matching existing rides happens synchronously on import (same as defining a segment); with many large rides it can take a moment.

## Next safe action

Reload the phone app. AirDrop `apps/karoo/samples/Coco_Jumbo.segment.json` to the iPhone, save it to Files, then Rides ->
Import -> Import Segment JSON. Confirm Segment Detail opens, then give it a goal (or import a coach plan) and send it to the
Karoo; it should attach to the Coco Jumbo already installed there.
