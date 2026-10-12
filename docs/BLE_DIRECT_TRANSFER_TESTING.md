# Testing the phone's Bluetooth direct transfer (development only)

Contract: `docs/BLE_DIRECT_TRANSFER_CONTRACT.md` (draft v2). Status: phone side implemented behind a development flag on 2026-10-12; the
Karoo side is not implemented. The Wi-Fi/IP send remains the working path and is unchanged. Nothing here uploads anything.

## What the phone does

- Module `modules/gritmap-ble-peripheral` (Swift, CoreBluetooth `CBPeripheralManager`). The serving rules live in
  `TransferSession.swift`, which has no Bluetooth dependency and is unit-tested on a Mac.
- Advertises **only** service `e7a4e868-0a21-45d6-ac63-5812c740ba12` (no local name) for at most 2 minutes, only while the Send screen is
  foregrounded. The first central to read the manifest owns the session and every other central is refused; advertising
  continues for the whole session so that same Karoo can reconnect and resume at its last complete chunk.
- Serves **Manifest** (read), **Request** (write), **Data** (read), **Status** (write). It stops on receipt, 30 s idle (60 s once the plan is fully read, to leave time for the receipt), 10 min total,
  leaving the screen, backgrounding the app, or Stop. The bytes live in memory only and are never logged.
- Wording: Preparing, Waiting for your Karoo, Karoo connected, Sending the plan... n%, then "Imported on your Karoo." only after a
  receipt with `status:"imported"`; "Sent; check your Karoo" if the plan was fully read but no receipt arrived.

## Turning the option on

The "Send over Bluetooth (beta)" card (Send to Karoo screen) is hidden unless: a development client (`__DEV__`), or a local build made with
`EXPO_PUBLIC_GRITMAP_BLE_TRANSFER=1`, or the device setting `dev_ble_transfer` = `1`. EAS/TestFlight builds have none of these.
The segment needs an FTP in the profile and a goal time (or an imported plan) so there is a plan to send.

## Automated checks (no radio)

```bash
npm test                                                     # src/transfer/directTransfer.test.ts
swiftc -parse-as-library -o /tmp/test-transfer-session \
  modules/gritmap-ble-peripheral/ios/TransferSession.swift scripts/test-transfer-session.swift && /tmp/test-transfer-session
```

The TS tests build the manifest and resources from the Karoo's own Diablo fixture and walk the whole protocol with a reference reader (hash
checks, segment skip, tampering, caps, receipt). The Swift test runs the real serving class: chunking, long reads, first-central-wins,
malformed requests, one-shot receipt.

## Manual check with nRF Connect (needs a physical iPhone)

The iOS Simulator has no Bluetooth radio (the card reports "isn't available"), so this needs a real iPhone as the peripheral and a second
device with **nRF Connect for Mobile** (or nRF Connect for Desktop):

1. Build with the flag, e.g. `EXPO_PUBLIC_GRITMAP_BLE_TRANSFER=1 npx expo run:ios --device --configuration Release`.
2. In GritMap: segment, menu, Send to Karoo, **Start Bluetooth send** (allow Bluetooth). Status: "Waiting for your Karoo...".
3. nRF Connect, Scanner: filter by the service UUID. The advertiser appears with name N/A. Connect; expand the service; four characteristics.
4. Read **Manifest** `A9C5876C-...`: UTF-8 JSON, 400-500 bytes: `{"v":2,"transferId":"...","createdAtMs":...,"plan":{"bytes":N,...},...}`.
   The iPhone shows "Karoo connected" (and keeps advertising; a second scanner that tries to read is refused).
5. Write **Request** `59E28123-...` (Text/UTF-8, with response): `{"resource":"plan","offset":0}`. Read **Data** `83E82BA5-...`: the first
   512 bytes of the plan (hex). Repeat with `"offset":512`, `1024`, ... until `offset + length = plan.bytes`. The iPhone shows
   "Sending the plan to your Karoo... n%".
   Resume check: disconnect nRF Connect mid-way and reconnect (the phone is still advertising); it can read the manifest again and
   continue at the next offset. A second device that connects and reads is refused. The phone counts a chunk as read only after its
   last byte went out (nRF Connect issues the Read Blob requests for you), so "Sent" can't appear after a half-read last chunk.
6. Write **Status** `C0BB77AF-...`: `{"transferId":"<id from the manifest>","status":"imported","code":"ok"}`. The iPhone shows
   "Imported on your Karoo." and ends the session. (Write `"status":"rejected","code":"bad_hash"` to see the rejection wording.)
7. Not writing any receipt: after the plan is read and 60 s pass, the iPhone shows "Sent; check your Karoo."

Optional on a Mac (also needs the physical iPhone): `swiftc -o /tmp/fake-karoo scripts/fake-karoo.swift && /tmp/fake-karoo
[--skip-segment] [--receipt imported|rejected]` scans, reads the manifest, walks the chunks, verifies the hashes and writes a receipt, printing
sizes and OK/FAIL only. Untested against a real iPhone as of this commit.

## Known limits and decisions open

- No link-layer encryption (see the contract's threat model); decision for Jason/Codex.
- The Karoo side does not exist yet; `docs/BLE_TRANSFER_CAPSULE_CONTRACT.md` (v1, HTTPS capsule) is superseded by this design.
- A 250 KB segment is about 500 chunk round trips; the real duration on a Karoo is unmeasured.
