# Handoff: "Remove saved token" and the unused demo map deleted (committed locally, not pushed)

- Updated: `2026-10-09 02:10 PDT`
- Agent: `Claude`
- Head: `feat: remove the saved GitHub token in the app; delete the unused demo MapScreen` (handoff committed on top)
- Worktree: clean for phone files; `apps/karoo/` untouched.

## Outcome

- **Remove saved token** (Share to Open Segments, maintainer section): shown whenever a token is saved; asks "Remove the saved token?" (deleted from this iPhone's Keychain; nothing already shared is affected) with "Yes, remove it" /
  "Keep it"; on success clears the Keychain item via the existing `clearRegistryToken`, returns to the no-token state (token field shown) and says "The saved token has been removed from this iPhone." A failure shows "GritMap couldn't remove the saved token. Try again."
  44 pt buttons, `AppText`, accessibility hint "Deletes the token from this iPhone". Unit test `src/registry/registryCredentials.test.ts` (mocked secure store): none until saved, save/read, remove, removing twice is harmless.
- **`src/screens/MapScreen.tsx` deleted** (unwired scaffold; nothing imported it; it was the only user of `demotiles.maplibre.org`). A comment in `RouteMapView.native.tsx` that named that host was reworded, so `grep -rn demotiles src` is empty. Old planning docs under `docs/PLAN_*` still mention the file historically; left as history.
- **`docs/PRIVACY.md` updated in the same commit:** the token "can be removed in the app at any time", and the deletion section tells a maintainer to use "Remove saved token" before deleting the app (iOS may keep Keychain items after app deletion). The network section was already true; the app now contacts only GitHub, OpenFreeMap and the local Karoo.

## Verified

- `npx tsc --noEmit` clean; `npm test` 633/633; `npm run web:smoke` clean; `grep -rn "demotiles\|MapScreen" src` has no code hits.
- Simulator flow (`docs/screenshots/token-removal/`): saved a made-up token (the segment is already published, so the app's "already published" check ended the share without sending the token anywhere), the saved-token state showed "Remove saved token", the confirmation card (`02-confirm.png`), and after confirming the no-token state with the success note (`03-removed-no-token-state.png`).
  I did not capture the saved-token state as its own image.
- Not done: VoiceOver on a real iPhone; confirming on a device that the Keychain entry is really gone (covered by the unit test and the API, not inspected on device).

## Goal alignment

- `docs/GOALS.md` Priority 1 (beta privacy policy stays exactly true) and Priority 3 groundwork (maintainer-only sharing until token-free sharing exists, `docs/OPEN_SEGMENTS_SHARING.md`). No shared contract touched. The Karoo receiver's lack of authentication is left alone, as asked.

## Next safe action

Jason fills the two TODOs in `docs/PRIVACY.md`, publishes it, and OKs pushing the local commits.
