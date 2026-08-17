# GritMap Transfer Package v1

The transfer package is the boundary between a companion phone (or another trusted package
producer) and the offline Karoo application. Transport is not part of the contract. ADB,
Android file transfer, a future local HTTP/Bluetooth transport, or a cloud relay may all
deliver the same UTF-8 JSON document to the Karoo inbox.

Import is atomic: segment geography, rider history, and a baseline pacing plan either all
validate and commit, or none of them do. Deterministic matching remains authoritative after
import; a transferred plan cannot start, select, complete, or abandon an attempt.

## Envelope

```json
{
  "schemaVersion": 1,
  "packageType": "gritmap-transfer",
  "packageId": "phone-export-2026-08-17T18:22:00Z",
  "createdAtMs": 1786990920000,
  "segment": { "...": "portable segment JSON v1" },
  "riderHistory": { "...": "rider-history JSON v1" },
  "baselinePacingPlan": {
    "schemaVersion": 1,
    "id": "plan-coco-jumbo-2026-08-17",
    "segmentFingerprint": "64-lowercase-or-uppercase-hex-characters",
    "createdAtMs": 1786990920000,
    "generator": {
      "type": "phone-ai",
      "modelVersion": "example-model-1"
    },
    "ftpWatts": 250,
    "targetFinishTimeSeconds": 720,
    "zones": [
      {
        "startDistanceMeters": 0.0,
        "endDistanceMeters": 500.0,
        "targetPowerWatts": 235,
        "classification": "HOLD",
        "icon": "STEADY",
        "instruction": "Settle into the climb"
      }
    ]
  }
}
```

At least one of `segment`, `riderHistory`, or `baselinePacingPlan` is required. Unknown
properties are rejected so producer/consumer version drift fails visibly.

## Baseline plan rules

- `generator.type` is `phone-ai`, `cloud-ai`, or `manual`.
- `segmentFingerprint` must match the canonical fingerprint of the packaged or already
  installed immutable segment.
- A pacing plan requires an installed rider profile, and `ftpWatts` must match it.
- Zones must be contiguous, non-overlapping, finite, start at zero, and cover the complete
  segment distance.
- Targets must be between zero and 150% of FTP. Known classification/icon values,
  transition limits, and instruction-length limits are enforced by the shared AI validator.
- Importing a new baseline for a segment atomically replaces its previous baseline. Live
  adaptations remain separate runtime plans.

## Deduplication and conflicts

Segment identity is its canonical SHA-256 fingerprint, not its display name or source ID.
An exact fingerprint is idempotent and does not duplicate points. Reusing an existing ID for
different geography is a conflict. Invalid or unsafe packages never partially update the
database.

## Current Karoo inbox

Place `.json` files in:

```text
/sdcard/Android/data/com.gritmap.karoo/files/imports/packages/
```

The launcher processes all pending files when **Import Segment JSON** is pressed. Accepted
and duplicate documents move to `imports/processed`; rejected documents move to
`imports/failed` with a sibling error report. File reads and Room transactions run off the
main thread.
