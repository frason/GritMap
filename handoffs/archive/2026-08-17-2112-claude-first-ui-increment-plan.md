# Handoff: Root-app first UI increment — plan ready for review, not yet built

- Updated: `2026-08-17 21:12 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `2397965 docs: hand off Karoo data field split`
- Worktree: **not clean** — see "External state" below before touching this checkout

## Outcome

Not a completed milestone — a **plan awaiting review** before implementation starts. The root
Expo app (`App.tsx`, `src/`) has had zero UI/navigation this whole time; everything built so
far is pure business logic (FIT parser, matcher, comparison, SQLite schema, dedup). The user
asked for the MVP's first real screens (FIT Import, Ride List, Ride Detail) instead of the
previously-discussed Karoo local-network sync feature (still paused, `SEGMENT_SYNC_DESIGN.md`).

Full plan: [`docs/PLAN_first_ui_increment.md`](../docs/PLAN_first_ui_increment.md) (this repo).
Approved Figma mock of all four screens/states:
https://www.figma.com/design/cyaMDDfLBKFc4NNK1SUUnb?node-id=29-205

**Requesting Codex's review of the plan doc before Claude implements it.** This is entirely
root-app/`src/` scoped and does not touch `apps/karoo/` — flagging for awareness and a second
opinion given the shared handoff protocol, not because of any known overlap with your current
Karoo work.

## Changed

Nothing committed. There is early, uncommitted scaffolding in the working tree from before this
review step was requested — see "External state." Nothing described here has landed.

## Verified

- The plan doc's technical claims were verified directly against source before writing them
  down: `src/db/migrations.ts`/`persistMatchCandidate.ts`'s hand-rolled DB interface doesn't
  structurally match real `expo-sqlite`'s `execSync`/`prepareSync` API (confirmed by reading
  `node_modules/expo-sqlite/build/*.d.ts`); `.gitignore` only excludes native build artifacts,
  not `ios/`/`android/` themselves; `fixtures/fit/*.fit` and `docs/FIT_PARSER_SPIKE.md` exist.
- A throwaway scaffolding spike (nav libs + `@expo/vector-icons` installed, `App.tsx` rewritten,
  stub screens/navigators, semantic `src/theme/*` tokens added) passed `npm run typecheck`,
  `npm test` (37/37, all pre-existing), and `npm run web:smoke` cleanly — this is what
  de-risked the "does adding React Navigation break the web build" question in the plan.
- SF Pro was tried for the Figma mock's typography and measured at 0-width in that rendering
  environment (likely a font-licensing restriction in that sandbox); the mock uses Inter
  instead. Worth re-checking in the Figma desktop app before assuming SF Pro is unusable there.

## External state

- **Uncommitted working-tree changes** (this is the "not clean" state above): modified
  `App.tsx`, `package.json`, `package-lock.json`; new `src/navigation/`, `src/screens/`,
  `src/theme/`. This is early/exploratory — a false start made before realizing the plan should
  go through this review step first. It typechecks and passes `web:smoke`/`npm test`, but
  **treat it as scratch, not as agreed implementation** — the plan doc is the source of truth
  for what to build, and this scaffolding may not match it exactly once reviewed. Don't build
  on top of it without checking first; it may get discarded and redone.
- No device/APK state changed by this work — this hasn't touched `apps/karoo/` or any device.

## Hazards and blockers

- This checkout is shared with cron (paused) and with your sessions — before running git
  commands here, check `git branch --show-current` and `git status` first, per this repo's
  usual practice.
- The plan's §2 (dev-client/prebuild migration) is a real workflow change: it moves the root
  app off Expo Go for all future development, not just this feature. The user already agreed
  to this specific tradeoff, but it's worth knowing before touching `app.json`/native dirs.
- Nothing here blocks or is blocked by your current Karoo live-activation reliability work —
  separate track, flagging only per the shared-review convention.

## Next safe action

Review [`docs/PLAN_first_ui_increment.md`](../docs/PLAN_first_ui_increment.md) — architecture,
scope boundaries (notably: segment definition/maps deliberately excluded, pending PR #54), the
`expo-sqlite` adapter gap in §"A blocking gap this plan discovered," and the PR breakdown.
Leave feedback in this handoff (append a section, or edit `docs/PLAN_first_ui_increment.md`
directly and note what changed) so Claude can pick it up and either revise the plan or start
implementing PR 1 as scoped.
