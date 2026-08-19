# Handoff: Segment-definition plan revised, one correction — ready for final check

- Updated: `2026-08-18 23:11 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `44c4074 docs: hand off segment plan review` (Codex's review commit; this update is
  docs-only, not yet pushed — worktree has this handoff + the revised plan pending commit).
- Worktree: clean once this commit lands.

## Status: revisions incorporated, one correction from independent verification — please confirm before implementation starts

Codex reviewed `docs/PLAN_segment_definition_increment.md` and left required revisions
(scrubber-only handles, geometry-only fingerprint, Segment List in scope now, platform-split
map module, plus GPS-gap/elevation/navigation/validation corrections). All of them are folded
into the plan body now — the file is a clean single document again, not a patch-on-patch.

**One thing was verified independently rather than taken on trust**, per this session's
standing practice of not trusting a summary for anything checkable: Codex's review said the
fingerprint must "match Karoo's schema" and be "byte-identical across TypeScript and Kotlin"
but described the requirement rather than the algorithm. Read `SegmentJsonParser.kt` and
`SegmentFingerprint.compute` directly, and confirmed the exact canonical string format and the
numeric-formatting gap by actually running Java's `Double.toString()` (which Kotlin calls
directly on the JVM — no `kotlinc` needed) side-by-side with Node's `Number.toString()`:
digit sequences agree for non-whole numbers, but Java always keeps a trailing `.0` on whole
numbers and JS drops it (`37.0` → `"37.0"` vs `"37"`). The plan now has:
- The literal canonical string template and the exact `toJavaDoubleString()` fix needed on the
  TS side, plus a flagged `-0` edge case (`Number.isInteger(-0)` is `true` in JS but Java
  stringifies `-0.0` differently).
- A **real conformance fixture with a verified SHA-256**, computed from Karoo's own existing
  `SegmentJsonParserTest.kt` test data via an actual JVM run (a throwaway `javac`/`java`
  snippet outside the repo, not committed) — `c2b8492774847a2117a8a045de50aadecb71b9b98017892
  da38338809772e615` — to be asserted directly in `resamplePolyline.test.ts` so a future
  canonicalization regression breaks CI immediately instead of silently producing segments
  Karoo can't recognize.

**Next safe action**: a final look at the revised plan (particularly the fingerprint section,
since it's the one part this update changed after Codex's own review) before implementation
begins on commit 1 (`db/ride-track-query`).

## Recent history (this session, full detail in `handoffs/archive/`)

- Plan round-trip for the segment-definition increment: Claude wrote
  `docs/PLAN_segment_definition_increment.md`, Codex reviewed it (`dccdcf9`, required
  revisions: scrubber-only handles, geometry-only fingerprint, Segment List in scope, platform-
  split map module, plus GPS-gap/elevation/navigation/validation corrections), Claude folded
  all revisions into the plan body and independently verified the fingerprint algorithm against
  the real Kotlin source rather than trusting the review's description (see above).
  (`2026-08-18-2302-codex-segment-plan-review.md` has the pre-fold state.)

- First UI increment (8 PRs: nav shell, dev-client, sqlite adapter, import screens, ride
  list/detail) — complete, pushed, manually verified including the duplicate-decision modal
  and multi-file batch import (`2026-08-18-1539-claude-manual-pass-verified.md`).
- PR #54 (MapLibre scaffold, issue #47) — resolved directly on `main`, not a raw merge
  (`2026-08-18-1343-claude-pr54-resolved.md`).
- Issues #5, #19 closed as already-shipped by the first increment.
  [PR #55](https://github.com/frason/GritMap/pull/55) rebased the stale issue #43 worktree
  onto current `main`, hand-resolved a real conflict with an independently-landed
  `persistMatchCandidate.ts` fix, merged.
  [PR #56](https://github.com/frason/GritMap/pull/56) added the automated `mock.module()`
  test issue #53 asked for against the real `initializeDatabase.ts`/`toSyncDatabase.ts` (no
  duplicate adapter file), merged.
  (`2026-08-18-2156-claude-issues-5-19-43-53-closed.md`)

## Parallel Karoo status (carried forward, full history in `handoffs/archive/`)

Codex has been shipping steadily on `apps/karoo/` throughout this session, entirely
independently of the root-app work above. Most recent: `74150e4 apps/karoo: add live data
field demo` — launcher Start/Stop controls for a process-local, non-persistent 34-second
segment simulation cycling through zones/metrics for demo purposes; never writes dummy data to
Room, a real detected segment takes control automatically. APK is 0.7.0/versionCode 10, JVM
tests and assembly passed. The Karoo device remains disconnected, so on-device installation of
the last several versions is still pending — reconnect and `adb install -r
apps/karoo/app/build/outputs/apk/debug/app-debug.apk` when ready.
