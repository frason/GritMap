# SQLite Schema and Migration Validation

## Design

The schema uses seven core tables and `PRAGMA user_version` for migration state. This keeps migration bookkeeping out of the application schema while still allowing ordered, transactional upgrades. `applyMigrations` always enables and verifies `PRAGMA foreign_keys = ON` before reading or changing the schema.

The reference polyline is normalized into `segment_reference_points` instead of stored as JSON. That makes ordered distance-range reads and future integrity checks straightforward without rewriting a JSON blob. Diagnostics are one-to-one with attempts because the MVP produces one current diagnostic summary for each persisted accepted/borderline traversal. Rejected matcher candidates are not persisted as attempts; temporary review history can be modeled separately if product requirements later demand it.

`ride_points` uses `(ride_id, point_index)` as its primary key. Attempts reference both boundary points with composite foreign keys, guaranteeing that their offsets exist on the same ride. Sensor columns are nullable so missing FIT samples remain distinct from real zero values.

Deleting a ride cascades through its points, attempts, and attempt diagnostics. Segment definitions created from that ride survive with `source_ride_id` set to null. Deleting a segment cascades through only its reference points, attempts, and diagnostics; rides and ride points remain intact.

## Connection API

Tests use Node's built-in `node:sqlite` `DatabaseSync`, so no test-only native dependency is needed. The migration runner depends on only `exec(sql)` and `prepare(sql).get()`. The future Expo adapter can expose those operations using `execSync`/`getFirstSync` while reusing the SQL unchanged.

## Validation

The real in-memory SQLite tests execute every migration and assert:

1. All seven core tables and their expected columns exist.
2. A complete imported-file → ride → points → segment → attempt → diagnostic graph inserts successfully.
3. Deleting one ride removes only its points, attempts, and diagnostics; unrelated ride/segment data remains.
4. Deleting one segment removes only its reference points, attempts, and diagnostics; the underlying ride and points remain.
5. Foreign keys report enabled and a nonexistent `ride_id` insertion fails with a real SQLite foreign-key error.

Run with:

```sh
node --test src/db/migrations.test.ts
```
