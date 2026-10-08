# Claude repository instructions

Before planning feature work, read `docs/GOALS.md` (vision, beta scope, priorities, non-goals,
and phone vs Karoo responsibilities). If a request conflicts with it, say so before building.

When the user says **"check the latest"**, **"read the latest handoff"**, or equivalent,
read `handoffs/LATEST.md` before planning or editing.

After completing a user-approved milestone, update `handoffs/LATEST.md` and add a dated copy
under `handoffs/archive/` using `handoffs/TEMPLATE.md`. Include exact commits/files changed,
verification actually run, uncommitted work, external/device state, hazards, blockers, and
the safest next action. Archived handoffs are immutable.

`state/STATUS.md` is from an older automated workflow and may be stale; the latest handoff
is authoritative for recent implementation work.
