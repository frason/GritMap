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

### 9. Privacy policy URL (required) and the App Privacy answers
Apple requires a **Privacy Policy URL** for external TestFlight testing (Test Information) and for the App Store. **The policy is written: `docs/PRIVACY.md`.**
It is host-agnostic Markdown with no repository links. To publish it, put the same text on any public web page you control (a page on the Vercel site, GitHub
Pages, or the rendered file on GitHub) and paste that URL into Test Information and the App Store Connect app's "Privacy Policy URL". Before publishing, replace the two
`[TODO: Jason ...]` markers: the **last-updated date** and a **contact email or form** (also used for takedown requests for shared segments). Re-read it once: it states what the app does
today, so update it if the app changes (a new service, analytics, or opening Open Segments sharing to everyone).

**App Store Connect -> App Privacy answers** (these match `docs/PRIVACY.md` and `ios/GritMap/PrivacyInfo.xcprivacy`):

| Question | Answer | Why |
|---|---|---|
| Do you or your third-party partners collect data from this app? | **No** (so "Data Not Collected") | Rides, segments, plans and profile (FTP, weight, heart rate) are stored only on the phone; nothing is sent to the developer. Apple's "collect" means sending data off the device where you or a partner can keep it longer than needed to answer the request. The only requests are public reads of GitHub files and OpenFreeMap map tiles, which carry no identifier or personal data from the app; the servers see the IP address transiently, as any website does. |
| Is any data used to track users? | **No** | No advertising SDK, no analytics, no data brokers, no tracking domains. |
| Third-party SDKs that collect data? | **None** | The app has no analytics, crash-reporting or advertising dependency (checked in `package.json` and the source). |
| Account / sign-in | None | There are no accounts. |
| Privacy policy URL | the published URL of `docs/PRIVACY.md` | Required. |
| Does the app use encryption beyond OS-provided? | **No** | `ITSAppUsesNonExemptEncryption = false` is already set. |

Decisions for Jason: (1) if you would rather over-disclose, you could declare "Other Data" for the transient IP address seen by GitHub and OpenFreeMap, but Apple's definition does not
require it and the policy already explains it in plain words. (2) When sharing opens to everyone (`docs/OPEN_SEGMENTS_SHARING.md`), the answers change: a shared segment is
user content you receive and keep, so this table and the policy must be revisited first.

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
