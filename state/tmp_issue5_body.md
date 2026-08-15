depends_on: #3, #4, #41, #44, #53

## Goal
Implement batch import of one or many FIT files through the native file picker, persisting
parsed rides into the schema from issue #4, using the parser validated in issue #3.

## Context
- See docs/MVP.md "MVP capabilities > 1. FIT import" and "Duplicate behavior" for full
  rules. Key points:
  - Parse files independently; report imported/duplicate/replaced/failed totals; a failed
    file must never roll back successful imports.
  - Retain each original file + its SHA-256 hash (imported_files table).
  - Duplicate rules (in order): (1) exact file-content hash, (2) same FIT
    activity/session identifier, (3) fallback: same device + start timestamps within 5s +
    durations within 5s. Route similarity never establishes duplication.
  - Prompt options: "Keep Existing" (cancel this file's import) or "Replace Existing"
    (preserve internal ride ID, replace parsed content, clear all match decisions, rescan
    against every segment). No import-as-copy for the same physical ride.
  - Missing sensor data stays missing (never zero-filled).
- Use the native file picker (expo-document-picker or equivalent) for multi-file selection.
- `src/import/findDuplicate.ts` (PR #38) already implements the 3-rule comparison logic
  given a `RideIdentity` per existing ride — this issue wires it to real stored rides.

Added #44 as a dependency (lead, 2026-08-14): the current `rides`/`imported_files` schema
(#4) doesn't yet store activity ID, device ID, duration, or a retained-file
reference/hash, so `findDuplicate`'s inputs can't be reconstructed from storage without
reparsing every file on every import. #44 adds those columns; land it first so this issue
builds against the real schema instead of a placeholder.

Repointed from #45 to #53 (lead, 2026-08-14): #45 was closed and replaced by #53
(same scope, explicit test spec) after 3 failed attempts — this issue needs the Expo
SQLite bootstrap #53 delivers, not the closed #45.

## Done when
- User can pick multiple FIT files via the native picker; each is parsed and stored per
  the schema, with a results summary (imported/duplicate/replaced/failed counts).
- Duplicate detection implements all 3 rules above in order, with Keep/Replace prompt UI.
- Replacing a ride clears its match decisions (documented as a TODO hook for the matcher
  work in later issues, since the matcher doesn't exist yet - just clear/flag correctly).
- A batch of ~100 synthetic or sample FIT files imports without crashing (can synthesize
  copies of the sample files with tweaked headers for volume testing).

## Output
Write a concise summary (<=40 lines) to your designated output file (the exact per-issue
path is given in your task prompt when the worker runs).

<!-- agent-planned -->
