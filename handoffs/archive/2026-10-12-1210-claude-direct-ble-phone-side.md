# Handoff: direct Bluetooth send (phone side) and v2 contract draft; Karoo side and device check still to do

- Updated: `2026-10-12 12:10 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `89938ea feat: dev-flagged direct Bluetooth send of plan and segment to the Karoo`
- Worktree: Codex's uncommitted Karoo/doc/handoff files remain untouched and unstaged; nothing pushed

## Outcome

The phone can act as a server-less Bluetooth source for a transfer, behind a development flag. It
advertises the existing service UUID, serves a manifest, the plan (always) and the segment (so the
Karoo can skip it if it already has the fingerprint), and takes a receipt. It says "Imported on your
Karoo" only after a receipt with `status:"imported"`. The Wi-Fi/IP send is unchanged and is still the
default and the only working path end to end: **no Karoo implements v2 yet and no radio-level test
has run on a physical iPhone** (see "Verified").

## Changed

- `2d64df9` `docs/BLE_DIRECT_TRANSFER_CONTRACT.md`: the v2 draft for Codex (new file; Codex's
  uncommitted `docs/BLE_TRANSFER_CAPSULE_CONTRACT.md` is untouched and now superseded).
- `89938ea`:
  - `modules/gritmap-ble-peripheral/`: Expo local module. `TransferSession.swift` (pure Foundation: manifest,
    request, chunked data, receipt, ownership; unit-tested) and `GritMapBlePeripheralModule.swift`
    (CoreBluetooth peripheral, foreground-only, 2 min advertising, 30 s idle, 10 min cap, one central).
  - `src/transfer/`: `directTransfer.ts` (manifest build/validate, chunk and receipt helpers, a
    reference Karoo reader), `transferId.ts`, `bleSendStatus.ts` (state and wording),
    `bleTransferSettings.ts` (dev flag), `directTransfer.test.ts` (16 tests).
  - `src/karoo/buildTransferParts.ts` + `sendGuidancePackageToKaroo.ts`: the segment/plan builders are
    shared by both transports, so the BLE bytes are the bytes the Wi-Fi send uses; Wi-Fi behavior unchanged.
  - `src/screens/BleSendSection.tsx` + a 3-line change in `SendToKarooScreen.tsx`: the
    "Send over Bluetooth (beta)" card, only when `isBleTransferEnabled`.
  - `app.json`, `ios/GritMap/Info.plist`: `NSBluetoothAlwaysUsageDescription` (the only config
    change; no EAS fields). `ios/Podfile.lock`: the local pod. `pod install` must be re-run after
    adding/removing module source files (the pod file list is fixed at install time).
  - `scripts/test-transfer-session.swift`, `scripts/fake-karoo.swift`, `docs/BLE_DIRECT_TRANSFER_TESTING.md`,
    `docs/screenshots/ble-direct/`.
- Dev flag: a development client, or a build with `EXPO_PUBLIC_GRITMAP_BLE_TRANSFER=1`, or the
  `app_settings` row `dev_ble_transfer` = `1`. TestFlight/EAS builds have none, so riders never see it.

## Verified

- `npx tsc --noEmit`: clean. `npm test`: 649 tests, 649 pass, 0 fail (includes 16 new transfer tests built
  from the Karoo's own `Diablo.Northgate-to-Junction.40m30.guidance-package.json` fixture). `npm run
  web:smoke`: exports cleanly. `git diff --check` clean.
- Swift: `swiftc -parse-as-library ... TransferSession.swift scripts/test-transfer-session.swift`: ALL PASSED
  (chunking, long reads by offset, first central wins, malformed requests, one-shot receipt, end).
- Unsigned **Release** simulator build (iPhone 17 Pro, iOS 26.5, fresh `pod install`): BUILD SUCCEEDED
  with the module linked. With `dev_ble_transfer`=1 the card appears on the Send to Karoo screen; Start
  says "Bluetooth sending isn't available on this device." (simulators have no Bluetooth radio):
  `docs/screenshots/ble-direct/send-screen-simulator-unavailable.png`.
- **Not run:** advertising on a physical iPhone, an nRF Connect read of the manifest and plan chunks,
  `scripts/fake-karoo.swift` against a real iPhone, any Karoo-side import. I did not install anything on
  Jason's iPhone (no approval). The procedure is in `docs/BLE_DIRECT_TRANSFER_TESTING.md`; this task's
  "second device reads the manifest and walks the plan chunks" check is therefore **still open**.

## External state

- Nothing installed on any physical device. The simulator build lives only in scratch space.
- Nothing pushed. No credentials, uploads or servers involved. `docs/PRIVACY.md` unchanged (nothing leaves
  the two devices; it does still say the Karoo send is "over your home Wi-Fi"; the Bluetooth option is
  dev-only so the policy is not yet wrong, but it needs a sentence before this ships to riders).
- Bluetooth permission prompt appears the first time Start is tapped on a device.

## Goal alignment

- Serves the phone-to-Karoo handoff without typing a Karoo IP (the beta's main friction) while keeping
  the plan private and local-first: no server, no account, no upload, works with no signal. Dev-flagged, so the
  beta scope in `docs/GOALS.md` is unchanged until Jason decides to expose it.
- Shared contracts: **new** BLE v2 contract (draft). `gritmap-transfer`, segment JSON and
  `baselinePacingPlan` are unchanged: a Karoo assembles the existing package from the resources.
  The Karoo side must act (below).

## What Codex must implement or confirm (Karoo, `apps/karoo/`)

1. Central using the four new characteristic UUIDs (manifest `a9c5876c…`, request `59e28123…`, data
   `83e82ba5…`, status `c0bb77af…`) under service `e7a4e868…`; the v1 token characteristic is not served.
2. Strict manifest parser (exact keys, 22-char transferId, 64-lowercase-hex hashes, caps 128 KiB plan,
   512 KiB segment, 16 KiB rider); reject over-cap before reading.
3. Chunk reader: write `{"resource","offset"}`, read data, advance by the length returned, verify length and
   SHA-256 over the exact bytes before parsing.
4. Skip the segment when `segmentFingerprint` is installed; otherwise read it over BLE (optional HTTPS fetch of
   the Open Segments file when `segment.public`, same hash check). Plan is always BLE.
5. Build the existing `gritmap-transfer` JSON (`packageId` = `transferId`, `riderHistory` when `rider`
   present) and run the unchanged importer.
6. Write the receipt `{transferId,status,code}` after the transaction commits, or `rejected` with a code.
7. **Confirm:** (a) is the optional `rider` resource wanted (the Karoo's strict parser needs a matching
   FTP profile); (b) link-layer encryption yes/no; (c) 512-byte chunks, 30 s inactivity and MTU
   request acceptable on the Karoo BLE stack; (d) no RR dropout when a transfer starts during a live H10 session;
   (e) real duration for a ~150-250 KB segment (about 300-500 round trips); if too slow, prefer the Karoo's
   existing segment or the public URL.

## For Jason (device steps, need his approval)

- Install a Release build with `EXPO_PUBLIC_GRITMAP_BLE_TRANSFER=1` on the iPhone and run the nRF Connect
  check in `docs/BLE_DIRECT_TRANSFER_TESTING.md`; or approve me doing it with the paired iPhone 15 Pro Max.
- Decide: require encryption (adds a pairing prompt) or accept the documented one-shot cleartext risk; add the
  PRIVACY.md sentence before any rider-visible release.

## Hazards and blockers

- The Bluetooth path is unvalidated on hardware: CoreBluetooth behavior (ATT long reads by offset,
  `didReceiveRead` ordering, advertising while foregrounded) is covered only by the pure-session tests.
- First-central-wins: a nearby phone/scanner that reads the manifest first blocks the rider's Karoo for
  that session (the phone shows what happened; no receipt means no "Imported").
- A card on the segment-only Send screen says "plan"; BLE needs an FTP in the profile and a goal or
  imported plan, otherwise it explains that. Not hidden by design.
- `scripts/fake-karoo.swift` is typechecked only.

## Next safe action

Codex: read `docs/BLE_DIRECT_TRANSFER_CONTRACT.md` and reply with the confirmations above (no code
needed yet). Jason or the coordinator: approve the physical-iPhone nRF Connect run so the "second device
reads the manifest and walks the plan chunks" check can be recorded.
