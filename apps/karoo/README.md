# GritMap Karoo

Standalone Android 12 (`API 31`, `arm64-v8a`) application and Karoo extension for local,
directed segment matching and validated on-device pacing guidance. This Gradle build is
independent of the Expo application at the repository root.

## Status

The deterministic matching, Room model, import contracts, in-memory live session, two UI
hosts, pacing validation, and JNI boundary live in this directory. A distributable AI build
also requires a pinned Cactus Android `libcactus_engine.so` and Needle 2 model bundle. The repository
does not invent or redistribute model weights; see [MODEL_PROVENANCE.md](MODEL_PROVENANCE.md).

## Prerequisites

- Android Studio with JDK 17
- Android SDK platform/build tools (compile SDK 35; device/target API 31)
- NDK `27.2.12479018` and CMake `3.22.1`
- A Karoo 3 with extension sideloading enabled for device acceptance

The exact Apache-2.0 Hammerhead `karoo-ext` 1.1.9 library source is vendored from upstream
commit `26e1d1c5c86e4d49922b2e2cc0474e62fc3b6eed`, so builds do not require personal package
credentials. See `vendor/karoo-ext/UPSTREAM.md`.

## Build and test

```bash
cd apps/karoo
./gradlew testDebugUnitTest
./gradlew assembleDebug
./gradlew connectedDebugAndroidTest
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Room and Compose instrumentation tests require an API 31+ emulator or device. Real Karoo
stream, overlay, touch-through, native model, battery, and memory acceptance must run on the
Karoo 3.

## Native model setup

1. Build or obtain the pinned official Cactus Android ARM64 runtime.
2. Copy `libcactus_engine.so` to `app/src/main/jniLibs/arm64-v8a/`.
3. Copy the pinned Needle model bundle directory to app-private storage through the app's model install
   flow or package the verified artifact in `app/src/main/assets/models/`.
4. Record the exact source revision, model format, SHA-256, and licenses in
   `MODEL_PROVENANCE.md`.
5. Configure the expected digest. Initialization fails closed on a missing or mismatched
   model.

The JNI bridge serializes inference and profiles both runtime-reported allocation and total
process resident memory. It does not claim that the whole Android process fits in 28 MB.
Until a concrete Needle bundle and digest are recorded, model initialization is deliberately
fail-closed and deterministic provisional pacing remains active.

## Portable segment JSON

```json
{
  "schemaVersion": 1,
  "id": "unique-segment-id",
  "name": "Local Wall Climb",
  "direction": "forward",
  "matching": {
    "corridorMeters": 30,
    "requiredCoveragePct": 0.9
  },
  "referencePolyline": [
    {
      "lat": 37.1234,
      "lng": -122.1234,
      "distanceMeters": 0,
      "elevationMeters": 42.5
    },
    {
      "lat": 37.1235,
      "lng": -122.1233,
      "distanceMeters": 10,
      "elevationMeters": 43.1
    }
  ]
}
```

The parser accepts only schema version 1 and forward direction. Distances must start at zero
and increase strictly. The fingerprint is SHA-256 over the canonical directed geometry and
matching parameters; name, ID, timestamp, and local source provenance are excluded.

## Segment Library and phone transfer

The launcher includes a Segment Library showing each installed segment's length,
reference-point count, matching settings, fingerprint prefix, and whether a phone-generated
baseline pacing plan is installed. Deletion is explicit and requires confirmation.

On Karoo, copy raw segment JSON files or atomic GritMap transfer packages into either of
these app-specific directories over ADB:

```text
/sdcard/Android/data/com.gritmap.karoo/files/imports/packages/
/sdcard/Android/data/com.gritmap.karoo/files/imports/segments/   (legacy raw segments)
```

Then press **Import Segment JSON**. Every pending file is validated. Successful and exact
duplicate imports move to `imports/processed/`; invalid packages move to `imports/failed/`
with a `.error.txt` explanation. A same-ID/different-fingerprint segment is rejected rather
than silently replacing immutable geography.

The transfer package can carry a segment, rider history, and a phone/cloud/manual baseline
pacing plan in one transaction. The plan remains separate from reference coordinates and is
accepted only when its fingerprint, FTP, complete distance coverage, power bounds, enums,
and transitions validate. See [TRANSFER_PACKAGE.md](TRANSFER_PACKAGE.md) for the versioned
contract. The folder inbox is deliberately transport-neutral: a future companion-phone
transport can deliver the same bytes without changing validation or persistence behavior.

## Runtime data flow

```text
KarooSystemService streams (1 Hz)
                |
                v
      ActiveAttemptSession (memory)
          |                 |
          v                 v
 StateFlow<LiveUiState>   pacing inference (10 s + events)
      |          |           |
      v          v           v
 Compose       Canvas ->    validated pacing plan
 overlay       Bitmap ->
               RemoteViews

Room writes: entry, material plan change, 30 s checkpoint, exit only
```

The extension exposes two deliberately focused Karoo fields:

- **GritMap Target Power** is a standard numeric field containing only the current
  recommended watt target.
- **GritMap Pacing Profile** is a graphical `RemoteViews` field containing the elevation
  profile, recover/hold/push color regions, and current-position marker.

The profile retains the original `live-pacing` type ID so existing page configurations
upgrade to the dedicated graph. Graphical updates are limited to at most one per second and
the profile is rendered to a bitmap. The overlay is Compose-based and always uses
`FLAG_NOT_FOCUSABLE | FLAG_NOT_TOUCHABLE`.

## Safety boundary

Geometry and attempt lifecycle are deterministic. Needle cannot start, select, finish, or
abandon an attempt. AI plans must cover the segment contiguously, use known classifications
and icons, remain at or below 150% of FTP, and pass transition/instruction validation. A
timeout, malformed output, low confidence, or sensor loss retains the last safe plan.
