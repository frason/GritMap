# Matcher traversal deduplication and version-aware persistence

Matcher-side and SQLite persistence deduplication now use one exported definition from
`traversalOverlap.ts`: two inclusive point ranges represent the same physical traversal
only when they overlap by **more than 50%** of the shorter range. Exactly 50%, a shared
endpoint, and back-to-back lap ranges remain separate.

Persistence compares every existing attempt for the same segment and ride with that
shared rule and selects the highest-overlap physical match. Same-version rescans and older
matcher results are no-ops. A strictly newer automatic result updates the existing row ID,
boundaries, timestamps, matcher version, confidence, decision, and diagnostics atomically.
Creation timestamps remain the original creation timestamps rather than being repurposed
as update timestamps.

Manual approval is authoritative: a manually approved row and its diagnostics are never
changed by an automatic rescan, even when the newer matcher rejects that traversal. For an
automatic row, a newer reject deletes the attempt; its one-to-one diagnostics are removed
by the existing foreign-key cascade because rejected traversals cannot legally occupy
`segment_attempts`.

Validation uses `node:sqlite` through the existing migrations. Tests cover exact repeats,
greater-than and exactly-50% overlap, a single shared endpoint, three back-to-back laps,
newer-version refresh, manual preservation, and automatic/manual reject-after-upgrade.
The focused matcher/persistence run passes 19 tests and the complete repository run passes
38 tests.
