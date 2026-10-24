# Install GritMap on a Karoo 3 (beta)

**GritMap needs a power meter and a heart-rate monitor.** Pacing plans are power targets, and the live guidance, energy budget and
cardiac fields depend on both. Without a power meter, GritMap can match segments and show progress, but it cannot pace you.

This guide is for the GritMap beta on the latest-generation Hammerhead Karoo. You need the
GritMap APK, the Hammerhead Companion app on your iPhone, and internet/Wi-Fi for the initial install. Segment and plan transfers use direct Bluetooth;
Wi-Fi is a fallback when Bluetooth is unavailable.

GritMap is beta software. It does not control your bike. Keep your attention on the road and use
the pacing guidance only when it is safe to do so.

## Before you start

- Update the Karoo to software version **1.538.2049 or newer**.
- Install Hammerhead Companion **1.12.0 or newer** on your iPhone and connect it to the Karoo.
- Connect the Karoo to Wi-Fi.
- Have the direct GitHub APK URL ready. Do not download the APK into Files first.

Hammerhead documents both URL and APK-file workflows in its
[official Companion App sideloading guide](https://support.hammerhead.io/hc/en-us/articles/31576497036827-Companion-App-Sideloading).

## Install from your iPhone

1. On the iPhone, long-press this direct link without opening or downloading it:
   [Install the latest GritMap Karoo beta](https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk).
2. Choose **Share Link**, then choose **Hammerhead** (the Hammerhead Companion app). Do not choose
   **Download Linked File** and do not share a downloaded copy from Files. That path can rename the
   file to a UUID and has been observed to leave the Karoo stuck on **Loading** without delivering
   the APK.
3. Keep the Karoo connected to Wi-Fi while Companion shows **Transferring**.
4. An install prompt appears on the Karoo. Tap **Install**.
5. Open the Karoo app drawer and launch **GritMap** once.
6. Allow location access when asked. Allow **Nearby devices / Bluetooth** when opening the Bluetooth receiver. The optional display-over-other-apps permission is not
   required for the official GritMap data fields.

For an update, repeat these steps with the same stable link. Do not uninstall the previous beta first:
installing the signed update over it preserves your GritMap segments and settings.

### If Companion cannot install the APK

If the Karoo displays a UUID filename and stays on **Loading**, waiting longer will not repair that
transfer. Back out of the screen, verify the Karoo and Companion versions and both devices' network
connections, then retry by sharing the direct link above rather than a downloaded file.

Use Android Platform Tools on a Mac or PC as a fallback:

1. On the Karoo, enable developer options, then enable **USB debugging**.
2. Connect the Karoo by USB and accept its computer-authorization prompt.
3. In a terminal, confirm that `adb devices` lists the Karoo.
4. Install or update GritMap:

   ```sh
   adb install -r /path/to/gritmap-karoo-<version>-beta.apk
   ```

If Android reports an incompatible signature, stop and contact the beta maintainer. Do not uninstall
GritMap or clear its data: that can delete saved segments, plans and private H10 recordings. Official
beta updates use the same signing identity and should install in place.

## Send a segment and plan over Bluetooth

Bluetooth sending requires **both** the upcoming Bluetooth-enabled GritMap iPhone beta and the
matching Karoo Bluetooth beta (**0.10.45-bluetooth-beta / code 73**, not yet published).
The stable link above may still serve 0.10.44 until the new release is published. Check the version
on the Karoo Segments screen. Phone build 7 hides Bluetooth; use the Wi-Fi fallback with that build.

**Current beta gap:** Bluetooth sends a segment with a pacing plan, so create or select a plan
before sending. To send only a segment, use the **Legacy Wi-Fi Receive** fallback below.
Plan-free Bluetooth sending and PR timing are planned together for a later release.

Send segments and plans **before starting a ride recording**. Jason reports that the extension app
screens cannot be opened during an active ride; pausing is not the pre-ride send flow.

1. Turn Bluetooth on for both devices and keep them nearby. No shared Wi-Fi or internet is needed
   for a fully Bluetooth transfer.
2. Open **GritMap > Inbox > Receive from Phone** on the Karoo. Allow Bluetooth/Nearby devices if asked.
3. The screen shows **WAITING FOR PHONE** and **Cancel Receiving**. Keep this screen open.
   It says **Bluetooth closes automatically after 2 minutes**: this is the discovery window;
   once a phone transfer starts, follow the displayed progress rather than restarting it.
4. In the Bluetooth-enabled GritMap iPhone beta, open the segment's Send-to-Karoo screen and follow
   its Bluetooth instructions. Keep the app in the foreground and allow Bluetooth permission.
5. Wait for the Karoo's successful import confirmation, then check **Segments** for the segment and
   loaded plan. The phone's sending progress alone is not confirmation of a completed Karoo import.
6. If discovery times out, open **Receive from Phone** again and retry. To stop waiting, tap
   **Cancel Receiving**.

A Polar H10 is optional for enhanced RR capture; ordinary heart-rate monitors work with the default
cardiac field. GritMap still needs the rider's power meter and heart-rate monitor for its intended pacing.

### Legacy Wi-Fi fallback

Use this with phone build 7 or when the Bluetooth send cannot complete. Both devices must be on the
same non-guest Wi-Fi network.

1. Open **GritMap > Inbox > Legacy Wi-Fi Receive** on the Karoo.
2. The Karoo shows an address such as `192.168.1.23:8734` and waits for 10 minutes. Leave it open.
3. On the iPhone Send-to-Karoo screen, choose the Wi-Fi fallback (or the IP send in build 7), enter
   that address including `:8734`, and send.
4. Confirm the Karoo reports the import and the plan appears under **Segments**.

If this fails, verify the shared network, reopen **Legacy Wi-Fi Receive**, and use the newly shown
address. Guest networks and VPNs can prevent the two devices from reaching each other.

## Add GritMap data fields

On the Karoo, edit a ride profile's data pages, choose **Add Field**, then open **Extensions** and
choose GritMap. A practical beta setup is:

### Page 1 — live pacing

- **GM Pacing Profile** as the large visual field. It combines the route ahead, virtual pacer,
  target versus actual power, elevation profile, and the next pacing section.
- Optional small numeric fields: **GM Target Power**, **GM Power Delta**, and
  **GM Predicted Finish**.

### Page 2 — execution and result

- **GM Pacing Coach** as a large field for the current, previous, and upcoming plan sections.
- **GM Segment Performance** as a large field for projected finish and quarter-mile splits.

### Optional physiology page

- **GM Cardiac Drift** is the default physiology field. It works with ordinary heart-rate and
  power data and shows efficiency only after enough steady paired data exists.
- **GM Watts/HR** is a compact supporting metric when both power and heart rate are available.
- **GM Power Balance** estimates anaerobic reserve and requires usable power data.
- **GM H10 Cardiac (Experimental)** is only for a Polar H10 configured for enhanced RR capture.
  It is advisory and does not change the pacing plan. Riders without an H10 should use
  **GM Cardiac Drift**.

You do not need every field. Start with **GM Pacing Profile**, the three optional numeric fields,
and **GM Cardiac Drift**.

## What to expect without sensors or a segment

- With no loaded segment or outside a segment, GritMap fields show a waiting/searching state; they
  should not be blank or crash the ride screen.
- A power meter and a heart-rate monitor are required for GritMap to do its job. Without a power
  meter, route matching and segment progress still work, but power guidance waits for power instead of
  inventing a value; GritMap cannot pace you without it.
- Without heart rate, cardiac fields wait for heart-rate data and the cardiac guidance is unavailable.
- Without a Polar H10, use **GM Cardiac Drift**. The experimental H10 field waits for enhanced RR
  data and is not required for live pacing.

Start recording the ride before reaching the segment. GritMap begins preparing as you approach,
then activates only after the directed route matcher confirms that you entered the segment in its
saved direction.

## Report a beta problem

Send all of the following:

- The GritMap version and build number shown on the Karoo **Segments** screen.
- The segment name, connected sensors, and whether the problem happened before, during, or after
  segment detection.
- A photo of the affected data page and the ride's exported FIT file.
- A photo of **GritMap > Settings > Diagnostics** after tapping **Refresh Diagnostics**. Do this
  before reinstalling or clearing the app.
- For an H10 problem, also include the final **GM H10 Cardiac** screen and say whether it progressed
  from `COLLECTING RR` to a live alpha-1 value.

Do not post FIT files or diagnostic artifacts publicly without checking their location and sensor
data first.
