# Redesign release: database migrations and rollback

The redesign build moves the on-device SQLite database from version 15 (build 8 and earlier) to version 17.
Both migrations run once, inside a transaction, the first time the new app opens the database. If one fails it
rolls back, the app reports the error, and the database stays at its previous version.

| Version | Name | What it does | Data it touches |
| --- | --- | --- | --- |
| 16 | `ride_name` | Adds a nullable `rides.name` and backfills it from the metadata already stored with each ride (a FIT session's sport profile name, or a GPX track name). Rides with no name stay NULL and the app shows a title built from the ride's date, such as "Sat morning ride". | Adds one column. No rows are removed or rewritten except `rides.name`. |
| 17 | `segment_goals` | Creates `segment_goals` (one goal and optional long-term goal per segment) and copies the single `active_goal` row into it. `active_goal` stays and now only says which segment Home leads with. | Adds one table. Existing goal, plans, sends and attempts are untouched. |

## Tested

`src/db/migrations.test.ts` builds a populated database at the previous version, applies the migration, and checks
that nothing is lost, foreign keys still hold, cascades still work, and running the migrations again changes
nothing. The v16 test covers rides with a FIT name, a GPX name, no metadata and a non-text name. The v17 test
covers a database with a goal, a plan send and an attempt, and a database with no goal.

## Rolling back

There is no down-migration. An older app refuses a database whose `user_version` is newer than it supports, so
going back to an earlier build means restoring the database file from before the update:

- TestFlight or App Store: the previous build can be reinstalled, but it will not open a database already
  upgraded to 16 or 17. Delete the app data, or restore from a device backup taken before the update.
- Ride files are retained separately on the device (`imported_files.retained_file_uri`), so rides can be
  re-imported after a reset. Segments, goals and plan history live only in the database.

Before the first install of the redesign on a device that holds real data, take a device backup.

## Known limit

The Karoo shows one goal at a time for now. Each segment stores its own goal and plan on the phone, but the Karoo
follows a single headline segment. The phone says so on Home beside the list of other goals.
