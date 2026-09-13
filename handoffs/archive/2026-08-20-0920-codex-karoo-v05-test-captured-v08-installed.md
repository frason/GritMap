# Handoff: Karoo v0.5 test captured and v0.8 installed

- Updated: `2026-08-20 09:20 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `ed0c539 ui/segment-detail-and-list`
- Worktree: Karoo cardiac-drift changes and this handoff are uncommitted; root-app work is committed.

## Outcome

The connected Karoo's v0.5 diagnostic trail proves a complete deterministic Coco Jumbo
traversal: the service saw Recording, discovered `coco-jumbo`, selected it at a 25 m start
distance, started the attempt, dispatched the entry alert, and completed normally about 68
seconds later. No GritMap crash appears in the captured log. The device was then upgraded in
place to the verified 0.8.0 APK.

## Changed

- No source behavior changed in this step.
- Device package upgraded from versionName 0.5.0/versionCode 7 to 0.8.0/versionCode 11.

## Verified

- `adb devices -l`: Karoo serial `00442GA241760203`, model `k24`, connected by USB.
- Before upgrade: versionName 0.5.0/versionCode 7, last updated 2026-08-18 15:14:33.
- Diagnostic sequence: `candidate_discovered`, `candidate_selected` (`startDistance=25`),
  `attempt_started`, successful `segment_entry_alert`, then `attempt_finished reason=completed`.
- After `adb install -r`: versionName 0.8.0/versionCode 11, last updated
  2026-08-20 09:18:37. Original firstInstallTime remained 2026-08-17 13:14:12, confirming an
  in-place update rather than uninstall/reinstall.

## External state

- Karoo currently has GritMap 0.8.0 installed and its app data was retained.
- Direct `adb pull` of the private diagnostic path was denied, but its contents were read
  successfully through `run-as` before the upgrade and the relevant sequence is recorded here.

## Hazards and blockers

- Version 0.5 diagnostics did not record individual power or HR stream values. They prove the
  matcher lifecycle, but cannot prove that power and HR reached `LiveUiState` during that test.
- A current boot log contains `BackgroundServiceStartNotAllowedException` when the extension
  alone tried to start the service from the background. Starting from the launcher worked, and
  the successful test ran with the service active.

## Next safe action

Open GritMap 0.8.0, confirm the imported segment remains installed, start the data-field demo,
and inspect GM Cardiac Drift. Before the next sensor ride, launch GritMap before recording.
