# Handoff: Pacing marker remains visible when riders overlap

- Updated: `2026-08-23 09:12 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted Karoo work; this increment modifies the profile renderer and focused test.

## Outcome

At target pace, the virtual target is represented by a green halo around the white current-rider dot instead of being hidden underneath it. Separated target riders remain red/green white-ringed dots. Compact and vertical layouts use the same overlap behavior.

## Changed

- `ProfileBitmapRenderer.kt`: overlap-aware concentric marker rendering.
- `ProfileBitmapRendererTest.kt`: verifies white rider plus green target halo at exact pace.

## Verified

- Focused renderer tests plus APK assembly: `BUILD SUCCESSFUL in 46s`.
- APK installed on connected Karoo: `Success`.

## External state

- Updated APK is installed on Karoo `00442GA241760203`.
- Version remains 0.8.1/versionCode 12.

## Hazards and blockers

- Physical display validation is still required.
- Preserve existing uncommitted Karoo work.

## Next safe action

Run the preview through an on-pace moment and confirm the green halo is visible around the white rider; then observe it split into a distinct dot as the pacing gap grows.
