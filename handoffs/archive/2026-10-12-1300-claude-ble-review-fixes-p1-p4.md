# Handoff: BLE direct transfer review fixes P1 to P4 (phone side); physical test still waits on Jason

- Updated: `2026-10-12 13:00 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `0c02937 fix: BLE direct transfer phone fixes P1-P4 from the contract review`
- Worktree: Codex's uncommitted Karoo/doc/handoff files remain untouched and unstaged; nothing pushed

## Outcome

The four phone fixes from `docs/BLE_DIRECT_TRANSFER_REVIEW.md` are in. No wire-format change: the Karoo
contract (commit `947e9fb`, decisions D1 keep `rider`, D2 no link encryption) is unchanged apart from two status
wordings. Still no physical-device run; the iPhone test needs Jason's go-ahead.

## Changed (`0c02937`)

- `modules/gritmap-ble-peripheral/ios/TransferSession.swift` (pure logic, unit-tested on a Mac):
  - **P1.** `readData(..., maxResponseBytes:)`: a chunk counts as served (and `planFullyServed()` /
    the `progress` event fire) only when a read's value offset plus the bytes one ATT response can carry
    reaches the chunk end, **or** the Karoo issues the next Request / writes the receipt after reading it.
    Building the response at value offset 0 no longer counts. One `progress` event per completed chunk.
    The module passes `central.maximumUpdateValueLength + 2` (MTU - 1) as the limit.
  - **P2.** Ownership is by central identifier and unchanged: the owner can re-read the manifest and
    re-request any offset after a reconnect; any other central is refused. In the module the phone no
    longer stops advertising at the first manifest read; the 2-minute discovery timer is cancelled at
    that read, advertising continues until the session ends (receipt, 30/60 s idle, 10 min cap, Stop,
    background).
  - **P3.** `idleLimitSeconds()`: 30 s, and 60 s once the plan is fully served. `idleOutcome()` gives
    `sentUnconfirmed` if the plan was served, else `timedOut`; the 10-minute cap uses it too. The timer
    restarts on every successful owner read or request.
  - **P4.** `readManifest(valueOffset:)` and `readData` answer `.invalidOffset` (ATT invalid offset) for
    a value offset past the end; an offset exactly at the end is an empty success (final blob). `startTransfer`
    now calls `TransferSession.manifestMismatch`, which checks that every listed resource's byte count and
    SHA-256 match the bytes, and that no resource is given that the manifest does not list; a mismatch throws
    before anything advertises.
- `modules/gritmap-ble-peripheral/ios/GritMapBlePeripheralModule.swift`: wiring of the above.
- `scripts/test-transfer-session.swift`: 66 checks, the new ones tagged P1 to P4.
- `docs/BLE_DIRECT_TRANSFER_CONTRACT.md`: status line ("P1 to P4 implemented"), receipt wait "within 60 s".
  `docs/BLE_DIRECT_TRANSFER_TESTING.md`: advertising continues, 60 s, a resume/second-scanner check.

## Verified

- `swiftc -parse-as-library ... TransferSession.swift scripts/test-transfer-session.swift`: ALL PASSED
  (66 checks). P1 uses an MTU of 101: the last plan chunk is not "served" after the first truncated part and
  is after the final blob read; next-Request and receipt settle; an unread request does not count. P2: owner
  re-reads the manifest and resumes at a later offset, a different central is refused manifest, request and data.
  P3: 30 s then 60 s, `timedOut` vs `sentUnconfirmed`. P4: invalidOffset on both reads, empty success at the end,
  and six manifest-mismatch cases.
- Unsigned Release simulator build with the changed module (no new files, so no `pod install`): BUILD SUCCEEDED.
- `npx tsc --noEmit` clean. `npm test`: 649 tests, 648 pass; the one failure was the known timing assertion in
  `src/import/batchImport.test.ts` (63 s vs 30 s) with the machine at load average ~180 from other sessions'
  simulators; run alone it passes (14.8 s). `npm run web:smoke` exports cleanly. `git diff --check` clean.
- **Not run:** anything on a physical iPhone (advertising while foregrounded, a second device reading the manifest and
  walking the plan chunks, reconnect/resume, central-identifier stability across a reconnect, the ATT truncation
  behavior that P1 assumes); `scripts/fake-karoo.swift` against a real iPhone.

## External state

- Nothing installed on any physical device. Nothing pushed. No credentials, servers or uploads.
- `docs/PRIVACY.md` is unchanged on purpose. **Add one sentence when the dev flag is lifted** (not before):
  "Send over Bluetooth hands the segment and plan directly from your iPhone to your Karoo over a short-range,
  unencrypted Bluetooth link while both screens are open; it does not use any server." Wording to be checked
  against the final behavior at that time.

## Goal alignment

- Same as the previous entry: the phone-to-Karoo handoff without typing an IP, no server, local-first. These
  fixes make the dev-flagged path honest ("Sent; check your Karoo" can no longer appear before the Karoo has the
  last bytes) and recoverable (reconnect and resume), which the review judged necessary before the first
  physical test. The beta scope in `docs/GOALS.md` is unchanged: the option stays hidden from riders.
- Shared contract touched: none on the wire. Codex's Karoo reader needs the contract's updated rules (MTU 517,
  logical-chunk length check, resume, receipt within 30 s and `writeNotPermitted` on a retry means delivered).

## Hazards and blockers

- P1 relies on CoreBluetooth truncating a Data response to MTU - 1 and `maximumUpdateValueLength + 2` being that
  limit. If a real iPhone/central combination truncates differently, a chunk completes later (the next-Request/
  receipt rules still settle it) rather than earlier; confirm on hardware.
- Continuing to advertise after the manifest read means a nearby scanner can see the service for the rest of the
  session (at most 10 minutes) but cannot read anything; confirm that iOS actually keeps advertising while a
  central is connected.
- The whole transfer is still cleartext (D2). The first-central-wins denial-of-service remains.
- `batchImport.test.ts` is load-sensitive: a red full run under heavy machine load is not necessarily a regression.

## Next safe action

Jason or the coordinator: approve installing a flagged Release build (`EXPO_PUBLIC_GRITMAP_BLE_TRANSFER=1`) on the
paired iPhone 15 Pro Max, then run `docs/BLE_DIRECT_TRANSFER_TESTING.md` with nRF Connect (manifest read, plan chunk
walk, resume after a disconnect, a second scanner refused, receipt wording). Codex: implement the Karoo reader
against the updated contract.
