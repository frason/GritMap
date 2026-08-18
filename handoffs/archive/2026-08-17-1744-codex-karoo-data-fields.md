# Handoff: Karoo pacing profile and target power fields split

- Updated: `2026-08-17 17:44 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `5ae510f apps/karoo: split target power and pacing profile fields`
- Worktree: clean before this handoff update

## Outcome

The Karoo extension now registers two focused fields. **GritMap Target Power** is a standard
numeric power-formatted field. **GritMap Pacing Profile** is a graphical field containing
the elevation profile, recover/hold/push colors, progress, and position marker. The profile
retains the old `live-pacing` type ID, so an existing configured GritMap module should become
the profile after upgrade.

## Changed

- `5ae510f` splits the fields, adds numeric stream mapping/tests, updates extension metadata,
  and simplifies the graphical RemoteViews layout.
- `TargetPowerDataType.kt` emits exactly one `FIELD_SINGLE_ID` value and never substitutes
  zero for a missing recommendation.
- `PacingProfileDataType` continues using the existing 1 Hz bitmap renderer and type ID.

## Verified

- `./gradlew testDebugUnitTest lintDebug assembleDebug` passed using JDK 17 and the Android
  SDK; no device instrumentation was run.
- The debug APK was built but deliberately not installed over the user's active Karoo app.
- Offline replay of `Karoo-Evening_Ride-2026-08-17-1706.fit` against Coco Jumbo produced an
  accepted match: 100% coverage, 3.43 m maximum deviation, no backward movement, 1 s maximum
  gap, and 0.988595 confidence. Missing HR/power was not a matching blocker.

## External state

- The physical Karoo still runs the prior APK and retains Coco Jumbo in Room.
- Overlay permission is enabled; Android fine/coarse location permissions for GritMap were
  observed as denied.
- After the failed car test, the GritMap process was absent and Karoo showed a dead extension
  binding. The existing implementation had no useful matcher/service diagnostic logging.

## Hazards and blockers

- Do not run `connectedDebugAndroidTest` against the active Karoo package; it previously
  cleared Room and app-specific external files.
- The new fields are not visible on-device until the user approves installing the new APK.
- Live activation remains unreliable until runtime location permission, service lifecycle,
  and structured diagnostics are fixed. The valid car ride proves geometry was not the cause.
- Target Power will be unavailable without an effective pacing recommendation; missing live
  sensors should freeze adaptation, not deterministic matching.
- The pinned Needle/Cactus runtime/model artifact remains unresolved.

## Next safe action

Implement the isolated live-activation reliability fix: request location permission during
setup, make the ride-time Karoo subscription lifecycle robust when the launcher closes, and
add bounded persistent diagnostics for ride state, GPS, candidate discovery, activation,
abandonment, and errors. Add a replay/acceptance test based on the supplied car FIT file.
