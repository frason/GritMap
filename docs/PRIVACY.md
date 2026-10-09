# GritMap Privacy Policy

**Last updated:** [TODO: Jason, set to the date this is published]

GritMap is a cycling app for iPhone, with an optional extension for Hammerhead Karoo bike computers. It helps you plan how to pace a
climb, ride it, and see how your effort compared with the plan. This page explains what GritMap does with your information.

**The short version:** GritMap keeps your rides, segments, plans and body numbers on your own devices. It has no accounts, no analytics,
no advertising and no tracking. We (the people who make GritMap) do not collect your data and cannot see it.

## What GritMap stores, and where

All of this stays on your iPhone (and, for what you send to it, your Karoo). None of it is sent to us.

- **Your rides.** When you import a ride file (FIT or GPX), GritMap reads it and keeps the ride's route, times, distance, elevation and any power,
  heart-rate, cadence, speed and temperature it contains. It also keeps a copy of the file you imported inside the app.
- **Your segments, goals and pacing plans.** The segments you create or add, your goal times, and the pacing plans GritMap builds or you import.
- **Your profile.** The numbers you enter: FTP (the power you can hold for about an hour), weight, and maximum heart rate. Weight is stored in kilograms
  even if you type pounds.
- **Settings.** For example, the address of your Karoo (so you do not have to type it again) and whether you have finished the first-time walkthrough.
- **A GitHub token, only if you are a GritMap maintainer.** Ordinary riders never have one (see "Sharing a segment" below).
  If you enter one it is kept in your iPhone's Keychain, and you can remove it in the app at any time.

GritMap does not ask for, and does not use, your location, camera, microphone, photos, contacts, health data or notifications on the iPhone.
It only reads the files you choose in the file picker.

**Backups.** Like most apps, GritMap's data on your iPhone can be included in your iPhone backups (iCloud Backup or a computer backup) if you use them.
Those backups are between you and Apple.

## What GritMap does not do

- No accounts, sign-in or sign-up.
- No analytics, usage tracking, crash-reporting service, advertising or advertising identifiers.
- No selling, sharing or renting of your information. We do not have it.
- No tracking you across other apps or websites.

## When GritMap uses the internet

GritMap works without an internet connection for everything you have already imported or added. It connects to the internet only in these cases:

1. **Open Segments (browsing and adding).** When you open Open Segments, the app asks GitHub (`api.github.com` and `raw.githubusercontent.com`) for the
   list of shared segments and for the segment files you look at. This is a public repository. GitHub, like any website, can see your device's IP address and
   which files you asked for. You are not signed in and GritMap sends no personal information. GitHub's own privacy statement applies to what GitHub does.
2. **Maps.** The maps in GritMap are drawn from OpenFreeMap (`tiles.openfreemap.org`). To show a map, your device asks that service for the map style and for the
   map tiles covering the area on screen. That service can therefore see your device's IP address and which part of the world you are viewing (tile requests), and any
   standard information a web request carries. GritMap does not send your rides, profile or any identifier with these requests. OpenFreeMap's own policy applies to
   what it does.
3. **Sharing a segment to Open Segments.** See the next section. During the beta only the GritMap maintainer can do this.

GritMap does not check for app updates itself and does not contact any other service.

## Sending to your Karoo (local network only)

When you tap "Send to Karoo" or "Send plan to Karoo", GritMap sends information directly from your iPhone to your Karoo over your home Wi-Fi (or a
hotspot both devices share). It does not go through the internet or any server of ours. What is sent: the segment (its name and route), and, with a plan,
the pacing plan and the rider details the Karoo needs to use it (FTP, weight and, if you set it, maximum heart rate).

- iOS asks your permission for "Local Network" access the first time. GritMap uses it only for this.
- The Karoo accepts a send only while its "Receive from Phone" screen is open (about 10 minutes), and the send is not encrypted. Do it on a network you trust.
- The Karoo keeps what it receives on the Karoo.

## Asking a coach or an AI assistant for a plan (only if you choose to)

In a segment's "Import coach plan" screen, "Share request" opens the normal iOS share sheet with a message you can send to a coach or paste into an AI
assistant. The message contains the segment's name, distance and how steep each part is, your FTP, and your goal time if you set one. **Nothing is sent unless you
pick where it goes**, and from then on it is handled by the app or person you chose, under their rules. GritMap itself never contacts an AI service. When you
paste a plan back in, it is checked on your phone.

## Sharing a segment to Open Segments (public and permanent)

Open Segments is a public folder of segment files. **Anything shared there is public to everyone and cannot be removed from within the app.** During the beta,
only the GritMap maintainer can share a segment. If and when sharing opens to everyone, this policy will be updated first.

A shared segment contains: its name, its route (the points along the road, with elevation), the settings used to recognise it, and an identifier made up for
the segment. It does **not** contain your rides, times, heart rate, power, goals, plans or profile.

A route is a place. A segment you cut from one of your own rides shows where you ride, including where it starts and ends. Do not share a segment that starts or
ends at your home or workplace.

## The Karoo extension and heart-rate data

The GritMap extension runs on your Karoo and works out where you are on a segment during a ride, using your Karoo's position and sensor data. It stores its segments,
plans, attempt results and diagnostic logs on the Karoo. If you use a Polar H10 heart-rate strap for the optional cardiac fields, the extension connects to it over
Bluetooth and keeps the heart-rate and beat-to-beat (RR) data it records on your Karoo, in the extension's private storage. **This data stays on your Karoo.**
The extension does not send it anywhere, has no analytics or crash reporter, and its only network activity is the local-network receiver described above.
The extension asks Android for location and Bluetooth permissions so it can follow segments and connect to a heart-rate strap.
The Karoo itself, and what Hammerhead's own software records and does with your rides, is covered by Hammerhead's privacy policy, not this one.

## Third parties and TestFlight

GritMap does not include third-party analytics, advertising or tracking code. While GritMap is in beta it is distributed through Apple's TestFlight. Apple
runs TestFlight and may collect information about your use of TestFlight and, if you allow it, send crash reports and feedback to us. That is governed by Apple's
privacy policy. If you send us feedback or a screenshot from TestFlight, we see what you chose to send.

## Deleting your data

Delete the GritMap app from your iPhone and the data it stores goes with it. The one exception is the GitHub token that only a GritMap maintainer has: iOS can keep
Keychain items after an app is deleted, so a maintainer should first use "Remove saved token" (Share to Open Segments, under the maintainer controls). To clear the Karoo, remove the GritMap extension or its data from the Karoo.
Anything you shared to Open Segments is public and cannot be removed by deleting the app. If you want a shared segment taken down, contact us (below).
Backups you made of your iPhone are separate, and you can delete them in iCloud or on your computer.

## Children

GritMap is not directed to children under 13, and we do not knowingly collect information from anyone. Because the app collects nothing, there is nothing to
delete for a child, but a parent or guardian can remove the app at any time.

## Changes to this policy

If GritMap's behaviour changes in a way that affects your information (for example, a new way to share segments or a new service it contacts), we will
update this page and the "Last updated" date before the change reaches you. Material changes will also be mentioned in the app's release notes.

## Contact

Questions, or a request to take down a shared segment: [TODO: Jason, add a contact email or form]

*This is a plain-language description of how the app works. It is not legal advice.*
