# BLE direct transfer contract (v2): DRAFT for Codex review

Status: **reviewed and implemented behind development flags, awaiting physical Karoo verification** (2026-10-12; see
`docs/BLE_DIRECT_TRANSFER_REVIEW.md`; Jason's decisions D1: keep `rider`, D2: no link encryption in v2). The phone fixes P1 to P4 from that
review are implemented. The phone advertiser/manifest/chunks/receipt and the Karoo central reader are both implemented behind development
flags. This replaces the capsule/HTTPS design in
`docs/BLE_TRANSFER_CAPSULE_CONTRACT.md` (v1, Karoo receiver only, left untouched): **no server, no domain, no uploads.** The Wi-Fi/IP send
(`gritmap-transfer` over HTTP) stays the working path and is unchanged.

Why: the pacing plan is ~3 KB and private; the segment is ~15 to 250 KB and public. Direct BLE works with no signal, needs no hosting, and
keeps `docs/PRIVACY.md` true (nothing leaves the two devices).

## Roles and window

- The iPhone is the BLE **peripheral** (GATT server) and advertises **only** the service UUID `e7a4e868-0a21-45d6-ac63-5812c740ba12`
  (no local name, no manufacturer data), only while the Send screen is foregrounded.
- The Karoo is the **central**. The rider taps Inbox, **Receive from Phone**; the Karoo scans (filtered by the service UUID) for at most
  2 minutes, connects, runs the exchange below, and disconnects. No bonding, no stored phone address (iOS rotates addresses).
- **Advertising window:** discovery is limited to 2 minutes from Start. Once a central reads the manifest, it owns the session (the first
  central to read the manifest or write a request; others are refused). The phone **keeps advertising for the rest of the session**, so the
  owning Karoo can reconnect after a dropped link and **resume from its last complete chunk** (requests are offset-based). The Karoo retries a
  dropped connection up to 3 times within the 30 s inactivity window. (Review R3 / phone fix P2.)
- **Session limits:** the session ends on a receipt write, 30 s without any request or read, 10 minutes in total, the phone leaving the
  foreground, or the rider tapping Stop. Once the plan is fully served, the phone waits up to **60 s** for the receipt before ending with
  "Sent; check your Karoo" (review R3 / phone fix P3). The phone forgets the bytes and the transfer id on every exit.

## GATT layout

Service `e7a4e868-0a21-45d6-ac63-5812c740ba12` (unchanged from v1). **New characteristics**: the v1 token characteristic
(`58fc915a-a32c-42c1-babd-fa58123409d7`) is not served, so a v1-only Karoo finds no matching characteristic and reports "unsupported", rather
than mis-parsing a v2 document.

| Name | UUID | Properties | Value |
|---|---|---|---|
| Manifest | `a9c5876c-8f5f-48be-aae7-eb47ef573c41` | read | compact UTF-8 JSON, at most 512 bytes |
| Request | `59e28123-c142-4b89-acba-57d76e483b72` | write (with response) | `{"resource":"plan"\|"segment"\|"rider","offset":N}`, at most 64 bytes |
| Data | `83e82ba5-a7f4-47c5-bf6c-6473178bef68` | read | up to 512 bytes of the last requested resource |
| Status | `c0bb77af-3bd8-4c60-b669-91ac74c778b9` | write (with response) | the receipt JSON, at most 128 bytes |

A long read (Read + Read Blob) is used for values longer than the ATT MTU; the phone answers by value offset (`request.offset` in
CoreBluetooth). Android's `readCharacteristic` performs the long read internally.

- **Logical chunk length.** The Data value for a request at `offset` is exactly `min(chunkBytes, bytes - offset)` bytes. The Karoo knows this
  from the manifest and must treat a shorter value as an error and retry, never as end of data.
- **MTU.** The Karoo **must** request MTU 517 (`requestMtu(517)`) before reading. The plan (a few KB) is fine at any MTU. At the default MTU
  of 23 a 250 KiB segment needs over 12,000 round trips (about 7 to 15 minutes, more than the session cap). So if the negotiated MTU is below
  185 and the segment is needed, the Karoo prefers the Open Segments fetch when `segment.public` is set and it has internet. Otherwise it
  reads over BLE while showing progress. At MTU 247 or more, a 250 KiB segment takes roughly 1 to 2 minutes.
- **ATT errors the Karoo can expect:** `readNotPermitted` / `writeNotPermitted` (not the owner, session ended, malformed or out-of-range
  request), `attributeNotFound` (no session), `invalidOffset` (value offset past the end; phone fix P4).

## Manifest

```json
{"v":2,"transferId":"X7kP3m9Qw2AbCd4Ef6Gh8J","createdAtMs":1791570000000,"segmentFingerprint":"<64 lowercase hex>",
 "chunkBytes":512,
 "plan":{"bytes":3104,"sha256":"<64 lowercase hex>"},
 "segment":{"bytes":152345,"sha256":"<64 lowercase hex>","public":true},
 "rider":{"bytes":212,"sha256":"<64 lowercase hex>"}}
```

- Exactly these keys at the top level (`rider` is the only optional one, see below). Unknown keys fail closed. Compact JSON, no whitespace;
  serialised size is at most 512 bytes (about 480 to 495 with every field).
- `transferId`: exactly 22 unpadded base64url characters encoding 128 random bits from a CSPRNG, one use. It is the package id and the receipt key.
  It is a capability only in the sense that the receipt must echo it; the manifest is readable by whoever reads first (see Threat model).
- `createdAtMs`: phone clock, positive integer.
- `segmentFingerprint`: the segment's fingerprint (equals the plan's `segmentFingerprint` and the segment JSON's `fingerprint`).
- `chunkBytes`: 512 (the ATT attribute maximum). A Karoo may accept any value from 20 to 512.
- `plan` / `segment` / `rider`: `bytes` is the exact byte length, `sha256` the lowercase hex SHA-256 **over the exact bytes** the phone serves
  (the compact `JSON.stringify` UTF-8 of the object; never re-serialised on the Karoo before hashing).
- `segment.public` (optional, only ever `true`): the segment is published in Open Segments. The URL is not carried (the manifest has no
  room for it, about 477 of 512 bytes are used before it); it is the fixed convention
  `https://raw.githubusercontent.com/frason/GritMap/main/registry/segments/<segmentFingerprint>.json`. The phone sets it only when it
  knows the segment is published; in the beta it is normally absent.
- **Caps** (reusing the capsule limits): plan at most **128 KiB**, segment at most **512 KiB**, rider at most **16 KiB**. The phone refuses to
  advertise a transfer over a cap; the Karoo must reject a manifest over a cap before reading.
- `rider` (optional; **kept**, decision D1) is the same `riderHistory` object the Wi-Fi send includes (FTP, weight, max heart rate). It is included so a plan sent
  here is accepted exactly like the Wi-Fi one (the Karoo's strict parser requires an installed profile whose FTP matches the plan's). If
  absent, the Karoo imports the plan against its existing profile.

## Chunked read

1. Karoo reads **Manifest**; validates it (strict keys, caps, hashes are 64 lowercase hex, `v` is 2, `transferId` pattern).
2. For each resource it needs, repeat until `offset == bytes`:
   write **Request** `{"resource":"plan","offset":0}`; read **Data**. The phone returns
   `bytes[offset ..< min(offset + chunkBytes, bytes)]` (1 to `chunkBytes` bytes) for the **last** request. Reading Data before any request,
   or after a rejected request, fails with an ATT error. A request with `offset >= bytes`, an unknown resource, a resource the manifest does not list, or a malformed
   body is rejected with an ATT write error. Any `offset` below `bytes` is accepted (the Karoo may re-request a chunk to retry).
3. Verify the reassembled bytes: length equals `bytes` and SHA-256 equals `sha256`, **before** parsing anything. Mismatch means abort and
   write a `rejected` receipt with code `bad_hash`.
4. **The Karoo skips the segment** (never requests it) when it already has `segmentFingerprint`. If it does not have it: read it over BLE
   as above, **or**, if the manifest has `segment.public` and the Karoo has internet, fetch the Open Segments file for `segmentFingerprint` (HTTPS,
   no redirects, cap 512 KiB) and verify the same `sha256` and `bytes`. The plan is always read over BLE.
5. Karoo builds the existing package and imports it through the unchanged strict parser, fingerprint checks, plan validation and
   one-transaction import:

```json
{"schemaVersion":1,"packageType":"gritmap-transfer","packageId":"<transferId>","createdAtMs":<createdAtMs>,
 "segment":<parsed segment bytes>,"riderHistory":<parsed rider bytes, if present>,"baselinePacingPlan":<parsed plan bytes>}
```

   If the segment was skipped (already installed), omit `segment`; the existing `baselinePacingPlan` validation looks it up by fingerprint.

## Receipt

After import (or rejection) the Karoo writes **Status** (with response):

```json
{"transferId":"X7kP3m9Qw2AbCd4Ef6Gh8J","status":"imported","code":"ok"}
```

- `status`: `imported` or `rejected`. `code`: 1 to 32 characters `[a-z0-9_]`. Defined codes: `ok`, `ok_segment_existing`; for `rejected`:
  `bad_hash`, `bad_segment`, `bad_plan`, `fingerprint_mismatch`, `ftp_mismatch`, `too_large`, `storage`, `timeout`, `cancelled`,
  `unsupported_version`, `other`. The phone shows rider text for known codes and a generic message for unknown ones.
- The phone accepts a receipt only from the session's central, only once, and only with the matching `transferId`. If the Karoo retries a
  receipt write because a response was lost and gets `writeNotPermitted`, it treats the receipt as delivered and does not retry again.
- The Karoo writes the receipt **within 30 s of its last read**; if the import can't finish in that time, it writes `rejected` with code `timeout`.
- **Only a receipt with `status:"imported"` allows the phone to say "Imported on your Karoo".** A transfer that has not received a receipt shows
  "Sent; check your Karoo". The Karoo should write the receipt after the transaction commits, and may write `rejected` early on any
  validation failure.

## Threat model (honest limits of v2)

- Link-layer encryption is **not** required (no bonding, no characteristic encryption permissions): the plan (watts per section, FTP) and
  the segment travel in the clear within Bluetooth range (about 10 m) during a window of at most 2 minutes plus the session. Mitigations:
  one-shot, first-central-owns-the-session, a window that closes as soon as the Karoo reads, a 128-bit `transferId`, hashes that make
  tampering detectable by the Karoo. The segment is public data; the plan is low-sensitivity but private. **Decided (D2, Jason 2026-10-12): no link
  encryption in v2.** `docs/PRIVACY.md` will state this in one sentence before the feature is visible to riders. Revisit after the beta
  ("Just Works" LE Secure Connections would add a pairing prompt on the Karoo).
- A nearby central that reads the manifest first takes the session, so the rider's Karoo would find nothing to connect to. The phone
  shows the steps that actually happened (Karoo connected, plan sent n of m, receipt) so the rider can tell the difference from a
  successful transfer: no receipt means "Sent; check your Karoo" at best.
- A malicious central cannot make the Karoo import anything: the Karoo verifies hashes and the strict parser; it is the *phone* that
  serves, and the Karoo chooses whom to connect to by service UUID.

## What the phone shows

Plain status text only: Preparing; Waiting for your Karoo (open GritMap, then Inbox, then Receive from Phone); Karoo connected; Sending the
plan (n of m); then either **"Imported on your Karoo"** (receipt `imported`), **"Your Karoo couldn't use this transfer"** with the code mapped
to words (receipt `rejected`), or **"Sent; check your Karoo"** when the plan was fully read but no receipt arrived within 60 s. Timeouts say so.

## What Codex must implement / confirm

1. Karoo central using the four characteristic UUIDs above (replace the v1 token read); filtered scan for the service UUID, 2 minutes, MTU request.
2. Strict manifest parser with the keys, patterns and caps above; reject over-cap before reading.
3. Chunk reader exactly as defined (write Request, read Data, offsets, end condition), hash verification over exact bytes before parsing.
4. Skip the segment when the fingerprint is installed; optional HTTPS fetch of the Open Segments file when `segment.public`; plan always over BLE.
5. Build the existing `gritmap-transfer` JSON (with `riderHistory` when `rider` is present) and call the existing importer unchanged.
6. Write the Status receipt with the codes above after commit (or on rejection).
7. Also implement: MTU 517 request, the logical-chunk length check, reconnect and resume (up to 3 retries), and the receipt rules (within 30 s;
   `writeNotPermitted` on a retry means delivered). Resolved: `rider` is kept (D1); no link encryption (D2). Still to confirm
   physically: chunk size 512 and the 30 s inactivity limit on the Karoo's stack, the reconnect behaviour, and RR continuity during a live H10 session.

Reference vectors: `src/transfer/directTransfer.test.ts` builds a manifest, resources and receipts from the Karoo's own
`Diablo.Northgate-to-Junction.40m30.guidance-package.json` fixture and walks the chunk protocol with an in-memory reference reader.
