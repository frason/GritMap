# Install GritMap on a Karoo 3 (beta)

This guide is for the GritMap beta on the latest-generation Hammerhead Karoo. You need the
GritMap APK, the Hammerhead Companion app on your iPhone, and Wi-Fi for the initial install and
for sending a segment from the GritMap phone app.

GritMap is beta software. It does not control your bike. Keep your attention on the road and use
the pacing guidance only when it is safe to do so.

## Before you start

- Update the Karoo to software version **1.538.2049 or newer**.
- Install Hammerhead Companion **1.12.0 or newer** on your iPhone and connect it to the Karoo.
- Connect the Karoo to Wi-Fi.
- Download the supplied `gritmap-karoo-<version>-beta.apk` file to the iPhone.

Hammerhead documents the same APK-file workflow in its
[official Companion App sideloading guide](https://support.hammerhead.io/hc/en-us/articles/31576497036827-Companion-App-Sideloading).

## Install from your iPhone

1. Open the downloaded APK in the iPhone Files app.
2. Tap **Share** and choose **Hammerhead** (the Hammerhead Companion app).
3. Wait while Companion shows **Transferring**.
4. An install prompt appears on the Karoo. Tap **Install**.
5. Open the Karoo app drawer and launch **GritMap** once.
6. Allow location access when asked. The optional display-over-other-apps permission is not
   required for the official GritMap data fields.

For an update, repeat these steps with the newer APK. Do not uninstall the previous beta first:
installing the signed update over it preserves your GritMap segments and settings.

### If Companion cannot install the APK

Use Android Platform Tools on a Mac or PC as a fallback:

1. On the Karoo, enable developer options, then enable **USB debugging**.
2. Connect the Karoo by USB and accept its computer-authorization prompt.
3. In a terminal, confirm that `adb devices` lists the Karoo.
4. Install or update GritMap:

   ```sh
   adb install -r /path/to/gritmap-karoo-<version>-beta.apk
   ```

If Android reports an incompatible signature, the Karoo has an older development build. Its app
data cannot be carried across to the beta signing identity: uninstall **GritMap** once, then install
the beta APK. Future signed beta updates can use `adb install -r` normally.

## Send a segment and plan from the phone

The phone and Karoo must be on the same Wi-Fi network.

1. Open **GritMap** on the Karoo.
2. Open the **Inbox** tab and tap **Receive from Phone**.
3. The Karoo shows an address such as `192.168.1.23:8734` and waits for 10 minutes. This is the
   Karoo address to enter on the phone. Leave this screen open.
4. In GritMap on the iPhone, open the segment and tap **Send plan to Karoo**.
5. Enter the Karoo address exactly as shown, including `:8734`, then send.
6. Confirm that the Karoo reports the import. Open **Segments** and select the segment; its detail
   screen should show that a pacing plan is loaded.

If sending fails, confirm that both devices are on the same non-guest Wi-Fi, reopen **Receive from
Phone**, and retry with the newly displayed address. VPNs and guest networks can block local-device
connections.

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
- Without a power meter, route matching and segment progress still work. Power-specific guidance
  waits for power instead of inventing a value.
- Without heart rate, cardiac fields wait for heart-rate data.
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
