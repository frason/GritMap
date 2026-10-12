# BLE transfer capsule contract

Status: Karoo receiver implemented; phone advertiser and transfer service are not yet implemented.

This is the post-beta, no-address transport for sending a public segment and private pacing plan
from the GritMap phone app to the Karoo. The existing local HTTP receiver remains available as a
fallback. The BLE layer carries only a short, one-time capability token; the Karoo downloads the
larger resources over HTTPS.

## BLE discovery

- Service UUID: `e7a4e868-0a21-45d6-ac63-5812c740ba12`
- Read characteristic UUID: `58fc915a-a32c-42c1-babd-fa58123409d7`
- The iPhone acts as the BLE peripheral and advertises only the service UUID.
- The rider opens GritMap's Inbox and taps **Receive from Phone**. The Karoo then acts as the
  central and starts a foreground, filtered scan for at most two minutes.
- Because the receive window is explicit and bounded, it uses low-latency scan mode for a quick
  handoff. Scanning stops before the Karoo opens GATT, reads the characteristic, and disconnects.
- Karoo Bluetooth access is requested when the receive session starts and released on success,
  timeout, cancellation, or error. The extension does not scan continuously in the background.
- Do not Bluetooth-bond or retain the iPhone's BLE address. iOS rotates private addresses.

The characteristic contains compact UTF-8 JSON:

```json
{"v":1,"t":"X7kP3m9Qw2AbCd4Ef6Gh8J"}
```

`t` is exactly 22 unpadded base64url characters encoding 128 random bits. The serialized example
is 36 UTF-8 bytes. Tokens are bearer capabilities and must never be logged.

## Capsule retrieval

The Karoo requests:

```text
GET https://gritmap.app/t/{token}
Accept: application/json
```

The response is capped at 16 KiB and must be:

```json
{
  "schemaVersion": 1,
  "capsuleType": "gritmap-transfer-capsule",
  "packageId": "opaque-id",
  "createdAtMs": 1791570000000,
  "expiresAtMs": 1791570600000,
  "segment": {
    "url": "https://public.example/segments/fingerprint.json",
    "sha256": "64 lowercase hex characters"
  },
  "plan": {
    "url": "https://private.example/one-time-plan",
    "sha256": "64 lowercase hex characters"
  }
}
```

- Unknown fields fail closed.
- Both resource URLs must use HTTPS, contain no user-info, and be at most 2,048 characters.
- `expiresAtMs` must be later than the Karoo clock and no more than 15 minutes after
  `createdAtMs`.
- The service should expire a capsule after ten minutes and consume it after one successful plan
  response. The Karoo accepts a maximum lifetime of 15 minutes only to allow small clock skew.
- Redirects are not followed. If the service uses object storage, the manifest must contain the
  final HTTPS URL.
- Segment responses are capped at 512 KiB; plan responses at 128 KiB.
- The Karoo verifies SHA-256 over the exact response bytes before parsing either document.

The segment response is the existing portable segment JSON object. The plan response is the
existing `baselinePacingPlan` JSON object. The Karoo combines them with the capsule metadata into
the existing `gritmap-transfer` package and passes that package through the existing strict parser,
fingerprint checks, plan validation, and one-transaction database import.

The private plan URL is itself a bearer capability. It must be short-lived and one-use, must not
appear in logs, and should return `Cache-Control: no-store`. A later protocol revision may carry an
AES-GCM key over BLE and store only ciphertext; version 1 relies on TLS plus short-lived,
high-entropy capabilities.

## Completion receipt

Reading the BLE characteristic means only that the Karoo obtained the token, not that import
succeeded. The transfer service should expose status keyed by the token so the phone can poll for
`fetching`, `imported`, or a bounded rejection code. The Karoo status callback is deliberately not
part of schema version 1 yet; do not make the phone report success merely because the BLE read
completed.

## Operational constraints

- The iPhone must remain foregrounded while advertising; iOS does not reliably expose the full
  custom service advertisement to a non-Apple central after the app backgrounds.
- Both devices require internet access for the capsule path. The local HTTP receiver remains the
  offline fallback until a chunked direct-BLE package protocol exists.
- GritMap requests Bluetooth through `karoo-ext` only for the user-triggered receive session and
  releases it in every exit path. This sharply limits contention with the separately managed H10
  connection. Physical validation should still confirm that initiating a transfer during a live
  H10 session does not cause an RR dropout.
- The main Inbox action is the bounded BLE receiver. The address-based HTTP receiver remains
  visible as **Legacy Wi-Fi Receive** for beta recovery and offline/local-network transfers.
