# GritMap Karoo 0.10.45 Bluetooth beta

For Karoo3: **0.10.45-bluetooth-beta / versionCode73**. GritMap needs a power meter and a heart-rate monitor.
Use the matching Bluetooth-enabled GritMap iPhone beta (phone build8 enables Bluetooth; build7 hides it).

## Send before your ride

Open **GritMap > Inbox > Receive from Phone** on the Karoo, allow Bluetooth/Nearby devices,
and keep the phone app open while sending. The Karoo shows **WAITING FOR PHONE**, **Cancel Receiving**,
and **Bluetooth closes automatically after 2 minutes**. Two minutes is the discovery window;
a connected transfer has a separate bounded window. Send before starting a ride recording.
An installed segment is skipped while its plan is updated. **Legacy Wi-Fi Receive** remains the fallback.

## Known gaps

- Bluetooth currently requires a pacing plan: create or select a plan before sending. Segment-only
  sending remains available through the phone's Wi-Fi fallback. Plan-free Bluetooth sending and
  PR timing will arrive together in a later release.
- Controlled transfer-link disconnect/resume passed hardware testing. Full Bluetooth-radio restart
  recovery failed earlier tests; if interrupted, cancel the stalled session and start a fresh send.
- In-ride transfer/H10 coexistence was not validated; send before recording.
- H10 RR samples save separately on the Karoo. Export to the phone is unfinished, and the normal ride
  FIT does not contain those raw RR samples.
- Experimental concurrent tracking, replanning and ceiling metadata remain disabled. No Needle model
  is activated in this beta.

## Update in place

Use the existing signed-update flow. Do not uninstall or clear app data; an in-place update retains
segments, plans and local recordings. If Android reports a signature mismatch, stop and contact the
maintainer. The final public stable-link/Companion installation must be verified before wide invites.
