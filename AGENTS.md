# Repository agent instructions

When the user says **"check the latest"**, **"read the latest handoff"**, or equivalent,
read `handoffs/LATEST.md` before planning or editing. Follow links from that file only when
they are relevant to the requested work.

After completing a user-approved milestone, update `handoffs/LATEST.md` and add a dated copy
under `handoffs/archive/` using `handoffs/TEMPLATE.md`. Record facts, not aspirations: exact
commits/files changed, verification actually run, uncommitted work, external/device state,
known hazards, blockers, and the safest next action. Never overwrite an archived handoff.

Do not treat `state/STATUS.md` as current implementation truth; it belongs to an older
automated project-management workflow and may be stale.
