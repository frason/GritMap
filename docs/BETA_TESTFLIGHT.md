# GritMap beta: TestFlight steps only Jason can do

Status: the repository is ready for a TestFlight build as of 2026-10-08. Everything below needs Jason's Apple ID,
Expo account or App Store Connect login, so none of it has been run. Nothing here creates anything until you do it.
Target: strangers on iPhone TestFlight by about 2026-10-15 (`docs/GOALS.md`, priority 1). The Karoo side is a separate
sideloaded APK (`docs/BETA_KAROO_INSTALL.md`).

## What is already set up in the repo

| Item | Setting | Why |
|---|---|---|
| `eas.json` | profiles `development`, `development-simulator`, `preview`, `production` | `production` is what TestFlight needs. |
| Build numbers | `appVersionSource: "remote"`, `production.autoIncrement: true` | EAS keeps the build number on its server and adds 1 per production build. `ios/` is committed (not generated), so local counting would rewrite `ios/GritMap/Info.plist` and the Xcode project on every build and dirty git. The first remote value is read from the project (currently build `1`). |
| Version | `1.0.0` (build `1`) | Bump `version` in `app.json` **and** `MARKETING_VERSION` / `CFBundleShortVersionString` in `ios/` together for a new marketing version; the build number is automatic. |
| Bundle ID | `com.gritmap.app` | Must exist in the Apple Developer portal and be the App Store Connect app's bundle ID. |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` (in `ios/GritMap/Info.plist` and `app.json`) | The app only uses encryption built into iOS (HTTPS to GitHub and the map tile server, hashing, Keychain). That is exempt, so TestFlight will not ask the export-compliance question on every build. If you ever add your own cryptography, change this. |
| Devices | iPhone only (`supportsTablet: false`, `TARGETED_DEVICE_FAMILY = 1`) | Only phone layouts have been designed and checked; iPad layouts were not. This also avoids iPad screenshot requirements at App Store time. Re-enable after the beta once iPad layouts are checked. |
| Privacy manifest | `ios/GritMap/PrivacyInfo.xcprivacy`: no tracking, no collected data, required-reason APIs declared (UserDefaults, file timestamps, boot time) | Matches the app: everything is stored on the phone. Libraries ship their own manifests (React Native, expo-file-system) and are merged by Xcode. |
| Usage strings | Only `NSLocalNetworkUsageDescription` ("GritMap sends segments directly to your Karoo over your local WiFi network.") plus `NSAllowsLocalNetworking` | The app uses no camera, photos, location, contacts or microphone. The file picker needs no permission string. Secure storage uses the Keychain (no permission). The local-network prompt appears the first time a rider sends to a Karoo. |
| Icon / splash | `assets/icon.png` 1024x1024 RGB (no transparency, as App Store Connect requires); splash is 1024x1024 | Meets requirements. |
| `.easignore` | Leaves `apps/` (Karoo), `fixtures/`, `docs/`, `handoffs/`, `registry/` and agent folders out of the cloud upload | Smaller, faster build and keeps real ride files off Expo's servers. |

Checked locally without credentials: `npx expo export --platform ios` produces a production (non-dev) Hermes bundle, and a
Release build for the iOS simulator compiles (see the handoff for the result). No personal data, tokens or Jason's addresses are in
the bundle (the only address string is the example `192.168.1.23:8734`; the registry owner `frason` is the public
Open Segments repository).

## Steps for Jason

### 1. Check Apple Developer enrollment
1. Sign in at <https://developer.apple.com/account>. You need an active **Apple Developer Program** membership (paid,
   US$99/year); a free personal team cannot use TestFlight.
2. Note your **Team ID**. The Xcode project currently has `DEVELOPMENT_TEAM = FX769T9X3C`: confirm it is the paid team.
   EAS replaces local signing, but the team must be the one that will own the app.
3. Register the explicit App ID `com.gritmap.app` (Certificates, Identifiers & Profiles, Identifiers). No special
   capabilities are needed (no push, no iCloud). EAS can also do this on the first build.

### 2. Log in to Expo / EAS
```bash
npx eas-cli login          # your Expo account (create one at expo.dev if needed)
npx eas-cli init           # creates the remote Expo project, writes extra.eas.projectId and owner into app.json
```
Commit the resulting `app.json` change (it contains a project ID, not a secret). Ask Claude to review it first.

### 3. Create the app in App Store Connect
<https://appstoreconnect.apple.com> -> Apps -> **+** -> New App: platform iOS, name **GritMap** (if taken, pick another
public name, e.g. "GritMap Pacing"; it is not the icon label), primary language, bundle ID `com.gritmap.app`, a SKU
(for example `gritmap-ios`). Note the numeric **Apple ID** shown under App Information; `eas submit` uses it.

### 4. First production build
```bash
npx eas-cli build -p ios --profile production
```
Sign in with your Apple ID when asked and let EAS **manage credentials** (it creates the distribution certificate and
provisioning profile). It builds in Expo's cloud (free-plan builds can queue for a while). The build number starts from the
project's value (`1`) and goes up by itself. If it starts somewhere unexpected, set it with
`npx eas-cli build:version:set -p ios`.

### 5. Submit to TestFlight
```bash
npx eas-cli submit -p ios --profile production --latest
```
It asks for the App Store Connect app (the Apple ID above) and your Apple login. For unattended use create an
App Store Connect API key (Users and Access -> Integrations); **never commit the `.p8` file** (it is git-ignored). After upload
Apple processes the build (usually 10-30 minutes) and emails you. In App Store Connect -> TestFlight the build shows "Ready to Test".

### 6. Before inviting strangers: walk it yourself
- Install the TestFlight build on your own iPhone (internal tester: add yourself under Users and Access first).
- Walk the whole beta loop on a clean install (delete the dev-client app first so it is a first run): onboarding, Open Segments,
  goal and plan, Send to Karoo, import a ride, plan vs actual, progress over time.
- Confirm the Karoo install guide (`docs/BETA_KAROO_INSTALL.md`) is what you will send testers.

### 7. Testing groups
- **Internal testing** (up to 100 people who are users on your App Store Connect team): available immediately, no review.
- **External testing** (the 20+ strangers): TestFlight -> External Testing -> New Group, add the build. The **first build of a
  version goes through Beta App Review** (usually under a day). Invite by email, or enable a **public link** (up to 10,000
  testers) and share that. Later builds of the same version usually skip review.
- In "What to Test" tell testers to follow the in-app steps and send them the Karoo install guide.

### 8. Beta App Review information (TestFlight -> Test Information)
Fill in: feedback email, marketing/support URL, contact (name, phone, email), and **no sign-in required** (the app has no
accounts). Suggested review notes:

> GritMap helps cyclists pace climbs and review how they rode them. It works entirely on the phone with no account.
> It also pairs with an optional companion extension for Hammerhead Karoo bike computers, which we distribute separately to testers.
> Reviewers do not need a Karoo: everything except "Send to Karoo" works without one. The first time a rider taps
> Send to Karoo, iOS asks for Local Network access because the phone sends the segment to the Karoo over the same Wi-Fi network.
>
> To review: complete the short setup (FTP and weight can be any numbers, e.g. 250 W and 75 kg). On the Segments tab choose
> "Open Segments" and add any segment (this needs internet). Open it, set a goal time (for example 40 minutes), and the app shows
> a pacing plan. To see ride analysis, import the attached sample ride on the Rides tab (Import, choose the file).

Attach `docs/beta-review-sample-ride.gpx` in the review attachment field. It is **synthetic** (generated by
`scripts/make-review-sample-gpx.ts` along the public "Diablo Northgate to Junction" Open Segments entry, invented timing); it imports
and matches that segment (checked on the simulator: one effort, 99% match). Tell the reviewer to add "Diablo Northgate to Junction"
from Open Segments first. Do not attach any personal ride. If Apple asks about the Karoo dependency: it
is optional hardware, the phone app is useful without it (planning, import, analysis), and the Karoo send uses plain HTTP on the
local network only.

### 9. Privacy policy URL (required)
Apple requires a **Privacy Policy URL** for external TestFlight testing (Test Information) and for the App Store. It must be a
public web page you control (GitHub Pages or any site). Content to cover, which is what the app does today:
- All rides, segments, goals, plans and profile (FTP, weight, heart rate) are stored on the phone only; there are no accounts,
  analytics, advertising or tracking.
- Network use: Open Segments reads public segment files from GitHub; map tiles come from OpenFreeMap (their servers see the
  phone's IP address and the map area requested); sending to a Karoo goes directly over the local network.
- Publishing a segment is optional and uses a GitHub token the rider enters themselves, stored in the iPhone Keychain, sent only to GitHub.
- How to delete data (delete the app) and a contact email.

App Privacy questionnaire (App Store Connect -> App Privacy): answer **Data Not Collected** and **no tracking**, which matches the
privacy manifest. Decide whether you want to disclose the OpenFreeMap tile requests; Apple's definition covers data *you*
collect, and the app only requests public map tiles.

### 10. After the first build
Tell Claude the build is live; the next steps are: add the TestFlight public link and the Karoo install guide to the
tester email, and run a VoiceOver pass on a real iPhone (not yet done).

## Not done / known
- No Android build or Play Store setup (not part of the beta).
- iPad layouts unverified, so the app is iPhone-only for now.
- Light appearance is forced (`userInterfaceStyle: light`).
- `NSBonjourServices` contains `_expo._tcp`, added by the development client tooling; it is harmless in production and is covered by
  the same local-network usage string.
- A Jason-owned Apple team ID is committed in the Xcode project (`FX769T9X3C`); a Team ID is not a secret.
