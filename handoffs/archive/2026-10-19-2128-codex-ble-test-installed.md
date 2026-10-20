# Handoff: Bluetooth test build installed on Jason’s Karoo

- Updated: `2026-10-19 21:28 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a915233 docs: coordinator next task for Codex`
- Worktree: only this handoff and `handoffs/LATEST.md` changed; no source edits.

## Outcome

Installed `0.10.44-ble1` / versionCode 68 in place on the USB-connected Karoo 3. Bluetooth Inbox is available. Physical transfer tests remain open.

## Changed

- No implementation changes or new commits. Updated handoff documents only.

## Verified

- APK SHA-256: `1a166ae026ee42743215eccb18818d9b1fe73d43fc16306645f1bbc038f29b92`.
- `apksigner verify --print-certs`: beta certificate SHA-256 `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`.
- `adb install -r`: Success. `dumpsys package`: versionName `0.10.44-ble1`, versionCode 68.
- First install timestamp `2026-10-09 13:18:34` and ceDataInode `109481` unchanged.
- UI before/after: `1 installed · 1 ready`; existing segment and pacing plan retained.
- Settings UI text identical before/after; rider profile and enabled location retained.
- MainActivity cold launch succeeded in 762 ms; crash log buffer empty.
- Inbox shows Bluetooth transfer description, Receive from Phone, Ready.
- No build/unit tests rerun: existing prepared APK installed. No physical BLE transfer or H10 continuity test run.

## External state

- Device serial `00442GA241760203`, model `k24`, connected by USB.
- APK `/Users/frason/Downloads/gritmap-karoo-0.10.44-ble1.apk`.
- Device left on GritMap Inbox, Ready; receiver not started.
- No uninstall, data clear, release, tag, or push performed.

## Goal alignment

- Serves dev-gated direct Bluetooth sharing in `docs/GOALS.md`; public beta IP route remains available.
- No shared contract changed; phone must advertise from its Bluetooth send screen for physical testing.

## Hazards and blockers

- This is a development test build. Next public Karoo release needs versionCode >=69.
- Existing/missing segment receipts, negotiated MTU, timings, reconnects, and H10 RR continuity remain unverified on the physical pair.

## Next safe action

With Jason, open the phone Bluetooth send screen for the segment already installed, then tap Receive from Phone on Karoo and record receipt, MTU, duration, and reconnects. Follow with a missing segment and H10 coexistence test.
