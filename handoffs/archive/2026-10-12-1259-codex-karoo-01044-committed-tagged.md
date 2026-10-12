# Handoff: installed Karoo 0.10.44 source committed and tagged

- Updated: `2026-10-12 12:59 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `f3442c4 feat(karoo): capture installed 0.10.44 beta`
- Worktree: unrelated README/install-guide edits and newer handoff work remain uncommitted

## Outcome

The source corresponding to the Karoo's installed `0.10.44-beta`/67 milestone is committed as
`f3442c4` and annotated tag `karoo-beta-0.10.44` points directly to that commit. This was completed
before beginning any Karoo direct-BLE v2 implementation.

The commit includes the accepted large-field typography/density pass, stable `GM PACING PROFILE`
title, launcher icon, bounded user-triggered v1 BLE capsule receiver, its tests, and the historical
milestone documents. It excludes the newer phone direct-BLE implementation and unrelated README
and install-guide edits.

## Changed

- Commit: `f3442c4 feat(karoo): capture installed 0.10.44 beta`.
- Annotated tag: `karoo-beta-0.10.44`.
- Thirty Karoo source/resource/test and milestone-document files were committed.
- No direct-BLE v2 Karoo code was added.

## Verified

- `:app:lintDebug` passed.
- `:app:assembleDebug` passed with `gritmapVersionName=0.10.44-beta` and
  `gritmapVersionCode=67`.
- The full JVM suite executed 189 tests; 188 passed and one failed.
- The failure is
  `NeedleAgentManagerTest.timeoutReturnsFallbackWithoutConcurrentInference`: its functional
  provisional-fallback assertion passes, but its wall-clock assertion requires the call to return
  in less than 70 ms. It failed consistently on this Mac, including when run alone. No test was
  weakened or changed for the tag.
- `git diff --cached --check` passed before the source commit.
- The initial Gradle attempt also encountered a transient AAPT2 daemon startup failure; a clean
  no-daemon retry compiled and linked resources successfully.

## External state

- The physical Karoo already runs `0.10.44-beta`/67 signed with the persistent GritMap Beta key.
- The tag and commits are local only; they have not been pushed and no `0.10.44` GitHub release was
  created.
- The public GitHub release remains `0.10.43`.

## Goal alignment

- Satisfies the top `docs/GOALS.md` reproducible tagged-Karoo-build requirement before starting the
  next phone-to-Karoo sharing iteration.
- Captures the v1 capsule receiver exactly as installed. Direct-BLE v2 remains a proposed shared
  contract and must not be enabled until both sides agree and physical testing passes.

## Hazards and blockers

- Local `main` is ahead of and behind `origin/main`; reconcile deliberately before pushing.
- `README.md` and `docs/BETA_KAROO_INSTALL.md` contain unrelated unstaged edits and were preserved.
- The timing-sensitive Needle test prevents claiming 189/189 on this checkout. It should be fixed
  separately rather than silently relaxing release verification.
- Tagging does not publish a release. Pushing the tag may trigger the beta release workflow, so do
  not push until branch reconciliation and release intent are confirmed.

## Next safe action

Reconcile local `main` with `origin/main` without losing the preserved README changes, then review
the direct-BLE v2 contract against the phone implementation before changing any Karoo BLE code.
