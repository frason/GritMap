export interface MigrationDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
  };
}

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "initial_core_schema",
    sql: `
      CREATE TABLE imported_files (
        id TEXT PRIMARY KEY,
        sha256 TEXT NOT NULL UNIQUE CHECK (length(sha256) = 64),
        original_filename TEXT NOT NULL,
        imported_at_ms INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE rides (
        id TEXT PRIMARY KEY,
        imported_file_id TEXT NOT NULL UNIQUE,
        parser_version INTEGER NOT NULL CHECK (parser_version > 0),
        start_timestamp_ms INTEGER,
        end_timestamp_ms INTEGER,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        FOREIGN KEY (imported_file_id) REFERENCES imported_files(id) ON DELETE RESTRICT,
        CHECK (
          start_timestamp_ms IS NULL OR
          end_timestamp_ms IS NULL OR
          end_timestamp_ms >= start_timestamp_ms
        )
      ) STRICT;

      CREATE TABLE ride_points (
        ride_id TEXT NOT NULL,
        point_index INTEGER NOT NULL CHECK (point_index >= 0),
        timestamp_ms INTEGER NOT NULL,
        latitude REAL,
        longitude REAL,
        distance_meters REAL,
        elevation_meters REAL,
        power_watts INTEGER,
        heart_rate_bpm INTEGER,
        cadence_rpm INTEGER,
        speed_meters_per_second REAL,
        temperature_celsius REAL,
        PRIMARY KEY (ride_id, point_index),
        FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
        CHECK ((latitude IS NULL) = (longitude IS NULL))
      ) STRICT;

      CREATE TABLE segments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        corridor_meters REAL NOT NULL CHECK (corridor_meters > 0),
        required_coverage REAL NOT NULL CHECK (
          required_coverage >= 0 AND required_coverage <= 1
        ),
        schema_version INTEGER NOT NULL CHECK (schema_version > 0),
        fingerprint TEXT NOT NULL UNIQUE,
        source_ride_id TEXT,
        source_start_point_index INTEGER,
        source_end_point_index INTEGER,
        created_at_ms INTEGER NOT NULL,
        FOREIGN KEY (source_ride_id) REFERENCES rides(id) ON DELETE SET NULL,
        CHECK (
          (source_start_point_index IS NULL AND source_end_point_index IS NULL) OR
          (
            source_start_point_index IS NOT NULL AND
            source_end_point_index IS NOT NULL AND
            source_start_point_index >= 0 AND
            source_end_point_index >= source_start_point_index
          )
        )
      ) STRICT;

      CREATE TABLE segment_reference_points (
        segment_id TEXT NOT NULL,
        point_index INTEGER NOT NULL CHECK (point_index >= 0),
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        distance_meters REAL NOT NULL CHECK (distance_meters >= 0),
        elevation_meters REAL,
        PRIMARY KEY (segment_id, point_index),
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE segment_attempts (
        id TEXT PRIMARY KEY,
        segment_id TEXT NOT NULL,
        ride_id TEXT NOT NULL,
        start_point_index INTEGER NOT NULL CHECK (start_point_index >= 0),
        end_point_index INTEGER NOT NULL CHECK (end_point_index >= start_point_index),
        start_timestamp_ms INTEGER NOT NULL,
        end_timestamp_ms INTEGER NOT NULL CHECK (end_timestamp_ms >= start_timestamp_ms),
        matcher_version INTEGER NOT NULL CHECK (matcher_version > 0),
        confidence_score REAL NOT NULL CHECK (
          confidence_score >= 0 AND confidence_score <= 1
        ),
        decision TEXT NOT NULL CHECK (decision IN ('accept', 'borderline')),
        manually_approved INTEGER NOT NULL DEFAULT 0 CHECK (manually_approved IN (0, 1)),
        created_at_ms INTEGER NOT NULL,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
        FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
        FOREIGN KEY (ride_id, start_point_index)
          REFERENCES ride_points(ride_id, point_index) ON DELETE CASCADE,
        FOREIGN KEY (ride_id, end_point_index)
          REFERENCES ride_points(ride_id, point_index) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE match_diagnostics (
        attempt_id TEXT PRIMARY KEY,
        coverage_pct REAL NOT NULL CHECK (coverage_pct >= 0 AND coverage_pct <= 1),
        max_deviation_meters REAL NOT NULL CHECK (max_deviation_meters >= 0),
        median_deviation_meters REAL CHECK (median_deviation_meters >= 0),
        max_backward_meters REAL NOT NULL CHECK (max_backward_meters >= 0),
        max_gap_ms INTEGER NOT NULL CHECK (max_gap_ms >= 0),
        gps_gap_count INTEGER NOT NULL DEFAULT 0 CHECK (gps_gap_count >= 0),
        confidence_score REAL NOT NULL CHECK (
          confidence_score >= 0 AND confidence_score <= 1
        ),
        reasons_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reasons_json)),
        created_at_ms INTEGER NOT NULL,
        FOREIGN KEY (attempt_id) REFERENCES segment_attempts(id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX idx_rides_start_timestamp
        ON rides(start_timestamp_ms);
      CREATE INDEX idx_ride_points_timestamp
        ON ride_points(ride_id, timestamp_ms);
      CREATE INDEX idx_segment_reference_points_distance
        ON segment_reference_points(segment_id, distance_meters);
      CREATE INDEX idx_segment_attempts_segment
        ON segment_attempts(segment_id, start_timestamp_ms);
      CREATE INDEX idx_segment_attempts_ride_range
        ON segment_attempts(ride_id, start_point_index, end_point_index);
    `,
  },
  {
    version: 2,
    name: "import_identity_and_retained_files",
    sql: `
      ALTER TABLE imported_files ADD COLUMN retained_file_uri TEXT;
      ALTER TABLE imported_files ADD COLUMN file_size_bytes INTEGER
        CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0);

      ALTER TABLE rides ADD COLUMN activity_id TEXT;
      ALTER TABLE rides ADD COLUMN device_id TEXT;
      ALTER TABLE rides ADD COLUMN duration_ms INTEGER
        CHECK (duration_ms IS NULL OR duration_ms >= 0);
      ALTER TABLE rides ADD COLUMN original_timezone_offset_minutes INTEGER
        CHECK (
          original_timezone_offset_minutes IS NULL OR
          original_timezone_offset_minutes BETWEEN -1440 AND 1440
        );
      ALTER TABLE rides ADD COLUMN fit_metadata_json TEXT
        CHECK (fit_metadata_json IS NULL OR json_valid(fit_metadata_json));

      CREATE INDEX idx_rides_activity_id
        ON rides(activity_id)
        WHERE activity_id IS NOT NULL;
      CREATE INDEX idx_rides_device_timing
        ON rides(device_id, start_timestamp_ms, duration_ms)
        WHERE device_id IS NOT NULL;
    `,
  },
  {
    version: 3,
    name: "ride_summary_columns",
    sql: `
      -- Populated once at import time (persistImportedRide.ts), not aggregated on every read.
      -- total_distance_meters: the last ride_points.distance_meters value (FIT distance is
      -- cumulative). total_ascent_meters: sum of positive deltas between consecutive points
      -- that both have a present elevation_meters value, in point_index order; a gap across
      -- missing elevation samples contributes no delta.
      ALTER TABLE rides ADD COLUMN total_distance_meters REAL
        CHECK (total_distance_meters IS NULL OR total_distance_meters >= 0);
      ALTER TABLE rides ADD COLUMN total_ascent_meters REAL
        CHECK (total_ascent_meters IS NULL OR total_ascent_meters >= 0);
    `,
  },
  {
    version: 4,
    name: "segment_fingerprint_not_unique",
    sql: `
      -- A segment's fingerprint is geometry-only (direction + matching params + resampled
      -- polyline), per docs/PLAN_segment_definition_increment.md -- two geographically
      -- identical segments defined from different rides (explicitly allowed by docs/MVP.md)
      -- must be able to share a fingerprint. SQLite has no ALTER TABLE to drop an inline
      -- UNIQUE constraint, so this rebuilds segments and every table with a foreign key into
      -- it. Each *_new table's FKs reference the *other* *_new tables by name (not the old
      -- table names) -- verified empirically that referencing an old name here causes
      -- DROP TABLE's implicit cascade-delete to silently wipe the newly-copied child rows
      -- before the rename ever happens. SQLite auto-rewrites a table's FK clauses to follow
      -- a referenced table through ALTER TABLE RENAME, so after renaming *_new back to the
      -- original names, every FK ends up pointing at the right table again.
      CREATE TABLE segments_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        corridor_meters REAL NOT NULL CHECK (corridor_meters > 0),
        required_coverage REAL NOT NULL CHECK (
          required_coverage >= 0 AND required_coverage <= 1
        ),
        schema_version INTEGER NOT NULL CHECK (schema_version > 0),
        fingerprint TEXT NOT NULL,
        source_ride_id TEXT,
        source_start_point_index INTEGER,
        source_end_point_index INTEGER,
        created_at_ms INTEGER NOT NULL,
        FOREIGN KEY (source_ride_id) REFERENCES rides(id) ON DELETE SET NULL,
        CHECK (
          (source_start_point_index IS NULL AND source_end_point_index IS NULL) OR
          (
            source_start_point_index IS NOT NULL AND
            source_end_point_index IS NOT NULL AND
            source_start_point_index >= 0 AND
            source_end_point_index >= source_start_point_index
          )
        )
      ) STRICT;

      CREATE TABLE segment_reference_points_new (
        segment_id TEXT NOT NULL,
        point_index INTEGER NOT NULL CHECK (point_index >= 0),
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        distance_meters REAL NOT NULL CHECK (distance_meters >= 0),
        elevation_meters REAL,
        PRIMARY KEY (segment_id, point_index),
        FOREIGN KEY (segment_id) REFERENCES segments_new(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE segment_attempts_new (
        id TEXT PRIMARY KEY,
        segment_id TEXT NOT NULL,
        ride_id TEXT NOT NULL,
        start_point_index INTEGER NOT NULL CHECK (start_point_index >= 0),
        end_point_index INTEGER NOT NULL CHECK (end_point_index >= start_point_index),
        start_timestamp_ms INTEGER NOT NULL,
        end_timestamp_ms INTEGER NOT NULL CHECK (end_timestamp_ms >= start_timestamp_ms),
        matcher_version INTEGER NOT NULL CHECK (matcher_version > 0),
        confidence_score REAL NOT NULL CHECK (
          confidence_score >= 0 AND confidence_score <= 1
        ),
        decision TEXT NOT NULL CHECK (decision IN ('accept', 'borderline')),
        manually_approved INTEGER NOT NULL DEFAULT 0 CHECK (manually_approved IN (0, 1)),
        created_at_ms INTEGER NOT NULL,
        FOREIGN KEY (segment_id) REFERENCES segments_new(id) ON DELETE CASCADE,
        FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
        FOREIGN KEY (ride_id, start_point_index)
          REFERENCES ride_points(ride_id, point_index) ON DELETE CASCADE,
        FOREIGN KEY (ride_id, end_point_index)
          REFERENCES ride_points(ride_id, point_index) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE match_diagnostics_new (
        attempt_id TEXT PRIMARY KEY,
        coverage_pct REAL NOT NULL CHECK (coverage_pct >= 0 AND coverage_pct <= 1),
        max_deviation_meters REAL NOT NULL CHECK (max_deviation_meters >= 0),
        median_deviation_meters REAL CHECK (median_deviation_meters >= 0),
        max_backward_meters REAL NOT NULL CHECK (max_backward_meters >= 0),
        max_gap_ms INTEGER NOT NULL CHECK (max_gap_ms >= 0),
        gps_gap_count INTEGER NOT NULL DEFAULT 0 CHECK (gps_gap_count >= 0),
        confidence_score REAL NOT NULL CHECK (
          confidence_score >= 0 AND confidence_score <= 1
        ),
        reasons_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reasons_json)),
        created_at_ms INTEGER NOT NULL,
        FOREIGN KEY (attempt_id) REFERENCES segment_attempts_new(id) ON DELETE CASCADE
      ) STRICT;

      INSERT INTO segments_new SELECT * FROM segments;
      INSERT INTO segment_reference_points_new SELECT * FROM segment_reference_points;
      INSERT INTO segment_attempts_new SELECT * FROM segment_attempts;
      INSERT INTO match_diagnostics_new SELECT * FROM match_diagnostics;

      DROP TABLE match_diagnostics;
      DROP TABLE segment_attempts;
      DROP TABLE segment_reference_points;
      DROP TABLE segments;

      ALTER TABLE segments_new RENAME TO segments;
      ALTER TABLE segment_reference_points_new RENAME TO segment_reference_points;
      ALTER TABLE segment_attempts_new RENAME TO segment_attempts;
      ALTER TABLE match_diagnostics_new RENAME TO match_diagnostics;

      CREATE INDEX idx_segments_fingerprint ON segments(fingerprint);
      CREATE INDEX idx_segment_reference_points_distance
        ON segment_reference_points(segment_id, distance_meters);
      CREATE INDEX idx_segment_attempts_segment
        ON segment_attempts(segment_id, start_timestamp_ms);
      CREATE INDEX idx_segment_attempts_ride_range
        ON segment_attempts(ride_id, start_point_index, end_point_index);
    `,
  },
];

export function configureDatabaseConnection(database: MigrationDatabase): void {
  database.exec("PRAGMA foreign_keys = ON");
  const row = database.prepare("PRAGMA foreign_keys").get() as
    | { foreign_keys?: number | bigint }
    | undefined;
  if (Number(row?.foreign_keys) !== 1) {
    throw new Error("SQLite foreign-key enforcement could not be enabled");
  }
}

export function applyMigrations(
  database: MigrationDatabase,
  orderedMigrations: readonly Migration[] = migrations,
): void {
  configureDatabaseConnection(database);
  validateMigrationOrder(orderedMigrations);

  const row = database.prepare("PRAGMA user_version").get() as
    | { user_version?: number | bigint }
    | undefined;
  const currentVersion = Number(row?.user_version ?? 0);
  const latestVersion = orderedMigrations.at(-1)?.version ?? 0;
  if (currentVersion > latestVersion) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${latestVersion}`,
    );
  }

  for (const migration of orderedMigrations) {
    if (migration.version <= currentVersion) continue;

    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      database.exec(`PRAGMA user_version = ${migration.version}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed`,
        { cause: error },
      );
    }
  }
}

function validateMigrationOrder(orderedMigrations: readonly Migration[]): void {
  let previousVersion = 0;
  for (const migration of orderedMigrations) {
    if (!Number.isInteger(migration.version) || migration.version !== previousVersion + 1) {
      throw new Error("Migration versions must be consecutive positive integers");
    }
    previousVersion = migration.version;
  }
}
