# Handoff: Root-app first UI increment — plan reviewed, revisions incorporated, implementing PR 1

- Updated: `2026-08-17 21:41 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `51e6839 docs: incorporate Codex review into first UI increment plan`
- Worktree: **not clean** — see "External state" below before touching this checkout

## Outcome

Still not a completed milestone — the plan/review round-trip is closed, implementation of PR 1
(navigation shell + semantic theme tokens) starts next in this session.

Full plan, now with Codex's review and Claude's incorporation of all seven required revisions
inline: [`docs/PLAN_first_ui_increment.md`](../docs/PLAN_first_ui_increment.md). Approved Figma
mock: https://www.figma.com/design/cyaMDDfLBKFc4NNK1SUUnb?node-id=29-205

Every revision item was resolved with something verified directly against source, not assumed
— see the plan's "Claude — revisions incorporated" section for the specifics (expo-sqlite's
one-shot APIs read from its `.d.ts`, both real FIT fixtures parsed directly to ground the
identity-normalization rules empirically, `expo-crypto`'s actual `Crypto.digest`/`randomUUID`
signatures confirmed via Expo's docs, PR #54's diff checked directly for app.json/native-config
touches).

## Changed

- `f4b5a15` (Claude): plan + Figma mock handed off for review.
- `3fd6790` (Codex): plan reviewed, seven required revisions appended.
- `51e6839` (Claude): all seven revisions incorporated into the plan's implementation sections
  (adapter design, FIT identity rules, ID/hash sourcing, cleanup ordering, batch responsiveness,
  a new migration v3 for ride summary columns, PR #54 coordination note).

No product implementation has landed yet. There is still uncommitted scaffolding in the working
tree — see "External state."

## Verified

- All claims in the incorporated revisions were checked against real source before writing them
  down (not re-summarizing here — see the plan doc's "revisions incorporated" section for the
  itemized list of what was verified and how).
- The pre-existing scratch `src/theme/*`/`src/navigation/*`/stub `src/screens/*` files were
  diffed against the plan's §0/§1 (navigation shell, semantic tokens) — neither section was
  touched by any required revision, so the scratch files match the approved plan as written and
  will be committed as PR 1 rather than redone.

## External state

- **Uncommitted working-tree changes**: modified `App.tsx`, `package.json`,
  `package-lock.json`; new `src/navigation/`, `src/screens/`, `src/theme/`. As of this handoff
  these are confirmed to match the approved (post-review) plan and are about to be committed as
  PR 1 in this same session — by the time you read this they may already be `nav/app-shell` on
  `main`. Check `git log` before assuming this description is still current.
- No device/APK state changed by this work — this hasn't touched `apps/karoo/` or any device.

## Hazards and blockers

- This checkout is shared with cron (paused) and with your sessions — check
  `git branch --show-current` and `git status` before running git commands here.
- PR 2 (dev-client/prebuild) generates and commits native `ios`/`android` dirs. Per the
  incorporated review: this doesn't conflict with PR #54's current diff (confirmed — no
  app.json/config-plugin changes there), but PR #54's `@maplibre/maplibre-react-native`
  dependency will need a follow-up `expo prebuild --clean` once it merges, to link it natively.
  That follow-up isn't done yet and isn't this handoff's responsibility to do — flagging so it
  isn't forgotten when PR #54 lands.
- Nothing here blocks or is blocked by your current Karoo live-activation reliability work.

## Next safe action

Implement PR 1 (`nav/app-shell`) from the plan, then continue sequentially through PR 2–8,
verifying each per the plan's per-PR verification notes before moving to the next. Update this
handoff again once a meaningful chunk of the increment (at least through PR 4/5, ideally the
whole thing) is committed.
