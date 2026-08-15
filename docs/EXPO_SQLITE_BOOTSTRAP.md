# Expo SQLite Bootstrap Verification

## What this bridges

`src/db/migrations.ts` (`applyMigrations`) is tested exclusively against
Node's built-in `node:sqlite` (`DatabaseSync`) via `src/db/migrations.test.ts`
because that gives fast, dependency-free tests of the real migration SQL.
`src/db/connection.ts` (#17) opens the real on-device connection via
`expo-sqlite`'s synchronous API (`execSync`, `getFirstSync`, `prepareSync`),
but deliberately stopped short of applying migrations.

`src/db/expoMigrationAdapter.ts` closes that gap with the thinnest possible
shim: it maps the two methods `applyMigrations` actually calls —
`exec(sql)` and `prepare(sql).get(...)` — onto `execSync` and
`getFirstSync`. No migration SQL is duplicated or rewritten; the exact same
`migrations` array from `src/db/migrations.ts` runs on both `DatabaseSync`
and the real Expo connection.

`src/db/bootstrap.ts` (`bootstrapDatabase`) is the single application entry
point: it opens/reuses the cached Expo connection from `getDatabaseConnection`,
adapts it, and calls `applyMigrations`. Because `applyMigrations` only runs
migrations whose version exceeds the database's current `PRAGMA user_version`,
calling `bootstrapDatabase()` repeatedly is a no-op past the first successful
run. On any failure, the cached connection is closed and removed
(`closeDatabaseConnection`) so a subsequent call reopens a fresh handle
instead of reusing a connection that failed mid-bootstrap.

`App.tsx` calls `bootstrapDatabase()` once on mount (inside a `useEffect`,
errors logged only) so the schema is created automatically when the app
starts. This is intentionally the only touch point in `App.tsx` — no UI,
import, or MapLibre work is included here.

## Why there is no automated Expo integration test

`expo-sqlite`'s JS build (`node_modules/expo-sqlite/build/index.js`) requires
the native Expo Modules bridge (`expo-modules-core`) at import time. There is
no `jest-expo`/`jest-preset-jest-expo` harness or native mocking layer set up
in this repository, and this task is scoped to not add one. Attempting to
`require`/`import` `expo-sqlite` under plain `node --test` fails immediately:

```
$ node -e "require('expo-sqlite')"
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '.../node_modules/expo-sqlite/build/SQLiteDatabase' imported from
  '.../node_modules/expo-sqlite/build/index.js'
```

So the correctness of `applyMigrations` and its full migration SQL remains
covered by the Node suite (`src/db/migrations.test.ts`, run via
`node --test src/db/migrations.test.ts`), and the **adapter/bootstrap
wiring** — which is intentionally almost no logic — is verified below via a
development build, per the task's "documented development-build
verification" option.

## Development-build verification steps

1. Ensure no previous `gritmap.db` exists for a clean run (uninstall the dev
   build, or in the iOS Simulator/Android emulator, clear app data).
2. Run the app on a real device or simulator: `npm run ios` or
   `npm run android` (a full Expo Go/dev-client session; `expo start --web`
   does not exercise the native SQLite driver).
3. On launch, `App.tsx`'s `useEffect` calls `bootstrapDatabase()`. Confirm no
   `console.error('Failed to bootstrap the on-device database', ...)` is
   logged in the Metro/device console.
4. From the same running JS context (e.g. a temporary
   `console.log` in `App.tsx`, or the in-app JS debugger/REPL), run:

   ```ts
   import { getDatabaseConnection } from './src/db/connection';
   const db = getDatabaseConnection();
   console.log('user_version', db.getFirstSync('PRAGMA user_version'));
   console.log('foreign_keys', db.getFirstSync('PRAGMA foreign_keys'));
   console.log(
     'tables',
     db.getAllSync(
       "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
     ),
   );
   ```

   Expected results on a fresh install:
   - `user_version` reports `{ user_version: 2 }` (the latest migration in
     `src/db/migrations.ts` at the time of writing).
   - `foreign_keys` reports `{ foreign_keys: 1 }`.
   - `tables` includes all seven core tables: `imported_files`, `rides`,
     `ride_points`, `segments`, `segment_reference_points`,
     `segment_attempts`, `match_diagnostics`.
5. Force-quit and relaunch the app (same install, same `gritmap.db`). Repeat
   step 4: results must be identical, and no error should be logged,
   confirming `bootstrapDatabase()` is harmless to call again on an
   already-migrated database.
6. To confirm foreign-key enforcement is live on the exact connection the
   app uses (not just a separate test database), attempt an invalid insert
   from the same REPL/debugger session:

   ```ts
   try {
     db.runSync(
       `INSERT INTO rides (id, imported_file_id, parser_version, created_at_ms, updated_at_ms)
        VALUES ('r1', 'missing-file', 1, 0, 0)`,
     );
     console.log('FAIL: insert should have been rejected');
   } catch (error) {
     console.log('OK: foreign key rejected the insert:', error.message);
   }
   ```

   This should throw a `FOREIGN KEY constraint failed` error.

## Result of the most recent manual run

This adapter/bootstrap change has not yet been exercised on a physical
device or simulator by an automated agent in this environment (no Expo
dev-client/simulator is available here). The steps above are the documented
procedure a developer with an iOS/Android build should follow before
merging user-facing features (#5) that depend on the schema being present.
The Node-side migration behavior these steps assert (`user_version`, all
seven tables, `PRAGMA foreign_keys = 1`, idempotent re-apply, and rejected
invalid foreign keys) is fully covered today by
`node --test src/db/migrations.test.ts`, which exercises the identical SQL
this adapter forwards unchanged to Expo.
