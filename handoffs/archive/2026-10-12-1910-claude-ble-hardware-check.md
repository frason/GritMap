# Handoff: BLE direct transfer verified on a real iPhone (phone side); Karoo side and second-device checks still open

- Updated: `2026-10-12 19:10 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `0cb096f docs: coordinator next task for Codex` (no code changed in this milestone)
- Worktree: clean before this handoff; nothing pushed by me

## Outcome

The phone's direct Bluetooth transfer works end to end against a real central. On Jason's iPhone 15 Pro Max
(EAS build 5, profile `production-ble-internal`, TestFlight internal group) a macOS central
(`scripts/fake-karoo.swift`) found the advertiser, read the manifest, walked the plan, segment and rider chunks,
verified every SHA-256, wrote an `imported` receipt, and the phone then showed "Imported on your Karoo." Hand
checks with LightBlue (macOS) confirmed the GATT layout, the manifest, receipt validation, foreground-only
advertising and that advertising continues after a manifest read. No contract mismatch was found. The Karoo
reader is still unimplemented, so nothing here proves the Karoo side.

## Changed

- No source changes. This entry records the hardware results only.

## Verified (all on the real iPhone; central was this MacBook)

| Check | Result | Evidence |
|---|---|---|
| Service advertised only while the Send screen is foregrounded | pass | LightBlue saw the entry while the screen was open; after GritMap was backgrounded it disappeared in about 10 s and the phone showed "Stopped. Bluetooth is no longer being offered." |
| No local name in the advertisement | pass | script: "local name present: false"; LightBlue lists it as unnamed |
| GATT layout | pass | service `E7A4E868-...` with four characteristics matching `A9C5876C`, `59E28123`, `83E82BA5`, `C0BB77AF`; Status shows "Writable with Response" and "Un-readable" |
| Manifest readable and matches what the app built | pass | read twice (two transfers): 475 bytes, exact keys `v, transferId, createdAtMs, segmentFingerprint, chunkBytes, plan, segment, rider`, v 2, chunkBytes 512, all hashes 64 hex; plan 1360 bytes, segment 4792, rider 114; same segment fingerprint both times, plan hash differs per transfer |
| Plan chunks walked to the plan's byte count | pass | script: plan 1360 bytes SHA-256 OK (3 chunks 512+512+336), segment 4792 OK (10 chunks), rider 114 OK |
| Well-formed receipt ends the session with "Imported on your Karoo" | pass | script wrote `{transferId, status: imported, code: ok}`; phone showed "Imported on your Karoo." |
| Bad receipt refused | pass (behaviour) | `imported` receipt with another transfer id (written by hand): phone stayed on "Waiting for your Karoo...". The ATT error text in LightBlue was not captured. |
| Advertising continues after a manifest read | pass | read the manifest, disconnected, the entry was still in the scan list within 30 s |
| Second central refused | **not run on hardware** | needs a different physical device; the script and LightBlue share this Mac's identity, so the phone treats them as one central. Covered only by the Swift session tests. |

Also run: the Swift session tests (66 checks) and the typecheck/test suite at the previous milestone; nothing
changed since.

## Findings

- **30 s idle limit makes hand testing hard.** Stepping through Request then Data by hand in a GUI took longer
  than 30 s and the phone ended the session ("The transfer didn't finish in time"); the Request write itself was
  accepted. The idle timer only starts at the first successful read/request, so a tester can take their time
  until that point. Fine for a Karoo; it is why the script was used for the chunk walk. No change made.
- **Negotiated MTU and per-chunk timings were not recorded.** LightBlue on macOS shows neither, and the script
  prints no timings. The whole 1360 + 4792 + 114 byte transfer completed in well under a second (script run
  finished immediately after the phone was started); a real Karoo, with a slower stack, still needs measuring.
- LightBlue's default write format is hex; JSON requests must be switched to UTF-8 String or typed as hex.
- The phone's "Karoo connected. Starting the transfer..." appeared as designed.

## External state

- Jason's iPhone has TestFlight build 5 (`production-ble-internal`, internal group only) with the Bluetooth
  option visible. A later normal beta build (profile `production`) will not have it.
- Screenshots from the iPhone are with Jason; three LightBlue screenshots exist in the session only (no transfer
  ids; one shows the deliberately wrong id `AAAA...`). None were committed. Jason can place iPhone screenshots in
  `docs/screenshots/ble-direct/` if wanted.
- The earlier local signed device build was cancelled and never installed; its scratch derived data remains in the
  session scratch directory only. The compiled script was `swiftc -o <scratch>/fake-karoo scripts/fake-karoo.swift`.

## Goal alignment

- Serves the phone-to-Karoo handoff without typing an IP address, with no server, account or upload, which is the
  beta's main setup friction. Still dev-flagged (an internal TestFlight profile only); riders see no change.
  `docs/GOALS.md` beta scope is unchanged.
- Shared contract touched: none (`docs/BLE_DIRECT_TRANSFER_CONTRACT.md` unchanged). The phone behaved as the
  contract describes on every check above; the Karoo reader must now be built to it.

## Hazards and blockers

- Hardware-verified only against a macOS central. Android BLE behaviour on the Karoo (MTU 517 request, long
  reads, reconnect, bonding prompts, H10 RR continuity) is unverified.
- Second-central refusal and reconnect-and-resume of a half-read transfer are not hardware-tested.
- Unencrypted link (decision D2). `docs/PRIVACY.md` still needs its one Bluetooth sentence before the flag is
  lifted for riders.

## Next safe action

Codex: implement the Karoo central per `docs/BLE_DIRECT_TRANSFER_CONTRACT.md` (MTU 517, chunk length check,
resume, receipt rules). Then run the second-central and resume checks with a second physical device, record the
negotiated MTU and chunk timings on the Karoo, and lift the flag only after Jason decides.
