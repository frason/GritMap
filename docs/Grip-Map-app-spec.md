# Cycling Performance & Goal Analysis App — Project Spec

## Origin & Context

Jason is an endurance athlete (cycling-focused) currently using an AI trainer app for workout scheduling and prescription. That tool's analysis is purely text-based and doesn't provide the visual, comparative depth needed to actually understand performance trends. This app is meant to fill that gap: a dedicated visualization and analysis layer on top of his existing workout data.

**Current goal driving development:** PR a 6.5-mile hill climb. Last attempt: 45 minutes. Target: 39 minutes. Target date: **October 3, 2026** (fixed — see [MVP.md](./MVP.md) for the authoritative MVP scope and timeline).

## Platform Decision

- **React Native** (likely via Expo), targeting **both iOS and Android** — not iOS-only.
- Primary usage context is mobile / on-the-go, not desktop.

### What Expo provides
Expo is a toolkit built on top of React Native that significantly lowers the setup/tooling burden, which matters given Jason is new to React:
- Handles the native build tooling (Xcode/Android Studio configuration) that plain React Native requires, so development can start without deep native setup.
- Use an **Expo development build** from the outset. MapLibre, SQLite, file handling, and later health integrations may require native modules that are not present in Expo Go. JavaScript changes still support fast refresh on a physical phone; the native development client only needs rebuilding when native dependencies or configuration change.
- Bundles common native capabilities (camera, location, notifications, etc.) as simple, ready-to-use libraries — relevant here since the app needs GPS/location access for maps and ride tracking, without needing to separately source and configure native modules for that.

### UI component approach: lightweight, not a full component library
Rather than adopting a full pre-built component library (e.g. React Native Paper, which is Material Design/Android-styled and well-maintained but not iOS-native-feeling; or Tamagui, which is more performance-focused and cross-platform but has smaller, more niche adoption), the MVP will use **Expo's own basic building blocks directly** (button, text input, switch, view container, etc.), with simple custom styling for spacing/color consistency rather than a full theming system.
- Rationale: the MVP has a genuinely small number of screens (three tabs plus a couple of detail/creation screens), so a full design system's API surface is more overhead than benefit.
- This keeps the codebase simpler and more readable/learnable for Jason as someone new to React, rather than requiring him to also learn a component library's specific abstractions and opinions.
- Nothing here blocks adopting a fuller component library later post-MVP if the app's visual polish needs grow alongside the navigation/feature expansion discussed elsewhere in this spec.

## Data Sources


| Source | Use case | Notes |
|---|---|---|
| **Peloton** | Indoor rides | Plan to pull via **Apple HealthKit** (iOS) and likely **Health Connect** (Android) / Samsung Health, rather than Peloton's own API |
| **Hammerhead Karoo** | Outdoor rides | **MVP: user exports and batch-imports FIT files.** Direct Hammerhead/Terra synchronization is a post-MVP convenience, not an MVP dependency. |
| **Strava** | Deliberately being phased OUT as a dependency — Strava is restricting third-party data access starting **September 2026**. Do not architect around Strava as a data source. |

For MVP, data plumbing is deliberately constrained to local FIT import so engineering effort can focus on segment matching and comparison UX.

## Core Product Concept: Goal-Centric, Not Ride-Centric

Unlike Strava/typical fitness apps which are ride-log-first, this app is **goal-first**. Jason is always training toward something specific — a hill climb PR, an endurance/gravel event, a triathlon, a century ride, a zone 2 base-building block, etc. Every individual workout should be understood in the context of *which goal it's serving* and *how it compares to past efforts toward that same goal*.

### Home experience
- Centered on active goal(s) — e.g., "Sub-39 Hill Climb" — with the latest relevant workout surfaced and contextualized against that goal.

## Feature 1: Custom Segments (Strava Segment Replacement)

Since Strava's segment data/matching will no longer be reliably accessible, the app needs to **build its own lightweight segment system**:

- User manually defines a directed segment from a ride by selecting start and end positions along that ride's track.
- The segment stores the complete directed reference polyline, resampled at 10-meter intervals, not merely its endpoints.
- Whenever rides are imported, the app evaluates them locally against every saved segment and records every valid same-direction traversal. Segment attempts reference ranges within their source rides; ride and sensor data are never duplicated.
- First segment to build: the 6.5-mile hill climb PR route.

## Feature 2: Comparison & Overlay Visualization Engine

This is the centerpiece of the app and the primary point of differentiation from Strava.

### Auto-matching similar workouts
- App attempts a **"best guess"** at similar past workouts based on type + duration (e.g., a 60–63 min Peloton ride matched against other ~60 min rides in the last ~4 months).
- If a clean best guess isn't available (or user wants to override), fall back to a **manual selector** to pick a workout to compare against.

### Overlay visualization — diff/heat-band rendering
Beyond simply plotting two lines on the same chart, the overlay should render as a visual diff between the primary and comparison attempt, since two raw lines require the user to mentally trace and compare them:
- Distance-based resampling to enable comparison — since two attempts at the same segment take different amounts of time, they don't share timestamps. Both rides' data (power, heart rate, etc.) are resampled onto a shared distance axis along the segment (e.g. a value every 10 meters), interpolating each ride's metric at that point in space rather than comparing by elapsed time. This makes point-by-point comparison valid despite pacing differences.
- Color-coded diff band — rather than (or in addition to) two overlaid lines, shade the space between them as a single band: one color (e.g. blue) where the primary attempt's value is higher at that point, a second color (e.g. red) where the comparison attempt's value is higher, and a neutral gray where the two are close enough to be considered even (using a small threshold to avoid flickering between colors on noise).
- Purpose — lets the user see at a glance where they gained or lost ground on the climb — e.g. faster in the first third, but heart rate spiked higher through the middle section — without having to trace two separate lines mentally.
- Applies per-metric (power, heart rate, etc.) via the existing channel-switcher pattern — each channel gets its own diff-band rendering when selected.
- **Cumulative elapsed-time gap is the primary performance channel.** At each 10-meter sample, calculate the difference between the attempts' wall-clock elapsed time from the segment start. Power and heart rate explain effort; the time-gap channel directly shows where time was gained or lost.
- MVP channels are cumulative time gap, power, heart rate, and elevation. Cadence and speed are optional if schedule permits.
- Do not interpolate across data gaps longer than 30 seconds, and render missing regions as gaps rather than zeros. Any display smoothing must be light and documented; calculations use unsmoothed values.

### Overlay visualization
- Rather than Strava's side-by-side stat comparison, the primary visualization is an **overlay chart**: current ride's data plotted against a comparison ride's data on the same timeline/segment.
- A **channel switcher** lets the user toggle which metric is overlaid (power, heart rate, cadence, etc.) — one clean chart, switch the data series rather than showing everything at once.
- Applies at two levels:
  1. **Segment-level** — e.g., this attempt at the hill climb segment vs. a previous attempt at the same segment.
  2. **Full-workout-level** — e.g., this zone 2 hour vs. a similar past zone 2 hour.

### Contextual "coming into the ride" data
For any workout being analyzed, surface pre-ride context alongside the performance data, including:
- Sleep (duration/score) the night before
- Resting heart rate that day (esp. lowest RHR)
- HRV
- Outdoor temperature at time of ride
- Any other relevant environmental/physiological factors

This context should be shown side-by-side when comparing two workouts, so Jason can see not just *how* the effort differed, but *why* — e.g., "your RHR was elevated and sleep was shorter going into this one."

## Feature 3: AI Coach Layer

- An AI analysis/coaching feature built into the app, seeded with a large context of cycling coaching knowledge and current sports science literature.
- Should be able to analyze specific rides/segments using the combined dataset (performance + contextual/biometric data).
- Conversational — Jason should be able to ask it questions directly about his training, a specific ride, or trends over time.
- Grounded in his actual data rather than generic advice.

## Architecture Summary — Four Core Pieces

1. **Data ingestion layer** — batch FIT-file import for MVP; HealthKit/Health Connect and automatic provider synchronization are post-MVP.
2. **Goal & progress tracking** — goal-first home experience, workouts contextualized against active goals.
3. **Comparison & overlay visualization engine** — auto-matched similar workouts, overlay charts with metric switching, segment-level and full-ride-level comparison, pre-ride biometric/environmental context.
4. **AI coach layer** — coaching-literature-grounded analysis and Q&A over the user's own ride and biometric data.

## Immediate Priority

Given the 4–6 week timeline to the hill climb PR attempt, the practical starting point is likely:
1. Get batch FIT import and the custom segment feature working for the hill climb segment specifically.
2. Build the overlay comparison view for that segment against past attempts.
3. Layer in pre-ride context (sleep/RHR/HRV/temp) once core comparison works.
4. AI coach layer can follow once there's real comparative data to reason over.

## Optional Workstream: Open-Sourcing the Segment Library

Given that Strava's segment matching is proprietary and becoming less accessible, there's an opportunity to build the custom segment feature (Feature 1) as a **standalone open-source library** rather than app-only code — both as a public good and as good timing/visibility ahead of Strava's September 2026 access changes.

### Library, not platform — explicitly no leaderboard/competition
This is a deliberate scope decision: the library is **just code**, not a hosted service.
- **No backend of its own** — it's a package (think npm/PyPI style), not a server. No accounts, no database, no hosting to maintain.
- **No shared/central state** — each consuming app stores its own segment definitions and matches locally (SQLite, local files, etc.). The library operates on data it's handed and returns results; it doesn't own or persist anything itself.
- **No leaderboard = no multi-user problem** — a leaderboard is what forces Strava into a centralized backend, since it requires reconciling everyone's times against the same segment in one place. By deliberately excluding that, there's no cross-user state to synchronize, so none of the auth/backend/multi-tenant complexity discussed elsewhere in this spec (for Jason's app itself) applies to the library at all. It's a clean, decoupled dependency.
- **This app is just "the first consumer"** — the app calls the library the same way any third-party app would; there's no special coupling or shared infrastructure between the app and the library itself.

### Structure
- Pull segment logic out of the main app into its own package/repo (e.g. `ride-segments` or similar), which the app then consumes as a dependency.
- Keeps the reusable, general-purpose piece (GPS corridor matching, segment definition, auto-detection) cleanly separated from the app-specific/proprietary pieces (goal tracking, AI coach, multi-user accounts, Jason's personal data).

### Format-agnostic design
- Input should be standard ride file formats (GPX, FIT, TCX) rather than Hammerhead- or Peloton-specific formats, so any developer or competing app could adopt it regardless of their data source.

### Per-tick elevation data (captured day one)
Beyond the segment definition itself, the **ride data captured for each segment attempt** must preserve per-tick (per-GPS-point) elevation alongside power, heart rate, and other metrics — not just start/end elevation. This is a day-one requirement, not a later add-on:
- FIT files already record elevation continuously alongside GPS coordinates, so this is a matter of explicitly capturing and storing that stream rather than discarding it, not an additional data source to integrate.
- This granular elevation profile is what will eventually let the AI coach layer compare attempts meaningfully — e.g. distinguishing "you were slower here because this stretch is steeper" from genuine performance differences — rather than comparing power/heart rate in a vacuum.
- Since this is cheap to capture now and expensive to backfill later (old attempts without it would be permanently incomplete), it should be part of the segment-attempt data model from the first version, even though the AI analysis that consumes it is out of scope for MVP.

### Segment data format (defined day one for future portability)
To avoid a data migration later, segments should be saved from day one in a format designed to be the eventual open-source library's schema — even though the library extraction itself is deferred past MVP.

- **File format:** plain JSON as the primary format. Universally readable across languages/platforms, easy to version/diff in a git repo, and straightforward to convert to/from GPX later if broader GPS-tooling interop is wanted.
- **Coordinate system:** standard latitude/longitude in **WGS 84** (the default GPS standard), ensuring no ambiguity across devices, apps, or countries.
- **Minimum required fields:**
  - Globally unique segment ID
  - Segment name
  - Start coordinate (latitude, longitude)
  - End coordinate (latitude, longitude)
  - Complete directed reference polyline, resampled every 10 meters
  - Matching tolerance/radius (30 meters)
  - Required in-corridor coverage (90%)
  - Segment schema version and creation timestamp
  - Deterministic fingerprint of the directed polyline and matching parameters
- **Additional fields for robustness/portability:**
  - Elevation at start and end points — helps disambiguate segments that might otherwise share similar coordinates
  - Original reference ride ID and selected start/end point indexes

Practically, SQLite is the MVP source of truth and the same segment shape has a portable, versioned JSON representation. Segments are immutable: correcting endpoints or a route creates a new segment. Overlapping or geographically identical segments are allowed. Deleting a segment permanently removes its definition and its attempt/review relationships, but never modifies the source rides.

### Future sharing model: cloud registry, local matching
- Shared segment definitions may eventually live in a lightweight cloud registry for publishing, discovery, globally unique IDs, fingerprints, and schema compatibility.
- Devices download immutable definitions and match them against private rides locally. FIT files, ride sensor streams, and attempts remain on-device by default.
- `segmentSchemaVersion` describes the portable definition; `matcherVersion` records which local algorithm evaluated a ride.
- A matcher upgrade may reevaluate rides against an existing immutable segment. A changed definition is a new segment and receives a fresh scan.
- Leaderboards or uploaded results are separate, opt-in post-MVP systems and are not required by the open-source matcher.

### Core API surface (rough shape)
- `defineSegment(track, startPoint, endPoint)` — save a segment from a reference track.
- `matchSegment(newTrack, segmentDefinition)` — detect and slice out the matching portion of a new ride, with configurable corridor/tolerance matching.
- Should be usable standalone, without any dependency on the rest of the app, a backend, or user accounts.

### Directed segment-matching contract
1. Store each segment as a complete directed reference polyline and resample it every 10 meters.
2. Search a ride for every candidate start point within 30 meters of the segment start.
3. Evaluate ride points forward only from each candidate start.
4. Project ride points onto the reference polyline, recording perpendicular distance and progress distance along the reference.
5. Require progress to move mostly monotonically from start to end. Up to 30 meters of temporary backward projected movement is allowed for GPS jitter; larger backward movement makes a completed candidate borderline or invalid.
6. Require at least 90% of the reference route to be covered inside the 30-meter corridor for automatic acceptance.
7. Permit GPS gaps up to 30 seconds. A longer gap makes an otherwise completed candidate borderline.
8. Reject reverse traversal and paths that reach both endpoints through a different route.
9. Save every valid traversal, including multiple attempts in one ride, while deduplicating overlapping detections of the same traversal.
10. Ignore incomplete traversals that never reach the segment end; GPS drift and abandoned routes should not create review noise.
11. Automatically accept candidates that pass every rule. Send completed, same-direction candidates that fail coverage, continuity, or ambiguity thresholds to advanced review.
12. Calculate and store a diagnostic confidence score from route coverage, direction/order, corridor distance, and GPS continuity.

### Ride/attempt ownership model
- A ride is the immutable source record for its GPS and sensor streams.
- A segment attempt stores the segment ID, ride ID, start/end point indexes or offsets, start/end timestamps, matcher version, confidence, and automatic/manual status.
- Segment attempts never duplicate ride points or sensor data.
- Segment performance uses wall-clock elapsed time between FIT timestamps at the segment boundaries. Stops and device auto-pause remain part of the result.
- A matcher upgrade reevaluates rejected and borderline candidates during MVP tuning. Replacing a ride also clears its match decisions and reevaluates it against every segment.

### MVP advanced diagnostic review
- The review screen overlays the ride and reference routes and identifies the proposed boundaries.
- It shows coverage percentage, maximum and median corridor deviation, backward movement, GPS gaps, direction/order checks, and confidence.
- The user may confirm or reject the completed candidate. A manually confirmed candidate participates fully in comparison and retains a `manuallyApproved` marker.
- A rejected candidate creates no segment-attempt relationship and does not appear in the segment's matched rides. Lightweight diagnostics and the decision may be retained against the intact ride for matcher tuning.
- The diagnostic workflow is temporary: hide or remove it once matching reliability is proven and the matcher is prepared for open-source extraction.

### License considerations
- **MIT / Apache 2.0** — maximizes adoption, no restrictions on downstream use, including by commercial competitors.
- **AGPL** — still open, but prevents a well-funded competitor (e.g. a Strava alternative) from closing off a derivative product built on top of it. Worth noting AGPL is typically aimed at network-service use cases; since this library has no server component of its own, its practical bite here is more about preventing closed forks than about triggering source-disclosure from network use.
- Decision point: whether the goal is maximum ecosystem adoption vs. protecting against pure commercial capture.

### Upside
- Could become a de facto open alternative to Strava's segment matching once third-party access tightens in September 2026.
- Good visibility/credibility for Jason as the author of a widely-used open primitive in the cycling data space.
- Ships independently of — and well ahead of — the app's own multi-user/auth work, since it has no dependency on that infrastructure.

## Map & Elevation Data Stack

For rendering ride tracks, segments, and route overlays, the recommended stack is fully free and open-source (no vendor lock-in, no per-request billing risk):

- **OpenStreetMap (OSM)** — underlying map data (roads, trails, paths). Free, open license (ODbL), community-maintained.
- **MapLibre** (`@maplibre/maplibre-react-native`) — open-source fork of Mapbox GL for rendering OSM-based vector tiles in React Native. No licensing fees, no vendor lock-in.
- **Tile hosting** — need a provider to serve map tiles:
  - Self-hosted option: OpenMapTiles or TileServer GL, for full control.
  - Hosted free-tier options built on OSM data: Stadia Maps, MapTiler, Thunderforest — suitable for indie/hobby-scale usage.
- **Elevation data** — sourced from two different places depending on use case, an important distinction now that per-tick elevation is a day-one requirement for segment attempts (see Per-tick elevation data section):
  - **Primary source for segments/rides: the FIT file's own barometric elevation data.** The Hammerhead Karoo records real elevation continuously during a ride via its own barometric altimeter, which is both more accurate than coarse satellite-derived elevation and already exactly time/distance-aligned with the ride's power and heart rate data. This is the elevation source used for segment definitions, per-tick elevation data, and the overlay/diff comparison charts — not a separate lookup.
  - **SRTM (NASA, free, global ~30m resolution) via Open-Elevation** remains a candidate for later, but purely as a **post-MVP fallback for elevation at arbitrary map points not tied to actual ride data** — e.g. previewing a planned route before ever riding it. This is explicitly **out of scope for the MVP** — the MVP only needs FIT-derived elevation for actual recorded rides/segments, not lookups for hypothetical/unridden routes. It is not used for elevation on recorded segments or rides in any case, since the FIT file's own data is both available and more accurate for that purpose.

This stack (MapLibre + OSM vector tiles + SRTM elevation) covers route rendering, segment overlays, and elevation profiles without introducing paid dependencies.

## Data Plumbing — Detailed

### Hammerhead Karoo (outdoor rides)
- **MVP path:** direct batch import of FIT files exported from the Karoo. FIT is documented, stable, preserves the sensor streams needed for comparison, and requires no account, backend, OAuth integration, or paid aggregation service.
- The app retains the original FIT file locally, parses it into normalized SQLite records, and never modifies the source file.
- Automatic Hammerhead integration is explicitly post-MVP.
- **Note:** No native Hammerhead → Apple Health / Health Connect integration currently exists (long-requested by the Karoo community, still unresolved), so Peloton and Hammerhead will need two distinct ingestion paths rather than a single unified one.

### Post-MVP automatic ingestion options
- Direct Hammerhead Developer Platform integration may be evaluated after the local core loop is validated.
- Terra can normalize Hammerhead activity data, poll for updates, deliver webhooks or FIT files, and provide historical retrieval, but its published pricing is too high for this MVP. It remains a possible product-scale option, not an MVP dependency.
- Any automatic provider integration will feed the same canonical local ride model used by FIT import.

### Peloton (indoor rides)

### Peloton (indoor rides)
- **iOS:** Peloton has native Apple Health integration (toggled in-app under Profile → wearables/integrations, or iOS Settings → Health → Peloton). As of recent updates this exports not just basic metrics (heart rate, calories, distance) but also **cadence, power, and speed** for cycling workouts — sufficient detail for this app's comparison/overlay use case.
  - Practical ingestion: read from **HealthKit** directly (`HKWorkout` + associated samples) once Peloton has written data there. Requires user to have the Peloton→Health toggle enabled.
- **Android:** No confirmed native Peloton → Google Health Connect / Samsung Health integration currently exists (historically Android lagged iOS here). This is a gap to validate early — worth a quick spike to confirm current state, since Peloton's integrations have been updated recently and this may have changed.
  - Fallback if unavailable: Peloton does not have a fully public workout API for third parties, so Android ingestion may need to route through Health Connect once/if Peloton adds it, or through manual export.

### Cross-platform HealthKit/Health Connect export utility (useful reference, not necessarily a dependency)
- Third-party tools like **Health Auto Export** (iOS) demonstrate the shape of a robust HealthKit export pipeline: reading 100+ metrics and workout types, producing JSON/CSV/GPX, and pushing to a REST endpoint on a schedule. This is a useful reference implementation pattern (schedule → query HealthKit → batch/transform → POST to backend) even if the app implements its own HealthKit reads directly rather than depending on a third-party exporter.

### Biometric context data (sleep, RHR, HRV)
- Sourced the same way as Peloton data on iOS: directly from **HealthKit** (sleep analysis, resting heart rate, HRV samples), since these are standard HealthKit types regardless of which device recorded them (Apple Watch, Oura, Whoop, etc. all write to HealthKit).
- Android equivalent: **Health Connect**, which most major wearables (Garmin, Samsung, Whoop, Oura) now write into.

### Recommended sequencing
1. Build batch FIT import and local persistence.
2. Build directed segment definition, matching, diagnostics, and comparison.
3. Evaluate automatic Hammerhead ingestion only after the MVP proves useful.
4. Build iOS HealthKit ingestion for Peloton and biometrics post-MVP.
5. Confirm and then add Android Health Connect ingestion.

### Weather / temperature data
- **Outdoor rides:** sourced directly from the bike computer (Hammerhead Karoo), which records ambient temperature as part of the ride data — no external weather API needed.
- **Indoor rides (Peloton):** temperature is optional manual entry by the user, or left blank if not provided. No automated weather lookup for indoor workouts.

### Garmin (alternative/additional biometric source)
- Garmin exposes two relevant developer surfaces:
  - **Garmin Health API** — Garmin's official API, JSON summaries of all-day metrics (heart rate, sleep, HRV, stress, respiration, body composition). Geared toward enterprise/wellness use cases but usable for a personal project; requires registering as a developer and going through Garmin's approval process.
  - **Garmin Connect API** — covers individual activities/events (runs, rides, swims) plus the same health metrics, with GPS/route data included for GPS-tracked activities. Uses **OAuth 1.0a with signed requests** (older/more complex than typical OAuth 2.0) and a **push-based model** — Garmin sends data to a registered callback URL on sync rather than Jason's app polling for it. Roughly 30-day historical backfill is available on first connect.
  - An **unofficial** library (`python-garminconnect`) exists and is commonly used for personal projects, but it works by scraping Garmin Connect session data rather than using the official API — fine for a personal/hobby build, but fragile (breaks on Garmin-side changes) and not appropriate if this were ever productized beyond personal use.
- **Relevance here:** worth using if Jason's sleep/HRV/RHR data actually originates from a Garmin device/watch rather than (or in addition to) an Apple Watch. If Garmin is the source, going directly to the Garmin Connect API may be more complete/reliable than relying on HealthKit/Health Connect as an intermediary, since it's the source of truth rather than a re-export.
- **Open question:** confirm which wearable (if any) Jason currently uses for sleep/HRV/RHR tracking — this determines whether Garmin, HealthKit, or Health Connect is the primary path for that data.

## Local Storage & Future Cloud Sync Strategy

### Initial ride pull (first-run)
On first run, the user selects one or more exported FIT files through the native file picker. Batch import supports historical backfill without requiring the user to connect an account.

### Ongoing storage: local-first, permanently
Every imported ride is saved to the local on-device database and becomes part of the app's permanent local ride history. New rides are added by importing new FIT files. The original FIT file is retained locally for reparsing after parser or schema upgrades.

### FIT import and ride identity rules
- Support batch selection and process each file independently; one invalid file must not roll back successful imports.
- Preserve the original FIT file and calculate a SHA-256 content hash. Version the parser so stored originals can be reparsed later.
- Preserve available timestamps, GPS, distance, elevation, power, heart rate, cadence, speed, temperature, and device metadata. Normalize stored values to metric units; missing sensors remain missing rather than becoming zero.
- Use UTC internally and retain the original timezone/offset when available.
- Prefer FIT activity/session identifiers for ride identity. An exact content hash is an exact duplicate.
- If no reliable activity identifier exists, warn of a duplicate only when the recording device matches and both start time and duration are within five seconds. Route similarity must never declare a duplicate because the same route may be ridden every day.
- A duplicate prompt offers **Keep Existing** and **Replace Existing** only. Replacing preserves the app's internal ride ID, replaces parsed data, clears prior segment decisions, and reruns all segment matching. Importing a second independent copy of the same physical ride is not allowed.
- Report imported, duplicate, replaced, and failed counts after each batch.

### Relationship to the future AI coach and cloud backend
Local-first storage remains the right foundation for the MVP and beyond, but the AI coach layer (deferred, see Feature 3) will likely need cloud infrastructure eventually: reasoning over potentially large ride histories favors a capable server-side model, and ideally the coach should be accessible beyond just the one device (e.g. a future web dashboard).
- **These aren't in conflict.** The local on-device database remains the primary, fast, offline-friendly store for day-to-day use (ride browsing, segment comparison). A lightweight sync layer can later mirror that same data up to a cloud backend as a secondary copy purpose-built for the AI coach to query — this is the same backend already anticipated in the Auth & Multi-User Foundations section below, just arriving in the architecture discussion earlier.
- **No cloud sync work needed for MVP.** The only forward-looking requirement is keeping the local data model clean and well-structured now, so that building a sync-to-cloud job later is straightforward rather than a redesign.
- **Local storage work is not wasted effort either way** — it's the foundational layer regardless of if/when cloud sync and the AI coach are eventually built.

## Auth & Multi-User Foundations

Since this is intended as a product for multiple users (not just a personal single-device tool), a login/account system is required — not optional — even though this is a mobile-only app with no desktop component.

### Why login is required
- **OAuth token custody** — integrations like Garmin's Connect API (and potentially others) issue tokens tied to an account; those tokens need to be associated with a specific user, not just "whoever has this phone."
- **Push-based webhook routing** — Garmin uses a push model (data sent to a registered callback URL on sync). The backend needs to know which user a given webhook payload belongs to, which requires real account identity, not device-local state.
- **Cross-device continuity** — if a user switches phones or uses the app on two devices, an account lets their data follow them rather than being stuck in one local install.
- **Segment sharing** — ties into the open-source segment library discussion; if segments become shareable/discoverable across users, ownership and permissions require identity.

### Recommended approach (kept lightweight)
- **Sign in with Apple / Sign in with Google** as the primary login methods — minimal user friction, and Apple requires offering Sign in with Apple if any other third-party login (e.g. Google) is offered, so both should likely ship together.
- Backend needs a `users` table (id + auth provider identity); every other table — rides, segments, goals, OAuth tokens for Garmin/Hammerhead/etc. — foreign-keys to that user id.
- **Local-first still applies within a user's own data**: cache rides/segments/goals on-device for fast access and offline use, with the backend acting as the sync/source-of-truth layer for cross-device continuity and webhook ingestion — not a wholesale shift to cloud-first architecture.

### Downstream implication
This confirms the app needs a real backend (not just a local SQLite-only app), consistent with the earlier note that push-based APIs like Garmin's require a stable public server endpoint regardless of platform.

## MVP Scope — Thin Slice for the Hill Climb Goal

Given the ~7-week timeline to October 3, 2026, the MVP deliberately narrows to a single end-to-end loop, all within the React Native app, with everything else deferred. Scope stays fixed at this thin slice regardless of the extra runway beyond the original 4–6 week estimate — the buffer is not being spent on additional features.

### In scope
1. **Batch FIT-file import (outdoor rides only)** — import one or more Karoo-exported FIT files with progress, per-file error handling, duplicate review, and preservation of all available GPS and sensor data.
2. **In-app segment definition screen** — a single native screen (using the MapLibre/OSM map stack) that renders a ride's GPS track as a line on a map, with two draggable scrubber handles along that line for marking segment start and end (Strava-style UX). No separate web interface or public URL sharing needed for MVP — the scrubber-on-known-track approach solves the "precise placement" problem without needing a zoomable standalone web tool.
3. **Automatic directed segment matching, including retroactive history** — scan every imported ride against each immutable directed reference polyline and save every valid traversal, including multiple traversals within one ride.
4. **Advanced diagnostic review** — review completed but borderline candidates during MVP matcher tuning; automatic matches need no review.
5. **Overlay comparison view** — compare attempts using cumulative elapsed-time gap, power, heart rate, and elevation on a shared 10-meter distance axis.

### Explicitly out of scope for MVP (deferred)
- Peloton ingestion / indoor rides
- Android support (HealthKit/Health Connect work)
- AI coach layer
- Goal dashboard / multi-goal home experience
- Open-source segment library extraction
- Multi-user accounts / login / auth
- Garmin API integration
- Weather/temperature beyond what the Karoo records natively
- Direct Hammerhead OAuth/API integration, Terra, webhooks, and automatic provider sync
- Cloud segment sharing/registry

### Forward-compatibility note (build for this now, even though it's out of scope)
Per the Ambient Contextual AI ("Long-Press Insights") concept described later in this spec, the MVP should be built with a few habits in mind even though no AI code is in scope yet: structure each screen's data as clean, well-labeled objects rather than implicit chart-only context; keep the local data model consistent and query-friendly; and build reusable chart/card components (e.g. one shared overlay chart component, one shared stat card component) rather than one-off per-screen implementations. See "MVP forward-compatibility requirements" under the Ambient Contextual AI section for full detail.

### Rationale
This scope is intentionally the smallest loop that's actually useful for the immediate goal: import real rides, define the one segment that matters, find every historical traversal, and compare attempts before the PR effort. Automatic provider ingestion is convenience work and must not block validation of the core product.

## MVP User Flow — First-Time Experience

### First-run flow (guided, goal-focused)
1. **Import FIT files** — explain how to export rides from Karoo, open the native file picker, and import one or many files.
2. **Guided segment creation** — the first-run experience funnels the user directly into creating their one segment (e.g. the hill climb) as a guided setup step, not something they have to discover on their own. User selects a past ride (e.g. their most recent/best hill climb attempt), sees the route rendered on the map, drags the start and end scrubbers to mark the climb, and names the segment (e.g. "Hill Climb PR").
3. **Immediate retroactive scan** — the moment the segment is saved, the app scans full ride history and surfaces any other past rides that crossed that same stretch, automatically sliced into segment attempts.
4. **Land on comparison view** — user arrives at the overlay comparison view for that segment, seeing baseline attempt(s) with power and heart rate ready to overlay.
5. **Ongoing matching** — every newly imported ride is automatically scanned against saved segments, and every valid attempt appears without manual tagging.

### Segments as a persistent app section (not just first-run)
Segment creation is not a one-time-only flow — it's a permanent feature accessible via a dedicated **Segments** section in the app, where the user can create additional segments at any time (select a ride, use the scrubber tool, name it, save it). The first-run experience is a guided/funneled version of this same underlying feature, aimed specifically at getting the user to their first segment quickly rather than presenting general app exploration.

## App Navigation

### MVP navigation: three-tab structure
A simple bottom tab bar with three tabs, deliberately minimal for the MVP:
- **Home** — goal-first landing screen, centered on the hill climb goal specifically, surfacing the latest comparison against the baseline attempt front and center.
- **Segments** — view existing segment(s) and create new ones via the map scrubber tool (select a ride, drag start/end handles, name and save).
- **Rides** — a list of imported rides and the entry point for batch import and segment creation.

### Home screen (MVP) — detailed
Home is intentionally simple for the MVP, built around the single hill climb goal rather than a multi-section dashboard:
- **Goal statement** — the goal stated plainly at the top (e.g. "Hill Climb PR, target 39 minutes").
- **Current status** — current best or most recent attempt time, and how far off the target that is.
- **Primary call to action** — a button/link that jumps straight into the comparison view (overlay vs. baseline) for that segment.
- **Recent ride activity** — a list of recent synced rides directly on Home (not just accessible via the Rides tab), so the user can quickly tap into a recent ride without needing to switch tabs.
- **Two states:**
  - **Before first segment exists** — Home shows the guided prompt/nudge to create the first segment (ties into the first-run flow described earlier).
  - **After first segment exists** — Home shows the goal summary, current status, comparison CTA, and recent ride activity as described above.

### Ride detail screen (tapping into a ride from the Rides tab)
Tapping a ride from the Rides list opens a detail view of that single ride — the raw ride data before any segment matching is applied:
- **Key stats header** — total distance, total time, average power, average heart rate for the full ride.
- **Route map** — the ride's GPS track rendered on the map (MapLibre/OSM stack, consistent with the rest of the app).
- **Full-ride charts** — power, heart rate, and elevation plotted over the course of the entire ride, giving a general sense of the effort beyond just the segment.
- **Segment match callout** — if any part of the ride matches an existing saved segment, a highlighted card surfaces this (e.g. "Hill Climb PR attempt detected in this ride"), tapping through to that segment's comparison view.
- **Create segment shortcut** — an action on this screen to create a new segment directly from this ride, launching the segment scrubber screen pre-loaded with this ride's track by default (rather than requiring the user to separately navigate to Segments and re-select the ride).

### Post-MVP navigation growth
The MVP's three tabs are designed to be a clean subset of a larger future structure, not something that needs to be torn out and rebuilt as the app grows:
- **Goals** — Home evolves into a full goals dashboard once multiple concurrent goals exist (not just the one hill climb), consistent with the goal-centric product concept described earlier in this spec.
- **Segments** — unchanged, carries forward as-is.
- **Rides** — unchanged, carries forward as-is.
- **Coach** — a new tab for the AI coach layer (Feature 3), likely a conversational/chat-style interface.
- **Profile / Settings** — a new tab for account and settings, needed once multi-user accounts and auth are introduced.
- Net effect: the tab bar is expected to grow from 3 items (MVP) to roughly 5 items (post-MVP: Goals, Segments, Rides, Coach, Profile/Settings), with each MVP tab surviving into the larger structure rather than being replaced.

## Long-Term Vision: Beyond Segments to Broader Workout Comparison

### The bigger picture this app is aimed at
Existing tools don't serve this well today: Strava doesn't do this kind of segment-level detail, and Jason's current AI training app doesn't either. The long-term vision extends beyond fixed-route outdoor segments into a broader personal sports-science tool: comparing **any similar workout experience**, not just repeated attempts at the same physical segment. Example: comparing the last five one-hour zone 2 Peloton rides against each other, correlating performance against contextual factors like temperature, time of day, body weight, and sleep score to understand what actually affected a given ride's outcome.

### What this means for MVP scoping
The MVP (FIT-imported outdoor ride loop: scrubber-based segment creation, retroactive matching, diff overlay comparison) proves out the hardest and most novel technical piece of this vision — distance-aligned comparison between two efforts on the same physical challenge. Explicitly deferred beyond MVP:
- Peloton ingestion
- Biometric/contextual data layer (sleep, weight, resting heart rate, temperature, time of day)
- Correlation/pattern-finding across a *class* of similar workouts (same type/duration) rather than a single fixed segment

### Forward-compatible data model (important even though deferred)
Even though biometric context and cross-workout correlation are not being built in the MVP, the underlying **ride and segment-attempt data model should have room for this data from day one** — fields for sleep score, temperature, body weight, etc. should exist in the schema and be able to be populated later (including backfilled onto historical rides), even before any UI or analysis is built against them. This avoids being blocked from enriching past rides retroactively once that layer is eventually built.

## Power Zones and Heart Rate Zones in Segment Comparison (fast-follow after MVP)

Raw power and heart rate numbers alone don't fully capture effort — knowing which **zone** a rider was in (e.g. zone 3 vs. zone 4) is a more meaningful signal of relative effort/efficiency than raw wattage or BPM alone, especially when comparing two attempts at different paces.

- **Explicitly flagged to not be forgotten**: this is planned as the fast-follow enhancement immediately after the MVP's core diff-overlay comparison view is working with raw power/heart rate data — not part of the MVP itself, but a near-term priority right after.
- **Requirement:** the app needs to store the user's zone thresholds (e.g. functional threshold power for power zones, max/threshold heart rate for HR zones) so each data point in a ride/segment can be classified into a zone.
- **Application:** once available, the segment comparison view would show zone breakdowns per attempt (e.g. "spent most of this climb in zone 4 vs. zone 3 on the previous attempt") alongside the existing raw-value diff overlay — giving a clearer signal of effort/efficiency differences beyond just pace.

## Post-MVP Roadmap: Beyond the MVP

Assuming the MVP proves the core loop is useful, the following is the rough sequencing and shape of what gets layered on next.

### Sequencing: data breadth before AI
1. **Peloton ingestion (via HealthKit)** — unlocks a whole new category of workouts (e.g. zone 2 indoor rides), matched by type/duration rather than fixed GPS route.
2. **Biometric/contextual data (sleep, resting heart rate, HRV, weight, temperature, time of day)** — layered in alongside or just after Peloton data, since this is what makes cross-workout comparisons genuinely insightful (explaining *why* a ride felt different) rather than just more overlay charts.
3. **AI coach layer** — deliberately sequenced *after* the above, since the coach is only as useful as the richness of data it has to reason over. Once segments, workouts, and biometric context all exist together, a conversational coach asking/answering things like "why was my heart rate so much higher on Tuesday's ride" has real data to work from, rather than offering generic advice.

### Rides vs. Workouts: parallel comparison models
A useful mental model going forward: **rides** are GPS-based activities that support segments (the MVP's core concept), while **workouts** are activities matched by type and duration without shared GPS (e.g. Peloton zone 2 sessions). Critically, workouts don't need new comparison logic — they reuse the exact same diff-overlay and historical-trend-band patterns already designed for segments, just with a different alignment axis (elapsed time or percent-through-workout, rather than GPS distance) since indoor workouts have no distance-based route to align on. This means:
- **Workout-to-workout comparison** — mirrors the one-to-one segment diff overlay (e.g. this zone 2 ride vs. a specific previous zone 2 ride).
- **Workout-vs-historical-norm comparison** — mirrors the historical band visualization designed for segments (e.g. this zone 2 ride vs. the typical shape of past zone 2 rides).
- Net effect: meaningfully less net-new design/engineering work than it might first appear, since it's the same underlying comparison engine applied to a different data source and alignment axis.

### Expanding beyond cycling: running and general activities
Adding running (or other activity types) as a future direction reveals that the true underlying model is broader than "cycling app" — it's really "any GPS or sensor-tracked activity with repeatable structure." Running specifically strengthens the case for **whole-activity comparison**, not just segment comparison: when running the same loop repeatedly, the entire run's start/end is essentially already fixed by the route, so comparing "this whole 5k vs. my last 5k on the same route" is often just as natural as (or more natural than) carving out sub-segments within it — unlike cycling, where the same road often appears as part of many different, longer, varied rides, making segment-level isolation more essential.

This suggests evolving the data model to **three tiers** rather than two:
- **Activities** — the top-level tier: a full bike ride, a full run, or eventually other activity types, each with its own GPS track and full set of sensor data.
- **Workouts** — activities matched by type/duration without requiring shared GPS (e.g. Peloton rides), as described above.
- **Segments** — GPS-defined sub-portions of an activity, applicable across activity types (e.g. a specific hill within a longer run, not just within a bike ride).

The comparison engine (diff overlay + historical band visualization) remains the same reusable core underneath all three tiers, since fundamentally each comparison is just aligning two or more time-series along some shared axis and diffing them — what varies is the axis used (distance, elapsed time, percent-complete) and how two things are determined to be comparable in the first place (same segment, same workout type/duration, same full route).

## Post-MVP Concept: Ambient Contextual AI ("Long-Press Insights")

### The core idea
Rather than treating the AI coach as a bolt-on destination (a separate chat tab you have to navigate to and re-explain your context to), the AI should be woven into the ethos of the app itself — available contextually, everywhere, without requiring a context switch. This is a meaningfully more ambitious design than a standalone chat interface, and worth calling out explicitly as its own concept.

### The mechanism: long-press insights
Any visual element in the app — a point on a segment's diff overlay, a dip in a sleep score chart, a specific segment attempt card, an HRV trend line — becomes **long-press-able**. Long-pressing doesn't open a generic chat; it opens a chat that's **already pre-loaded with exactly what the user was looking at as context** (the specific data point, metric, time range, or comparison in view). This means the AI's first response can already be specific (e.g. "I see you're asking about the middle of this climb, here's what was different") rather than requiring the user to first explain what they're even looking at. From there, the user can also just ask a free-form question grounded in that same context (e.g. "why do you think my sleep score is getting worse relative to my HRV?").

### What this requires architecturally
- **Structured context snapshots** — every screen/chart component needs a way to package up "what is currently being shown" into a structured chunk the AI can consume: not just raw numbers, but labels for which segment, which metric(s), which specific rides/workouts are being compared, what time range, etc.
- **Shared data access** — the AI needs access to the same underlying data the charts themselves pull from (segment attempts, sleep, HRV, workouts), so it reasons over real numbers rather than guessing from a rendered chart.
- **One consistent interaction pattern app-wide** — the same long-press gesture and chat bubble/response style should work identically on Home, Segments, sleep/biometric trend views, etc., so it feels like one coherent, ambient capability rather than each screen inventing its own bespoke AI feature.

### Design tradeoff worth noting
This is more work than a single bolted-on chat tab, since a standalone chat only needs one interface, whereas ambient contextual AI requires every relevant screen to be "AI-aware" (able to produce a context snapshot). However, it's a substantially stronger, more differentiated product experience, and is considered worth building deliberately rather than rushing, once the underlying data picture (segments, workouts, biometric context) is rich enough to make the AI coach genuinely useful in the first place (see sequencing in the Post-MVP Roadmap above).

### MVP forward-compatibility requirements (build these habits now, even with no AI code in the MVP)
No AI-facing code needs to be built in the MVP itself, but a few architectural habits adopted now will make ambient contextual AI dramatically easier to add later rather than requiring a retrofit:
- **Structured, labeled data over implicit rendering** — every screen's underlying data should be modeled as clean, well-named structured objects (e.g. "this is segment X, comparing the attempt from this date against the attempt from that date, showing the power metric") rather than context that only exists implicitly in how a chart happens to be drawn. This makes packaging a future AI context snapshot trivial rather than a rewrite.
- **Clean, consistent local data model** — reinforces the local storage approach already established: the AI will ultimately query the same rides/segments/attempts data the UI already displays, so keeping that local data well-structured now means it's directly reusable later rather than needing reshaping.
- **Reusable chart/card components, not one-off implementations** — build a small number of shared, reusable components (e.g. one reusable overlay chart component, one reusable stat card component) rather than bespoke one-off code per screen. This matters specifically for the long-press gesture: adding it once to a shared component automatically covers every place that component is used, rather than needing to be added individually to a dozen bespoke implementations.

## AI Memory Architecture

### No chat history — memory instead
A deliberate product decision: the AI chat experience should **not** present a conventional chat history the user has to scroll back through to find old context. Instead, the AI should rely on a genuine memory system so that anything discussed previously is simply already known in any new conversation, voice or text, without the user needing to dig up or reference an old thread. The chat history model (separate stale threads you have to reopen) is explicitly being avoided in favor of persistent, retrievable memory as the primary mechanism for continuity.

### How this works technically
The established pattern (confirmed via current research, since this space moves quickly) is fact extraction plus retrieval, not full-transcript storage:
- As conversations happen, discrete facts are extracted and stored as small, structured, semantically searchable entries (e.g. "user's functional threshold power is 250 watts," "user's sleep has been trending worse over the past month") rather than storing raw transcripts.
- At the start of any new conversation, the system searches this memory store for whatever's relevant to the current question and quietly feeds just those relevant facts into the AI's context — the AI never needs to "reread" an old conversation.
- A layered approach is typical: a short sliding window for the live conversation, periodic summarization for long single sessions, and persistent fact-based memory for anything that should carry indefinitely across sessions (goals, zones, recurring patterns).

### Recommended library: Mem0
Based on current research into open-source AI memory frameworks, **Mem0** is the recommended starting point:
- Most widely adopted general-purpose option (~48,000 GitHub stars), with real funding and broad framework support.
- Purpose-built for exactly this use case: personalization and remembering facts about a specific user across sessions — directly matches the need here (remembering Jason's zones, goals, and training patterns over time), as opposed to more specialized alternatives.
- Alternatives considered: **Zep** (stronger specifically at reasoning about facts that change over time, e.g. sleep trending worse over months, but has moved toward a more cloud-focused/less self-hostable model recently) and **Letta** (better suited to complex autonomous agents managing their own memory, more than this app's simpler personalization need).
- **Caveat:** this space changes quickly (new frameworks and benchmarks emerge frequently) — worth reconfirming Mem0 is still the right pick at the time this is actually built, rather than treating this recommendation as permanent.

## Ambient AI Insights: Proactive, Not Just Reactive

Beyond the long-press insights pattern (user-initiated), the AI should also **proactively surface insights unprompted**, appearing at genuinely relevant moments throughout the product — not as a bolt-on "AI summary" feature bolted formulaically onto every screen.

### The key distinction: editorial judgment, not formulaic captioning
The critical requirement is that this must **not** be a rote pattern like "always show an AI summary block under every chart." Instead, the AI needs to exercise judgment about what's actually interesting or worth calling out in the specific data it's looking at, and only surface something when there's a genuine insight — the same way a sharp coach glances at your data and says "huh, that's interesting" only when something is actually interesting, not after every single ride.
- Example of the desired behavior: a small insight callout (e.g. a text bubble anchored under a specific chart or data point) appears specifically when the AI has identified something notable — e.g. a recurring pattern, an anomaly, a meaningful trend inflection — not as a permanent fixture under every piece of data regardless of whether anything is actually notable.
- This requires the underlying system to evaluate data for "is this worth mentioning" rather than simply always generating commentary on demand.

### Relationship to other AI concepts in this spec
This is a third, complementary mode of AI presence alongside the memory system (above) and the long-press insights pattern (see Ambient Contextual AI section): memory ensures continuity across interactions, long-press insights are user-initiated and context-aware, and proactive ambient insights are AI-initiated and judgment-driven. Together these are meant to make the AI feel woven into the app's ethos rather than a bolt-on feature living in a separate chat tab.

## Post-MVP: Historical Trend Comparison View

Beyond one-to-one attempt comparison (the MVP diff-band overlay), there's a natural extension once enough attempts on a segment accumulate: comparing a ride against the full history of attempts on that segment, not just a single other ride. Explicitly flagged as post-MVP — valuable, but not needed for the initial hill climb PR push.

### Two comparison modes going forward
- One-to-one — the existing MVP diff-band overlay: a specific ride vs. a specific other ride.
- One-to-history — a specific ride (typically the most recent) vs. the aggregate of all past attempts on that segment.

### Approach: spaghetti plot (simplest version)
Every past attempt is plotted as a thin, faint line on the same distance-based chart, all layered on top of each other. Visually, tight clustering of lines at a given point on the segment indicates consistent performance there across attempts, while wide spread indicates a point where performance varies a lot ride to ride — useful for spotting recurring trouble spots (e.g. "I always lose time at this one corner").

### Approach: historical band with current ride overlaid (preferred, cleaner version)
Rather than showing every individual line, compute a shaded band representing the typical/normal range (e.g. min-max or a percentile range) of the metric at each distance point across all past attempts, with the current or most recent ride plotted as a single bold line on top. This immediately shows:
- Whether the current ride is ahead of or behind historical norms at each point along the climb.
- Recurring weak points, visible as places where the historical band itself consistently dips or spikes, i.e. a pattern true across attempts rather than a one-off.

### Relationship to MVP
This reuses the same distance-based resampling approach established for the MVP one-to-one diff overlay, extended from two data series to many. Deferred post-MVP since it requires a meaningful number of accumulated attempts to be useful, and the one-to-one comparison already serves the immediate hill climb PR goal.

## Remaining Post-MVP Questions

- Confirm Android Peloton → Health Connect/Samsung Health availability before building Android indoor-workout ingestion.
- Choose between direct Hammerhead integration and an aggregation provider only after automatic synchronization has demonstrated product value sufficient to justify its engineering or subscription cost.
- Define governance, discovery, moderation, and optional identity for the future cloud registry of immutable shared segment definitions.
