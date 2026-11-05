# TestFlight text for build 19 (DRAFT, Jason pastes it in App Store Connect himself)

Limits: "What to Test" and descriptions have length limits in App Store Connect; trim if it rejects. Replace the bracketed address with the dedicated support address once it exists. Do not use a personal email.

## Beta App Description
GritMap helps you pace a climb. Pick or define a segment, set a goal, get a power-based pacing plan, send it to your Hammerhead Karoo 3, ride with live guidance, then import the ride and see plan versus actual.

You need: an iPhone, a Hammerhead Karoo 3, a power meter on your bike and a heart-rate monitor. Without a power meter and heart-rate monitor GritMap cannot do its main job. The Karoo extension is installed separately; the install guide is linked from the GritMap README on GitHub.

This is an early beta. Pacing and physiology features are experimental and advisory, not medical advice.

## What to Test (build 19)
Please run the whole loop once on a real ride:
1. Install the Karoo extension (install guide in the GritMap GitHub README).
2. In the app, import a ride (FIT or GPX) and define a segment from it, or pick one from Open Segments.
3. Set a goal and look at the pacing plan.
4. Send the segment and plan to your Karoo (Bluetooth).
5. Ride it with live pacing on the Karoo.
6. Import the ride's FIT file into the app and check plan versus actual.

New in this build: map previews follow light and dark mode; segment cards show maps; the power meter and heart-rate requirement is stated up front.

Known issue: the Rides or Segments list may stop responding to taps. Force-quit and reopen the app if it happens, and tell us.

Not in this build: sign-in, Liked segments, publishing from the app. Those are on the Open Segments website only.

Tell us: your iPhone model and iOS version, the app build number, the Karoo software version and extension version, and what you were doing. Please do not post private emails or Apple IDs publicly.

## Feedback email (App Store Connect field)
help@opensegments.org

## Beta App Review notes (for Apple)
No sign-in or account is required; the Open Segments account feature is switched off in this build. The app reads ride files the user chooses (FIT/GPX) and keeps them on the device. Bluetooth is used only to send a segment and plan to the user's own Hammerhead Karoo. To exercise the app without a Karoo or power meter: import the sample ride file in the repository (`docs/beta-review-sample-ride.gpx`) and follow the walkthrough. No demo account is needed.
