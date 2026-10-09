# GritMap

GritMap helps cyclists plan an effort for a climb or segment, execute that plan live on a
Hammerhead Karoo, and review what happened afterward on an iPhone.

The project is preparing for a small public beta. Segments are intended to stay open and
shareable; live pacing and ride data remain local to the rider's devices.

## What the beta includes

- Create or import a directed segment on iPhone.
- Set a finish goal and generate or import a section-by-section pacing plan.
- Send the segment and plan to a Karoo over local Wi-Fi.
- Follow live target power, pacing progress, finish projection, and optional physiology fields.
- Import the completed FIT file on iPhone and compare the effort with the plan and prior rides.

## Karoo 3 extension

The current extension requires a **Hammerhead Karoo 3**. Karoo 2 is not supported by this beta.

### Install with Hammerhead Companion

1. On your phone, open the [latest GritMap Karoo release](https://github.com/frason/GritMap/releases/latest).
2. Download or long-press the `gritmap-karoo.apk` asset and choose **Share**.
3. Select **Hammerhead Companion**.
4. Approve the installation on the Karoo, then open **GritMap** from its app list.
5. Follow the [Karoo beta setup guide](docs/BETA_KAROO_INSTALL.md) to grant permissions and add
   GritMap fields to a ride profile.

Advanced fallback with Android Debug Bridge:

```bash
adb install -r gritmap-karoo.apk
```

Every beta APK is signed with the same GritMap beta identity. Install updates over the existing
app so the Karoo retains locally stored segments, plans, settings, and diagnostics.

## Live data fields

The images below are placeholders. Real Karoo screenshots will replace them before the public
beta announcement.

| Field | What it answers | Preview |
|---|---|---|
| **GM Pacing Profile** | Where am I relative to the planned pacer, and what effort comes next? | ![GM Pacing Profile](assets/Pacing-profile.png) | 
| **GM Pacing Coach** | What is the current section target, and how did nearby sections go? | ![GM Pacing Coach](assets/Pacing-coach.png) |
| **GM Segment Performance** | What is my projected finish and where am I gaining or losing time? | ![GM Segment Performance](assets/Segment-performance.png) |
| **GM Power Balance** | Am I spending modeled reserve faster or slower than planned? | ![GM Power Balance](assets/power-balance.png) |
| **GM Cardiac / H10 Cardiac** | Is power-to-heart-rate efficiency changing, and is clean H10 RR context available? | ![GM Cardiac fields](assets/Cardiac-drift.png) |

These are advisory training displays, not medical measurements or guarantees of performance.

## Join the iPhone TestFlight beta

The companion app beta is **iPhone-only** for now. An iPad layout and Android phone app are not
part of this first test.

To request an invitation, [open a TestFlight beta request](https://github.com/frason/GritMap/issues/new?title=TestFlight%20beta%20request&body=I%20would%20like%20to%20test%20GritMap%20on%20iPhone.%0A%0AKaroo%20model%20(optional):%0APower%20meter%20(optional):%0APolar%20H10%20(optional):).
Do **not** post your Apple ID or private email address in a public GitHub issue. The maintainer will
provide private enrollment instructions or replace this request link with the public TestFlight
link once Apple approves the external-testing group.

Beta testers should be willing to:

- install a prerelease Karoo extension;
- report the app and extension version with problems;
- share screenshots and, only when comfortable, relevant FIT or diagnostic files privately;
- remember that pacing and physiology features are experimental and advisory.

## Development

- Product direction: [docs/GOALS.md](docs/GOALS.md)
- Karoo build and test setup: [apps/karoo/README.md](apps/karoo/README.md)
- TestFlight preparation: [docs/BETA_TESTFLIGHT.md](docs/BETA_TESTFLIGHT.md)
- Privacy policy draft: [docs/PRIVACY.md](docs/PRIVACY.md)

The Karoo application is Apache-2.0 licensed. See [apps/karoo/LICENSE](apps/karoo/LICENSE).
