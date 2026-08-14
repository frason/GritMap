# Import identity schema migration

Migration 2 adds the persisted identity needed by batch import without changing the
original seven-table migration. Existing rows upgrade safely: every new field is nullable,
so the migration never invents an activity ID, device ID, duration, timezone, or file
location for previously imported rides.

Original FIT files remain in application-managed local storage. SQLite stores their URI in
`imported_files.retained_file_uri`, their byte length in `file_size_bytes`, and continues
to use the existing SHA-256 as the integrity and exact-duplicate identity. This avoids
putting large binary blobs in SQLite while keeping later parser-version reparsing possible.

`rides` stores normalized `activity_id`, `device_id`, `duration_ms`, and
`original_timezone_offset_minutes`. These fields support indexed duplicate lookup and
normal display/import behavior. `fit_metadata_json` additionally preserves the parser's
device, file, session, and activity metadata. The JSON is retained because the FIT profile
can expose useful fields beyond today's normalized subset; it is not queried for duplicate
identity, and the retained FIT file remains the canonical reparsing source.

`getRideIdentity()` joins `rides` to `imported_files` and maps SQL `NULL` identifiers to
absent TypeScript properties. It intentionally fails for a legacy row without required
start/duration timing rather than fabricating a usable duplicate identity.

Validation uses real in-memory SQLite through `node:sqlite`: fresh migration, populated
version-1 upgrade, exact column types/nullability, NULL identifier mapping, device/timing
index selection through `EXPLAIN QUERY PLAN`, and transactional replacement preserving the
ride ID.
