# Handoff: Pacing Profile horizon and pace simplification 0.10.1

- Updated: `2026-09-28 20:42 PDT`
- Agent: `Codex`
- Branch: `main`
- Head at completion: `dd4878b feat: optional git-repo-backed segment registry (#62)`

## Outcome

Built and installed GritMap Karoo 0.10.1/code24 on device `00442GA241760203`.

## Changed

- Mountain silhouettes now occupy only a shallow horizon band behind the vanishing point.
- Road effort gradient fades toward near-black beside YOU.
- Fixed center Pace card shows only signed time (`-` behind, `+` ahead).
- Large top guidance shows action plus pace relationship/time, without target watts.

## Verification

- Four-state contact sheet regenerated and reviewed locally.
- Focused renderer/layout tests passed.
- Full JVM tests and debug APK assembly passed.
- Replacement install succeeded; device reports 0.10.1/code24.
- Extension process is alive; extension, service, and Karoo connection logs are healthy with no fatal startup error.

## Known hazards

- One full preview-loop hardware review remains useful.
- Shared worktree changes remain uncommitted; preserve unrelated iOS and Claude work.

## Safest next action

Review one full preview loop on 0.10.1 and collect feedback as a batch.
