# Phone <-> Karoo pairing and transfer: proposed contract

Status: **proposal for Codex review, nothing on the Karoo is built.** Written 2026-10-05 after
the rider's verdict on the current flow: typing a local IP is "terrible". Phase 0 below is already
done on the phone; Phases 1-4 need Karoo work (Codex's area) and, for 2 and 3, phone native
dependencies (a dev-client rebuild).

## What is wrong today

| Pain | Cause (in code) |
|---|---|
| Retype the Karoo IP every time | phone kept no address (fixed, Phase 0) |
| Raw "Network request failed" when it changed | no friendly error (fixed, Phase 0) |
| Karoo must sit on "Receive from Phone"; times out after 10 min | `HttpSegmentInbox.pending()` is a one-shot listener opened by a button |
| "Received" tells you nothing | the Karoo writes `200 OK` as soon as the body is read (`readHttpPostBody`), then imports; a rejection only appears on the Karoo screen |
| Any device on the Wi-Fi can post a plan to your Karoo | no authentication at all |
| IP changes silently (DHCP) | address is typed, not discovered |
| Phone cannot tell what the Karoo already has | no read path (this caused the "Relize"/"Realize" confusion on 2026-10-05: same-named segments with different routes are separate segments) |

## Goals and non-goals

Goals: pair once, then "Send" just works; nothing to open on the Karoo; only paired phones can
send; the phone learns the real import result; the phone can read what the Karoo has.
Non-goals for v1: confidentiality against a packet sniffer on the same network (the transport stays
plain HTTP; see Security), cloud relay, Bluetooth transport, internet access.

## Phase 0 -- phone only (done)

- `app_settings` table (migration v12). After a transfer succeeds, the phone stores the address in
  canonical `host:port` form (`src/karoo/savedKarooAddress.ts`) and pre-fills it in both send
  screens; a typo never overwrites a good address.
- `describeSendResult` replaces the raw network error with "Couldn't reach <address>. Is the Karoo
  on 'Receive from Phone' and on the same Wi-Fi? Its address may have changed", and send results now
  carry `unreachable` (request attempted, no HTTP answer) separately from validation errors.

## Phase 1 -- persistent receiver, richer responses (Karoo)

1. A receiver that is always available while the extension runs (host it in the existing extension
   process / `LiveSegmentService`; it only needs to listen while Wi-Fi is connected; stop when the
   rider switches "Accept transfers" off). Keep today's one-shot "Receive from Phone" screen as the
   **unauthenticated legacy mode** so old phones keep working; the persistent receiver is
   authenticated only (Phase 2) and answers `401` otherwise.
2. `GET /ping` (unauthenticated, no side effects -- safe to call because the listener is persistent):
   ```json
   { "app": "gritmap-karoo", "karooId": "16 hex chars, generated once",
     "name": "Karoo 3", "transferSchema": 1, "appVersion": "0.10.35", "paired": true,
     "capabilities": ["transfer-v1"], "serverTimeMs": 1790000000000 }
   ```
   `capabilities` is the handshake `docs/COACH_PLAN_CONTRACT.md` asks for: add
   `"generator-types-v2"` and `"rider-profile-version"` when those land, and the phone will only send
   the richer fields to a Karoo that lists them.
3. `POST /transfer` responds **after** import with the real outcome, not on receipt:
   `200 {"status":"imported","segmentName":"Realize","segmentWasNew":true,"riderProfileUpdated":true,
   "baselinePlanUpdated":true}` or `422 {"status":"rejected","error":"Baseline plan does not cover
   the complete segment distance"}`. Same body-size limit (1 MB). The phone shows "Imported on Karoo"
   or the rejection reason instead of "check the Karoo screen".
4. `GET /segments` (authenticated) so the phone can warn before sending:
   ```json
   { "segments": [ { "id": "relize", "name": "Relize", "fingerprint": "22e204bc...",
                     "lengthMeters": 1906.7, "plan": { "source": "manual",
                     "generatorModelVersion": "ftp-terrain-v1", "createdAtMs": 1787400344000,
                     "zones": 3 } } ] }
   ```
   This lets the phone say "the Karoo has 'Relize' (1,907 m); your 'Realize' (1,796 m) is a different
   route and will be added as a new segment".

## Phase 2 -- QR pairing with signed requests (Karoo + phone camera)

**Pairing.** In GritMap on the Karoo: *Pair a phone* shows a QR code (valid 10 minutes, one use per
phone). Payload:
```
gritmap://pair?v=1&h=192.168.7.50&p=8734&id=<karooId>&n=<url-encoded name>&k=<base64url, 32 random bytes>
```
`k` exists only on the Karoo screen and in the QR -- an out-of-band channel (line of sight), never on
the network. Both sides derive the shared secret locally:
`secret = HMAC-SHA256(key = k, message = "gritmap-pairing-v1|" + karooId)`. No pairing round trip is
needed: the Karoo completes the pairing on the first valid signed request, recording
`{keyId, secret, phoneLabel (from header, optional), createdAtMs, lastUsedAtMs}` and discarding `k`.
Several phones may be paired. The Karoo lists paired phones with *Remove*.

**Signed requests** (every authenticated endpoint):
```
X-GritMap-Key-Id:    hex(first 8 bytes of SHA-256(secret))
X-GritMap-Timestamp: unix milliseconds
X-GritMap-Nonce:     16 random bytes, hex
X-GritMap-Signature: base64( HMAC-SHA256(secret,
                       METHOD + "\n" + PATH + "\n" + timestamp + "\n" + nonce + "\n" + hex(SHA-256(body))) )
```
The Karoo checks: key id known; `|now - timestamp| <= 10 min`; nonce not seen in that window (keep
the last ~256); signature equal in constant time. Failures return `401` with
`{"error":"unpaired" | "bad_signature" | "stale_timestamp" | "replay", "serverTimeMs": ...}`; the phone
turns `stale_timestamp` into "Your Karoo's clock differs from your phone's by N minutes". The old
unsigned `POST /transfer` stays accepted **only** while the legacy receive screen is open.

Phone requirements (mine, after the Karoo side exists): `expo-camera` for scanning (native; adds an
iOS `NSCameraUsageDescription`), HMAC-SHA256 built on `expo-crypto`'s digest (already installed), the
secret in `expo-secure-store` (Keychain), pairing list screen, signed `fetch` wrapper, manual-address
fallback kept.

## Phase 3 -- discovery for IP changes (optional)

The Karoo registers an NSD service `_gritmap-karoo._tcp` (name = `karooId`, TXT `v=1`). After pairing,
the phone browses for that service and updates the stored host:port by `karooId` -- no retyping and no
re-scan when the router hands out a new address. Re-scanning the QR remains the fallback. Phone side
needs a Bonjour/NSD module (native), and on iOS `NSLocalNetworkUsageDescription` plus
`NSBonjourServices` = `_gritmap-karoo._tcp` in the app config. Not required for Phases 1-2.

## Phase 4 -- uses of the read path

- Duplicate-segment warning before sending (point 4 above).
- Show "installed on Karoo / plan source / sent at" on the segment screen.
- Later: pull rides or attempt summaries from the Karoo through the same authenticated channel.

## Security notes

- Threat model: another device on the same Wi-Fi posting or replaying transfers, or reading the segment
  list. HMAC with a QR-delivered secret prevents that; replay is bounded by timestamp + nonce, and
  transfers are idempotent by segment fingerprint anyway (a replayed *plan* could still overwrite a
  newer baseline within the 10-minute window, which the nonce cache closes).
- Not covered: eavesdropping. Bodies (route, FTP, weight) cross the LAN in clear text. If that matters,
  add AES-GCM with a key derived from `secret` (HKDF, info `"gritmap-transfer-enc-v1"`); it needs a
  crypto module on the phone beyond `expo-crypto`, so it is deliberately deferred.
- Bind the receiver to the Wi-Fi interface only; refuse requests from non-private addresses; rate-limit
  failed auth per source address; never log `k`, the secret or signatures.
- Secrets live in app-private Karoo storage (the app already sets `allowBackup=false` and excludes all
  backup/transfer domains) and in the iOS Keychain on the phone.
- Revocation: *Remove* on the Karoo deletes the secret; the phone shows "Not paired" on the next 401.

## Assumptions to verify on the device (not verified by me)

- A foreground/extension-process listener survives Karoo ride mode and screen-off long enough to be
  useful, and does not measurably hurt battery. If not, tie the listener to Wi-Fi-connected events or a
  rider toggle.
- Android NSD (`NsdManager.registerService`) works for a sideloaded app on Karoo's Android build.
- A QR of ~170 characters is comfortably scannable on the Karoo's screen at default brightness.
- The Karoo clock is accurate enough for a +/-10 minute window (it should be, from GPS/network time).
- The rider's phone is an iPhone (assumed from the project setup); everything above also works for an
  Android phone, with its own permission prompts.

## Suggested order

1. Phase 1 items 2-3 (`/ping`, import result in the response) -- small, and immediately removes the
   "received but did it import?" guessing. The phone can use them the same day.
2. Persistent receiver + Phase 2 pairing together (a persistent unauthenticated listener would be
   a regression).
3. Phase 1 item 4 + Phase 4 once pairing exists.
4. Phase 3 only if re-scanning after an IP change proves annoying in practice.
