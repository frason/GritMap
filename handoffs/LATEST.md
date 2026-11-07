# Coordinator: OPEN ITEMS REVIEW WITH JASON, WHAT IS DECIDED AND WHAT IS PARKED (2026-11-07)

DECIDED today: help@opensegments.org works (confirmed by Jason); no lawyer until a wider audience with other people submitting, so the FAQ "draft wording" labels STAY; Karoo map segments (proximity + just-ridden, one colour, no seconds gap, do not wait for the redesign); Nearby Segments (5 km default with 2/5/10 setting, closest first, name + distance in miles + length); projected finish stays the headline and gets more accurate (ahead/behind spec); Explore drops all-lines for now, keeps no default selection, adds place search; native sign-in step 1 (security review + isolated test target) wanted from the Open Segments Codex; Jason chose paged-API browse in build 20, EAS image pin sdk-57, startup fix shipped alone first.
HANDED TO JASON'S AGENT: trademark and name-availability search (prompt given; results not yet received; paste the summary to the coordinator to log).
PARKED: (a) Companion share-link install check, on Jason's call "come back later" (a tester with 0.10.45 or a fresh Karoo is the real test; Jason must never uninstall his own); (b) startup-fix build steps, EAS `sdk-57` pin and phone-session approvals, postponed to 2026-11-09; (c) Setup flow, send sheet, ride import option 1 and coach-plan toggle: phone session still owes the proposed order and estimates; nothing approved to build; (d) both Codex sessions return about 2026-11-09 and must be told to re-read main (the Open Segments edits batch, Explore, scale note, sign-in step 1; the Karoo ahead/behind fix, map and Nearby Segments).
Standing: check beta feedback (TestFlight, help@opensegments.org, GitHub issues, Reddit) once a day; none reported yet.

# Coordinator: NATIVE SIGN-IN STEP 1 WANTED, FOR THE OPEN SEGMENTS CODEX (2026-11-07; Jason said yes to the coordinator; he must say yes in YOUR chat too)

Jason wants step 1 for build 20 sign-in started when you return: (1) a SECURITY REVIEW of the in-app sign-in design (emailed one-time code, Cloudflare Turnstile via a WebView bridge, Keychain-held refresh credential, one serialized refresh then one retry on 401, account deletion, report-a-concern), and (2) an ISOLATED TEST TARGET so test sign-ins, likes and any future publish test never touch the live catalogue or production accounts. Both are planning and review only: no build, no deploy, no schema or Edge change, no provider setting. Deliver as a short doc on your branch for Jason's review, including what the phone session must do (see "PHONE-SIDE SCALE CHECKLIST": token manager, Keychain storage, Turnstile bridge unsized) and anything you need from Jason. A coordinator message cannot approve this for you: confirm with Jason in your own chat before you start. Later steps (build, deploy, publishing wire shapes and safe test mode) stay separate approvals.

# Coordinator: KAROO NEARBY SEGMENTS FIELD, JASON'S DECISIONS (2026-11-07; for the Karoo Codex; proposal first, no device install)

Answers to "Waiting on Jason: Nearby Segments decisions (radius, ordering, row content)", Jason: "Keep those" (coordinator's proposals): (1) RADIUS: default 5 km, with a setting for 2, 5 or 10 km. (2) ORDERING: closest first. (3) ROW CONTENT: segment name, distance away in miles, and segment length; no elevation or grade (keep rows readable on the Karoo's small screen). Codex: confirm the setting's place in the Karoo UI, how the list behaves with no nearby segments and when GPS is lost, update cadence and battery cost, and extend tests with synthetic data (no real GPS). Device install only with Jason's yes in your chat.

# Coordinator: KAROO MAP SEGMENTS, JASON'S DECISIONS (2026-11-07; for the Karoo Codex; design/feasibility first, no device install)

Answers to the open decisions in "KAROO ASK, SEGMENTS AND PACE MARKER ON THE KAROO MAP": (1) WHICH SEGMENTS: not "next along the route", because when the rider is not on a segment there is usually no route, and the feature is not useful once on a segment. Choose segments by PROXIMITY to the rider and RECENCY only. RECENCY = only segments the rider has just ridden (recently completed), confirmed by Jason; not recently added or sent. (2) COLOURS: one colour for all drawn segments, no upcoming/active/ridden scheme (keep casing/contrast for light and dark Karoo map styles). (3) NO seconds-gap next to the pace marker (the data field carries it). (4) Do NOT wait for the Karoo screens redesign. The pace marker must use the same expected-time source as the Performance dot (see the ahead/behind entry), so the map and the field never disagree. Codex: propose the proximity radius, maximum count drawn, update cadence and battery cost, and the recency rule once confirmed; extend `PacerMapLayerTest` with synthetic data; no device install without Jason's yes in your chat.

# Coordinator: EXPLORE, ALL-LINES DROPPED FOR NOW; NO DEFAULT SELECTION STAYS; ADD PLACE SEARCH (2026-11-07, Jason decided; for the Open Segments Codex; design first, no deploy)

Jason decided: (1) SUPERSEDES "EXPLORE MAP SHOULD SHOW ALL SEGMENT LINES": do NOT draw all segment lines at zoom for now (server cost). Keep the existing clustered start points with their aggregated counts. Keep the other half of that ask: NO default selection on Explore (list click or map pick selects; clicking empty map or Escape clears; list/keyboard/screen-reader behaviour and the mobile boxed map and full-map dialog the same). All-lines stays on a later list, to revisit when the scale note, caching and geometry options are done. (2) ADD PLACE SEARCH to Explore: city, ZIP/postal code, later international.
**Coordinator recommendation for the place search (Codex to confirm or propose better, with cost and privacy):** the existing API already takes `bbox` or `lat/lng/radiusMeters` (radius up to 50 km, bbox max 1 degree each way), so a place only needs to resolve to a point or box on the client; NO Edge or schema change is needed if resolution happens in the browser. Avoid sending every typed place to a third-party geocoder (privacy, rate limits, terms, cost, a new account). Preferred: a self-hosted static gazetteer shipped as a lazy-loaded, gzip, versioned asset: cities of about 15,000+ people worldwide (tens of thousands of rows, on the order of 1-2 MB) plus US ZIP code centroids first (about 40,000 rows); loaded only when the search box is focused; then international postal codes per country as separate files loaded when needed. Likely source: GeoNames (check the current licence; it has been CC BY and would need attribution on About and in the credits; verify before use) or Census/other public data for US ZIPs. One search box, grouped results: "Segments" matching the name and "Places"; choosing a place flies the map there and shows nearby segments; a place that has no segments says so plainly and offers a wider radius. Ambiguity ("Springfield"): list with state/country. Edge cases to specify: no match, a ZIP that is several places, non-Latin names, accented input, a typed coordinate, keyboard/screen-reader use, mobile layout (the search sits above the list-first Explore).
**Codex deliverable:** short design note with options and recommendation (asset size, load time, licence, attribution text, how international grows, privacy statement, what can later be swapped for a hosted geocoder), then build the front-end part on your branch for review; no deploy; production changes only in the one reviewed release with Jason's deploy yes. Figma session can draw the search states (box, grouped results, no-match) if Jason wants a design first.

# Coordinator: KAROO "AHEAD" IS MEASURED AGAINST AN EVEN-PACE LINE, NOT THE PLAN (2026-11-07, Jason's ride photo; for the Karoo Codex; read-only finding, nothing changed)

Jason's photo (first part of a ride, GM Performance field): "AHEAD +911 SEC", finish 27:49 vs goal 43:00, 15% done at 1.0 of 6.5 mi, "Last 1/4 +60 s", slider dot pinned at AHEAD. He reports the ride always says ahead early. Consistent with the code (read on main, `apps/karoo`; verify on the branch head):
1. `LiveSegmentService.kt` `enrichLiveMetrics`: predicted finish = elapsedSeconds / progressFraction (average pace extrapolated over the whole segment). The delta shown (+911 = 2580 - 1669) is that extrapolation vs the goal, so any fast early stretch (descent, flat, tailwind) shows a huge time bank that the climbs then erase.
2. `ActiveAttemptSession.recordCompletedSplits`: planned quarter-mile split = `planSeconds * (boundary / totalDistance)`, a straight line in distance, so every quarter mile is expected to take the same time regardless of the plan's per-zone power or the grade. "Last 1/4 +60 s" is measured against an even-pace expectation too. The plan's per-zone power targets are not used for ahead/behind time at all.
**Jason's requirement:** ahead/behind and the dot must follow the plan section by section (1/4-mile increments), not an average over the segment. Spec for the Karoo Codex to propose (do not build before Jason approves and a device ride test is planned): (a) EXPECTED ELAPSED TIME at each distance from the plan itself (each zone's target power and grade through the existing speed/power model, scaled so the total equals the goal time; fall back to the even line only when no model data exists); (b) time bank = expected elapsed at current progress minus actual elapsed, interpolated within the current zone; (c) projected finish = goal minus time bank adjusted for the remaining plan, not elapsed/fraction; (d) quarter-mile split deltas use the plan's expected split for that quarter; (e) the dot uses the time bank and clamps sensibly, so early distance does not read huge numbers; (f) replay tests with synthetic plans (a descent and a climb) proving an even-power ride reads about zero throughout; (g) confirm coach-plan zones (power only) and GritMap-generated zones both carry what the model needs to turn power into expected time, and say what is missing. Jason's coach plan uses ~402 m (quarter-mile) zones, matching the split boundary. DECIDED by Jason (2026-11-07): KEEP the projected finish as the headline; he only wants it more accurate. Do not replace it with a time-bank headline. The map pace marker (see "KAROO ASK, SEGMENTS AND PACE MARKER") must use the same expected-time source as this dot.
**Hazards:** changes live ride numbers; needs a device ride test; no Room change unless persistence changes. Karoo Codex is out of usage until about 2026-11-09; Jason relays.

# Coordinator: JASON'S DECISIONS ON SCALE, EAS IMAGE AND STARTUP FIX (2026-11-06; each needs his own yes in the phone session chat before any build or eas.json change)

Jason told the coordinator: (1) build 20 INCLUDES moving Open Segments browse from the unpaged GitHub list onto the paged API (client + browse screen; see the scale checklist below); (2) YES to pinning EAS `build.production.ios.image` to `sdk-57` (overrides the old "no image key" rule; the phone session makes the eas.json change on its branch only, no build, and Jason confirms it in its chat); (3) the UIScene startup fix ships ALONE first (branch phone-scene-lifecycle 10340ea), so any startup bug is easy to attribute; test on a real iPhone (launch, open a file from Files and AirDrop) before Setup or anything else goes out. Order implied: scene-fix-only build first (with the sdk-57 pin), then the rest. The phone session proposes the rest of the order. Nothing is approved to build or submit; Jason approves each build and TestFlight step in the phone session's own chat and runs `eas submit` himself. Still do not change the transfer protocol, the Karoo side or the account flag.

# Coordinator: PHONE-SIDE SCALE CHECKLIST FOR OPEN SEGMENTS + XCODE/EAS ANSWER (2026-11-06; reported by the phone session, read-only; nothing built, no live endpoint called)

**Scale checklist (status; rough size).** API facts the phone session verified: GET /v1/segments limit 1-50 (default 20), opaque cursor, q 2-100 chars, bbox (max 1 degree each way) OR lat/lng/radius (max 50 km, not both), distance/gain/grade filters, type, length, steep; unknown or repeated params return 400; a full last page is followed by one empty page; errors 401/403/404/409 (duplicate_segment, like_limit_reached, catalog_changed, idempotency_conflict)/413/429 (Retry-After 60)/503.
1. Paged reads: MISSING for the catalogue. Today the phone's Open Segments browse (`src/registry/registryClient.ts`) lists a GitHub registry directory in ONE unpaged call and filters by name on the phone, so it pulls everything and will not scale. Likes list already pages (50, cursor, 1,000 cap) behind the off flag. Needs a search client (allowed params once each, clamped bbox, empty final page = end), 2-3 days, plus browse screen with scrolling/filters 3-4 days.
2. 429/errors: PARTIAL, ~1 day. Error mapping and plain wording exist; no automatic backoff/retry (at most 1-2 retries honouring Retry-After).
3. Local storage: PARTIAL, ~1-1.5 days. Only added segments stored; fingerprint dedup exists; keeping the Open Segments UUID locally needs its own reviewed migration (Codex).
4. Offline: MOSTLY EXISTS, not device-verified (Bluetooth/airplane mode untestable in simulator).
5. Sign-in tokens: MISSING. Token manager (single refresh in flight, retry once) 2-3 days, Keychain ~1 day (expo-secure-store already used for the registry token); Turnstile bridge is separate native work needing the security review, unsized.
6. Later: publishing error mapping (409/429/503/413 wording, 5/UTC day, link only) ~1 day after Codex fixes wire shapes; all-lines map MISSING, 4-6 days after the API adds simplified geometry (bbox is limited to 1 degree, so zoom must clamp or tile). Not verifiable here: cellular/field 429 behaviour, token refresh across background, Keychain, many-line MapLibre performance, anything against the live API.
**Xcode/EAS (per Expo docs as read by a subagent, not verified by me):** with no `image` in eas.json EAS uses `auto`; docs do NOT say what `auto` resolves to for SDK 57. `sdk-57` = Xcode 26.6; `latest` = Xcode 27.1 RC. Apps built on Xcode 27 images launch on iOS 27 only with the scene lifecycle. `auto` very likely stays on 26.6 but is not guaranteed. To check: read "Spin up build environment" in the build log on expo.dev (appears after the build starts; cancel if it says xcode-27); or pin `build.production.ios.image: "sdk-57"` (needs Jason's yes; conflicts with the phone session's old "no image key" rule); and install the build from TestFlight and check it launches BEFORE telling testers. The scene change is independent of other work (branches phone-setup-flow c39457d, alone on phone-scene-lifecycle 10340ea); it needs a real-iPhone check (launch, open a file from Files/AirDrop). Its hand-written SceneDelegate must be removed when moving to SDK 58 or Expo's own `ios.enableSceneSupport`, or the two conflict.
**Implication:** before Open Segments grows, phone browse must move off the unpaged GitHub list onto the paged API (build 20 scope question for Jason).

# Coordinator: COACH-PLAN PROMPT, COACHING BLOCK + "INCLUDE PREVIOUS EFFORT DATA" TOGGLE (2026-11-06; scope only, nothing approved to build)

Jason had an AI agent rewrite the pasted coach-plan prompt and asked me to evaluate it. Verdict: keep the coaching ideas, not the whole text. The app's generated prompt (`src/pacing/buildCoachPlanRequest.ts`) already quotes its rules from the parser constants (`src/pacing/coachPlan.ts`), so keep generating rules, template and fingerprint from code and ADD a short static coaching block. Do not paste the rewrite whole: its rules duplicate three times, hard-code 150% / 100 W / 80 chars (will drift), and are stricter than or different from the parser (code fences are stripped, watts rounded, unknown fields only warn, instructions over 80 chars are shortened with a warning, no one-zone-per-grade-section rule). It omits two enforced limits (notes max 500 characters, author max 60) and that `segmentFingerprint` must match exactly. Its "3-second-smoothed power" meaning is UNVERIFIED against the Karoo fields; confirm with the Karoo session before it goes in.
**Coaching block to add (short):** rank evidence: exact segment history, then comparable efforts, then recent demonstrated power, then goal time, then FTP and grade; FTP is context, not a target; do not hold FTP for a whole sustained segment; restrained start; mostly HOLD with few PUSH; a slower goal allows lower power than the best; never invent history, and say in notes which history was used, the main power anchor, any data limit, and conservative / matched / aggressive (notes under 500 characters); power does not guarantee a finish time.
**Toggle (Jason's design):** on the ask-a-coach screen, a toggle labelled "Include previous effort data from GritMap". No preview (the efforts are already on the segment page). Included only for this segment: best time plus the last few efforts with date, elapsed time, average power and normalized power if available; NO route/GPS, location, or other segments. The block is labelled as GritMap-verified efforts on this exact segment, and the prompt tells the AI to treat anything else as unverified. Disabled with "no efforts on this segment yet" when the phone has none. It only copies text to the clipboard; the rider chooses where to paste, so nothing leaves the phone by itself; the screen should say that, and `docs/PRIVACY.md` changes only if wording needs it. Also add a line to the prompt: "Optional: paste your history for this segment from your training app below", because the phone has less history than Jason's training app until ride import improves.
**Rules:** synthetic efforts only in tests and fixtures (no real power numbers in the repo). Phone change needs a build and Jason's yes in the phone session's chat; treat as a small separate item after Setup + send sheet, with ride import feeding it more history.

# Coordinator: SETUP FLOW + SEND-TO-KAROO SHEET: JASON WANTS TO START BUILDING (2026-11-06; approval must be given in the phone session's own chat)

Jason decided: keep the new "Send to Karoo sheet — every send (Nov 6)" design (Figma node 690:2358, 8 states, light and dark; the in-app sheet for sending ANY segment or plan, visuals matching the setup v2 style) and start building. Scope for the phone session: (a) the first-run Setup flow, v2 visual-first set, rows 10 to 17 of section "Setup — first run (Nov 6)", with the Profile "Karoo setup" entry (decisions below); (b) the send sheet, which CHANGES the existing Send to Karoo screen for every rider, so it needs the existing BLE/Wi-Fi send tests to stay green and no behaviour change to the transfer protocol itself. Decisions already made: install button "Share link to Hammerhead" primary + "Copy link instead" (share sheet needs a real-device Companion check before it ships; if it fails, ship copy-only), Profile entry only (no Home banner), Skip marks a step Skipped and shows it in the checklist. Alignment fixes done in Figma (icons were offset; fixed at source), designer checked only some frames visually. Jason's pick of v2 over the originals is implied by "yes, all screens" and "keep it, start building"; the phone session should still read the v2 frames, not the originals.
**Order and approvals are open:** ride import option 1, setup + send sheet, and build 20 (sign-in/Liked) are three candidate phone changes. The phone session should propose an order and what can share a build. Constraints: keep account code and the account flag OFF/separate from these; keep each change revertable; a build or TestFlight upload needs Jason's yes in the phone session chat, and Jason runs `eas submit` himself. I cannot approve any of it. Do not change the transfer protocol, BLE contract, or Karoo side. Copy comes from `src/transfer/bleSendStatus.ts` and the install docs, in one place.

# Coordinator: SETUP SCREENS, VISUAL-FIRST v2 SET ADDED (2026-11-06; design only)

At Jason's request ("less text, more visuals", then "yes, all screens") the Figma session drew visual-first v2 frames for every setup step, next to the untouched originals, same section "Setup — first run (Nov 6)" (rows 10 to 17), Light / Dark: Welcome 683:2358/683:2410; Install 683:2462/683:2522; Send waiting 683:2582/683:2641; Versions 684:2358/684:2405; Updating 684:2452/684:2514; Stuck on Loading 684:2576/684:2629; On the Karoo 684:2682/684:2736; Fields 684:2790/684:2835; Pick a segment 684:2880/684:2932; Sending 684:2984/684:3045; Not found 686:2358/686:2428; Couldn't use transfer 686:2498/686:2554; Wi-Fi 686:2610/686:2663; No plan yet 686:2716/686:2759; Done imported 686:2802/686:2842; Done sent unconfirmed 686:2882/686:2922; Checklist 686:2962/686:3022. Profile entry unchanged (680:3180/680:3220). Copy facts unchanged from the brief below. Illustrations are simple shapes with synthetic data, not Karoo screenshots. Only 8 of the 28 new frames were visually checked by the designer; I have not opened any.
**Not yet recorded: Jason's explicit pick of v2 over the originals.** "Yes, all screens" implies v2 but the phone session should confirm with Jason before building. Check before build: the install "Not from Files" tile must still convey the UUID/Loading warning without text; the send tracker stages must only claim what the phone can confirm (only the receipt confirms Karoo import).

# Coordinator: FIRST-RUN SETUP SCREENS DESIGNED, BUILD BRIEF (2026-11-06; design only, nothing approved to build)

Figma session drew 16 first-run setup screens, light and dark, 390x844, file cyaMDDfLBKFc4NNK1SUUnb, page "GritMap Redesign Options", section "Setup — first run (Nov 6)" (x=0, y=49500). Link pattern: figma.com/design/cyaMDDfLBKFc4NNK1SUUnb/?node-id=<id with : as ->. Ids Light / Dark: 01 Welcome 679:2359/679:2422; 02 Versions 679:2485/679:2534; 03 Install 679:2583/679:2634; 03a Updating 679:2685/679:2736; 03b Stuck on Loading 679:2787/679:2837; 04 Karoo permissions 679:2887/679:2947; 05 Add fields 679:3007/679:3065; 06 Pick a segment with a plan 681:2358/681:2412; 06a BT waiting 680:2358/680:2414; 06b Connected, sending 680:2470/680:2526; 06c Not found 680:2582/680:2629; 06d Karoo couldn't use transfer 680:2676/680:2714; 06e Wi-Fi fallback 680:2752/680:2798; 06f Make a plan first 681:2466/681:2505; 07a Done, imported 680:2844/680:2894; 07b Done, sent no receipt 680:2944/680:2991; 08 Checklist 680:3038/680:3109; 09 Profile with Karoo setup entry 680:3180/680:3220. Only 10 of 32 frames were screenshot-checked by the designer; I have not opened them.
**Jason's decisions (reported by the Figma session from its chat):** (1) install: primary "Share link to Hammerhead" via the iOS share sheet, secondary "Copy link instead"; NEEDS a device test with Hammerhead Companion before it ships (docs only describe long-press, Share Link in Safari); (2) Profile entry only, no Home banner; (3) Skip marks the step Skipped and shows it in the checklist.
**Facts for the build:** step state is manual (ticks/Skip); the phone cannot read Karoo state. Only the send step confirms itself from the BLE receipt. Failed-transfer wording must come from `src/transfer/bleSendStatus.ts` (e.g. ftp_mismatch: "the plan was built for a different FTP than the Karoo has"); no placeholders. Bluetooth send needs a plan; segment-only send stays on Wi-Fi (docs/GOALS.md), so step 5 starts with "pick a segment that has a plan" and a "make a plan first" state. Downgrade warning: 0.10.45 or earlier cannot return once 0.10.46 has run; never uninstall or clear data (README, docs/BETA_KAROO_INSTALL.md). No Apple/Google sign-in or publishing here; synthetic sample data only in the design.
**Phone session, propose (read-only, no build, no push) and estimate:** JS-only vs native; where setup state persists (local only, resumable); Profile entry; copy kept in one place so it can track the install docs; tests; the share-sheet Companion check as a device step for Jason; and whether setup ships with build 20 (sign-in/Liked), after it, or separately (my lean: after the ride-import change, kept separate and revertable, not mixed with account code). Jason approves any build and TestFlight step himself in the phone session's chat.

# Coordinator: EASIER RIDE IMPORT ON THE PHONE, OPTION 1 STARTED (2026-11-05, Jason: "start on 1 now"; scope only, nothing approved to build)

Goal: remove friction from the manual FIT/GPX import. No new accounts, no servers, files stay on the phone. Ride import today is `src/screens/ImportScreen.tsx` via `DocumentPicker` (one place already allows `multiple: true`, another `multiple: false`); `ios/GritMap/Info.plist` registers NO document types, so GritMap does not appear in "Open in..." or the share sheet for `.fit` / `.gpx` files. Order of options and the reasons are in the coordinator reply of 2026-11-05; Intervals.icu import and Bluetooth return stay later.
**Phone session, propose (read-only, no build, no push) and estimate:**
1. Register GritMap as an opener for FIT and GPX (document types / UTI declarations; verify how iOS identifies `.fit`, which has no system type, so an exported/imported type declaration is likely needed; check Info.plist and the privacy manifest). Open-in-place vs copy; share sheet and "Open in GritMap" from Files, AirDrop, Mail, Messages, Safari downloads and the Hammerhead Dashboard download. NATIVE change, needs a new build.
2. Incoming-file handler: route an opened file into the existing import flow with a confirmation screen (never import silently), multi-file, duplicate detection (existing fingerprint/import identity, `docs/IMPORT_IDENTITY_SCHEMA.md`), clear errors for not-a-ride files, big files, partial files. Reuse the existing parser; no new parsing.
3. In-app "Get your ride" help on the import screen: short steps for the Hammerhead Dashboard download (verify current Dashboard wording first) and where the file lands on iPhone; offline-safe text; no links that send data anywhere.
4. Tests: fixtures for the incoming-file path, the same multi-file/duplicate cases, existing 1234-test suite stays green. Simulator can exercise "Open in" with sample files; a real iPhone is needed to confirm the share sheet shows GritMap for a `.fit` from Files and AirDrop (state what you could not verify).
5. Interaction with build 20 (sign-in/Liked): independent; propose whether it ships before, with, or separately. Keep this change small and separately revertable (new build number, no mixing with account code; account flag stays OFF unless the sign-in release is approved).
Report: size/risk per piece, what needs a native build, privacy impact (should be none beyond reading files the rider chooses; update `docs/PRIVACY.md` wording only if true), and a proposed commit/branch plan. Jason approves each build and TestFlight step himself in the phone session's chat.

# Coordinator: PUBLIC BETA OUTREACH STARTED (2026-11-05, Jason)

Jason posted the Karoo community post (draft: `docs/beta/PUBLIC_BETA_REDDIT_POST_DRAFT.md`). No tester feedback yet. Live pieces: TestFlight build 19 (public link), Karoo 0.10.46 (code 76) public release, Open Segments production (likes live), support address `help@opensegments.org`. Check-in routine until Codex returns (about 2026-11-09): look at App Store Connect TestFlight (installs, sessions, crashes, feedback), the support mailbox, GitHub issues, and Reddit replies once a day; record counts and blocking bugs here. Beta success measure (proposed): testers who complete the full loop once; review after one week.

# Coordinator: KAROO 0.10.46 (CODE 76) PUBLISHED AS THE PUBLIC BETA APK (2026-11-05, Jason ran it)

Jason pulled the installed version 76 APK from his Karoo with adb (read-only), verified SHA-256 `f172fc88c941d7739ff43e02318ee393274510248b538be65b64cd0630b69c92` equal to the Karoo Codex's signed candidate, and published it with `gh release create karoo-v76-screen-preview ... --target efaf5f67905d087689cc71cc48a99362c52e95f2 --latest` (assets `gritmap-karoo.apk`, `SHA256SUMS.txt`; notes `docs/beta/KAROO_76_RELEASE_NOTES.md`). The tag deliberately does not match `karoo-beta-*`, so the CI release workflow did not run. The public latest-download link serves the same checksum (verified by Jason with curl). README, `docs/BETA_KAROO_INSTALL.md` and `docs/BETA_TESTFLIGHT.md` updated (Room 4: no downgrade, never uninstall). Open: Companion share-link install check on a Karoo; the cardiac countdown and Recent Segments (Room 5) stay unreleased until a supervised ride. Support contact is `help@opensegments.org`. Karoo Codex: the release exists; do not tag the branch head and keep Room 5 work separate.

# Coordinator: PUBLISHING FROM THE PHONE IS A LATER BUILD (2026-11-05, Jason decided)

The next phone release (build 20 candidate) is sign-in + Profile + Liked + hearts + Add to My segments + existing Send to Karoo + in-app account deletion + report-a-concern. Publishing a segment to Open Segments from the phone (including older saved ones) is NOT in it; plan it as a later build after sign-in works on a real iPhone. Nothing to build now beyond keeping the sign-in test target reusable for publishing. For the Open Segments Codex: the publishing deliverables (wire shapes, safe test mode, report path, phone consent text) stay on your list but are not blocking build 20; do them after the sign-in security review and isolated test target. The scope section "SCOPE, PUBLISHING FROM THE PHONE APP" below still applies.

# Coordinator: EXPLORE MAP SHOULD SHOW ALL SEGMENT LINES, NO DEFAULT SELECTION (2026-11-05, Jason; for the Open Segments Codex; design first, no deploy)

Jason's ask: on Explore, do NOT auto-select a segment. Show every segment drawn as a line on the road, including when zoomed out, not just numbered clusters ("tallies"). Clicking a list card or a line selects that segment; clicking empty map clears the selection and returns to all lines. The earlier default selection made sense when Home was the segment showcase; Home no longer is.
What I found in your code (verify): `MapPanel.tsx` draws only START POINTS in a clustered GeoJSON source (`cluster:true`, `clusterMaxZoom:13`), and route geometry exists only for the single selected `detail`; `SegmentSummary` (`client.ts`) has `start` but no geometry; `selectionAfterResults` in `DiscoveryPages.tsx` picks a default selection after results load. So this is partly front-end (selection, click-outside, line layer, mobile boxed map too) and partly API: lines for many segments need geometry that the list does not carry today.
**Please produce a short design note and a proposal, then build the front-end part on your branch:**
1. Selection: no default selection on Explore; list click or line click selects; map click on empty space or Escape clears; URL/focus/keyboard/screen-reader behaviour (a list card is still reachable and announces selection); mobile boxed map and full-map dialog behave the same.
2. Geometry options with cost, privacy and caching (the privacy rule stays: listed segments only, never Link only): (a) add a simplified polyline preview to listed summaries; (b) a bounded bbox "lines" read returning simplified geometry per zoom with a hard cap; (c) vector tiles. Recommend one, with payload size per 100 segments, cache behaviour at the gateway, and whether it needs an Edge/schema change (it would need Jason's separate release approval).
3. Zoomed out: lines at every zoom while the visible count is under a cap; above the cap, thin lines or clusters as the fallback with a clear "zoom in to see all segments" cue. State the cap and why.
4. Visual: unselected lines must be visible but quieter than the selected route; the current `--color-map-segment-other` (`#404B5A` dark, `#76796E` light) may be too faint for the main subject. Propose values with contrast numbers on map-bg, then Figma can draw it. Also hover/focus line highlight.
5. Performance and a11y limits you cannot verify (many lines on a phone, reduced motion).
Own branch only; no deploy; ask Jason before any Edge/schema change. Figma session: draw the all-lines default and selected states (desktop + mobile, light/dark) once Codex confirms the line colour.

# Coordinator: LIKED SEGMENTS ON THE PHONE (OPTION B) AND WHAT IT MEANS FOR KAROO (2026-11-05, Jason chose B; scope only, nothing approved to build)

Decision (Jason): the phone signs in to Open Segments itself and pulls the Liked list. NO "Open in GritMap" button or any GritMap-specific link on the Open Segments web: Open Segments stays unaware of GritMap and GritMap is just one client (see `docs/PRIVACY_CHANGES_FOR_REVIEW.md` 4a). Production likes are live and smoke-tested.
**Smallest useful phone release (build 20 candidate), in this order:**
1. Native sign-in: same emailed 8-digit code as the web, via the Turnstile WebView bridge, refresh credential in Keychain, one serialized refresh then one retry on 401 (Codex draft `docs/OPEN_SEGMENTS_NATIVE_SIGNIN_SECURITY_DRAFT_20261104.md`; needs Jason's approval and a security review before any build).
2. Flag on for the account client only: Profile entry, sign out, Liked screen, hearts on segment cards/detail (already written on `phone-liked-segments` against the contract; re-check against the LIVE API, not the fixture).
3. Liked list: "Add to my segments" saves the segment locally keeping its Open Segments UUID and fingerprint, then the EXISTING send-to-Karoo flow pushes it. No new Karoo transfer path.
4. In-app account deletion and a report-a-concern path (Apple requires both once accounts and community content exist); verify current guideline wording.
5. Out of the first release: publishing from the phone, Apple/Google sign-in, universal links, type tag unless trivial.
Needs from Open Segments Codex: native sign-in plan finalized for review, a safe test account/mode so phone testing never writes to the live catalog, confirmation that the live likes endpoints match the contract. Phone session: re-verify the client against live (read-only calls), then propose the build plan; Jason approves each build and each TestFlight step himself.
**For the KAROO CODEX (scope and read-only review; docs only, no device, no install, no build):** liked segments reach the Karoo as ordinary sent segments, so no new protocol is expected, but answer these in a doc on your branch:
1. Volume: how many segments can the Karoo app hold and match (Room storage, startup load, Nearby/Recent Segments matching) if a rider adds dozens or a few hundred? What is the cost per segment and a sensible cap or warning?
2. Identity: does the received segment keep the Open Segments UUID/fingerprint so the Karoo can dedupe, show the source, and accept an updated copy? If not, what is the smallest contract change (shared contract: segment JSON, `gritmap-transfer`; phone must agree)?
3. Removal: when a rider unlikes or deletes a segment on the phone, should the Karoo copy go too? Propose behaviour (manual only is acceptable); no silent deletes of ride-time data.
4. Type tag: the segment `segmentType` (climb, descent, ride) now comes from the API. Can the Karoo show it on segment rows and the Nearby proposal?
5. Interaction with the queued work: Nearby Segments (liked/added segments as the pool), Recent Segments Room 5 migration, and the tester APK candidate. Which of these is affected if the segment list gets large or arrives in batches?
6. Sending several at once: is multi-segment send over Bluetooth safe (size, ordering, partial failure, resend)? Read-only review of the transfer code and tests.
Report findings and a recommended minimum Karoo change (possibly none). The Karoo app does not need a build for this release unless answers 1, 2 or 6 show a gap. Karoo Codex still waits on Jason for Nearby Segments decisions.

# Coordinator: PRODUCTION LIKES LIVE, SMOKE TEST PASSED (2026-11-05, Jason)

Open Segments Codex deployed the private likes release to opensegments.org on 2026-11-05 (its receipts: branch `codex/open-segments-platform`, `fcd810c`/`d87cdcf`, archive `handoffs/archive/2026-11-05-0755-codex-open-segments-likes-live.md`, local only, not pushed): likes migration applied, Edge function version 11, Worker version `aebcaa1e`, with the reviewed visual/FAQ updates (FAQ draft labels visible). Jason ran the signed-in smoke test on production (like, reload Liked, unlike, reload) and it PASSED. Codex should record that result. Open: the three FAQ wording mismatches Codex flagged (Anonymous vs Anonymous rider; five per UTC day wording; About map-credit sentence vs inline credit links) are not confirmed fixed. Phone account flag is still OFF in build 19; native sign-in not approved; safe publish test mode not delivered.

# Coordinator: ABOUT PAGE FAQ, FOR THE OPEN SEGMENTS CODEX (2026-11-04, Jason approved sending the draft)

Add an FAQ section to the About page from `docs/OPEN_SEGMENTS_ABOUT_FAQ_DRAFT.md` (on main). Use accordion/disclosure markup with the existing components, light and dark, 390 px and desktop, keyboard and screen-reader friendly, anchorable questions. Jason's decisions: bulk downloads are NOT promised; the answer says we are looking into it based on demand and points to Help. Items marked [LAWYER] (ownership, licence, edit/delete, bulk) are draft wording: show them but mark the page text "draft wording pending review" the same way as the mission cards. [OPEN] items (who runs it/funding, publishing from the phone app, liked segments) must stay hedged exactly as drafted or be omitted; do not state anything the product does not do today. Check each factual claim against the live Terms/Privacy text and your code (5 per UTC day, ODbL 1.0, credit, Link only, report/removal) and list any mismatch rather than silently changing the meaning. Own branch only; no deploy.

# Coordinator: DETAIL HEADER ICON BUTTONS HAVE INCONSISTENT HIT TARGETS AND HOVERS (2026-11-04, Jason screenshots; for the Open Segments Codex)

On the segment detail header the three icon buttons (heart "Save to Liked", copy link, share) do not match: the heart's hover is a small circle (about 56 px), the copy button's hover is a larger rounded square (about 88 px wide), and share differs again. Not caused by the latest build. Make all three one shared icon-button component: same size (at least 44x44 hit target), same rounded-square radius from the Figma icon button spec (if Figma has none, use `radius/md` and tell the coordinator so Figma can draw it), same hover and focus-visible fill from tokens in light and dark, same tooltip placement. Check the same buttons on cards (`th-like-card` heart) and the mobile standalone page. Screenshots of hover/focus states in light and dark, tests rerun. Own branch only.

# Coordinator: FILLED STAT TILES ONLY ON THE SEGMENT DETAIL PAGE (2026-11-04, Jason; for the Open Segments Codex)

Correction to item 5 of the mobile web section: the filled/bordered metadata background is for the SEGMENT DETAIL page only (the Distance / Climb / Net grade tiles, `.th-stat-tiles`). Segment CARDS (Explore list and mobile list, Home sample card, My segments, Similar, Near me) go back to the earlier inline stats text with no background and no border. Remove the card-stat box added in `mobileWeb.css` (`.th-explore .th-card-stats` background/border/padding) and any equivalent on the Home sample card; the Home sample card keeps its original card look. Desktop cards were already unchanged. Re-screenshot 390 px light/dark, rerun tests. Figma is being reverted to match (cards inline; filled tiles only on the detail page; create-flow steps return to the old look). Own branch only.

# Coordinator: MOBILE EXPLORE MUST KEEP THE DISTANCE DROPDOWN (2026-11-04, Jason found it missing; for the Open Segments Codex)

Cause: the list-first mobile Explore Figma frames (627:21262 / 627:21339) drew size CHIPS in place of the Distance dropdown, and the build followed them (`DiscoveryPages.tsx` renders `th-mobile-size-chips` when `mobile`, the `Select label="Distance"` only on desktop). That was a design mistake, not a Codex error. Jason wants the Distance dropdown on mobile Explore, same options as desktop (All, Under 5 km / 3.1 mi, 5-15 km / 3.1-9.3 mi, Over 15 km / 9.3 mi) and same `length` URL param. Restore it on mobile (the Select, sized for 390 px, beside or under the type filter, whichever fits), remove the chips, re-check that no other desktop filter (including any gradient filter) is missing on mobile, update `mobileWeb.css` and the review doc, rerun tests and 390 px light/dark screenshots. Own branch only. Figma is being redrawn to match.

# Coordinator: MOBILE WEB FIXES FOR OPEN SEGMENTS, DESIGNED IN FIGMA (2026-11-04, Jason approved the designs' direction; for the Open Segments Codex)

**Jason reviewed all frames below and approved them as the design to build (2026-11-04). Build approval for code on your branch only; deploy still needs his separate yes.** Jason found the mobile responsive web poor. Figma file `cyaMDDfLBKFc4NNK1SUUnb`, page "Web C · Trailhead final", new area at x=8600+; notes frame `617:20959`; before/after of stat tiles `627:21163`. Design only; no approvals to deploy. Check first what production and your local branch already do on mobile.
1. **Home (same content mobile and desktop):** product and mission first, no search, no map background. Hero: "A free, open catalog of cycling segments"; primary button "Create a segment" FIRST, secondary "Browse segments". One sample card (synthetic, Switchback Ridge) with an inlaid boxed map; three mission cards (open and independent; ride on your device; works with GritMap but separate). Mission wording is DRAFT, subject to lawyer review (follows `docs/PRIVACY_CHANGES_FOR_REVIEW.md` 4a). Frames: desktop `611:20623` light / `614:20673` dark; mobile `613:20647` / `614:20751`. Desktop top nav keeps Explore and About.
2. **Mobile header:** hamburger only (no profile icon). Sign-in/profile live inside the menu. Frames: closed `614:20822` / `614:21094`; open signed out `614:20893` / `614:21165`; open signed in `614:20988` / `614:21260` (plain "Signed in as" line, no avatar; names are read-only `rider-NNNNNNNN`).
3. **Segment detail:** DESKTOP unchanged (map with side panel, as today). MOBILE becomes a standalone page using the same panel parts: CLIMB tag + close X (X goes to Explore), title with small copy and share icons, Listed pill + credit, filled stat tiles, BOXED MAP CARD (12 px radius, OSM attribution) between the tiles and the elevation card, buttons, quarter-mile table. Frames `616:20974` light / `616:21112` dark. The share icon is a plain vector in Figma.
4. **Mobile Explore is list-first:** header, title, search, type filter, size chips, boxed map card (200 px, "Open full map" link), count, then the segment cards; List/Map toggle removed. Frames `627:21262` light / `627:21339` dark. Desktop Explore stays map-first.
5. **Stat tiles:** filled style (metadata/bg fill, 1px border/default, radius md, uppercase label, large value) now also on shared Stat tile `465:393` and compact inside every Segment card variant (`490:10995`); matches your `.th-stat-tiles` CSS, so the web may already do this. Segment cards' size unchanged.
Report back: which of these production/your branch already do, what is new, and the build stage you would add it to. Own branch, no deploy.

# Coordinator: PHONE BUILD 19 CUT FROM 540cd1f (2026-11-04; Jason ran it, flag OFF)

**Correction:** the build is iOS build **19**, not 18 (autoIncrement skipped 18; cause not checked, possibly an earlier started or failed build around the Apple agreement error). Build 17 was `86bae63f` (b841177).
- EAS build id `54a5bd6e-057b-407e-92e5-42f1130a1c97`, version 1.0.0, profile production, SDK 57.0.0, started 2026-11-04 4:05:35 PM by Jason. EAS records commit `540cd1f7d049af90c891f115c7d4e6faee833a2e` (branch `phone-build18`, = `548de1c` + one comment-only scrub commit).
- **UPDATE: build 19 is in TestFlight and installed (Jason confirmed).** Archive copy written; see `handoffs/archive/` file ending `claude-phone-build19-testflight.md`.
- Contents: Open Segments account flag OFF, so no sign-in, no Liked, no publishing; only dormant client code. Map previews follow light/dark, segment cards show maps, power meter + HR requirement line.
- Known issue to tell testers: Rides/Segments lists can rarely stop responding to taps; restarting the app fixes it. Cause unproven, tap fix deferred.
- Pre-build checks (phone session, fresh worktrees at that exact commit): clean tree, no `image` key in eas.json, Podfile.lock identical to c96ff10, plutil OK, flag false, no native/config diff vs build 17, tsc clean, npm test 1234 pass / 0 fail / 24 skipped, Swift script 128 ok, identity scan 11 hits all the handle lines and zero others (planted-hit sanity test passed). Nothing rerun after the build started.
- Git: `phone-build18` (540cd1f), `phone-liked-segments` (84d43b5, includes a1cd7b8; NOT in the build) and `phone-build13` are local only, none pushed. Phone repo has nothing uncommitted.
- **Archive copy deferred** until the build finishes and the TestFlight state is confirmed (archived handoffs are immutable).
- Next: Jason checks build 19 on his iPhone; phone work after this (sign-in, Liked) waits on the Open Segments Codex items in the to-do list below (hosted likes release, native sign-in plan and security review, safe publish test mode).

# Coordinator: CODEX CURRENT TO-DO, ONE LIST (2026-11-04, supersedes the ordered list in "CODEX, WHAT TO DO NEXT" below; read this first)

You last read main at `60af75b`. NEW since then: `bc4a6dc` (palette is blue/violet, your tokens are the source of truth; thanks for confirming), `25607d6` (tester push gate), `d0a5de7` (phone publishing scope), `05a4254` (dark contrast P1 values + final logo), `7f49589` (segment-other token), `9c57bb4` (privacy memo wording tightened per your review). Phone build 18 is being cut from `548de1c` with the account flag OFF: it contains NO sign-in and NO publishing, only dormant Open Segments client code.
**OPEN SEGMENTS CODEX (`codex/open-segments-platform`):**
1. Tokens, values only, in `tokens.css` (both dark blocks): `--color-border-input: #667587`, `--color-accent-default: #858EB9`, `--color-map-road: #3E454D` (keep `--color-accent-fill #5966a6`); add `--color-map-segment-other` `#76796E` (light) and `#404B5A` (dark) and point unselected map segments at it (leave the create-flow "full ride" line on border/input unless Jason says otherwise). Re-run the contrast tests; Figma shows zero failures with these.
2. Final logo: ink mark and wordmark (light and dark), favicon = panel-coloured tile with the ink mark; stop using `--color-logo-mark`/`--color-logo-glyph`. Ask Jason how to get the SVGs; do not commit logo files until he confirms. Keep one swappable logo component and favicon. Trademark search is Jason's, still open.
3. Phone publishing scope (section "SCOPE, PUBLISHING FROM THE PHONE APP"): deliver for the phone the publish and check wire shapes and fixtures (portable segment, `creditMe`, visibility, `409`/limit/receipt semantics), a SAFE TEST MODE (content writes are closed on preview and staging, so a phone test publish would land in the live catalog), and the report/abuse path the app needs for Apple's user-generated-content rules (verify current guideline wording). Report which contract pieces already exist.
4. Tester push gate (section "GOAL, TESTER PUSH"): propose the exact coordinated hosted likes release (schema 12, Edge, gateway, assets, account deletion route, palette/logo/favicon) with fresh recovery verification, for Jason's SEPARATE approval; draft the native sign-in plan (Turnstile WebView bridge, Keychain refresh, one-refresh-then-retry rule) for a security review; neither is approved to build or deploy.
5. First-use "Connect to Open Segments" screen text and the website Terms/Privacy/Help, aligned with `docs/PRIVACY_CHANGES_FOR_REVIEW.md` (draft, not final legal text; keep your correction that the app holds responses and downloads locally).
6. Continue web build stages 1 to 5 from the build handoff with screenshots in light and dark.
7. Still open: `packages/segment-core` on origin (needs Jason's push yes with exact commits and files), what production serves today versus the local branch, deploy of the net/type fields, partial-elevation rule, attribution wording vs the loaded map style.
**KAROO CODEX (`codex/karoo-screen-redesign`, reviewed branch already pushed):**
1. Two queued read-only reviews, docs only, no device: segments and pace marker on the Karoo map (section "KAROO ASK") and Karoo-to-phone Bluetooth ride sync feasibility.
2. Tester push impact (section G): what a persistent-beta signed APK candidate for testers needs (Room 5 migration, no downgrade to 76, exact version and hash, supervised ride check Saturday at the earliest); propose it, do not install or release.
3. Waiting on Jason: Nearby Segments decisions (radius, ordering, row content).
Neither session: no deploy, push, native change, hosted release, device install or provider setting without Jason's explicit yes in YOUR own chat; own branch only; no force-push; keep personal data out of commits.

# Coordinator: NEW TOKEN --color-map-segment-other (2026-11-04, Jason chose #404B5A); values-only note for the Open Segments Codex

Unselected map segments must NOT use border/input (it became the lighter `#667587` in dark with the P1 contrast fix). Add `--color-map-segment-other` to `:root` as `#76796E` (light, the old border/input value, so light looks the same) and to BOTH dark blocks (`prefers-color-scheme` and `:root[data-theme=dark]`) as `#404B5A`, and point the unselected-segment map layer (and any CSS or JS in `mapPalette.ts` that currently uses border/input for those strokes) at it. Contrast on map-bg: light 3.76, dark 1.64 (decorative, passes its 1.5:1 guide); dark vs selected route `#7088FF` is 2.81 so the route stays dominant. Figma: token table 475:9955, developer handoff note 477:10421; rebound strokes include Home dark 498:12725/12727/12729 and Home light 498:12493/12495/12497.
**Not rebound (Jason's call, ask him):** the create-flow "full ride (not selected)" line on the upload and choose-section maps (for example 470:5614, 471:6030) still uses border/input so it stays the lighter `#667587` in dark; it is the main subject of those screens. Keep it unless Jason says otherwise.

# Coordinator: DARK CONTRAST FIX P1 APPROVED + FINAL LOGO APPLIED IN FIGMA (2026-11-04, Jason picked P1)

**For the Open Segments Codex (values-only; goes on top of the blue/violet palette section below):** put these three values in BOTH dark blocks of `apps/web/src/tokens.css` (the `prefers-color-scheme` block and `:root[data-theme=dark]`):
- `--color-border-input: #667587` (was `#323943`)
- `--color-accent-default: #858EB9` (was `#5966a6`; links, selected outline, checkbox, focus uses its own token)
- `--color-map-road: #3E454D` (was `#40474f`)
Keep `--color-accent-fill: #5966a6` with label `#E9EDF1` (4.60:1), `--color-text-on-accent: #13161A`, route `#7088ff`, `--color-border-default: #000000`. Re-run the contrast tests: Figma recomputed all 61 rows, zero failures in light and dark; border-default `#000000` is 1.32 on the page against a 1.5 decorative guide (WCAG-exempt), left as is. Also note `--color-accent-hover` / pressed and the accent-subtle fills: check they still read against the lighter accent.
**Side effect to handle:** unselected map segments use border/input as their stroke, so in dark they become a lighter grey (`#667587`) than before. If Jason wants them dim again they need their own token (for example `--color-map-segment-other`); ask Jason in your chat and tell the Figma session if it should be drawn.
**FINAL LOGO (Jason, 2026-11-04):** the Figma session applied the final logo: an ink mark and wordmark in light and dark; the favicon is a panel-coloured tile with the ink mark; the Logo component set was updated (all instances) and the tokens `color/logo/mark` and `color/logo/glyph` were REMOVED. This SUPERSEDES the violet logo-mark and glyph values and the "recolour the existing logo" instructions in the sections below. Codex: do not use `--color-logo-mark`/`--color-logo-glyph` going forward; Figma frames: page "Open Segments · Logo final (Nov 4)" and Logo component set (check the current node in the Figma file). Ask Jason (in your chat) how to obtain the SVG files (the Figma session can export them outside the repo); do not commit the logo files until Jason confirms. Keep ONE swappable logo component and favicon. The trademark search (USPTO and EUIPO, classes 9 and 42) is still open and is Jason's before the public launch.

# Coordinator: SCOPE, PUBLISHING FROM THE PHONE APP (2026-11-04, requested by Jason; scope only, nothing approved to build)

**Facts first (from `docs/OPEN_SEGMENTS_PHONE_CLIENT.md` on `codex/open-segments-platform`, reported not independently tested):** the server side is deployed (Trailhead release Nov 3: schema 11, Edge 10; creation API, optional `creditMe`, 5 publications per account per UTC day, name 5 to 100 characters, 300 m to 100 km, elevation required, listed by default with `visibility:"unlisted"` for Link only, duplicate/similar check returning booleans only, exact retries return the saved receipt). WEB sign-in is live. The PHONE has no sign-in yet (designed in Figma, contracted, not built). The phone's current share path is the old maintainer-only GitHub route.
**Jason's question, answered: YES, publishing can be switched on later and still cover segments saved earlier.** Design it as an action on an existing local segment ("Share to Open Segments" in the segment menu and Profile), not as part of creating a segment. Rules for old segments:
1. Only segments the rider created from their own rides are shareable. Segments pulled from Open Segments or imported from someone else's file must not be re-published (they are already public or not the rider's); the phone must check segment provenance (source ride, registry origin) and, if the data model cannot tell, add a field by migration.
2. Old segments may not meet the new rules (under 300 m, over 100 km, no elevation, name under 5 characters). Show a clear reason per segment and, where possible, a fix (rename; trim to a valid section; "no elevation, cannot be shared"). Never publish a segment that fails the server rules, and never alter the saved segment silently.
3. The near-home check runs on the segment's own start and end points (and the source ride's endpoints if the ride still exists); show a warning and let the rider cancel.
4. Duplicate and similar check before publish (boolean result, handle 409, never assume a private duplicate is linkable); fingerprint is the canonical segment-core SHA-256 (the phone already recomputes fingerprints on import).
5. Record the result on the local segment (server id, visibility, published time, credit used) with a small database migration, so "Shared" shows and the same segment is never published twice; exact retries are safe by contract.
**Pieces, in order, with rough size:** (1) native sign-in: emailed code, Turnstile bot check in an allowlisted WebView, refresh credential in Keychain, sign out, in-app account deletion; LARGE, security review and Jason's yes, shared with Liked and Profile. (2) The publish flow: rules gate, near-home reminder, duplicate/similar check, visibility (Listed default; Link only behind a permanence warning and explicit confirm), "Credit me as <account name>" ON by default (preview the name), 5 per UTC day with local reset time, irreversible-confirm screen, publishing/progress, success with share link (`https://opensegments.org/s/<uuid>`) and share sheet, error and offline states, "Shared" mark; Figma has the in-app publish screens (section "Open Segments in the app"); check gaps (limit reached, duplicate, rules failure for old segments). BIGGEST BUILD. (3) A SAFE TEST PATH: content writes are closed on preview and staging, so a phone test publish would land in the live public catalog permanently. Codex must provide a test environment or test mode before the phone does any live publish test; until then build against a fake server and never publish test data to production. (4) App Store user-generated-content rules (to verify against Apple's current guidelines): an in-app way to report a segment and a published contact, filtering and a block or hide path for abusive content; the app already shows Open Segments results. (5) Compliance: contribution licence consent (ODbL offer) at publish time with a link to the contribution terms, privacy and App Store answers, lawyer memo (`docs/PRIVACY_CHANGES_FOR_REVIEW.md`). (6) AUTO-SHARE (opt-in, OFF by default; queue, near-home hold, 5/day cap, retries) is PHASE 2; the first tester push can ship manual publishing, or even sign-in, Liked and pull only (Jason to decide).
**Phone session may prepare (flag OFF, local branch, fixtures only, no real endpoint, no sign-in transport, no native change):** publication rules module mirrored from the contract, shareable-segment check with reasons for existing segments, provenance audit and migration design (propose, do not apply), the publish view-models and screens against a fake server, tests. **Codex to deliver:** publish and check wire shapes and fixtures for the phone (portable segment, `creditMe`, visibility, error mapping), a safe test mode, the 409/limit/receipt semantics, and the abuse/report path for the app.
**Needs Jason (own yes in the target chat):** native sign-in approach and security review; any native/config change; which items are in the first tester push; contributor consent wording (lawyer).

# Coordinator: GOAL, TESTER PUSH AFTER SIGN-IN AND LIKED SEGMENTS WORK IN THE APP (2026-11-04, Jason)

**Jason's goal:** once login works and liked segments show up in the phone app, push to get testers. This is the gate checklist; items are owned by the named session and each needs Jason's own yes where marked. Nothing here is approved yet.
**A. Server (Open Segments Codex):** answer the 7 contract questions; push `packages/segment-core`; hosted likes release (schema 12, Edge, gateway, assets) with fresh recovery verification, SEPARATE Jason approval; deploy the blue/violet palette and remove pink; confirm what production does today (writes, sign-in, limits); account deletion route.
**B. Phone sign-in and Profile (phone session, after A):** real transport for the emailed code (Supabase email OTP, Turnstile bot check in an allowlisted WebView, refresh credential in Keychain), sign out, **in-app account deletion (Apple requires it for apps with account creation)**, Profile behind the avatar on Home (placement A), the two undrawn states (sign-out confirm, account recheck errors; Figma session). Needs Jason's yes and a security review for the WebView bridge and token storage.
**C. Phone liked segments:** real client on the contract (done against fixtures in `548de1c`), Liked list, hearts, "Open in GritMap" via `gritmap://` (universal links optional, later), flag ON for the tester build only.
**D. Decide scope with Jason:** auto-share and in-app publishing were called a beta blocker earlier; is the first tester push sign-in plus liked plus pull only, with publishing on the web? If publishing stays web-only for this push, say so in the README and TestFlight text.
**E. Compliance (Jason, lawyer):** privacy policy and App Store privacy answers and `PrivacyInfo.xcprivacy` updated BEFORE the build ships (`docs/PRIVACY_CHANGES_FOR_REVIEW.md`); Open Segments terms and privacy kept consistent; a dedicated contact address; the separation/structure questions; trademark search. Lawyer review turnaround is the likely long pole, so send the memo early.
**F. Build and TestFlight (phone session, Jason runs submit):** build 18 from the liked-segments branch after rebase on `6bca004` plus the tap-hardening fix if wanted; standing pre-build scan (identity scan, clean tree on a fresh worktree, no "image" key, Podfile.lock vs c96ff10, Info.plist lint, tsc, tests, Swift script); back up the iPhone before submit; external testers need TestFlight Beta App Review and "What to test" text that states the power meter and HR requirement; update the README TestFlight section.
**G. Karoo side for testers:** the public APK (version 73) is older than the installed 76 and the local 78; shipping Recent Segments and the cardiac countdown to testers needs a persistent-beta signed APK, an exact approved candidate, the Room 5 migration plan (no downgrade to 76), and Jason's supervised ride check (Saturday at the earliest). Decide whether testers get the Karoo update in this push or later.
**H. End-to-end test before invite:** a test account through sign-in, like on web, see it in the app, add to my segments, send to Karoo over Bluetooth, on real devices, synthetic or Jason's own data; then invite a few testers first.
**Long poles:** Codex's hosted likes release, the sign-in security review, the lawyer memo, and the Karoo release candidate. The phone session can prepare B, C and F against fixtures while A is in progress.

# Coordinator: WEB PALETTE IS NOW BLUE/VIOLET, NO PINK; CODEX'S LOCAL TOKENS ARE THE SOURCE OF TRUTH (2026-11-04, Jason confirmed)

**Jason confirmed in chat: the blue is correct, and the pink must be removed everywhere on the web.** I was wrong to call the blue favicon a possible mix-up: Jason tuned the palette directly with the Open Segments Codex on 2026-11-03 (local colour lab; receipts `handoffs/archive/2026-11-03-*palette*.md` and `docs/OPEN_SEGMENTS_SITE_COLOR_LAB_20261103.md` on `codex/open-segments-platform`, tokens in `apps/web/src/tokens.css`). **This SUPERSEDES every pink value and the cooler-gray dark values in my sections below** (pink route/elevation/logo, "ink glyph" notes, cooler gray dark table `c748c62`, dark map cleanup colours where they differ). Where my text and `tokens.css` disagree, `tokens.css` wins.
Current values (from the Codex branch, not yet on origin):
- LIGHT (neutrals and graphite accent unchanged): route-line and logo-mark `#4e33d7` (violet), elevation-line `#5433fa`, elevation-fill `rgb(76 49 211 / 16%)`, logo-glyph white.
- DARK: bg-page `#1a232d`, bg-panel `#151c23`, bg-subtle `#1a2a3d`, border-default `#000000`, border-input `#323943`, accent default/fill/hover `#5966a6`, accent-subtle `#060f1e`, route-line and logo-mark `#7088ff`, elevation-line `#7088ff`, elevation-fill `rgb(112 136 255 / 16%)`, header-bg `rgb(25 25 39 / 70%)`, metadata-bg `#2c3454`, text colours as before (primary `#E9EDF1`, secondary `#B7C0CA`); dark map: bg `#222a35`, road `#40474f`, water `#1c4459`, park `#203c31`, label `#bcc5d2` (see tokens.css for the rest).
- Known: Codex reports two dark contrast tests failing (border-input on bg-page, route on map road) with Jason's exact colours kept; this palette must not be described as accessibility-passing until resolved or consciously accepted by Jason. Primary text on fill is 4.60:1.
**To do (no deploy without Jason's separate yes):** (1) Open Segments Codex: find and remove any remaining pink in the web build, docs, social images and favicon; production still serves a pink favicon and pink route colours from the earlier release, so a hosted release is needed to change it (a separate Jason approval). (2) Figma session: update the web variables and frames to these values, retire the pink and cooler-gray tokens. (3) Coordinator: GOALS and README mention no web colours, no change needed. (4) The phone app stays blue and Inter by Jason's earlier rule that phone and web are visually distinct brands; the web violet/indigo is now close to the phone blue in dark mode. Jason chose both, so this is noted, not a blocker; revisit if the two look too alike.

# Coordinator: CODEX, WHAT TO DO NEXT, IN ORDER (2026-11-04; applies to BOTH Codex sessions, read this first)

New on main since you last read (033e82f): `0c8e9af` (Karoo status corrected, GOALS), `bb87c34`/`5f9048c` (README), `1646a4e` (coordinator review of your likes contract), `f877e17` (7 phone-adapter questions for you), `f9ea994` (phone Profile placement A, email-code-only sign-in), `1cc03f7`/`caff4f1` (privacy and separation memo for the lawyer: `docs/PRIVACY_CHANGES_FOR_REVIEW.md`).
**Open Segments Codex (`codex/open-segments-platform`):**
1. Answer the 7 questions in the "PHONE ADAPTED TO THE LIKES CONTRACT" section in the contract doc (short-segment rows, hearts on unlisted segments, error body shape, 401 refresh rule, export route id, control style, segmentType vs activityType).
2. Palette check: your notes mention a "blue favicon" and an "approved blue palette"; the approved web look is graphite ink + pink (the logo uses pink). Ask Jason in your chat whether blue was his call before deploying it. Also confirm the cooler-gray dark values (`c748c62`) and the dark map cleanup are applied, and that the two "accepted" dark contrast failures are gone with the new values.
3. Separation: Jason wants the phone to treat Open Segments as a separate, independent service (the app connects to it; GritMap holds none of its data). In the phone contract/design note, list what the first-use "Connect to Open Segments" screen must say (what is sent, which privacy policy and terms apply, that GritMap does not receive it), and keep the web Terms, Privacy and Help text consistent with `docs/PRIVACY_CHANGES_FOR_REVIEW.md`. Do not publish policy text as final; it is a draft for Jason's lawyer.
4. Continue web build stages 1 to 5 from the build handoff (tokens, map shell, account/My segments with Liked, creation flow, content pages), screenshots in light and dark for Jason's review.
5. `packages/segment-core` is still not on origin and the phone cannot depend on it. Ask Jason in your chat for a push yes (own branch only, no credentials or personal GPS in the commit); say exactly which commits and files.
6. Still open from earlier: what is deployed at opensegments.org today (writes, listing rules, sign-in); the type thresholds; near-home distance; partial-elevation rule; attribution wording vs the loaded map style; a hosted likes release is a SEPARATE approval; sign-in Turnstile native bridge needs Jason's yes and a security review.
**Karoo Codex (`codex/karoo-screen-redesign`):**
1. Ask Jason in your chat whether to push your branch (cardiac countdown, Recent Segments, screenshots, handoffs), so main reflects it; own branch only, explicit yes.
2. Do the two queued read-only reviews: segments and pace marker on the Karoo map (see the KAROO ASK section above) and Karoo-to-phone Bluetooth ride sync feasibility. Docs only, no device, no install.
3. Jason still owes answers on the Nearby Segments proposal (radius, ordering, row content) and any install approval; do not build or install without an exact yes.
Neither session: no deploy, push, native change or device install without Jason's explicit yes in your own chat.

# Coordinator: PHONE PROFILE PLACEMENT A APPROVED, EMAIL-CODE-ONLY SIGN-IN SCREENS (2026-11-04, Jason chose A)

**Decided by Jason:** Profile lives behind an **avatar button at the top right of Home** (placement A). The Settings "Account" row opens the SAME Profile screen (one Profile, not two). No fourth tab. Sign-in is **email code only** (Apple and Google deferred), matching Codex's contract.
**Figma (file cyaMDDfLBKFc4NNK1SUUnb, phone page "GritMap Redesign Options"):** Home with avatar light 588:2414 / dark 588:2514; Profile signed out light 588:2710 / dark 588:2806; Profile signed in light 588:2902 / dark 588:3097; sign-in entry 243:2358 (light) / 243:2702 (dark) with "Use the email you use on Open Segments to see your uploads and likes."; code, wrong code, expired, too many attempts 243:2409 to 243:2939; "checking you're a person" 587:2359 / 587:2387; "couldn't check you're a person" 587:2415 / 587:2448; sign-in from Profile 588:2358 / 588:2386; Settings 265:2410 / 265:2435 (row "Account" = rider-4821, read-only; "Rider profile (weight, FTP, goals)"). Option notes: section "Where the account lives, options" (B and C not chosen).
**Profile content (signed in):** account name (server generated, read-only, like rider-4821), email, My uploads, Liked (same list as the Segments tab row so they cannot disagree), "Credit me as <name>" ON by default, "Share new segments to Open Segments" OFF by default (wording is a Figma draft, TO CONFIRM with Jason; not in the contract yet), Rider profile link (weight, FTP, goals; private, stays on the phone), Sign out. Signed out: what an account is for, "Sign in with email", Rider profile link, and a note that riding, planning and Karoo sends work without an account.
**Phone session:** when Jason schedules it, build Profile behind the existing flag (OFF), reusing the Liked list; no sign-in transport yet. Do NOT build the Turnstile WebView or Keychain token storage without Jason's yes and a security review. Not drawn yet: sign-out confirm sheet, signed-in "account recheck" errors.
**Before any build that ships sign-in or publishing (Jason / coordinator):** `docs/PRIVACY.md`, `docs/GOALS.md` ("nothing leaves the phone") and the App Store privacy answers must be updated: the email address is sent for sign-in, segments are sent when published, likes are stored on the account. Lawyer review. Likes API is not deployed (contract is proposed v1), so My uploads and Liked stay empty or hidden until it is.

# Coordinator: PHONE ADAPTED TO THE LIKES CONTRACT; SEVEN QUESTIONS FOR CODEX (2026-11-04)

Phone commit `548de1c` on local branch `phone-liked-segments` (on `2d5ac52`; not pushed; flag OFF; no native change; no sign-in UI; no real endpoint). It mirrors the proposed contract in plain types with a fixture copy (no segment-core dependency): UUID ids, paged liked list, `PUT` with `{liked}`, batch state in chunks of 100, listed-only fingerprint lookup, apex links, error mapping (401 signed-out, 404, 429 with Retry-After, 400 never retried, 409 like limit, 5xx unavailable, offline only when no answer), stale-response guard, injected transport. tsc clean; 1258 tests, 0 fail, 24 skipped. Simulator re-check pending.
**Codex, please answer in the contract doc:**
1. `toPhoneLikedSummary` rejects distances under 100 m but the creation rule is 300 m minimum, and a bad row fails the whole page. Either the server guarantees every row passes the projection, or the phone may skip an unusable row. Which?
2. A pinned segment that is not listed cannot show a heart on its own page (fingerprint lookup is listed-only and the phone stores no server id after pinning). Intended? If not, the phone stores the server id at pin time (needs a migration).
3. Specify the error body shape (the phone keys off status only) and confirm 409 `like_limit_reached` applies to PUT only.
4. A 401 covers both "never signed in" and "expired token". State whether the client should try a refresh, and how it tells which.
5. Confirm the export route's `data.segment` is the existing portable JSON and whether its `id` equals the segment UUID (the phone uses the requested UUID and dedupes by the recomputed fingerprint).
6. Control style: the web owner revisions ended on a compact solid heart (Jason's choice). The phone shows a heart icon plus the word; coordinator decision: keep the phone as is unless Jason says otherwise.
7. `activityType` ("ride" or "climb") on the wire is NOT the Climb/Descent/Ride type tag. Coordinator decision: the tag uses `segmentType`; say if the two should be reconciled.

# Coordinator: REVIEW OF CODEX'S LIKES / PHONE CONTRACT (proposed v1, 2026-11-04); phone told to adapt; README updated (bb87c34)

Read-only review of `docs/OPEN_SEGMENTS_LIKES_API_CONTRACT_20261104.md` on `codex/open-segments-platform` (local, not on origin/main; not deployed; production is schema 11 / Edge 10 with no likes routes). **It already answers every question in my "PHONE LIKED-SEGMENTS CLIENT" section, so no separate drafting was needed.** Coordinator view, subject to Jason:
- ACCEPTED: UUID ids; summaries add `fingerprint`; paged liked list (50 per page, 1000 likes per account, no silent truncation); idempotent `PUT /v1/account/likes/{uuid}` with `{liked}`; batch state for 1 to 100 ids; likes private (no counts, no who-liked), deleted with the account; encrypted-backup retention disclosed honestly in the privacy text; like limits separate from the 5 publishes per day; canonical link `https://opensegments.org/s/{uuid}` (apex only); `gritmap://segment/{uuid}` works today, universal links do not.
- ACCEPTED WITH A KNOWN LIMIT: fingerprint lookup returns LISTED segments only (same 404 for missing, hidden and Link-only), so a heart on a segment already on the phone works only if it is listed; Link-only needs its id or link. Good for privacy; fine for the beta.
- NEEDS JASON'S DECISION (it changes an earlier decision): **phone sign-in is the same emailed-code identity as the web, and Apple and Google sign-in are deferred.** This avoids the Apple "Hide My Email" two-account problem but drops the "Sign in with Apple and Continue with Google first" order the Figma phone screens show. The phone sign-in screens in Figma need to be updated to match.
- NEEDS JASON'S APPROVAL BEFORE ANY BUILD: the native sign-in proposal shows a Cloudflare Turnstile challenge in an allowlisted WebView on our domain, plus a secure token store (Keychain). New host permissions, a native bridge and a security review; hosted approval needed. Nothing is built.
- STILL NEEDED: lawyer review of the new private likes data and the retention wording; Jason's yes on associated domains (universal links) and the AASA file; a hosted likes release is a separate approval (schema 12 / Edge / gateway).
- PHONE: told to adapt its client and fixtures to this contract (flag off, local branch only, no sign-in UI) and to capture synthetic dark-mode screenshots for the README.
- README: rewritten (`bb87c34`): requirements up front (power meter, HR, Karoo 3, iPhone), the five-step flow with Bluetooth as the send route, Open Segments section, dark-mode Karoo previews rendered from synthetic data (7 images under `assets/karoo/`), "in development" labels for Recent Segments and the baseline countdown. Phone screenshots to follow once the phone session delivers them. Old placeholder images removed.

# Coordinator: CORRECTION, KAROO REDESIGN IS APPROVED AND 76 IS INSTALLED; STATUS OF THE TWO CODEX SESSIONS (2026-11-04, read from their local worktrees; nothing from them is on main yet)

**Corrects my "KAROO SCREEN REDESIGN, PROPOSAL ONLY, NOT APPROVED" section further down and my "version 70" notes: both are stale.** The Karoo Codex records that Jason approved the redesign, that it installed version 76 (Room 4) on October 31 (source efaf5f6, runtime e7a7c45), and that startup was verified with 7 installed / 7 ready fields. The merged responsive Pacing field (Pacing Coach/Profile) is in. Ignore the four "STILL OPEN" redesign questions in that older section.
**Karoo Codex (`codex/karoo-screen-redesign`, local only, nothing pushed):**
- Cardiac Drift "calibrating" bug: cause found by replaying the supplied original FIT privately (outputs stay outside Git). The tracker can lock a baseline and then suppress drift while the field still says collecting. Fix `a9d9ed9`: baseline countdown plus the real readiness reason. 288 tests, lint and build pass; NOT installed.
- GM Recent Segments (`7761b4e`, highlight `e58c64c`): newest completed attempts, 30 s shrinking highlight on the latest. Room 5 migration: the device cannot go back to 76 after installing it; never uninstall or clear data to work around it. 296 tests pass; NOT installed; flags off; latest debug build 78 is not persistent-beta signed.
- Nearby Segments proposal written (`docs/KAROO_NEARBY_SEGMENTS_PROPOSAL.md`): installed starts within about 2 km, up to 4 rows, awaits Jason's review of radius, ordering, row content.
- 108 synthetic preview PNGs for the root README (`assets/karoo-previews/2026-11-04/`), labelled development previews, not device captures.
- Segments-and-pace-marker map review and Karoo-to-phone Bluetooth sync feasibility: still queued. Codex is NOT working on liked segments.
**Open Segments Codex (`codex/open-segments-platform`, local, ~50 commits in 2 days):** local private likes server and UI built (Uploaded/Liked collections, inline code sign-in, optimistic toggle). Control tried as heart, then Like/Liked text, then thumb, now a compact solid heart (Jason's choices). Production is schema 11 / Edge 10 with likes OFF and revised filter dropdowns deployed; a hosted likes release needs a separate approval. QUESTIONS FOR JASON: (1) its notes mention a "blue favicon" matching an "approved blue palette", committed locally, not deployed (production favicon is pink); the approved web palette is graphite ink + pink, so confirm blue was his call; (2) two dark-mode contrast tests fail, "previously accepted": confirm the cooler-gray dark values (c748c62) are applied. My phone-contract questions (fingerprint lookup, URL shape, account linking) have not been answered in what I read.

# Coordinator: PHONE LIKED-SEGMENTS CLIENT IS BUILT AGAINST A FIXTURE; CODEX, MATCH THE CONTRACT TO THESE ASSUMPTIONS (2026-11-03)

The phone session built the Liked screens, hearts and "Open in GritMap" routing on local branch `phone-liked-segments` (commits 3458fc5, 0cc2a31, 2d5ac52; NOT pushed; flag OFF; no native change). It guessed the server contract; each guess is marked `ASSUMPTION(contract)` in `src/openSegments/accountClient.ts` and `segmentLink.ts` on that branch. **Codex: when you write the real phone contract, either match these or tell us what differs:**
1. Segment ids are opaque strings. Each summary carries fingerprint, name, distance, elevation gain (fingerprint lets the phone show "already added" with no download).
2. One unpaged liked list, newest first; `setLiked` idempotent; a batch "liked state" lookup for a list of ids.
3. Fetch by id works signed-out and for Link-only segments, returning portable JSON in the existing registry format.
4. **Biggest open question:** a `findByFingerprint(fingerprint)` lookup, because registry results and segments already on the phone carry fingerprints, not server ids. Without it the heart only works where the server id is known (Liked rows, link pin screen). Please decide and say whether a fingerprint lookup is allowed (it must not leak Link-only segments to people without the link).
5. Link shapes: custom scheme `gritmap://segment/<id>` already works in current builds. The https form is a guess: `https://opensegments.org/s/<id>` (and www). Confirm the real URL shape. Use the universal link on the web page with `gritmap://` as fallback (the custom scheme shows an iOS "Open in GritMap?" prompt).
6. Universal links need, in this order, Jason's approval of each: Associated Domains entitlement `applinks:opensegments.org` in the app (new native build), the App ID capability, and an `apple-app-site-association` file on opensegments.org with the app's Team ID and bundle id `com.gritmap.app`. Do NOT put anything about the Team ID in the repo until Jason confirms it is fine to publish (it is not secret, but he decides). The web page also needs a fallback when the app is not installed (TestFlight / App Store page).
Not built on the phone yet: sign-in (waits for your contract), map on the pin screen (needs design), Climb/Descent/Ride tag (spec not in repo).

# Coordinator: LIKED SEGMENTS (HEART) AND GETTING THEM ONTO THE PHONE (2026-11-03, requested by Jason; no Figma yet, build from this text)

**Jason's ask:** a heart to like a segment on Open Segments; liked segments appear in "My segments" in a separate list from uploaded ones (a segment can be in both); make it easy to get liked segments onto the phone. Jason skipped the Figma step: design to the existing Trailhead tokens and components (heart = a new duotone icon in the same set, outline off / filled on, label "Like" / "Liked", never colour alone), and send Jason screenshots for approval at the end of each stage.
**Defaults used until Jason says otherwise (TO CONFIRM):** likes are PRIVATE to the account (no public counts, no "most liked" ranking, no one else can see who liked what); a like made on the web or the phone shows on both (stored on the account).

**Web (fold into stage 3, account and My segments):**
1. Heart on the Segment card and the Segment page. Signed-out tap opens the same sign-in prompt as the creation flow, then completes the like. Optimistic toggle with an undo-safe failure state; keyboard and screen-reader label ("Like segment" / "Remove from liked").
2. "My segments" gets two tabs: **Uploaded** and **Liked**. A segment the rider uploaded and also liked shows in both. Empty states for each. A liked segment that later becomes Hidden or is removed drops out of Liked without leaking why.
3. Segment page: **"Open in GritMap"** button (universal link / deep link that opens the app on that segment's pin sheet, with an install fallback to the TestFlight/App Store page) and a **QR code** of the same link for desktop visitors. Works without an account.
**Data and privacy:** store a like as (account id, segment id, created at) only. Unliking deletes the row; deleting the account deletes all likes; likes never appear in public APIs, listings or logs. This is new personal data on the server: add it to the privacy page text and flag it for Jason's lawyer review. Rate-limit like toggles per account. Contract and fixtures shared with the phone through `segment-core`/the phone client contract.

**Phone (follows the Open Segments contract; flag-gated; do NOT build before the contract exists and Jason schedules it):**
1. When signed in with the Open Segments account, show **Liked** (from the account) with an "Add to my segments" action per item (pins and downloads the line locally) and "Add all" for first use; already-pinned items show as added. Heart toggle on Open Segments results and segment detail, synced with the account.
2. Handle the "Open in GritMap" link: open the segment's pin sheet; unsigned users can pin without an account.
3. Pinned segments behave like any other segment, including send to Karoo.

**Account linking question (Codex must decide and report):** Sign in with Apple "Hide My Email" gives the app a private relay address, so the same person signing in with Apple on the phone and by emailed code on the web could end up with two accounts and two separate sets of uploads and likes. Propose how accounts are linked or merged (for example, link sign-in methods under one account after a verified email code) or how the app warns the rider. Account name stays server-generated and read-only. Verify current Apple/Google sign-in rules (Apple requires Sign in with Apple when a third-party login is offered) and Supabase support in current docs.

**Confirm list additions:** like storage and deletion; linking rule; deep-link domain and association files (apple-app-site-association) without Jason's secrets; QR generation client-side with no tracking; how unsigned "Open in GritMap" behaves when the segment is Link only (should still open for anyone with the link).

# Coordinator: KAROO ASK, SEGMENTS AND PACE MARKER ON THE KAROO MAP (2026-11-03, requested by Jason). Design/feasibility first, no device install

**Jason's ask:** track segments on the Karoo map: show each segment as a coloured line on the map, plus the pace marker on the map. Fits `docs/GOALS.md` (Karoo owns live execution and "the map pacer"); not a conflict.

**What already exists (verify, do not assume):** `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/PacerMapLayer.kt` (+ `PacerMapLayerTest.kt`) already sends Karoo map effects: a `ShowPolyline` of the matched segment (id SEGMENT_POLYLINE_ID, SEGMENT_COLOR, width 5) and a pacer `Symbol.Icon` (`gm_map_pacer`) at the target-progress point, only while the match status is ACTIVE; it hides both otherwise. `docs/NEXT_RIDE_TEST_CHECKLIST.md` lists "Map pacer" as an unchecked item, so it may never have been validated on a real ride. The Karoo extension API (`MapEffect`: ShowPolyline/HidePolyline/ShowSymbols/HideSymbols, ids, colour, width) is vendored in `apps/karoo/vendor/karoo-ext`.

**What Jason wants beyond that (DRAFT, TO CONFIRM with Jason):**
1. The segment line visible BEFORE the rider reaches it (upcoming planned segments on or near the route), not only once the attempt is active; clearly different treatment for upcoming, active and already-ridden segments.
2. Several segments at once where they exist (a stacked/multi-segment ride), each with its own id; hide the ones that are far away to keep the map readable and the device fast.
3. A pace marker that is easy to tell apart from the rider's own position, moving along the segment at the planned pace, so the rider sees ahead or behind on the map (same target as the Pacing dot in the Karoo data fields; one source of truth).
4. Colours must stay readable on Karoo map styles (light and dark) and not hide the route line; white/black outline or casing if needed.

**Please do (read-only/design first, short report to Jason):**
- Audit the current map layer against the above: what shows today, when, and what it reads from (does it need segments the rider is NOT matched to yet? is there an upcoming-segment list in state?). Say whether the vendored Karoo API allows several polylines and symbols at once, line style (colour/width only, or dashes/casing?), maximum counts, update frequency and any known performance or battery cost.
- Propose the behaviour: which segments to draw and when (draft: next planned segment within 2 km along the route plus the active one; ridden ones faded or hidden), the colour per state (propose, within Karoo contrast), marker design and size, and how it behaves when GPS is lost or the rider leaves the route.
- Say what the pace marker should show when the plan is replanned (live replanner) so the map and the data field never disagree.
- Tests: extend `PacerMapLayerTest` for the new states with synthetic data. No real GPS in fixtures.
- Real-world check: Jason's supervised Diablo ride is the first chance (Saturday at earliest, Bluetooth only, diagnostic74 already approved for that one ride). Adding map behaviour needs a NEW approved install; do not install anything on the Karoo or push without Jason's yes in your chat. Device stays read-only otherwise. Do not touch the uncommitted work of other sessions.
- If the map layer changes could affect live segment matching or the pacer, say so before building. The map is display only; it must not alter engine state.

**Open decisions for Jason (answer in the coordinator chat):** which segments to show (all on route, next only, within what distance); colour change only vs a distinct upcoming/active/done scheme; should the pace marker also show the rider's gap in seconds next to it; whether this waits for the Karoo screens redesign (`docs/KAROO_SCREEN_SPECS.md` on `claude/gritmap-karoo-screens-b47518`, where the pacing dot colour is also still open) so the map marker and the data field dot share one design.

# Coordinator: PHONE BACKLOG ADDITION, FIT IMPORT FROM THE FILES APP / iCLOUD DRIVE (2026-11-02, Jason approved adding to backlog and GOALS)

**Backlog, not beta-blocking, not scheduled.** Check whether the phone's existing manual FIT import already accepts files from the iOS Files picker (iCloud Drive, other providers); if not, add it. This also covers FIT files from other head units and Hammerhead dashboard exports. Phone session: confirm current behaviour read-only and report, do not build until Jason schedules it. The Karoo-to-cloud drop and Intervals.icu import ideas are recorded under "Later" in `docs/GOALS.md` (Phone and Karoo sharing); Bluetooth stays the main path.

# Coordinator: DARK MODE PALETTE CHANGED TO COOLER GRAY (2026-11-02, Jason picked Option 2). Values-only change; supersedes the warm dark values in the build handoff below

**Jason found the warm charcoal dark mode too warm. Use these dark values instead of the warm ones (token table 475:9955 in Figma already shows them). Light mode is unchanged. If you have already built dark tokens, this is a value swap only; no structure change.** In the build handoff below, read "warm charcoal in dark" as "cool gray in dark".

Dark tokens, old -> new:
- color/bg/page #2A251F -> #1F2328
- color/bg/panel #352F28 -> #292E34
- color/bg/subtle #403931 -> #343A41
- color/bg/disabled #302B25 -> #262A2F
- color/text/primary #F1ECE0 -> #E9EDF1
- color/text/secondary #C4BCAB -> #B7C0CA
- color/text/disabled #8A8372 -> #747D88
- color/text/on-accent #1B1812 -> #13161A
- color/border/default #4F483E -> #434A53
- color/border/input #8F8878 -> #7D8590 (lifted from #7A828D to reach 3:1 against bg/subtle)
- color/accent/subtle #3F4442 -> #3F4144
- color/accent/fill #4D4539 -> #3F464F (dark primary button fill)
- color/accent/fill-hover #5C5346 -> #4D5560
- color/accent/on-fill #F6F1E6 -> #E9EDF1
- color/route/casing #2A251F -> #1F2328
- color/map/bg #302B24 -> #252A30
- color/map/road #453E34 -> #353C44
- color/map/label #C4BCAB -> #ADB6C2
- color/chart/grid #4F483E -> #434A53

**Dark map cleanup (Jason approved via the Figma session; values-only, applies to the live map style layers in dark; light mode untouched):**
- Park / wood / landcover fill: none below zoom 13 (same as land #252A30); at zoom 13 and closer #2A302E (was olive #343D2A). Token color/map/park (Dark) is now #2A302E.
- Park and boundary lines: no dashes; solid hairline #434A53 at 40% opacity (or off).
- Orange road / bridge highlights: use the neutral road colour #353C44.
- Unchanged: land #252A30, water #2A3C46, labels #ADB6C2, route #FF6FA3 (5.5:1 on land).

Unchanged in dark: accent/default #E3EEF0, accent/hover #F2F8F9, accent/pressed #FFFFFF, focus/ring #E3EEF0, route/line #FF6FA3, elevation/fill #FF6FA3 at 18%, logo glyph #0C0A07, success fg #7FD6A0 / bg #26361F, warning fg #F2C35B / bg #3C3114, danger fg #FF9166 / bg #432416, map/water #2A3C46, overlay/scrim #000000.

Contrast: the Figma session recomputed all 59 dark rows from the live variables; all pass (text on page 13.43, route on map bg 5.55). Verify in your own contrast test.

**Brand separation note (for Jason):** the phone app dark palette is also cool gray, so web dark and phone dark are now closer (page vs app background delta E 9.0, panel vs app surface 8.4; dark primary fill vs app blue 25.2, was 39.8). Light mode is still clearly different. Jason has not yet accepted this narrowing explicitly; it follows from his pick.

# Coordinator: BUILD HANDOFF FOR CODEX, OPEN SEGMENTS WEB REDESIGN "TRAILHEAD" (2026-11-02, Jason APPROVED the Figma design)

**Status: design approved by Jason. Build in stages, report after each. Do NOT deploy to opensegments.org or change staging/production data or settings without Jason's yes for that exact action. Do not push without Jason's yes in your chat; push only your own branch; never force-push; add explicit paths; no credentials or personal GPS in commits. Do not touch apps/karoo.**
**Source of truth:** Figma file `cyaMDDfLBKFc4NNK1SUUnb`, page "Web C · Trailhead final" (base `https://www.figma.com/design/cyaMDDfLBKFc4NNK1SUUnb/?node-id=X-Y`, colon becomes hyphen). Developer handoff frame **477:10417** (screen list with links, components, interaction notes, states without colour, contrast table, open questions); token table **475:9955** (CSS names 1:1, e.g. `var(--color-bg-page)`); components **463:204**; icons **462:204**; unslop audit **508:15974**. Key screens: Home 498:12459 (dark 498:12710), Explore 467:595, Segment page 467:2508, create flow 471:5791 / 472:7415 / 473:8854, sign-in 469:3981, Account 469:2779, My segments 468:2402, About 468:2277, map controls/attribution 500:12700 / 501:14577, visibility modals 497:12230 / 497:12428 / 497:12656. If you cannot read Figma, tell Jason; the Figma session can export token CSS and frame images outside the repo.
**Look and feel (decided):** concept C "Open Map" with style tile **Trailhead**; font **Figtree** + **DM Mono** for numbers (self-host woff2, SIL OFL 1.1, keep licence files and a notices entry); duotone icon set A (original drawings; no third-party icon licence); accent **graphite ink** (#1E2D30 light / #E3EEF0 dark); **pink route** (#D6336C / #FF6FA3) also used for the elevation profile line, with an alpha fill token; near-white warm neutrals in light (page #F7F4EC, panel #FFFEFA) and warm charcoal in dark; hairline borders, shadows only over the map and on modals; radius by role (6/8/12/16). NO gradients on the route. The web and the GritMap phone app are INTENTIONALLY visually separate brands: do not reuse phone colours or components. Logo (Jason, 2026-11-02): until his new logo is ready, use the EXISTING opensegments.org logo with its green recoloured to the route pink (#D6336C light / #FF6FA3 dark); the dashed "LOGO SLOT" placeholder in the Figma frames is superseded. Recolour the existing asset (do not redraw it), check it on light, dark and map backgrounds, and in DARK mode the glyph inside the pink mark is the INK colour (white on #FF6FA3 is only 2.4:1; ink #0C0A07 is 7.6:1), in light mode it stays white (4.6:1 on #D6336C), via a `logo/glyph` token (values in token table 475:9955); keep one swappable logo component and favicon so the new logo drops in.
**Behaviour decisions to implement:**
1. **Map on by default.** The basemap loads on first paint on every screen, full-bleed on Home, Explore and Segment page with a floating nav bar over it (solid fallback if blur unsupported). NO "show map" button or toggle. Slow or failed tiles: a Retry state and the page stays usable. Controls stack bottom-right: +, -, "Near me" (explain before the browser asks for location; "Not now" remembered for the browser session only; nothing sent to a server), and an "i" attribution button (one tap opens "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", Esc closes), exactly one attribution per map. Attribution wording and placement are flagged for Jason's lawyer: verify the text against the style actually loaded.
2. **Home:** one random LISTED segment selected per page load (never Link only or Hidden), highlighted in the list and framed on the map, never reshuffled on interaction; no "How it works" section (About has it).
3. **Segment cards:** type tag (Climb / Descent / Ride, icon + caps word) at top-left, right arrow (horizontal) top-right, name across nearly full width (two lines then ellipsis, full name on hover/focus), stats, pink elevation profile at the far right. Explore filter: All / Climb / Descent / Ride.
4. **Type rule (DRAFT, TO CONFIRM by Codex):** Climb if net average grade >= +3% and net gain >= 15 m; Descent if <= -3% and net loss >= 15 m; else Ride; no elevation data = no tag, excluded from type filters, still in All. Compute in shared `packages/segment-core`, derived not stored unless you justify storing.
5. **Creation flow:** same rules as the phone: 300 m minimum, 100 km maximum, elevation required; steps as drawn (sign-in gate, upload, choose section, name and share, near-home, similar segments, review, publishing, published, errors, daily limit, leave confirm). Listed publicly BY DEFAULT with a small "Change visibility" link that opens a modal where Link only needs a permanence warning and an explicit confirm (Link only cannot be changed afterwards). 5 publishes per account per UTC day (Link only counts); show the reset time in local time.
6. **Names and credit:** NO chosen display name. Server-generated account name (e.g. `rider-4821`), never derived from the email or real name, read-only for now (a later release may allow change). "Credit me as <name>" checkbox ON by default on name/share step and review; unticked shows "Anonymous rider" publicly with no account id leak. Same model as the phone.
7. **Reporting:** in-page report form (not a prefilled email); report auto-hide stays; badges Listed / Link only / Hidden (after a report).
8. **Accessibility:** states must not rely on colour alone (active nav link semibold + underline; selected = ink outline + left bar + tint; focus = 3 px ink ring with gap; every status has icon + title); follow the contrast table in the handoff frame; keyboard and screen-reader labels for map controls; respect prefers-color-scheme (no theme toggle drawn) and reduced motion.
9. **UNSLOP RULES:** follow the Unslop audit frame (508:15974): tokens exactly as designed, no stock shadcn/Tailwind themes or default radii, no purple/gradient text/animation spam/emoji icons/centred hero + three cards, copy without marketing cliches. Do not install or run third-party scanners without Jason's approval.
**TO CONFIRM BEFORE STAGE 2 (answer these first, short report):** near-home distance (draft 250 m from the ride start) and what counts as "home"; segment name length (draft 3 to 60); 25 MB GPX/FIT limit; sign-in timings (10 minute code, 3 tries, 15 minute pause); partial-elevation rule (draft: block when the chosen section overlaps an elevation gap, allow a gap outside it); type thresholds; whether credit can change after publishing (draft: fixed per segment); attribution wording vs the loaded style; what is actually deployed at opensegments.org today (writes open or closed, listing rules, sign-in).
**STAGES (report after each, tests and screenshots, Jason approves before the next):** 0) audit current apps/web against the Figma, list what differs and propose how to do the build with the least rewrite; answer the confirm list. 1) Tokens (CSS variables from 475:9955, light/dark), fonts, icon set, base components (buttons, inputs, chips, badges, cards, notices, modals, toasts, nav) with a component gallery page. 2) Map shell: full-bleed basemap, floating nav, controls stack, attribution, near me, loading/failed states; Home with random selected segment; Explore with list/map, filters including type; Segment page. 3) Account/sign-in screens (account name read-only) and My segments. 4) Creation flow including visibility modal, credit checkbox, near-home, similar segments, limit and error states, sharing the same `segment-core` rules as the phone. 5) Content pages (About, Terms, Privacy, 404, offline), accessibility pass (keyboard, screen reader, contrast, reduced motion), responsive check at 390 px, visual diff against Figma, Lighthouse. Production deploy is a separate decision by Jason.
**Tests and evidence per stage:** unit tests for segment-core rules (type, limits, elevation), component tests, an end-to-end test of the creation flow on a local server with synthetic data only (no real GPS), screenshots in light and dark at 1440 and 390, and a list of any deviation from Figma with the reason.
**Related asks still open above in this file:** phone publish contract and `segment-core` push, auto-share, HR drift bug, nearby segments field, Karoo-to-phone ride sync feasibility, type metadata. This web build does not displace them; segment-core on origin and the phone contract stay the priority for the beta.

# Coordinator: NEW SEGMENT METADATA, CLIMB / DESCENT / RIDE TYPE (2026-11-02, Jason asked; draft rule, TO CONFIRM)

Jason wants every segment tagged **Climb**, **Descent** or **Ride** (flat or rolling), shown on BOTH Open Segments and the GritMap phone app (icon + caps label tag on the card, like the old live-site "RIDE" tag, plus a filter on Explore). Figma is being updated by the Figma session for web and phone.
DRAFT RULE (derived from the elevation profile, not chosen by the rider; computed once in shared `packages/segment-core` so phone, web and server agree): Climb if net average grade >= +3% and net gain >= 15 m; Descent if net average grade <= -3% and net loss >= 15 m; otherwise Ride. Constants named and unit tested; the old live example (1.3 km, 11 m, 0.9%) is a Ride.
CODEX, please report and design (no build until Jason approves): (1) confirm or change the thresholds and whether to use net grade or something robust to noise (smoothed profile, use the same elevation smoothing the segment already uses); (2) derived vs stored: recommend computing on the fly from the stored profile (no migration, no drift) and returning it in the API and phone contract as a read-only field; if stored for search, say how it is kept in sync when the algorithm changes; (3) the Explore filter (type) in the API and its effect on map-area search and caching; (4) segments with no elevation (older phone segments, imported): what the tag shows (no tag vs Ride); (5) add the field to the phone client contract and fixtures, and tell the phone session via a handoff note. Phone work for the tag waits for segment-core on origin.

# Coordinator: ACCOUNT NAMES REPLACE DISPLAY NAMES, "CREDIT ME" CHECKBOX, UNSLOP RULE (2026-11-02, Jason decided Option A)

SUPERSEDES the display-name notes below (chosen names, 2 to 30 character rules, blocked-words list, "Choose a different name." errors, and "name taken"/uniqueness wording).
1. **No chosen display name.** Each account gets a neutral, SERVER-GENERATED account name (never derived from the email or real name; Codex proposes the format, e.g. two words plus digits, and collision handling). It is tied to the account's email privately. The email is never shown publicly and never used as the credit. Riders cannot edit the name now; a later release may let riders change it when real account sign-in options exist (design the schema so the name is a field that can become editable, with history/ moderation in mind).
2. **"Credit me" per segment, checked by default.** The publish step shows the name that will be credited next to the checkbox. Unchecked means the segment shows "Anonymous rider" publicly (the account is still known to moderators). Same on web and phone (the credit is account-wide, as decided earlier: phone-published segments carry the same credit). Codex: report whether credit can be changed after publishing, how anonymous segments appear in search results and API responses (no account id leaks), and what the phone contract carries (credit flag, generated name read-only).
3. Figma web and phone screens are being updated by the Figma session. The old display-name setup/validation screens are dropped.
4. **UNSLOP RULE FOR THE BUILD.** Jason wants the site to avoid generic AI-looking UI. The developer must follow the "Unslop audit" frame that the Figma session adds to the handoff (checklist from the public Unslop UI playbook: no default palettes, stock shadcn/Tailwind look, AI purple, gradient text, animation spam, uniform rounding or pills everywhere, neon glow, emoji or generic icons, default fonts as the only face, centred hero + 3 cards skeleton, marketing cliches; plus layout quality by eye). Implement tokens exactly as designed rather than library defaults, and do not add UI libraries' stock themes. Do not install or run third-party scanners without Jason's approval.

# Coordinator: WEB DESIGN DECISIONS + NOTE FOR CODEX BUILDING opensegments.org (2026-11-01, Jason decided)

Jason chose for the Open Segments web redesign: style **Trailhead**, font **Figtree** (DM Mono for numbers), icons **duotone set A**, route colour **no gradient** (single route colour, hollow start ring, filled finish square), logo **still being worked by Jason, use a placeholder**. The "GritMap Figma screens" session is building all screens, tokens and components on Figma page "Web C · Trailhead final" (file cyaMDDfLBKFc4NNK1SUUnb), including every step of the segment creation flow; it will end with a developer handoff frame. NOTHING is to be built until Jason approves that page and a Codex handoff is written, so Codex: do not start the redesign yet.
**MAP RULE FOR THE BUILD (Jason): the site must LAUNCH WITH THE BASEMAP LOADED BY DEFAULT. There must be no "show map" button or opt-in toggle.** Handle slow or failed tiles with a retry and keep the page usable, but never gate the map behind a control. Keep the OpenFreeMap/OSM attribution chip once per map. (The phone app is different: its map previews have a Settings switch.)
Self-host Figtree and DM Mono (SIL OFL 1.1, keep the licence file and a notices entry).

# Coordinator: FOR CODEX, FEASIBILITY: AUTOMATIC KAROO-TO-PHONE RIDE SYNC OVER BLUETOOTH (2026-11-01, Jason approved this ask; read-only, no build, no device access)

Jason wants rides to reach the phone automatically after a ride. An outside suggestion (from a chat assistant, unverified in places) was a Karoo extension that detects ride end, reads the finished `.fit`, queues it offline and uploads it to a backend. We do NOT want the backend: GOALS says nothing passes through a server on the phone/Karoo path and ride GPS must not be hosted. Keep the Karoo half, replace the server with the existing Bluetooth link (the reverse of phone-to-Karoo; GOALS lists it as "Later"). Intervals.icu was tested as an alternative source: its re-encoded FIT keeps records and GPS within a metre but drops Karoo-only data and changes timer/lap values, so it is an optional later import at best, not the main path.
Please answer, citing code and `karoo-ext` docs/source rather than assuming:
1. Can a Karoo extension READ the finished ride FIT file? Where does Karoo OS write it, what permission or storage rule applies (scoped storage), and does karoo-ext expose a ride-ended event, a file path or the bytes? Is the file finalized at the moment the event fires?
2. How would the extension know a ride is new and not yet sent (ride id, start time, content hash) and how is the queue persisted?
3. Transfer: reuse the existing BLE transfer (versioned contract + fixtures) in the reverse direction. Message sizes (a real 3-hour ride FIT is about 415 KB; allow 2 MB), chunking, resume, integrity hash, and what the phone's existing import and duplicate detection (content hash, activity id, device-timing rules) will do with it. Include the pause/resume events and the Karoo-only record fields that Intervals.icu dropped.
4. iPhone side: what iOS permits while the app is in the background or killed (CoreBluetooth background modes, state restoration). Be explicit about what will NOT work (for example needing the app open) so the rider experience is honest.
5. Rider flow and failure modes: when does the sync start (ride end, phone in range), what the Karoo and phone show, what happens with no phone nearby, with an old Karoo version, and with the Karoo asleep.
6. Distribution: does the Hammerhead Extensions Library (self-service for developers, SRAM approval) change how riders install the extension compared with today's APK link? Report requirements and approval steps only; do not submit anything.
7. Effort estimate and a proposed phase plan (contract + fixtures, Karoo send, phone receive, background behaviour), and what must be decided by Jason.
Do NOT change apps/karoo, do NOT install anything, do NOT read from the Karoo device. This does not displace the other Codex asks above (phone publish contract + segment-core, HR drift bug).

# Coordinator: AUTO-SHARE SEGMENTS TO OPEN SEGMENTS, OPT-IN, OFF BY DEFAULT, BETA BLOCKER (2026-11-01, Jason decided)

Jason: segments created in the phone app must be able to upload to Open Segments automatically; this is required before the beta opens. DECIDED: a Settings option "Share new segments to Open Segments", OFF by default. When ON, a newly created segment uploads without a publish tap, as **Link only** (not listed) unless the rider later lists it. Safeguards the contract must enforce: the near-home check runs first and a segment near home is held for the rider's confirmation (never uploaded silently); the 5 per UTC day cap applies and over-cap segments queue with a visible reason; the rider must be signed in with a display name set (otherwise the segment waits and the app says why); a visible "Shared" mark on each segment, with a way to stop sharing; failures retry later with plain-text status; nothing but segment line, name and credit is sent (no ride data, times, power, HR). Existing segments are NOT uploaded when the switch is turned on, unless the rider picks them. Codex: put this in the phone client contract (the earlier ask for Codex above): extra items are idempotent re-upload (a retry must not create duplicates), what "stop sharing" does to a Link-only segment others already opened (unlist vs delete), and how the similar-segments check treats auto-shares. Phone work waits for the contract and for segment-core on origin.

# Coordinator: FOR CODEX, KAROO HR DRIFT STUCK ON "CALIBRATING" + NEW "NEARBY SEGMENTS" FIELD (2026-11-01, Jason)

**1. BUG, GM Cardiac Drift never loaded on a real ride.** Jason rode on 2026-11-01 and the HR Drift field kept saying "calibrating" the whole ride. GOALS says Cardiac Drift is the default field and must never show a broken or empty state, so this is a defect, not a design choice. Please (read-only, no device pull, no install): (a) work out from the code which input gates "calibrating" (minimum duration, power/HR sample counts, steady-state detection, HR source, zone/FTP profile missing, recording not started, the 0.10.43 adaptive thresholds from d38057f) and list every condition that keeps it there; (b) say which installed Karoo version/commit Jason was riding (installed is version70/0.10.44-fields1 unless he says otherwise) and whether the bug is already fixed in a later commit; (c) state exactly what evidence you need, e.g. the ride's FIT file (Jason can export it; never commit it, the repo is public) or an adb logcat he runs, and give Jason the exact steps. Any device read, log pull or install needs Jason's approval of the exact action. Propose a fix and a synthetic replay test that reproduces "never leaves calibrating" before changing anything.

**2. NEW FIELD (proposal first), "Nearby Segments".** Jason wants a data field listing the nearest segments in order of closeness, each with the rider's LAST TIME on it and the GOAL time for it. Please write a short design note (no build): ordering rule (straight-line distance to the segment start vs distance ahead along the planned route; which is correct while riding), how many rows fit on the field sizes you can derive, row content (name, distance to start, last time, goal; what shows when there is no last time or no goal), how it uses the segment data already on the Karoo (sent segments, attempts, goals) and whether any new data must travel in the phone to Karoo contract, matching cost/battery with many segments, and what happens when none are within range. This overlaps the existing items in docs/GOALS.md (Karoo tracks every segment you start; PR when there is no plan), so say how it fits `docs/KAROO_MULTI_SEGMENT_AND_PR.md`. Design/screens: the "GritMap Karoo screens redesign" session will draw it after your note. Do NOT build until Jason approves; this does not displace the open Karoo redesign review above.

# Coordinator: BUILD 17 IS ON JASON'S PHONE, BUILD 18 ON HOLD, OPENSEGMENTS.ORG LIVE PER JASON (2026-10-31)

Jason submitted build 17 (EAS id 86bae63f-5e7b-402e-a303-29ca033f9084, commit b841177) and it is on his phone. He is gathering feedback; NO build 18 until he says so. Phone commits waiting locally on `phone-build13` (not pushed): 4982bf6 (first name scrubbed from uploaded files) and 6bca004 (map previews follow light/dark mode). Define Segment rules still wait for `segment-core` on origin. Jason says opensegments.org is live: Codex, please confirm in your next report what is actually deployed there (writes open or closed, which listing rules, which sign-in) so docs and the phone contract match reality. Not verified by the coordinator.

# Coordinator: ASK FOR CODEX, PHONE PUBLISH TO OPEN SEGMENTS (2026-10-31, Jason approved sending this)

Jason asked how a rider publishes a segment from the GritMap PHONE to Open Segments. Today the phone has no publish step: the screens are designed (Figma phone Open Segments section 233:2358, incl. name/credit 337:*, validation errors 338:*, link-only/daily-limit 335:*) but the app cannot build them until the server contract and shared code are available. Please do these, in this order, and report in a handoff section:
1. PUSH `packages/segment-core` to origin so the phone can adopt the same creation rules for NEW segments (300 m minimum, 100 km maximum, elevation required; existing saved segments untouched). Needs Jason's yes in YOUR chat. Before pushing check no personal GPS data or credentials are in the commit; add explicit paths only; never force-push; push from your own branch, not the phone session's.
2. WRITE THE PHONE CLIENT CONTRACT (doc, no code needed first): sign-in from the phone (emailed 8-digit code, Turnstile equivalent for native, how the 60-day sliding session is held on the phone, where the token lives), display name set/edit and the validation rules, publish request and response (name, line, listing vs Link only, credit, near-home warning, similar-segments result, 5 per UTC day limit and its error), what the phone must NOT send (no ride data, no timestamps, no power/HR), map-area search request (coarse cell or bbox, pagination, caching headers), fetching a segment by link, and error codes the phone can show as plain text.
3. Say whether staging can open for TEST writes with a throwaway account so the phone can be tested end to end (Jason approves any staging change), and when.
4. Still outstanding from earlier notes: update docs/tests for the listing rule (listed by default, Link only, 5/day), fix the stale comment in creationSelection.ts, confirm partial-elevation rule, persistent 60-day sign-in design, email sender status, per-email OTP gate, moderation email notices, backup key custody.
Phone work follows in a later build behind a switch, starting with map-area search and pinning; publish comes after the contract is agreed. Nothing here changes apps/karoo.

# Coordinator: KAROO SCREEN REDESIGN, PROPOSAL ONLY, NOT APPROVED, DO NOT BUILD YET (2026-10-31)

The Karoo Screens design session produced a redesign proposal (design and specs only; nothing under apps/karoo changed, nothing installed). Spec: `docs/KAROO_SCREEN_SPECS.md` on branch `claude/gritmap-karoo-screens-b47518` (pushed, no PR; read it with `git show origin/claude/gritmap-karoo-screens-b47518:docs/KAROO_SCREEN_SPECS.md`). Figma file cyaMDDfLBKFc4NNK1SUUnb, page "Karoo": design system 306:204, Pacing 322:204, Performance 304:204, Cardiac Drift 305:1101, Power Balance 305:1517. Decided by Jason: Pacing Coach and Pacing Profile merge into one "Pacing" field (solid dot = you, open ring = pacing dot from targetProgressMeters).
STILL OPEN (Jason has NOT answered; do not implement these parts): (1) colour change HOLD green / PUSH orange / REST-EASE blue / red only for warnings (recommended yes, but every state must also carry a word or icon, never colour alone); (2) invented verdict thresholds (Performance ON GOAL within 2 s; Power Balance OK >=10%, LOW 3 to <10, EASE NOW <3 or now <10%): recommended provisional, named constants; (3) pixel sizes are estimates, Karoo 3 density is from memory; (4) pacing dot uses an even-pace estimate until the plan contract carries time anchors (recommended keep).
FOR CODEX NOW (read-only, no device): review the spec for feasibility against the renderers/KarooFieldLayout.kt and report: actual field sizes if derivable without a device, the migration plan for keeping both pacing type ids (LivePacingDataType) while rendering the merged layout, clipping risks with the condensed font, and whether anything needs a new data field. Do NOT change apps/karoo, and do NOT install anything. Any build waits for Jason's answers and the Saturday-or-later Bluetooth diagnostic74 ride test; a logging build for real viewSize needs Jason's approval of the exact APK.

# Coordinator: CREDIT STAYS ON THE PHONE TOO (2026-10-31, Jason decided in chat)

Segments published from the PHONE carry a credit just like the web (earlier note said credit is web-only; superseded). Fields stay: name + credit only. Open design points for Codex/Figma to settle and report to Jason: where the credit name comes from on the phone (shared account display name set once, editable, same one the web uses), how it is shown (Figma phone Review has a read-only "Credited to <name>" line), and that the display name must NOT default to the email address or real name without the rider choosing it. The phone contract needs the same credit field as the web DTO.
**DISPLAY NAME RULES (Jason, 2026-10-31):** names do NOT have to be unique. Draft validation: 2 to 30 characters after trimming; no "@" or web addresses; letters, numbers, spaces and common punctuation; a server-side blocked-words list with one generic error. Codex confirms the final rules and reports them. Figma errors: "Use 2 to 30 characters.", "Names can't include email addresses or links.", "Choose a different name."

# Coordinator: OPEN SEGMENTS LISTING RULE CHANGED, NO PHONE-CONFIRMATION GATE (2026-10-31, Jason decided in chat)

Jason: the "two distinct accounts must each submit a successful local match claim before a segment is listed" rule is DROPPED. It required the GritMap phone app (the on-device matcher), which would make the phone a requirement for a site that must stand on its own. This SUPERSEDES the listing rules in docs/OPEN_SEGMENTS_V1_CONTRACT.md ("Publication and visibility" and "Minimal match claim") and any plan item that depends on them.
DECIDED DEFAULTS:
1. **Listed by default.** A new segment is listed (search, nearby, bbox, suggestions, ride lookup) as soon as it is published and active. The creator makes it from a real uploaded ride file (GPX/FIT) as today.
2. **"Link only" option at creation.** The creator may choose Link only instead; that behaves exactly like today's unlisted (direct link works for anyone, absent from every discovery path, noindex, no revealing link previews). Creator can only choose this at creation (definition stays immutable); say in your report whether changing it later is cheap and safe.
3. **No phone confirmation.** DEFER the match-claim endpoint (PUT /v1/segments/{id}/match-claim), its table logic and any phone work for it from v1. Optional later: an "N riders have ridden this" social-proof count that NEVER affects visibility. Remove claim-based eligibility from listing logic and from segment-core/listing where it exists; keep moderation (active/flagged/removed) separate and still overriding.
4. **Publish cap: 5 per account per UTC day** (Jason approved 5; make it a named constant), on top of Turnstile, per-IP limits and the existing report path.
KEEP: near-home start/finish warning on Review; early "similar segments" check (it must still cover link-only segments without revealing their links); report flow with the "starts or finishes at home" category auto-hide (caps 2/account, 5/IP digest, 20/global per UTC day), other reports queue; Jason sole admin; response 24 h home / 7 days ordinary.
RISK ACCEPTED BY JASON: a bad segment is public the moment it is published and is dealt with by reports. Do not describe listing as verified, safe or ridden. UI copy must not say "ridden by others".
FOR CODEX: (a) update the contract/plan docs and tests; (b) report what changes in the migrations/DB (listing flag now set at publish; "unlisted" only from the creator's Link only choice) and in the API (a visibility field on create); (c) tell me what the Figma session must change: the creation screens need a Link only choice, and any "stays out of discovery until two riders" copy must go. Staging writes stay closed; no new deploy without Jason's approval in your own chat.

# Coordinator: STAY SIGNED IN FOR 1-2 MONTHS (2026-10-30, Jason requirement)

Jason: people must be able to use the site a month or two later without signing in again. Finding (read-only, Codex's local branch ad3ba59): `apps/web/src/contributions.ts` keeps the access token only in memory (never cookie/localStorage) and caps it at 3600 s; the refresh token is never stored or used. So a page reload, tab close or 1 hour signs the rider out. FOR CODEX: design persistent sign-in. Recommended: refresh token in an HttpOnly, Secure, SameSite cookie set by the Worker (not readable by page JS, not in localStorage), Supabase refresh-token rotation on, sliding ~60-day lifetime, silent refresh on page load, access token stays in memory, sign-out revokes it and clears the cookie, "sign out everywhere" later. Draft work stays local as today. Report the chosen storage, lifetime and any security tradeoff before building; **Jason APPROVED 60 days sliding from last visit (2026-10-30).** Still report the chosen cookie/storage design and tradeoffs in your handoff before shipping.

# Coordinator: PHONE ADOPTS THE SAME SEGMENT RULES (2026-10-30, Jason answered in chat)

Jason: private and published segments behave the SAME on web and phone. This overrides the earlier "leave phone behaviour alone" notes in items 1 and 2 below. Phone Define Segment will require elevation data (block with a reason and offer another file), minimum 300 m, maximum 100 km (shared limits, ideally from `packages/segment-core` so web and phone cannot drift). Phone session: schedule for build 13 with the Course tab, not build 12 (already built, unsubmitted). Credit stays web/published-only. Jason has not yet confirmed that DESCRIPTION was also removed (item 4); treat as removed unless he says otherwise. Codex is working on creation now.

**FOR CODEX (two small asks):** (1) update the stale doc comment in `packages/segment-core/src/creationSelection.ts` (it says the phone is exempt; the phone now uses it). (2) State in your handoff whether partial elevation (>=2 finite points in the chosen section, `partialElevation:true`) is the intended web rule; the phone will mirror it. Existing saved phone segments are untouched. Phone session cleared by Jason to start build 13 (Define Segment rules, Course tab, FIT share-sheet).

# Coordinator: CREATION RULES + EARLY CHECKS DECIDED (2026-10-30, Jason answered in chat)

Figma drew the website Create-a-segment flow (file cyaMDDfLBKFc4NNK1SUUnb, section 250:2358; rules-difference card 261:2882). Decisions:
1. **No elevation = BLOCKED.** The website must not publish a route without elevation; show why and offer another file. (The phone today just hides climb/grade; leave phone behaviour alone unless Jason says.)
2. **Segment length: minimum 300 m, maximum 100 km** (replaces 100 m). Jason: Strava's original minimum was 300 m. Phone currently clamps only a 10 m gap; do not change the phone without Jason.
3. Keep the near-home start/finish reminder on Review.
4. **Fields: name + credit only.** REMOVE segment TYPE (Climb/Ride) and the optional DESCRIPTION from the page, DTO, API and database use where possible (additive/compatible; do not rewrite old migrations; tell Jason what hosted data/schema is affected).
5. **FIT files are ACCEPTED on the website and the phone** until Jason says otherwise. This is Jason's informed decision despite the unresolved Garmin SDK licence (Section 2(c), see earlier notes; a Garmin question is drafted, unsent). Browser-side decode only, ride never uploaded; keep the licence risk visible in docs and the launch checklist.
6. Turnstile stays. 7. Shorter phone-style consent sentence plus Figma's added line; terms v1 stay provisional pending lawyer review.
8. **EARLY 'similar segments' CHECK, no sign-in:** in the Choose-your-segment step, once start/finish are set, the browser sends only a coarse cell area (public, cacheable, rate limited, listed segments ONLY, never unlisted/flagged/removed), compares the trimmed route locally with the shared duplicate comparator and shows matches with 'open it' / 'use this one instead'. The authoritative atomic duplicate check at publish stays (it includes unlisted; its message must not reveal an unlisted segment's link). Disclose that an approximate area is sent.
9. **PHONE RIDE LOOKUP, 'ask once, remember':** after a ride import the phone asks once (remembered, changeable in Settings) whether to find Open Segments on its rides; if yes it requests listed segments for coarse route cells (leave out roughly the first and last kilometre, cap cells for long rides, no request-body location logging), matches locally, and shows 'N Open Segments on this ride' with pin actions. No account needed. Include this in the phone client contract.
Report the exact request shapes (coarse cell/bbox limits, pagination, caching) and what changes for the phone contract.

---

# Coordinator: SEGMENT CREATION MUST MATCH THE PHONE, INCLUDING ELEVATION (2026-10-30, Jason)

Jason: website segment creation needs elevation and should be the **same experience as the phone's Define Segment flow**. Reference implementation (read it, do not redesign): `src/screens/DefineSegmentScreen.tsx` (ride route on a map + elevation chart + draggable start/end range + live distance/climb stats + name + duplicate decision), `RideElevationChart.tsx`, `ElevationProfileChart.tsx`, `DistanceRangeScrubber.tsx`, `DuplicateDecisionModal.tsx`, and the pure logic `clampSegmentRange`, `computeVisibleDistanceRange`, `nearestTrackPoint`, `cumulativeTrackDistance`, `resamplePolyline`, constants RESAMPLE_INTERVAL_METERS=10 and CORRIDOR_METERS=30 (docs/MVP.md "Segment definition"). The current web draft (`apps/web/src/draft.ts`, `ContributionPages.tsx`) carries elevation optionally and the page has no scrubber/profile yet.
How to hand it over (UI components are React Native, so they cannot be shared; the LOGIC can):
1. Move every remaining pure function the phone's Define flow uses into `packages/segment-core` (e.g. `computeVisibleDistanceRange`, scrubber snapping/clamp maths, elevation smoothing/gain rules), with the phone re-exporting so behaviour is byte-identical; add conformance tests that run the SAME fixtures through the phone path and the web path (same start/end -> same polyline, same fingerprint, same gain/loss, same quarter table).
2. Build the web UI as a faithful port of the phone's interaction: route map + elevation profile with draggable start and finish handles that stay in sync with map markers, live distance / climb / avg grade / quarter table, same minimum/maximum length and clamp rules, same duplicate decision wording. Keyboard accessible, works on phone-width screens. Use the website's visual language; copy and states should read the same as the phone.
3. **Elevation is required for creation.** GPX/FIT tracks with no elevation: mirror what the phone does today (report exactly what that is). If the phone allows it, the web must show the same warning; do not invent a different rule. Say whether elevation values are raw device data or smoothed and keep gain/loss identical to the phone.
4. Acceptance: one fixture ride gives identical published geometry, fingerprint and elevation stats from the phone and the website; a stranger can create a segment on desktop and phone-width browser; nothing but the trimmed segment is sent.
5. Handoff must state any behaviour that differs from the phone and why. Local/staging only, public writes stay off.

---

# Coordinator: PRIORITY CHANGE for Codex - segment CREATION comes first (2026-10-30, Jason)

Jason asks Codex to prioritize **creating segments** (upload a GPX/FIT route on the website, pick start/end, preview, publish unlisted) ahead of further milestone-5 operations work (backups, latency, hosting polish) and ahead of phone discovery (milestone 6). Order: (1) GPX creation end to end on staging behind the publication flag (browser-side parse, nothing but the trimmed segment leaves the device, duplicate check, ODbL consent, email-code sign-in); (2) FIT creation only after Jason decides the Garmin SDK licence question (options note still owed: ask Garmin / permissive decoder / clean-room / phone-only); (3) then the rest. Report in the next handoff what creation can do today versus what is missing, and what Jason must do for it (sender setup for the sign-in code is the likely blocker). Public publishing stays off until Jason approves launch.

---

# Coordinator: SIGN-IN IS EMAILED ONE-TIME CODE (OTP), NOT MAGIC LINK (2026-10-30, Jason)

Amends the email-only decision: Jason wants an emailed one-time code the user types in (works the same on the website and in the phone app, no deep link or redirect needed). Please: (1) use Supabase email OTP (code in the email template, not the confirmation link) and verify it in current docs; say the code length and expiry actually supported so the Figma placeholders (6 digits, ~15 min, ~1 min resend, 10 min rate window) can be corrected; (2) throttle code requests AND verification attempts per email and per IP (brute-force limits, lockout message, no account-existence leak in error text); (3) email template wording from help@opensegments.org, no clickable sign-in link; (4) the real sender setup (free tier, SPF/DKIM/DMARC list, do not disturb Email Routing records) is still required; (5) the phone app and site share the same flow, so the contract for the phone must be code-based. Supersedes the 'magic link' wording in my previous note. No accounts created by you, no secrets in the repo, no paid service without Jason's approval.

---

# Coordinator: SIGN-IN DECISION CHANGE for Codex (2026-10-30, Jason)

**Open Segments v1 sign-in is EMAIL MAGIC LINK ONLY.** Jason reversed the earlier Google+Apple choice to avoid developer-account setup. Apple/Google become a later addition (Apple must be offered whenever Google is, in the phone app). Please:
1. Make email sign-in a launch requirement, and replace the Google/Apple owner steps with the email sender setup. Supabase's built-in sender is heavily rate-limited, so specify a real sender on a FREE tier (verify current limits/prices of options, incl. Cloudflare email sending if it is ready) and exact SPF/DKIM/DMARC records for opensegments.org. List every DNS record you would add and do NOT disturb the existing Email Routing records for help@opensegments.org.
2. Design for weaker accounts: email accounts are cheap to make in bulk, so keep the two-distinct-accounts listing rule honest in docs (not verification), add signup/link throttles and disposable-domain handling if reasonable, and keep the per-reporter and per-claim limits.
3. Confirm the staging sign-in plan (it is off today): what Jason must configure, then verify end to end on staging once he says go.
4. Update the questions from my previous coordinator note: answer which sign-in methods exist now (this decision supersedes), the filter bucket mapping, the map-area search request shape and the client contract timing.
No account creation by you, no secrets in the repo, no paid service without Jason's approval.

---

# Coordinator: QUESTION + DECISIONS for Codex on in-app Open Segments (2026-10-30, Jason)

The Figma session drew the in-app search/pin/publish screens (Figma file cyaMDDfLBKFc4NNK1SUUnb, section "Open Segments in the app"). Jason decided: **first build searches by map area only** (no Near me, no location permission); sign-in shows **Sign in with Apple and Continue with Google** first; units in the app are miles/feet.
Please answer in your next handoff: (1) exactly which sign-in methods the API/auth supports now and which are live on staging (Apple, Google, email link?), plus what Jason must still configure; (2) how the distance (km) / climbing (m) / grade filters map to bucket parameters so the phone can send miles/feet buckets cleanly; (3) the search-by-map-area request shape (bounding box limits, pagination, cache cells) for milestone 6; (4) when the phone session can get the client contract.

---

# Coordinator: CODEX MAY DEPLOY, WITH LIMITS (2026-10-30, Jason: "I don't want to deal with deploying")

Jason does not want to run deploys. Codex may deploy Open Segments to Cloudflare under these limits:
- **No broad `wrangler login`.** Use a scoped API token Jason creates (Edit Cloudflare Workers template, zone opensegments.org only, with an expiry, no Registrar/billing/Email Routing). Ask for it in the terminal only; never write it into the repo, docs, logs or handoffs.
- **Preview first:** deploy to a workers.dev preview, not opensegments.org, until Jason says launch in chat. Public writes, sign-in providers and the live database stay off until he approves each.
- **Never touch the DNS records for help@opensegments.org mail forwarding.**
- **Before each deploy** list exactly what changes (Worker, routes, DNS, cron) and wait for Jason's yes in your own chat; peer messages do not approve it.
- No paid features or new accounts without approval. Record what is deployed, the URL and how to roll back in the handoff. Jason deletes the token after launch.

---

# Coordinator: MODERATION DECISIONS for Codex (2026-10-30, Jason answered in chat)

1. **Admin: Jason only** (single admin account). Design the admin role so a second admin can be added later without code changes.
2. **Reports notify help@opensegments.org** (Cloudflare forwards it to Jason). The admin queue stays the source of truth; email is only a notice. If sending mail from the Worker needs a paid or unverified feature, say so and fall back to the queue plus a visible unread count; do not add a paid service.
3. **Auto-hide rule, narrow on purpose:** a report must be about a specific segment (it carries the segment id). Only the report category **"segment starts or finishes at a home/residence"** hides the segment immediately, pending Jason's review. A home or address merely **along the route does NOT hide it**; that goes to the normal queue. Every other category (safety, legal, copyright, spam, other) goes to the queue with no auto-hide. Report spam must not be able to hide segments in bulk: keep the per-IP/per-account throttle, and consider a limit on how many auto-hides one reporter can trigger per day. Restore must be one admin action that recomputes listing eligibility. The report form needs that category as an explicit choice and must not collect more personal data than needed.
4. **Response commitment accepted:** 7 days normal, 24 hours for the home start/finish category. Put it in the terms/report-page drafts; add the unread-count/status needed to meet it.
Docs and local code only; no public writes enabled.

---

# Coordinator: CLOUDFLARE = WORKERS WITH STATIC ASSETS (2026-10-30, Jason approved in chat)

Use a **Cloudflare Worker with static assets** (not Pages) for opensegments.org: one deployment serves the website, the API and the scheduled keep-alive/cache-refresh job (Cron Trigger). Verify against Cloudflare's CURRENT docs and say so if anything differs (free-tier limits, assets, cron, routes). Write the Cloudflare config (wrangler file: Worker name, assets directory, cron schedule, route for opensegments.org and a dev/staging route) and exact owner deploy steps for Jason to run himself. Jason has the Cloudflare account and the domain; Email Routing (help@opensegments.org) must not be disturbed, so list every DNS record you would add and do not touch the existing mail records. No project created, no deploy, no secrets in the repo. Update the plan's "Pages/Worker" wording to Workers. Docs and local config only.

---

# Coordinator: HOSTING + AUTH DECISIONS for Codex (2026-10-30, Jason approved in chat)

1. **Free tiers only** (Cloudflare Pages/Worker, Supabase free). Nothing paid without Jason's explicit approval.
2. **Keep-alive via Cloudflare:** Jason wants a Cloudflare scheduled job (Worker Cron Trigger) that regularly refreshes cached catalog data from Supabase so the free project does not pause from inactivity. Design it: the cron runs a small real read query (the catalog revision / listing refresh), writes the edge cache, and logs success/failure. Jason said weekly; Supabase's free pause window is about a week of inactivity, so verify the CURRENT documented rule and choose an interval with margin (e.g. every 2-3 days), then tell Jason. Add a failure alert path (at least a visible status record). Also note free tier has no point-in-time backups, so the private backup plan stays a launch gate.
3. **Sign-in: Google and Apple** (Jason's choice), not email-only. Document owner setup steps for Jason (he does them, you do not enter credentials): Google Cloud OAuth client + consent screen; Apple Developer Services ID + key for Sign in with Apple (he already has a developer account); redirect URLs for opensegments.org and local dev; Supabase provider config. Keep an email magic-link fallback if Supabase default email limits allow, and say what limit applies and when a custom sender is needed. If the phone app later offers Google sign-in, App Store rules require offering Apple too; note it.
Docs and local code only. No accounts created, no credentials in the repo, no DNS/deploy.

---

# Coordinator: DOMAIN BOUGHT for Codex (2026-10-30, Jason confirmed in chat)

Jason bought **opensegments.org** (Cloudflare). Public contact address: **help@opensegments.org** (forwards via Cloudflare Email Routing to Jason's private inbox; never write that inbox, or any account credential, in the repo). Use help@opensegments.org as the takedown/contact placeholder in the contract, terms/privacy drafts and site footer instead of any TBD. Do not deploy, point DNS or create hosting/auth accounts yet; that is the next decision and needs Jason. Docs and local config only.

---

# Coordinator: TWO WEBSITE REQUESTS for Codex (2026-10-29, Jason approved in chat)

1. **Homepage wording.** Replace "No paywall. Ever." (Explore hero at http://127.0.0.1:5173/) with **"Free to explore."** Jason may charge for API usage later, so no "ever" promise anywhere on the site, terms or docs. Grep for similar absolute promises ("always free", "never charge") and flag them.
2. **Create-your-own-segment flow on the website.** Jason wants any signed-in user to create a segment from a **FIT or GPX route**: upload, parse **in the browser** (the ride file never leaves the device), pick start/end on the route (the plan's publish flow already lists duplicate preview, source attestation and licence consent), preview, publish as unlisted per the listing rule. **Ship GPX first** (no Garmin SDK needed). FIT upload stays gated on the licence options note already requested; do not bundle `@garmin/fitsdk` in the website until Jason decides. Strip time, HR, power and anything not needed from the extracted segment; warn if the trimmed route starts near a user's home (privacy). Reuse `segment-core` parsers and the strict publication DTO. Local only, no public writes enabled.

---

# Coordinator: DECISION for Codex - Open Segments data licence is ODbL 1.0 (2026-10-29, Jason approved in chat)

Jason chose **ODbL 1.0** for published segment data (code stays AGPL). Please treat the licence as decided and update the contract/plan wording from "default pending review" to "decided by Jason 2026-10-29; lawyer review of final terms text still required before public launch". Contributor grant to put in the terms draft: contributor keeps ownership; confirms the route is their own or one they may share; grants GritMap a permanent, non-exclusive licence to host and distribute it under ODbL; no exclusivity claimed. Hosted-API quotas/keys stay distinct from the data licence (anyone may reuse downloaded data under ODbL). Do not relicense existing registry segments automatically. Docs only; no public terms page goes live yet.

---

# Coordinator: TWO DECISIONS for Codex on Open Segments (2026-10-29, Jason approved both in chat)

1. **One quarter-mile constant: 402.336 m everywhere.** Jason decided. The phone's fixed zone default `QUARTER_MILE_METERS = 402.875` in `packages/segment-core/src/computeZoneGrades.ts` changes to 402.336 (the Karoo, adaptive zones, fixtures and the new public tables already use it). Add a test that every quarter-mile use shares one exported constant. Check that plans already stored/sent keep working (plans carry their own zone ends; do NOT silently regenerate or re-send stored plans) and say what you verified. Update `coreConformance.test.ts` (it pins 402.875 today), the README line, and the implementation-plan note that says the legacy value is kept.
2. **Jason wants people to upload a FIT file on the Open Segments website.** Constraint from GOALS: raw rides stay on the user's device, so decode **in the browser** and send only the extracted segment, never the ride file. Licence problem: `@garmin/fitsdk` LICENSE.txt grants use for "internal business purposes" and section 2(c) bars making the SDK or its features available to third parties, so bundling it into a public website looks like a violation. Jason's question is what to do. Please write a short options note (docs only, no code yet): (a) ask Garmin for written permission or check whether a separate redistributable licence exists, (b) a permissively licensed FIT decoder (verify its actual licence text and how it was written), (c) a small decoder written from the public FIT protocol documentation without copying SDK code (state the clean-room risk), (d) phone-only import, web takes portable JSON/GPX. Recommend one. Flag whether the phone app's own use of the SDK has the same issue. Not legal advice; Jason decides.

---

# Coordinator: CONTRACT QUESTIONS for Codex from the phone BLE sender (2026-10-27)

The phone session built the BLE pacing-fields sender (local branch `ble-pacing-fields`, tip 1dead18, off 9369ff4, not pushed, not native-built): staged baseline plus richer variants, optional capabilities characteristic, variant chosen by advertised features, frozen per central, no/malformed/unknown advertisement = baseline byte-identical to the old phone. Its variant choice matches your gateTransferExtensions for 15 advertisements; your fixtures are used byte-identical; 762 TS tests and 123 Swift checks pass. Please answer these in your next handoff section (short answers):
1. **segmentRecord does not fit the 512-byte BLE manifest when a rider profile is present** (Diablo, all fields: 476 B non-public / 490 B public BEFORE the record; the record adds about 99 B). It fits only with no rider. Ceilings cost nothing. Options: shorter descriptors, omit rider when the Karoo already has it (needs the inventory note), or a versioned chunked manifest. Which do you want? The phone currently leaves the record out and reports manifest_too_large; it never drops the rider. This also decides the PR-timing work.
2. **riderId:** a different owner rejects the WHOLE package atomically, so a changing id breaks every later send. Who generates it, where does it persist (iOS Keychain survives reinstall, app_settings does not), and is there an owner reset on the Karoo? Until answered the phone builds no record.
3. **Malformed capabilities write:** the phone accepts it (ATT success) and serves baseline. Does your central treat a failed write as an abort? Confirm accept is right. Confirm the Karoo writes capabilities on EVERY connection (including reconnects), and BEFORE its first manifest read (reading first gets baseline for good).
4. **Receipt codes** for rejected pacing fields (e.g. bad_replan, bad_record, record_owner_mismatch): list them all so the phone can show plain text instead of a generic rejection.
For the supervised ride, ceilings are enough (they cost no manifest bytes); the record can follow once Q1 and Q2 are settled.

# Coordinator UPDATE for Codex (2026-10-27, Jason decided): Bluetooth for the pacing test, phone sender in progress

Read after your own latest handoff (diagnostic74 approved, awaiting device and sender). New decisions:
1. **The supervised pacing test uses BLUETOOTH, not Wi-Fi.** The GritMap MVP phone session is building the phone BLE v2 sender for the optional pacing fields against your `docs/RECEIVER_CAPABILITIES_CONTRACT.md` and `fixtures/contracts/` (it reads them from `origin/codex/karoo-receiver-capabilities`). It will send questions through the coordinator if the contract is ambiguous: answer them in your LATEST section. Keep the old-Karoo/old-phone baseline unchanged. Do not install diagnostic74 until Jason confirms the sender build exists and the Karoo is connected, unlocked and authorized (his approval of the exact APK stands).
2. **Build 8 (phone) stays in Jason's internal TestFlight only** and passed his checklist; it is NOT going to Apple. The next public phone build is the redesign (light/dark, segment-centred home, per-segment goals), so the sender will ship in that build. Public Karoo stays 0.10.45/73 with flags off.
3. **Per-segment goals are coming on the phone:** every segment can have its own goal and plan, and plans already carry `targetFinishSeconds`. Answer in your next handoff: what does the Karoo do today when TWO different segments have stored plans (which one headlines, can both be shown, any conflict with live replanning or the concurrent-segments cap)? Short note, no implementation.
4. Order stays: receiver/sender test first, then plan-free Bluetooth + PR timing, then the "On Karoo" inventory design note (Jason approved the mark; the phone list now shows a "Karoo" check from its own send log behind a swappable interface, so your inventory can replace it).
Work in your own worktree/branch, explicit paths, no force-push; push your commits.

# Coordinator: NEXT TASK for Codex (2026-10-26, Jason: this is the priority): make the new pacing reach the Karoo

The public 0.10.45/73 release is done; the replanner (1650b79) is built but off and has never run on a real ride. Work in your own worktree, own branch, explicit paths, no force-push, push your commits.
1. Receiver capability gating: the Karoo must advertise (in the BLE v2 capability/handshake and the Wi-Fi path) that it accepts the optional plan ceilings and `segmentRecord`; the phone sends them only when advertised.
   Old Karoo versions must keep working unchanged (installed 70 rejected the new extension).
2. Parser + storage for `docs/PLAN_CEILINGS_CONTRACT.md` fields, and the shared synthetic fixtures the phone session can test against (committed under fixtures/, no personal data). Tell the phone side the exact field names.
3. Replay validation of the replanner on an anonymous/synthetic copy of the Junction Function and Diablo shape (do NOT commit real GPS/ride data): no target above ceiling, 20 W step limit, deficit redistribution, ahead = no early spend, unreachable goal shows best finish.
4. Then a flag-on diagnostic build for ONE supervised on-bike test, presented to Jason for an exact install approval. Do not enable the flags in any public release without Jason's approval.
Sequence: this first, then plan-free Bluetooth + PR timing, then the "On Karoo" inventory design note. Report back in handoffs/LATEST.md.

# Coordinator: PHONE TASK queued, FIT file in the iOS share sheet (2026-10-26, Jason approved, AFTER build 8)

Jason wants GritMap to appear in the iOS share sheet / "Open in..." when he shares a .fit file. Today only the Import screen file picker (expo-document-picker) works; app.json declares no document types.
Do it as option 1: declare a .fit document type (CFBundleDocumentTypes + an imported UTI, via app.json ios.infoPlist), handle the incoming file URL (Linking initial/event URL) and route it into the existing FIT import
path, with a test. No Share Extension target. Needs a native build, so it cannot be an OTA update. NOT in build 8; branch from main after build 8 ships. Check that it fits docs/GOALS.md priorities and the redesign Import screen.

# Coordinator: DESIGN NOTE request for Codex (2026-10-24, Jason approved): Karoo inventory for an "On Karoo" mark

Jason wants the phone to show **"On Karoo"** next to a segment (and, if cheap, the plan version the Karoo holds and whether it is older than the phone's). Today the phone only knows what it SENT
(`plan_sends` and Bluetooth receipts), not what the Karoo HAS. Write a short DESIGN NOTE only, no implementation: a read-only inventory the phone can request over the existing Bluetooth link
(or another safe route): per segment fingerprint, whether present, plan fingerprint/version/FTP, installed time. Cover size (hundreds of segments), privacy (nothing new off-device; no encryption in
BLE v2, so keep it to fingerprints and versions, no names/GPS if possible), the Bluetooth roles (the phone is the peripheral today; the Karoo the central: who requests?), deletion on the Karoo,
and fixtures for both sides. This is lower priority than the Bluetooth hardening and the PR/plan-free work; say where you would sequence it. Do not change the BLE contract yet.

# Coordinator: NEEDLE moved to the backlog (2026-10-24, Jason decided)

Jason heard Needle may not work well on the Karoo and could drain the battery. **Stop all Needle work** (no artifact selection, no benchmark, no advisory integration). Keep the existing code
and `docs/NEEDLE_READINESS.md` as they are; the deterministic live replanner does not depend on it. docs/GOALS.md updated. In-app AI is now being considered for the PHONE app instead
(priority 9, later phase, needs a design note first): do not start anything on the Karoo for it.

# Coordinator: RELEASE DECISIONS for Codex (2026-10-24, Jason approved)

1. **Scope: option 1.** Ship the Bluetooth beta with the current plan requirement as a documented known gap. Segment-only send stays in the phone's Wi-Fi fallback. Plan-free
   Bluetooth sending and PR timing ship TOGETHER later (docs/GOALS.md priority 7, updated). Do not implement them now. State the gap plainly in the release notes and install guide.
2. **You may now PRESENT the release evidence to Jason** for a separate tag/publish approval: exact source (46eb5be or newer committed), version/versionCode (0.10.45-bluetooth-beta / 73),
   APK sha256, signature, flags (injection 0, concurrent/replanning/ceilings off), actual QA and the physical evidence (new-segment import, skip, controlled-link resume), and the unresolved
   items (full-radio restart failure, H10 coexistence waived, export unfinished). Do NOT tag or publish until Jason approves that exact step. Never publish the diagnostic APK.
3. Merge or push your branch so origin has your commits (own worktree, explicit paths, no force-push; rebase on origin/main which has the phone's build 8 and my docs). After any approved
   release, verify the stable Companion install URL and update docs/BETA_KAROO_INSTALL.md and docs/KAROO_BETA_RELEASE.md. The phone session needs the final Karoo labels and the version number
   for build 8's 'testers need Karoo version X' text: tell Jason both.

# Coordinator: PRIORITY for Codex (2026-10-23, Jason approved): public Karoo release with the Bluetooth reader, before the replanner

Jason is moving Bluetooth to beta riders in the next phone build (docs/GOALS.md priority 1, commit ee69df6); the IP route becomes a fallback only. The phone build
cannot go out until a PUBLIC Karoo release carries the BLE reader. Please, in this order:
1. Prepare a release candidate from committed code: BLE v2 reader and fixes (67bfc60), all experimental flags OFF (concurrent segments, replanning, ceilings), versionCode
   >= 71, versionName that makes clear it is the Bluetooth beta, beta-signed APK, release workflow as for karoo-beta-0.10.44. Run full QA (default build) and record it.
2. Run the open physical tests with Jason and record them in a handoff: H10 coexistence during a receive session, and a deliberate disconnect/resume transfer
   (see docs/BLE_DIRECT_TRANSFER_REVIEW.md R3/R5). Say which must pass before wide invites.
3. Update docs/BETA_KAROO_INSTALL.md and docs/KAROO_BETA_RELEASE.md for Bluetooth (what to open on the Karoo, permissions, in-place upgrade keeps data, IP fallback).
4. Do NOT tag, publish or install on the physical Karoo until Jason approves that exact step; ask him with the version, APK sha256 and the QA evidence.
5. Do NOT push on the phone session's checkout/branch: use your own worktree for anything you push. Replanner rollout and Needle wait behind this.
6. **Karoo button labels are now copied into the phone app's onboarding and Send screens** (build 8, `onboardingCopy.ts`): GritMap > **Inbox** > **Receive from Phone** (Bluetooth) and **Legacy Wi-Fi Receive** (Wi-Fi fallback). Keep these three labels exactly, or tell the phone session (via Jason) the new ones BEFORE the public release. Also confirm the Karoo screen text matches: 'WAITING FOR PHONE', 'Cancel Receiving', 'Bluetooth closes automatically after 2 minutes'.

# Current task status: replanner development milestone verified (2026-10-22 16:44 PDT)

**Completed:**
- `c9da364`: concurrent foundation/runtime (default off) plus installed Coach/Profile/cardiac display work committed and pushed; verification handoff `c26e024`.
- `1650b79`: deterministic live replanner, optional ceiling import/storage, data-preserving Room migration, synthetic replay and phone/Karoo shared-fixture checks implemented. Default and opt-in full QA pass **249 tests each, lint and build**; phone fixture3/3 and typecheck pass. Both experimental flags are off for default debug/beta.
- Needle readiness/ABI/effort assessment written; **Needle is not activated**.

**Remaining:**
- Receiver capability/rollout gating and physical/real-ride validation before enabling ceiling metadata/replanning. Installed Karoo is still **version70 / 0.10.44-fields1** and rejects the new extension. Phone production sender unchanged. Next device/public code >=71.
- Calibrated per-section timing/best-finish prediction and ride-level energy accounting; current response/schedule are explicit estimates, private Diablo PR replay not performed.
- PR `segmentRecord` contract/import/storage/display; concurrent tracking remains disabled.
- H10 recordings list/export, separate October18 RR-artifact confirmation, and ride validation of cardiac/H10/field changes.
- Needle artifact/runtime/advisory implementation and device validation, after the deterministic path; see `docs/NEEDLE_READINESS.md`.

No new device install, public release or model download. Feature source committed; handoff commit/push follows. Details, exact verification and safest next action: `handoffs/archive/2026-10-22-1644-codex-live-replanner-verified.md`. Older entries below are historical; this status supersedes their pending/installation statements.

# Handoff: concurrent/field milestone committed (2026-10-22 16:24 PDT)

`c9da364` commits concurrent attempts (default off) and completed installed field updates. Default and opt-in full tests/lint/debug builds passed (226 tests each). H10 export remains pending. No new device install or release. Push follows; default-off replanner implementation is starting. Details: `handoffs/archive/2026-10-22-1624-codex-concurrent-fields-committed.md`.

# Coordinator: PHONE SESSION tasks (2026-10-22, Jason approved; replaces the 2026-10-09 phone task below)

Apple approved build 7 for external TestFlight. Beta riders arrive now. In order:
1. **Push** the 13 local commits (Jason approved 2026-10-21): fetch, rebase/merge onto origin/main, never force-push, check the diff for personal data (no ride files,
   no FTP/weight/goal values, nothing from `fixtures/`), run typecheck and tests, report the pushed head.
2. **Fresh-install walkthrough of the beta loop** as a stranger would (empty database, no FTP): onboarding, get a segment, set a goal, plan, send to the Karoo over the
   IP route with the in-app instructions, import a FIT, see plan vs actual. Report confusing or broken steps, ranked by how likely a stranger is to get stuck. Report
   first; no code changes until the report is reviewed.
3. **Open Segments usable by strangers** (GOALS priority 3): short plan first, from `docs/OPEN_SEGMENTS_VERCEL.md` (a proposal; any hosting needs Jason's approval).
4. **Build 8 contents, plan only**: realistic plans, staged goal, past weights, and whether Bluetooth can be shown. Bluetooth needs a public Karoo release first (the
   BLE fix is not in `karoo-beta-0.10.44`). No build or upload until Jason says go.
Blocked on Codex (do not build): sending ceilings and `segmentRecord` to the Karoo (needs the Karoo parser to accept the optional fields first, plus shared fixtures).

# Handoff: Coach/Profile update installed (2026-10-22 16:18 PDT)

Karoo USB install succeeded: **0.10.44-fields1 / versionCode70**, preserving app data. Includes the horizontal work fill, 1.5× active Coach and brighter Profile/title/timing/elevation changes below. Signed beta build, APK signature/package verification and postinstall device version check passed. BLE enabled; concurrent tracking stays disabled. Source remains uncommitted; no public release. Next versionCode >=71. Details: `handoffs/archive/2026-10-22-1618-codex-fields1-installed.md`.

# Handoff: horizontal Coach work and Profile visibility (2026-10-21 22:30 PDT)

Active Coach is now **1.5× original size**, with left-to-right actual-work fill and a vertical white planned-work line. Large Profile restores the title and HOLD/action timing banner, adds stable left elevation labels, replaces YOU with a small white dot, and brightens terrain. Full QA: **226 tests, lint and debug build passed**; final focused renderer/layout tests, lint and build also passed after the last refinements. Previews visually checked. **Uncommitted; not installed.** Details: `handoffs/archive/2026-10-21-2230-codex-coach-horizontal-profile-visibility.md`. Earlier concurrent/coordinator work remains below.

# Handoff: Coach work fill, larger Profile and cardiac/H10 display (2026-10-20 23:31 PDT)

Jason confirmed accumulated work vs planned work. Coach now has full-block actual-joule fill, a horizontal target-work line, and a doubled active row/content. Profile removes the middle PACE card and enlarges TARGET/ACTUAL and other numbers. Cardiac drift qualifies steady/comparable windows, resets interruptions and smooths by elapsed time; H10 status appears sooner with RR qualification retained. **224 tests, lint and debug build pass; final Profile renderer tests/build pass. Not installed: ADB saw no device.** Full-scale work budget uses an explicitly estimated distance-proportional plan time. Changes and prior concurrent work are uncommitted. Details: `handoffs/archive/2026-10-20-2331-codex-work-coach-profile-cardiac-fields.md`; semantics: `docs/KAROO_FIELD_WORK_FILL.md`.

# Coordinator: ORDER for Codex on the replanning task (2026-10-20, Jason approved): deterministic replanner FIRST, Needle later

**Build the deterministic live replanner first (Step 4), on its own, shippable without Needle.** Needle has never run on the Karoo: `MODEL_PROVENANCE.md` still
says PIN BEFORE DISTRIBUTION (no model bundle, no digest, no licence check) and the Cactus runtime library is not shipped, so `NeedleAgentManager` refuses to
initialise and the fallback is what every build uses today. Therefore:
1. Replanner first: quarter-mile boundary replanning from actual vs planned time, deadband, behind: spread the deficit weighted to easier grades within ceilings,
   ahead: do not spend the surplus early, unreachable goal: show the best achievable finish. Inputs: per-zone ceilings once the phone contract lands
   (`docs/PLAN_CEILINGS_CONTRACT.md`, phone side already built, not yet sent; your parser must accept the optional fields first); until then derive no ceilings and
   only replan within the plan's own targets and the adjacent-step limit. Default-off flag like the concurrent work. Unit tests + a replay of a fake ride.
2. Needle second, as an optional advisory layer behind the same fallback: do not start until the replanner works. Meanwhile write a short note listing exactly what
   Needle needs before it can run for a rider (which Needle 2 bundle, digest, licences, packaging/install path, runtime library, size, latency on the Karoo 3)
   and your estimate, so Jason can decide whether to invest in it.
3. Nothing about Needle may block the replanner, the beta, or the BLE/multi-segment work.

# Coordinator: COMMIT REQUEST for Codex (2026-10-20, Jason approved)

Please commit the multi-segment foundation and concurrent runtime now, **default-off** (`CONCURRENT_SEGMENTS_ENABLED=false` for debug and beta, opt-in via
`-PgritmapConcurrentSegments=true`). Use explicit `git add` paths, include the design/proposal docs and archives, and keep the separate H10 export work out
of this commit. Re-run the default and opt-in QA before committing and record the results. No tag, release, version bump or Karoo install. Push is allowed
once the handoff commit is made. Then start the realistic-targets/replanning task below (read the NEW TASK section above) with a short plan first.

# Coordinator: NEW TASK (2026-10-20, Jason approved, GOALS priority 8): realistic quarter-mile targets and live replanning, Needle included

Problem: on long segments (Diablo Northgate to Junction, ~6.5 mi) the plan puts an unsustainable target on one very steep quarter-mile; the rider falls short
and every later target still assumes the original plan, so the rider stays behind. Full spec from Jason: Steps 1 to 5 (summarised below). **Before coding,
each session posts a short plan and flags conflicts with the existing architecture.**
- **Phone session (plan side, Steps 1 to 3):** (1) Reproduce first from the stored ride history for the segment: per quarter-mile print grade, planned watts,
  and actual watts on each past ride (including the 41:40 PR); confirm which quarter-miles are targeted above anything ever held. Print locally only; **do not
  commit ride data** (public repo). (2) Per-quarter-mile personal ceiling from completed rides (best power held there, +3 to 5%), fallback to a configurable
  sliding %FTP (about 105% early on a short pitch trending to about 95%), plus an energy-budget (W' style) check that rejects overspending plans. (3) Redistribute capped
  effort to following easier quarter-miles within ceilings; limit adjacent-step change (about 15 to 20 W, configurable); if the goal is infeasible return the
  best achievable time and the gap, never inflate targets. Then **write a contract note**: the plan carries the per-quarter-mile ceilings (and constants) so the Karoo
  can replan. Shared fixtures with Codex. The phone remains the only place plans are created.
- **Codex (live side, Steps 4 and 5), after the multi-segment foundation:** at each quarter-mile boundary compare cumulative actual vs planned time and recompute
  the remaining targets from what the rider did, with a deadband; behind: spread the deficit weighted to easier grades within ceilings; ahead: do not spend the surplus
  early; goal unreachable: show the best achievable finish. **Needle** (already integrated: `NeedleAgentManager`, `NeedleLivePacingGuidanceEngine`, `AiPlanValidator`,
  `processTelemetry`, 5 s timeout with fallback) assists only: estimate sustainable power and fade from the live stream and suggest the adjustment size and a short cue,
  clamped to the ceilings and smoothing limits; unavailable, slow or invalid means silent fallback to the deterministic replanner. Note that the README says Needle
  initialisation is disabled until a model bundle and digest are recorded: say what is missing and whether the Karoo can run it today. If Needle cannot do this
  role, tell Jason what it can do and propose the closest fit before building. The deterministic engine stays the authority.
- Acceptance: no target above its ceiling on Diablo; replaying the PR ride through the replanner adapts targets after the mid-segment pitch; a 20 W shortfall on
  the hard pitch redistributes without breaking ceilings or the step limit; short segments and thin history use the fallback; unit tests for ceiling, redistribution,
  replanning; existing behaviour unchanged. Order: phone Step 1 first (confirms the diagnosis), contract note second, Karoo replanner third.

# Handoff: concurrent live service integrated, default OFF (2026-10-20 15:32 PDT)

`gritmapConcurrentSegments=true` now opts into independent sessions/persistence for up to four overlapping segments, plan-first headline/handover, fifth-segment diagnostics, shared H10 lifetime, secondary Performance line and unplanned elapsed/progress. Final QA: **213 tests, lint and dev build pass**; normal build passes and debug/beta defaults are false. Phone PR basis confirmed as sampled `endTimestampMs - startTimestampMs`, including pauses. **PR import/storage/display still pending; no wire or device changes.** W′ is disabled only in the opt-in path pending a ride-level engine. Code/docs remain uncommitted. Details and limitations: `handoffs/archive/2026-10-20-1532-codex-concurrent-runtime-integrated.md`.

# Coordinator: DECISIONS for multi-segment and PR (2026-10-20, Jason approved)

For Codex and the phone session, answering the open points in `docs/KAROO_MULTI_SEGMENT_DESIGN.md`:
1. **Time basis: use the phone's definition.** A PR on the Karoo means the same thing as the phone's personal record (its fastest accepted
   effort and its time basis). Codex: read the phone's effort/PR code in `src/` to match it exactly, and say in the contract which basis it is.
2. **Concurrent cap: 4.** The Karoo tracks up to 4 segments at once. A fifth is not tracked, and the Karoo **logs a diagnostic** when it
   ignores one (segment id and reason). It must not drop or reset an already-tracked segment to make room.
3. Still open, to settle between Codex and the phone session (no rider-facing impact yet): rider ownership of a record, record replacement,
   split anchors. Phone must not send `segmentRecord` until the Karoo parser accepts it and shared fixtures exist.

# Handoff: concurrent tracking foundation implemented (2026-10-20 14:34 PDT)

Pure `ConcurrentSegmentTracker` and headline selection now pass nine synthetic overlap/lifecycle tests; full Karoo QA passes **207 tests, lint and debug build**. Independent attempts survive another segment finishing or abandoning; plan-first/nearest-finish headline is deterministic. **Not wired to live service yet; device/beta behavior unchanged.** Code/docs uncommitted. Next: default-off service integration, ordered persistence and shared H10 lifecycle. Details: `handoffs/archive/2026-10-20-1434-codex-concurrent-tracker-foundation.md`.

# Handoff: multi-segment design and PR contract review ready (2026-10-20 13:42 PDT)

Drafted `docs/KAROO_MULTI_SEGMENT_DESIGN.md` after inspecting the runtime. Covers concurrent sessions, deterministic headline, PR/first-attempt display, per-attempt persistence and shared H10 ownership. Contract review identifies time-basis, rider ownership and split-cap details to agree before sender changes. **Design only, no source/wire/device changes.** Documents uncommitted; beta unchanged. Details: `handoffs/archive/2026-10-20-1342-codex-multi-segment-design-review.md`.

# Handoff: H10 export request committed (2026-10-20 09:04 PDT)

`273bd59` commits the H10 recordings list/export request; the feature is **not implemented**. BLE commits `67bfc60` and `1c2de1a` are retained, and newer remote multi-segment docs `3d30816` merged cleanly. Push authorized and follows this handoff commit; no tag/release. Details: `handoffs/archive/2026-10-20-0904-codex-h10-request-committed.md`.

# Handoff: BLE update committed (2026-10-20 09:00 PDT)

Commit `67bfc60` contains BLE callback/lifecycle fixes, regression tests and physical-test archives. Prior QA: 198 tests, lint and signed build pass; two new-segment transfers and installed-segment skip physically verified on `0.10.44-ble2`/69. No push/tag/release. H10 coexistence and deliberate reconnect/resume remain open; next public code >=70. Separate H10 export request remains uncommitted. Details: `handoffs/archive/2026-10-20-0900-codex-ble-update-committed.md`.

# Requested task: H10 recordings list and export (2026-10-19 22:46)

Jason requested a rider-facing list of saved H10 RR recordings with export for Claude/other analysis tools. **Not implemented.** First confirm whether the October 18 ride has a separate RR artifact: its FIT has regular Polar ANT+ BPM but no RR/HRV or DFA alpha-1 fields; private GritMap storage could not be inspected using run-as on the non-debuggable beta. Preserve original recordings and app data; do not commit personal ride data. Supports the H10 parallel track without blocking the beta loop. Details and requested scope: `handoffs/archive/2026-10-19-2246-codex-h10-recordings-export-request.md`.

# Handoff: installed-segment skip log-verified (2026-10-19 22:41)

Karoo reconnected. Repeat transfer at 22:33:57 used MTU 517, read only plan (1759 B) and rider (114 B), and completed `ble_imported existing=true durationMs=3840`; installed code delivers `ok_segment_existing` on this path. Both missing-segment and installed-segment paths now have successful physical log evidence. **Still open:** live H10 RR continuity and deliberate reconnect/resume. Implementation and handoffs remain uncommitted; next public code >=70. Details: `handoffs/archive/2026-10-19-2241-codex-installed-segment-skip-verified.md`.

# Handoff: repeat Bluetooth transfer confirmed (2026-10-19 22:34)

Jason confirmed a successful resend after the two new-segment tests. Karoo was unavailable to ADB, so `existing=true` / `ok_segment_existing` is not independently log-verified yet. **Still open:** live H10 RR continuity, deliberate reconnect/resume, and repeat-transfer log confirmation. No source changes this turn; previous implementation/handoffs remain uncommitted. Details: `handoffs/archive/2026-10-19-2234-codex-repeat-transfer-confirmed.md`.

# Handoff: two physical Bluetooth transfers passed (2026-10-19 22:23)

Jason confirmed two separate segments worked on `0.10.44-ble2`/69. Karoo logs confirm both imports/receipts succeeded with MTU 517: 4792 B segment in 5.331 s total; 10961 B segment in 8.689 s total. Both were missing-segment paths; no reconnect logged. **Still open:** resend an installed segment (`ok_segment_existing`), reconnect/resume validation, and live H10 RR continuity. Changes remain uncommitted; next public code >=70. Details: `handoffs/archive/2026-10-19-2223-codex-two-ble-transfers-passed.md`.

# Handoff: BLE callback fix installed; physical retest pending (2026-10-19 21:50)

**Bluetooth remains blocked on physical retest.** The callback-routing and connection-lifecycle fix is installed as `0.10.44-ble2`/69. Final QA: 198 tests, lint, signed/minified beta build pass; existing segment/plan and settings retained. No physical transfer run after this fix yet. Next public release requires code >=70. Implementation and handoffs are uncommitted. Details: `handoffs/archive/2026-10-19-2150-codex-ble-callback-fix.md`.

# Handoff: Bluetooth test build installed (2026-10-19)

`0.10.44-ble1`/68 is now installed in place on Jason’s Karoo 3. APK hash/signature match the coordinator handoff; the existing segment, pacing plan, settings, first-install timestamp, and data inode survived. App launch succeeds; Bluetooth Inbox is Ready. **Installation is complete; the three physical transfer/H10 tests below remain open.** Next public release must use versionCode >=69. Details: `handoffs/archive/2026-10-19-2128-codex-ble-test-installed.md`.

# Coordinator: BUG for Codex, first physical BLE test failed (2026-10-19 21:40)

**Bug (first in line, blocks the Bluetooth beta):** the first real phone→Karoo transfer on `0.10.44-ble1` ended with the Karoo error
`ble_transfer_failed error=IllegalStateException:Unexpected BLE read event` (logcat tag `GritMapLive`, 21:36:28.753, read-only `adb logcat`).
The message comes from `DirectBleGattClient.Connection.read()`: the awaited result was not a `GattEvent.Read` (most likely during the plan connection's `readManifest()`).

What the log shows (iPhone private address omitted):
- **The data path works.** A full segment was read over BLE: manifest 475 B, then 10 Request-write/Data-read pairs of 512 B ×9 + 184 B =
  4792 B, in about 2.3 s (21:36:26.05 to 28.33), with MTU 517 negotiated. Roughly 2 KB/s, so a 250 KB segment would take about 2 minutes.
- **Then the plan phase failed, most likely during that connection's manifest read.** From 28.355 to 28.506 the log has 4 `onConfigureMTU`
  callbacks and 3 `configureMTU` requests within 150 ms (several connections or duplicate MTU callbacks), then service discovery completes
  at 28.522. The manifest read response (op 11, 475 B) arrives at 28.641, and a write response (op 19) at 28.729, then `ble_transfer_failed`
  at 28.753. Jason's iPhone showed **"Your Karoo couldn't use this transfer. Try again"**, which means the Karoo's `catch` block
  delivered a **`rejected` receipt (code `other`)** over the current connection: the 28.729 write is that receipt, and the exception
  was thrown just before it, i.e. the awaited manifest read was satisfied by a stray event before its real response arrived.
  So the receipt path is verified on hardware (phone parsed and displayed it). The error is also mislabeled `other`.
- **Connections leak.** At 21:36:39 three earlier GATT clients (cif 3, 4, 5) were still connected and were dropped by the phone with reason
  0x13. `close()` calls `gatt.disconnect()` then `gatt.close()` immediately without waiting for `STATE_DISCONNECTED`, and
  `receive()` reconnects for every resource (manifest, segment, plan, rider), so stale links stay up.

Likely causes (please confirm with the logging below):
1. `Connection` has one shared `pending` deferred, and `complete()` accepts the **first event of any type**. A duplicate or late
   `onMtuChanged` (Android reports one for the local request and one for a remote-initiated exchange) or `onServicesDiscovered` then
   satisfies the wrong `await()` and kills the transfer.
2. Reconnecting for each resource multiplies those events and leaks links. The contract only requires reconnect-and-resume after a *drop*.

Fix direction (your code, your call):
- Make the GATT client robust: keep events typed or queued, **ignore** stale Mtu/Services/Connection(connected) events while awaiting a
  Read/Write, and treat only a disconnect or a non-success status as failure. Include the unexpected event's class and the operation in
  the error text; today it only says "read event".
- Use **one connection** for manifest + plan + rider + segment, with reconnect-and-resume only after a real drop. If the public-segment
  fetch (line 28 comment) needs to happen between reads, do it before the single connection, or keep the connection alive.
- On close: call `disconnect()`, wait for `STATE_DISCONNECTED` (with a short timeout), then `close()`.
- Add a unit test with a fake GATT that delivers a duplicate MTU callback during a read, and one that disconnects mid-chunk.

Re-test when fixed, in order: segment already on the Karoo; a missing segment; one with the H10 connected. Jason's iPhone has build 5.
The phone session's evidence of the phone side: `handoffs/archive/2026-10-12-1910-claude-ble-hardware-check.md`. If you build a new test
APK, use versionCode 69 or higher, never tag it, and install with `adb install -r`.

# Coordinator: READY for Codex (2026-10-20 09:30): multi-segment tracking and PR display. Unblocked, start with the design note

Jason decided (see `docs/GOALS.md` priority 7 and the proposal `docs/KAROO_MULTI_SEGMENT_AND_PR.md`, on `origin/main`): the Karoo must not
be limited to one segment at a time. **The BLE fix is committed and physically verified (Jason confirmed 2026-10-20), so this is unblocked. It is still post-beta: do not change the beta Karoo build for it, and do not touch the BLE contract without the phone session.**
- Track every segment you start, concurrently, each with its own recorded attempt; completing one must not reset the others.
- Headline rule: the active segment that has a plan, else the one that ends first; a small secondary line for the others.
- No plan on the headlined segment: show the rider's PR with live ahead/behind; no PR yet: progress and elapsed time only.
- The Karoo can compute a PR only from attempts recorded on the Karoo, so the phone will send a `segmentRecord` (best time plus splits).
  **Your parser must accept it before the phone sends it** (the current parser fails closed on unknown keys).
First step, please: a short design note (concurrency model, headline selector, rendering) and a review of the contract proposal. Evidence for
why: on the Diablo pair, riding from the Northgate gate tracks Diablo Northgate to Junction only, because `LiveSegmentCoordinator` runs
discovery only while it has no candidates (`discover` is inside `if (candidates.isEmpty())`) and `reset()` clears all candidates when one
finishes. The Full Diablo starts 950 m into Northgate to Junction, so it is never discovered.

# Coordinator: next task for Codex (2026-10-19 21:15)

Read `docs/GOALS.md` first. Status: iPhone build 7 is in external TestFlight review (submitted 2026-10-19). Public Karoo
release is `karoo-beta-0.10.44` (Karoo 3 only). Your v2 BLE reader (`99d1878`, with its handoff `abdbfb9`) passed coordinator QA:
196/196 JVM tests, lint and build, and it matches `docs/BLE_DIRECT_TRANSFER_CONTRACT.md`.

**Task 1: install the BLE test build on Jason's Karoo, then run the physical test with him.**
- The coordinator has already built it from committed `abdbfb9`, with no source changes:
  `./gradlew :app:assembleBeta -PgritmapBetaSigningProperties=<beta-signing.properties> -PgritmapVersionCode=68
  -PgritmapVersionName=0.10.44-ble1 -PgritmapDirectBleV2=true` (JDK 17).
  APK: `~/Downloads/gritmap-karoo-0.10.44-ble1.apk`. SHA-256 `1a166ae026ee42743215eccb18818d9b1fe73d43fc16306645f1bbc038f29b92`,
  signer SHA-256 `eac4c309…f5f6` (the beta key, same as 0.10.44). Rebuilding with the same flags is fine; record the hash if it differs.
- Install **in place**: `adb install -r` (or Companion). Never uninstall or clear data. Confirm `0.10.44-ble1`/68 via dumpsys,
  and confirm the GritMap library and settings survived.
- Do **not** tag or publish this as a release. It is a dev-flagged test build only.
- Physical test with Jason (iPhone has internal TestFlight build 5, `production-ble-internal`):
  1. a plan for a segment already on the Karoo (expect receipt `ok_segment_existing`);
  2. a plan for a segment the Karoo doesn't have (segment over BLE, then `ok`);
  3. one transfer during a live H10 connection: check RR continuity.
  For each, record the negotiated MTU, the duration, the receipt shown on the phone, and any reconnects. Note anything that doesn't
  match the contract. The phone session's hardware check is `handoffs/archive/2026-10-12-1910-claude-ble-hardware-check.md`.

**Version code rule:** this test build uses code 68, so **the next public Karoo release must use versionCode 69 or higher**, or it
won't install over the test build on Jason's Karoo.

**Still open from before:** confirm the rider-facing Karoo strings say "section(s)" for pacing-plan stretches.

Done when: the test build is installed and verified on the device, the three physical results are written up in a handoff with the
Goal alignment section, and any bug is listed first with a repro.

# Handoff: Karoo direct-BLE v2 reader implemented and dev-gated

Commit `3d503c3` adds the Karoo central for the reviewed direct-Bluetooth v2 contract: strict
manifest/caps, MTU 517, exact Request/Data chunks, SHA-256-before-parse, installed-segment skip,
optional public fetch, three reconnect/resume attempts, optional rider history, unchanged atomic
`gritmap-transfer` import, and receipt retry semantics. It is enabled in debug builds and hidden in
release/beta unless `-PgritmapDirectBleV2=true`; Legacy Wi-Fi and public `0.10.44` are unchanged.
Full Karoo QA passes (196/196 JVM tests, lint, debug/native build), and a debug-signed dev APK is
ready. Physical iPhone/Karoo transfer and H10 coexistence are still required; no APK was installed or
released. Details: `handoffs/archive/2026-10-12-1935-codex-karoo-direct-ble-v2.md`.

# Handoff: Karoo 0.10.44 published and independently verified

`main` was rebased cleanly onto current GitHub history and pushed. The first `0.10.44` tag run
correctly failed because Gradle still defaulted to `0.10.43`/66; commit `ca6ea4f` fixes the defaults
to `0.10.44`/67. The failed unpublished tag was replaced with an annotated tag pointing to
`ca6ea4f`. Corrected workflow `38308093435` passed tests, lint, signed/minified build, asset
verification, upload, and release publication. The public APK is
`https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk`, SHA-256
`6b07e5151581c4d1996ef579f12812a6c32ee0409369c8b1f5c899283e5e1af5`. Details:
`handoffs/archive/2026-10-12-1409-codex-karoo-01044-published.md`.

# Handoff: installed Karoo 0.10.44 source committed and tagged

Commit `20f9ed7` captures the Karoo source installed as `0.10.44-beta`/67 after rebasing onto current
`origin/main`: the approved large-field
typography, stable Pacing Profile title, launcher icon, and bounded v1 BLE capsule receiver. Annotated
tag `karoo-beta-0.10.44` points directly to that commit. Lint and a versioned debug APK build pass.
The JVM suite is 188/189 on this Mac because the pre-existing
`NeedleAgentManagerTest.timeoutReturnsFallbackWithoutConcurrentInference` wall-clock assertion
requires `<70 ms` and fails even in isolation; functional fallback still succeeds. No direct-BLE v2
Karoo work was started. Details:
`handoffs/archive/2026-10-12-1259-codex-karoo-01044-committed-tagged.md`.

# Decision: direct BLE approved in principle; freeze Karoo protocol work until contract review

Jason approved the recommendation on 2026-10-12 to use Claude's direct-Bluetooth v2 design instead
of building the hosted capsule service now. The private plan always travels over BLE. The public
segment is skipped when its fingerprint is already installed, otherwise fetched from Open Segments
when available or transferred over BLE as the offline fallback. The existing bounded, user-triggered
two-minute receive window, strict `gritmap-transfer` validation, atomic import, receipt, and Legacy
Wi-Fi fallback remain required.

Do **not** rewrite the Karoo receiver from the v1 capsule protocol until
`docs/BLE_DIRECT_TRANSFER_CONTRACT.md` has been reviewed against the actual phone implementation and
both sides agree on the wire behavior. Preserve the v1 capsule code but do not ship it enabled. The
review must explicitly settle ATT/MTU chunk behavior, connected-session timeout versus scan timeout,
retry/resume rules, receipt/rejection behavior, optional rider data, link-encryption choice, size
limits, exact-byte hashing, iOS foreground behavior, and H10 coexistence. Large BLE segment transfer
is a fallback; installed-fingerprint and public-URL paths are preferred. Details:
`handoffs/archive/2026-10-12-1222-codex-direct-ble-decision.md`.

# Handoff: large-field visual pass installed as Karoo 0.10.44-beta

The approved large-field density/type pass, stable `GM PACING PROFILE` title, launcher icon, and
bounded Bluetooth receiver are installed in place on the connected Karoo as `0.10.44-beta`/67.
The signed/minified beta build passed, `adb install -r` succeeded, the original install timestamp
was preserved, MainActivity displayed in 839 ms, Hammerhead reconnected the extension, and recent
logcat contained no GritMap fatal exception. The public release remains 0.10.43 and all current
milestones are still uncommitted. Details:
`handoffs/archive/2026-10-10-2130-codex-karoo-01044-installed.md`.

# Handoff: Karoo large visual fields share the Pacing Profile hierarchy

Using Jason's five supplied device screenshots, Cardiac Drift, Power Balance, Segment Performance,
and Pacing Coach now match Pacing Profile's header scale and information hierarchy. Pacing Profile
itself changed only its top-left title to `GM PACING PROFILE`. Exact typography changes are audited
in `docs/KAROO_LARGE_FIELD_TYPOGRAPHY_AUDIT.md`. Regenerated 480 px previews were inspected with no
clipping; full Karoo QA passes (189/189 JVM tests, lint, debug build). Nothing was installed or
committed, and the public beta is unchanged. Details:
`handoffs/archive/2026-10-09-1654-codex-large-field-density.md`.

# Handoff: Karoo BLE transfer is user-triggered and bounded

The Karoo-side no-IP transfer path now uses an explicit Inbox action rather than an always-on
extension scan: **Receive from Phone** opens a filtered, low-latency BLE receiver for at most two
minutes, stops scanning before GATT, and releases Karoo Bluetooth on every exit path. The existing
address-based receiver remains as **Legacy Wi-Fi Receive**. Full Karoo QA passes (189/189 JVM tests,
lint, debug build). This supersedes the continuous-scan architecture in the preceding BLE handoff.
It remains uncommitted and cannot work end to end until the phone advertiser and HTTPS capsule
service are implemented. Details:
`handoffs/archive/2026-10-09-1642-codex-bounded-ble-receive.md`.

# Handoff: Karoo BLE transfer-capsule receiver is implemented

The no-IP Karoo receiver is implemented and verified in isolation: a low-power filtered BLE scan
reads a 36-byte, 128-bit capability token; Karoo then fetches a strict short-lived HTTPS capsule,
downloads the public segment and private plan separately, verifies both SHA-256 hashes, and imports
them through the existing atomic `gritmap-transfer` path. The exact UUIDs, schemas, size limits and
phone/server obligations are in `docs/BLE_TRANSFER_CAPSULE_CONTRACT.md`. Full Karoo QA passes
(189/189 JVM tests, lint, debug build). It is not installed or end-to-end usable yet because the
iPhone advertiser and capsule service do not exist, and physical H10 coexistence remains mandatory
before release. Details: `handoffs/archive/2026-10-09-1630-codex-ble-transfer-capsule-karoo.md`.

# Handoff: approved GritMap icon installed on the Karoo

The Karoo launcher now uses Jason's approved dark bike-and-arrow GritMap icon while notifications
and data-field selectors retain the purpose-built monochrome extension glyph. Debug build and lint
pass; a signed/minified beta build also passes and was installed in place on the connected Karoo
without clearing app data. The work is uncommitted and is not yet in the public 0.10.43 asset.
Next: visually confirm it in the Karoo app grid, then commit and publish it in the next beta tag.
Details: `handoffs/archive/2026-10-09-1435-codex-karoo-app-icon.md`.

# Handoff: first public Karoo beta release published and independently verified

The first public Karoo beta release is live: `https://github.com/frason/GritMap/releases/tag/karoo-beta-0.10.43`. The initial run failed because the Android setup action requested Google's removed `tools` package; commit `8959916` fixes it and corrected run `37979085132` passed setup, tests, lint, signed/minified build, signature/version verification, artifact upload, and release publication. The public APK was downloaded again and independently verified: `com.gritmap.karoo`, code 66, `0.10.43-beta`, GritMap Beta certificate SHA-256 `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`, asset SHA-256 `1f0d298f218d445b03596bb429a02f15e86c266058303b208ecda2f684ba9254`. Stable link: `https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk`. Next: physically install that public asset through Hammerhead Companion and verify data retention/previews. Details: `handoffs/archive/2026-10-09-1224-codex-public-karoo-release.md`.

# Handoff: public Karoo beta distribution and tester README prepared

Commit `2dad59a` adds the root public-beta README, Hammerhead Companion/ADB instructions, a safe iPhone TestFlight request path, five replaceable Karoo field screenshot placeholders, and a tag-driven signed APK release workflow. The workflow runs Karoo tests/lint, builds and verifies the signed APK, publishes `gritmap-karoo.apk` plus `SHA256SUMS.txt`, and marks the beta as GitHub's latest release so the stable `/releases/latest/download/gritmap-karoo.apk` link works. Nothing was pushed or released and no secrets were configured. Next: configure the four Actions signing secrets, push, tag `karoo-beta-0.10.43`, inspect the run, then test the public asset through Hammerhead Companion. Details: `handoffs/archive/2026-10-09-1133-codex-public-beta-distribution.md`.

# Handoff: adaptive cardiac guidance and signed 0.10.43 beta candidate

Karoo commit `d38057f` makes `GM Cardiac Drift` progressively useful for short, medium, and long efforts; adds qualified H10 alpha-1 context to long efforts; tightens RR qualification to approximately two clean minutes at 95% validity; and changes rider-facing pacing-plan wording from zones to **sections** without changing shared contracts. A signed `0.10.43-beta`/code 66 candidate passed 183/183 JVM tests, lint, minified beta build, signature/version verification, and is staged at `/Users/frason/Documents/CS Agent Team for ChatGPT/GritMap Beta Builds/gritmap-karoo-0.10.43-beta.apk` (SHA-256 `bfd21b83b5bbabdb95128329499b9f9ac6be9abea258af47969ab5f70f0005a2`). It is not installed; the physical Karoo remains on `0.10.42-beta`. Next: install in place, inspect previews, then perform the checklist in `docs/H10_RIDE_VALIDATION_CHECKLIST.md`. Details: `handoffs/archive/2026-10-08-2252-codex-adaptive-cardiac-01043.md`.

# Coordinator: current phone task (2026-10-09 00:50, sent to the GritMap MVP session)

For Codex's awareness. Do not edit these phone files.

Done and QA-passed since the last update: the map first-open guard (`9283e38`), real ride fixtures
untracked and their tests skipping when absent (`5bf44a4`), "sections" wording (`c60efc4`), and the
handoff (`1fb003d`). A fresh clone gives 606 pass, 24 skipped, 0 fail. **Codex:** the exact
rider-facing "section" strings to match on the Karoo are in
`handoffs/archive/2026-10-09-0050-claude-map-first-open-fixtures-sections.md`. Wire/JSON keys stay `zones`.

**Task:** write `docs/PRIVACY.md`, the privacy policy for the TestFlight Privacy Policy URL (an external
testing gate), with every claim checked against the code, plus the App Store Connect "App Privacy" answers.

# Handoff: profile history (migration 15), past weights, weight at each effort, plain "why" copy (2026-10-20 23:10 PDT, committed locally, not pushed)

New `athlete_profile_history` table (backfilled from the current profile; `setAthleteProfile` appends on change); the Profile screen has "Past weights (optional)" (date + weight; never changes the current profile); each past effort is now calibrated at the weight the rider had that day when known (latest row at or before it, earliest row for older efforts). The goal-card notices say plainly that GritMap plans no more power than the rider has held on the climb and that it grows as new bests are set. Ceiling margin and CP/W' unchanged. 746/746 tests, migration tested on a populated database, typecheck and web:smoke clean. Details: `handoffs/archive/2026-10-20-2310-claude-profile-history-past-weights.md`.

# Handoff: staged goal (next + long-term) and goal-time-derived plan power (2026-10-20 22:55 PDT, committed locally, not pushed)

The goal editor now offers "Beat my best of X (Y)" and an optional long-term goal (migration 14, one nullable column); plans, sends and notices use the NEXT goal, the long-term goal only drives a progress line and a one-tap "Set my next goal to ..." note when the next goal is reached; a fresh install sees the single goal as before. The plan's average power is now solved from the goal time with the physics model calibrated on the rider's efforts (power-duration table kept as fallback). The FTP-confirmed flag is gone: an existing profile FTP is always used. Per-effort weight plumbing is in; weight history storage needs a migration (proposed). 730/730 tests, typecheck and web:smoke clean; simulator check on demo data. Details: `handoffs/archive/2026-10-20-2255-claude-staged-goal-physics-anchor.md`.

# Handoff: realistic plan follow-up: evidenced floors, history critical power, PR-relative notice (2026-10-20 22:25 PDT, committed locally, not pushed)

A plan that would be slower than an effort the rider already rode (for a goal at least as ambitious) now never targets below that effort's held power (whole profile by default; late-only gave a plan slower than the rider's best); past 20 to 90 minute efforts can raise the critical power used by the energy-budget guard; redistribution is forward-only (fixed a flaw that pushed late effort into early zones); the out-of-reach notice waits for a rider-saved FTP, is decided by the predicted finish and is worded against the rider's best. With the rider's real values (local only) the realistic plan is predicted slightly faster than the rider's best and W' does not bind. 707/707 tests. Pending: floors scope, staged-goal build, physics-derived anchor. Details: `handoffs/archive/2026-10-20-2225-claude-realistic-plan-floors-history-cp.md`.

# Handoff: realistic quarter-mile targets, phone side done (Steps 1 to 3; committed locally, not pushed) (2026-10-20 19:45 PDT)

Generated plans now respect per-quarter-mile ceilings (best power held +4%, else a fallback), an energy-budget (W') guard, a 20 W climbing-step limit and an 80 W hard cap, with trimmed effort moved to later easier sections; the segment screen says when a goal looks out of reach ("best plan finishes about X, Y slower"). One generator feeds the segment screen, the Wi-Fi send and the Bluetooth send; imported plans are never rewritten; **nothing about ceilings is on the wire** (draft `docs/PLAN_CEILINGS_CONTRACT.md` + synthetic fixture for Codex). Step 1 on the only two real Diablo attempts available (45:19, 45:45): 10 of 26 quarter-miles planned above anything held (worst +21 W at qm19); calibrated, even the raw plan predicts 45:06 vs a 40:00 goal. FTP 250/goal 40:00 are assumed; the rider's best ride was not in `fixtures/fit` then. 691/691 tests, typecheck clean. Details: `handoffs/archive/2026-10-20-1945-claude-realistic-plan-steps-1-3.md`.

# Handoff: build every GritMap screen as editable Figma frames (task for a fresh session) (2026-10-20 14:40 PDT)

Jason wants to redesign the app and cut unnecessary screens, with every screen placed in Figma (file `cyaMDDfLBKFc4NNK1SUUnb`, GritMap-Screens). The previous session had no Figma tools because Figma was authorized after it started, so nothing is built yet. A new session in this project should read `docs/GOALS.md`, load the `figma-use` skill, and build the 17 routed screens plus onboarding and the duplicate modal as editable frames with tokens from `src/theme`, using simulator screenshots for maps. No phone-app or Karoo change. Details and the full screen/file table: `handoffs/archive/2026-10-20-1440-claude-figma-screens-handoff.md`.

# Handoff: BLE direct transfer verified on a real iPhone (phone side); Karoo side still open (committed locally, not pushed)

On Jason's iPhone 15 Pro Max (TestFlight build 5, `production-ble-internal`) a macOS central read the manifest, walked the plan (1360 B), segment (4792 B) and rider (114 B) chunks with every SHA-256 verified, wrote an `imported` receipt, and the phone showed "Imported on your Karoo". Also passed by hand with LightBlue: foreground-only advertising (gone ~10 s after backgrounding), no local name, GATT layout, manifest (475 B, v2), a wrong-id receipt refused, and advertising continuing after a manifest read. **Not run on hardware:** second central refused (needs a different device), reconnect-and-resume, MTU and chunk timings. No contract mismatch found; no code changed. The 30 s idle limit is painful for manual GUI testing (fine for a Karoo). Next: Codex implements the Karoo central. Details: `handoffs/archive/2026-10-12-1910-claude-ble-hardware-check.md`.

# Handoff: BLE review fixes P1 to P4 done on the phone (committed locally, not pushed)

`0c02937` fixes the four phone issues from `docs/BLE_DIRECT_TRANSFER_REVIEW.md` with no wire change: a chunk counts as served only when its last byte was delivered (small-MTU safe, so "Sent; check your Karoo" can't appear early); advertising continues for the whole session with owner lock so the Karoo can reconnect and resume; the receipt gets a 60 s window once the plan is served; reads past the end answer `invalidOffset`, and `startTransfer` checks the manifest's byte counts and SHA-256 against the bytes. 66 Swift session checks pass, Release simulator build succeeds, typecheck/web:smoke clean, 649 tests (the batchImport timing test flaked under machine load, passes alone). **Still not run on a physical iPhone**; that needs Jason's go-ahead. PRIVACY.md Bluetooth sentence is for when the dev flag is lifted. Details: `handoffs/archive/2026-10-12-1300-claude-ble-review-fixes-p1-p4.md`.

# Handoff: direct Bluetooth send, phone side (dev-flagged), and v2 contract draft (committed locally, not pushed)

The iPhone can now hand a plan, and the segment only when the Karoo lacks it, straight to the Karoo over Bluetooth with no server (`89938ea`, contract draft `2d64df9`: `docs/BLE_DIRECT_TRANSFER_CONTRACT.md`). Local Expo module `modules/gritmap-ble-peripheral` (CoreBluetooth) serves a manifest, chunked plan/segment reads and a receipt; "Imported on your Karoo" appears only after an `imported` receipt. Hidden unless a dev build, `EXPO_PUBLIC_GRITMAP_BLE_TRANSFER=1` or `dev_ble_transfer`=1; the Wi-Fi/IP send is unchanged. typecheck, 649/649 tests, web:smoke clean; Swift session tests pass; Release simulator build succeeds (simulators have no Bluetooth radio). **Not yet run on a physical iPhone** (no nRF Connect check recorded) and no Karoo implements v2. Codex's to-do/confirm list and Jason's steps: `handoffs/archive/2026-10-12-1210-claude-direct-ble-phone-side.md`.

# Handoff: expo-font declared; icons verified in a Release build (committed locally, not pushed)

`expo-font ~57.0.4` is now a declared dependency (peer of `@expo/vector-icons`) with `ios/Podfile.lock` updated; `expo install` also added `expo-font` to app.json's `plugins` (no EAS fields). Unsigned Release simulator build on a fresh install shows the tab-bar and list icons; `expo-doctor` is down to the two expected warnings (non-CNG sync, patch-version mismatches, not bumped). typecheck, 633/633 tests, web:smoke clean. The app icon is still the Expo placeholder. Details: `handoffs/archive/2026-10-09-0830-claude-expo-font.md`.

# Handoff: "Remove saved token" and the unused demo map deleted (committed locally, not pushed)

Share to Open Segments' maintainer section now has a confirmable **Remove saved token** (clears the Keychain item, returns to the no-token state; unit-tested); the unused `MapScreen.tsx` (the only user of `demotiles.maplibre.org`) is deleted, so the app contacts only GitHub, OpenFreeMap and the local Karoo. `docs/PRIVACY.md` updated in the same commit. typecheck, 633/633 tests, web:smoke clean; screenshots in `docs/screenshots/token-removal/`. Details: `handoffs/archive/2026-10-09-0210-claude-token-removal-dead-map.md`.

# Handoff: privacy policy (docs/PRIVACY.md) and App Privacy answers (committed locally, not pushed)

Docs only. `docs/PRIVACY.md` is a plain-language, host-agnostic policy checked claim by claim against the phone code and (read-only) the Karoo extension; `docs/BETA_TESTFLIGHT.md` step 9 has the App Store Connect answers (**Data Not Collected, no tracking**). Jason must fill two TODOs
(last-updated date, contact email) and publish it at a public URL. Gaps noted: no in-app way to delete the maintainer GitHub token; the Karoo receiver is unauthenticated (use a trusted network). Evidence table in `handoffs/archive/2026-10-09-0125-claude-privacy-policy.md`.

# Handoff: map first-open guard, real ride fixtures untracked, "sections" wording (committed locally, not pushed)

Phone-only. (1) Blank map on first open: **not reproduced at normal load** (0 of about 46 cold opens before; seen only with the Mac at load 50-90); defensive fix in the shared `RouteMapView` (create the native map after the first non-zero layout, refit when the style loads, rebuild a stalled map); after: 15/15 fresh-install first opens fine; screenshots in `docs/screenshots/map-first-open/`.
(2) The 6 real FITs and the GPX are untracked and git-ignored (still on disk); their 6 tests skip when absent (630/630 present; 606 + 24 skipped absent); history not rewritten. (3) "Sections" for plan stretches, "zones" only for training zones; exact strings for Codex in the archive entry; JSON key `zones` unchanged. Note: `9283e38`'s message omits the fixture removal (they were staged). Needs Jason's OK to push. Details: `handoffs/archive/2026-10-09-0050-claude-map-first-open-fixtures-sections.md`.

# Handoff: Attempt Review and Attempt Comparison on the design system; cross-tab Back-button fix (committed locally, not pushed)

Phone-only; Karoo and fixtures untouched. Compare Efforts names both efforts with a picker to swap either, says who was ahead and explains the time-gap chart ("Ahead or behind"); Review Effort renames the match diagnostics (Route followed,
Furthest off the route, Backtracking, GPS dropouts), explains why GritMap isn't sure, and Confirm/Remove state their consequences (remove confirms in-screen). Charts have spoken summaries; all text is `AppText`.
**Bug fixed (`c6808dd`):** opening a segment/effort/comparison from Home, Import, Ride detail or after saving a segment left it with no Back button; navigation now keeps the tab's list underneath. typecheck, 628/628 tests, web:smoke clean;
before/after screenshots in `docs/screenshots/attempts/`. "zones" wording untouched. Needs Jason's OK to push 12 local commits. Details: `handoffs/archive/2026-10-08-2155-claude-attempt-screens-and-back-button.md`.

# Handoff: Open Segments browse and share on the design system; token-free sharing proposal (committed locally, not pushed)

Phone-only; Karoo untouched. Open Segments cards now show distance and climbing, with offline/busy/empty/error states, pull to refresh and "already added". Share to Open Segments tells strangers
sharing isn't open yet (beta: maintainer only), warns that shared segments are public and show where you ride, and hides the GitHub-token path behind "I'm the GritMap maintainer". New
`docs/OPEN_SEGMENTS_SHARING.md` compares token-free options and **recommends a Cloudflare Worker that opens a reviewed pull request (after the beta)**; nothing built. typecheck, 620/620 tests, web:smoke clean;
before/after screenshots in `docs/screenshots/open-segments/`. Needs Jason: the four decisions at the end of the proposal, and OK to push 9 local commits. Details:
`handoffs/archive/2026-10-08-2105-claude-open-segments-design-sharing-proposal.md`.

# Handoff: phone app is ready for a TestFlight build, short of Jason's Apple credentials (committed locally, not pushed)

Phone-only; Karoo untouched. Added `eas.json` (development / preview / production; remote autoincrementing build numbers because `ios/` is a committed native
project), `.easignore`, export-compliance flag, buildNumber, **iPhone-only for the beta** (iPad layouts unchecked), a synthetic review sample ride, and
`docs/BETA_TESTFLIGHT.md` with the exact steps only Jason can do (enrollment, `eas login`/`init`, App Store Connect app, first build/submit, external group, Beta App
Review notes about the Karoo, privacy policy URL). Verified: typecheck, 617/617 tests, web:smoke, `expo export --platform ios`, and an unsigned Release simulator build
that launches into first-run onboarding with no dev UI. Nothing needing Jason's credentials was run. **Needs Jason's attention:** the PUBLIC repo contains 6 real ride FITs
in `fixtures/fit/` (personal GPS); and OK to push 7 local commits. Details: `handoffs/archive/2026-10-08-2010-claude-testflight-readiness.md`.

# Handoff: Define Segment redesigned; progress-over-time load 7.5 s to ~0.05 s; text size reflows live (committed locally, not pushed)

Phone-only; Karoo untouched. Define Segment and its handles are on the design system (plain steps, 44 pt handles with VoiceOver
labels/values, inline errors, loading/no-GPS/error states). Progress over time: computing the bands took **7,486 ms** on the simulator
before and **45-83 ms** after (the interpolation rebuilt its observation list on every step; now cached per array; Compare Attempts
benefits too). Changing text size while the app is open now reflows design-system text without a relaunch (`useFontScale` keyed
`AppText`); screens still using raw `Text` don't yet. typecheck, 617/617 tests, web:smoke clean. Before/after screenshots:
`docs/screenshots/define-segment/`. "zones"/"sections" wording untouched per the hold. Still needs: Jason's OK to push 5 local commits; a person's
VoiceOver pass. Details: `handoffs/archive/2026-10-08-1930-claude-define-segment-perf-textsize.md`.

# Handoff: beta-loop screens moved onto the design system; Home safe-area fix (committed locally, not pushed)

Phone-only; Karoo untouched. Segment Detail (goal and pacing plan, elevation chart), coach-plan import, Send to Karoo,
Import (ride and segment files, with progress and result states), Plan vs actual, Progress over time (was Historical
Range) and Ride detail now use only `src/theme` tokens/components, with loading/empty/error states, 44 pt targets, Dynamic
Type and VoiceOver labels. Home no longer draws under the status bar and its Change button is reachable (`3b3e590`, its own
commit). Before/after simulator screenshots on demo data: `docs/screenshots/redesign/`. typecheck, 616/616 tests and
web:smoke clean. Copy and behavior changes (alerts to on-screen results, duplicate prompt, "zones" to "sections", Send to
Karoo button says "Send route to Karoo") are listed in the archive. **Not yet done:** a person's VoiceOver pass; Attempt
Review/Comparison, Define Segment, Publish, Open Segments still use the old style. Needs Jason's OK to push
`be21320`, `3b3e590`, `078e131`. Details: `handoffs/archive/2026-10-08-1550-claude-beta-loop-design-migration.md`.

# Handoff: signed Karoo beta 0.10.42 is tagged, installed and documented

Karoo `0.10.42-beta`/code65 is built from the exact annotated tag `karoo-beta-0.10.42`, signed with
a persistent private beta key, checksum-recorded, and installed on the physical Karoo. A clean
0.10.41-beta install followed by an in-place 0.10.42-beta upgrade passed. The beta audit also found
and fixed two release-facing defects: GM H10 Cardiac was absent from the extension manifest, and
the large Pacing Profile was blank without a segment. All 176 JVM tests, lint, debug build, signed
R8 build and signature verification pass. `docs/BETA_KAROO_INSTALL.md` now matches the phone's exact
GritMap / Receive from Phone / Send plan to Karoo wording. The one-time debug-to-beta signature
transition left the Karoo library empty; resend a segment and plan before its smoke ride. Details:
`handoffs/archive/2026-10-08-1516-codex-karoo-beta-0.10.42.md`.

# Handoff: first-run onboarding, design foundations and empty states on the phone (committed locally, not pushed)

Phone-only; Karoo untouched. A fresh install now walks a four-step onboarding (what it does, FTP and weight in kg or lb,
how to get a segment, how to connect the Karoo) and lands on an empty Segments screen; walked on a wiped simulator install
with screenshots in `docs/screenshots/onboarding/`. New design system in `src/theme/` (type scale, light and dark palettes
with a contrast test, Button/Card/ListRow/TextField/EmptyState/ErrorState/LoadingState). Found and fixed on the way: Open
Segments listed raw fingerprints; FTP and weight could not be edited after being set (new Profile button). 608/608 tests,
typecheck and web:smoke clean. **For Codex:** the in-app Karoo steps use exact strings **GritMap**, **Receive from Phone**,
**Send plan to Karoo**, an address like `192.168.1.23:8734`, and a 10-minute window; keep `docs/BETA_KAROO_INSTALL.md`
consistent (they live in `src/onboarding/onboardingCopy.ts`). VoiceOver not yet exercised. Details:
`handoffs/archive/2026-10-08-1425-claude-onboarding-design-foundations.md`.

# Handoff: Polar H10 cardiac-stability field installed on Karoo

Karoo 0.10.42/code65 adds a separate `GM H10 Cardiac` field backed by real Polar H10 RR intervals.
It computes experimental DFA alpha-1 only after an approximately two-minute clean window, never
bridges a known dropout, and shows RMSSD plus RR validity as supporting context in responsive large
and compact views. The ordinary `GM Cardiac Drift` field remains the universal fallback. All 175
JVM tests, lint and APK build pass; 0.10.42 is installed on the connected Karoo. A physical H10
exercise validation remains. Commit `0a6ac9f` consolidates all accumulated work through this
milestone; the follow-up handoff-only commit leaves the worktree clean. Details:
`handoffs/archive/2026-10-08-1035-codex-h10-cardiac-field.md`.

# Handoff: Coco Jumbo physical live retest passed end to end

The 2026-10-08 physical retest verifies the 0.10.41 activation fix. The Karoo log shows
`candidate_discovered` -> `candidate_selected` at 18 m -> attempt start/entry alert -> completed
attempt/completion alert. Room persisted 95.71% live coverage through 510.68 m against the correct
six-zone AI-coach plan (280 W FTP, 4:18 goal, 300-370 W). The attached FIT independently matches at
100% coverage with no gaps or backward movement. H10 capture also saved 199/199 valid schema-2 RR
samples with zero gaps; RR-derived HR was 59.75 bpm versus 59.72 bpm in the matching FIT window.
The FIT identifies Polar device 47674 over ANT+ as the HR source. This drive
had HR/speed but no power/cadence, so adaptive power behavior remains untested. Details:
`handoffs/archive/2026-10-08-0813-codex-coco-live-retest-pass.md`.

# Handoff: real Coco Jumbo live-activation bug fixed; 0.10.41 is installed

The 20:04 drive's FIT is a clean Coco Jumbo accept (100% coverage, 6.85 m max deviation,
no gaps), and Karoo diagnostics exposed the actual live bug: the coordinator reset each candidate
after its first direction-gate sample, so a gate requiring two consecutive forward samples could
never confirm. Viable candidates are now retained while confirmation is pending. Matcher/service
tests, lint and APK build pass; 0.10.41/code64 is installed and post-install diagnostics confirm
the new bound-service startup path. The phone transfer also has a new 15-second timeout. A moving
retest remains. Details:
`handoffs/archive/2026-10-06-2043-codex-live-candidate-activation.md`.

# Handoff: Coco Jumbo now has real elevation and non-zero section grades

The original GPX carried no elevation, so its 55-point portable segment was legitimately imported
with missing elevations and plan generation displayed 0% grade. Coco Jumbo is now enriched from the
real Karoo FIT's barometric traversal: 110.8-188.2 m, 77.4 m/254 ft gain over 533.553 m (14.5%
average), with six non-zero adaptive section grades. Elevation changes the immutable fingerprint to
`cfc9be45fea61eebdd9dbcacd6e5798fd6386afecacb575012657c045e995efc`; delete the old Coco Jumbo on
phone/Karoo before importing and sending this replacement, then regenerate its plan. Typecheck and
497/497 tests pass. Details:
`handoffs/archive/2026-10-06-1653-codex-coco-jumbo-elevation.md`.

# Handoff: Import Segment JSON is built on the phone (the Coco Jumbo task) -- uncommitted, phone only

The task at the top of this file is done: Rides -> Import now has **Import Segment JSON**, which validates a portable
segment file, adds it to Segments, matches existing rides and opens Segment Detail. One change to the plan: the Karoo's own
segment files have no `fingerprint`, which the existing parser rejects, so `fromPortableSegmentJson` gained an opt-in
`allowMissingFingerprint` (computes it locally; a fingerprint that IS present must still match; the registry path still
requires one). The phone's fingerprint for `Coco_Jumbo.segment.json` equals the one in the Karoo's database
(`ed56296f099c...`), so a plan sent from the phone attaches to the installed segment, no duplicate. 493/493 tests; not
live-checked; Karoo build untouched. Details: `handoffs/archive/2026-10-06-claude-segment-json-import.md`.

# Handoff: iPhone segment-JSON provider read fallback added

Coco Jumbo's file is valid and contains `id: "coco-jumbo"`; the reported null-ID/read failure
happened before JSON parsing in the iOS document-provider bridge. The phone picker now explicitly
copies selected JSON to local cache and tries three ordered readers: modern Expo `File`, legacy
Expo string read, then URI fetch. A pure fallback test covers the null-ID failure. Typecheck and all
496 root tests pass. This is JavaScript-only but the phone must reload the newest bundle before
retrying the same `Coco_Jumbo.segment.json`. Details:
`handoffs/archive/2026-10-06-iphone-segment-json-read-fallback.md`.

# Next phone task: import portable segment JSON, starting with Coco Jumbo

The rider has Coco Jumbo on the Karoo but not in the phone library. Its authoritative portable file
already exists at `apps/karoo/samples/Coco_Jumbo.segment.json`. The phone's current Import screen
only processes FIT/GPX, so AirDropping that JSON to the iPhone cannot add it yet. Add a clearly
labelled **Import Segment JSON** action to the phone, read a selected JSON document, and pass the
parsed object through the existing `fromPortableSegmentJson` + `importRegistrySegment` validation,
fingerprint verification and duplicate handling. On success, navigate to Segment Detail so the
rider can create/import guidance and send the combined segment/plan back to Karoo. Do not add a
special Coco Jumbo database seed or bypass fingerprint validation. Add tests for valid import,
invalid/tampered JSON, and already-imported fingerprint. This is a phone-only task and should not
touch the Karoo build or its currently installed 0.10.40 baseline.

# Handoff: the phone now records the plan each Karoo send carried (uncommitted; no Karoo impact)

Plan vs actual used to compare an effort with the segment's *current* plan (the "historical-plan caveat" in the
next-ride checklist). Each successful send to the Karoo is now stored (`plan_sends`, migration v13: the exact
baseline plan JSON incl. the target time the Karoo got), and Plan vs actual uses the latest plan sent at or
before the effort, labelled "the plan sent to your Karoo on <date>", plus a line comparing the real time with the
Karoo's target. **Sends made before this build are not recorded** -- the rider should resend Realize's and Diablo's
plans from this build before the ride, otherwise the comparison falls back to the current plan with the old caveat.
482/482 tests; not live-checked. Details: `handoffs/archive/2026-10-06-claude-plan-sends-recorded.md`.

# Handoff: Android 12 background-service startup hardened offline

The offline 0.10.41/code64 candidate no longer calls `startService()` from the Karoo extension's
background `onCreate`. The extension now holds a `BIND_AUTO_CREATE` connection to
`LiveSegmentService`, and the service begins Karoo ride-state observation from `onBind`; therefore
tracking does not rely on the map layer or a visible GritMap field rescuing a rejected background
start. A Robolectric binding regression test, 19 focused service tests, compile, lint and APK build
pass. The APK was deliberately not installed: physical Karoo remains on the clean 0.10.40/code63
planned-segment-test baseline. Details:
`handoffs/archive/2026-10-06-android-background-service-binding.md`.

# Handoff: predicted finish time for imported plans (phone app, uncommitted)

Rider asked for a predicted completion time to appear with the goal when a plan is imported. The phone now
predicts it (physics power model from weight + route elevation, calibrated to the rider's last three efforts on
the segment) and shows it in the import preview and on the segment screen next to the goal comparison. A coach
plan with no target time of its own is now sent to the Karoo **with the predicted finish as
`targetFinishTimeSeconds`** (existing wire field), so the Karoo's segment "Goal" no longer reads "Fastest
sustainable" and its pacer has a time to use. No Karoo change needed. 471/471 tests; on the real 2026-09-13 Diablo
effort the uncalibrated model is ~7% optimistic and the 39:00 plan calibrates to ~41:52. Not live-checked. Details:
`handoffs/archive/2026-10-06-claude-predicted-finish-time.md`.

# Handoff: physical 0.10.40 approach/H10 lifecycle passed on a short ride

The connected Karoo's 2026-10-06 short ride exercised the automatic Coco Jumbo approach without
entering a planned segment. The preferred H10 connected and began capture 3.2 seconds after the
approach request, with no retry or fallback. Ride end saved a structurally exact schema-1 artifact:
236/236 valid samples, zero gaps/trailing bytes, 238.3 seconds and 59.2 bpm mean RR-derived HR.
The exported FIT independently recorded Polar ANT+ HR and averaged 59.6 bpm over the same window,
only 0.4 bpm higher, confirming the intended simultaneous ANT+ HR plus Bluetooth RR design.
No crash occurred. A denied extension background start recovered through the map-layer start 0.8
seconds later. Planned-segment behavior remains untested. Details:
`handoffs/archive/2026-10-06-0852-codex-short-ride-h10-result.md`.

# Handoff: RR persistence isolation, identity, schema 2 and post-ride analysis are complete offline

The offline `0.10.41`/code64 source now keeps all artifact disk work off the Bluetooth callback,
uses a bounded ordered writer with explicit failure behavior, attaches capture/segment/attempt
identity plus a SHA-256 metadata sidecar, and preserves native H10 1/1024-second RR values in a
backward-compatible schema 2. A new FIT/log/RR analysis CLI reports the next ride's approach,
fallback, capture, gap and HR-comparison evidence. Root tests/typecheck and 56 focused Android
tests plus lint/build pass. Nothing new was installed: the Karoo remains intentionally on
0.10.40/code63 for the clean moving approach test. Details:
`handoffs/archive/2026-10-06-0752-codex-rr-pipeline-completion.md`.

# Handoff: next-ride checklist is synchronized and ready

`docs/NEXT_RIDE_TEST_CHECKLIST.md` now matches the installed Karoo 0.10.40/code63, marks the preferred
H10 setup complete, preserves the offline 0.10.41 boundary, documents the exact approach/retry log
sequence, and adds Claude's phone Plan vs Actual review plus its historical-plan caveat. Do not open
H10 Diagnostics or reinstall before the ride. Details:
`handoffs/archive/2026-10-05-2214-codex-next-ride-checklist-current.md`.

# Handoff: plan vs actual per zone (phone app, uncommitted; no Karoo impact)

Claude added a "Plan vs actual" screen on the phone: after an effort is imported, its power is averaged per
plan zone (time-weighted, pauses excluded, odometer stretched to the segment length) and shown against the
plan's targets with a chart, a table, time gained/lost vs the best other attempt, and a short read
("went out hard", "faded as the effort went on", biggest miss). Entry: segment screen -> Your Efforts, and the
attempt review screen. JS only; 445/445 tests; run on the real 2026-09-13 Diablo effort (262 W vs a 284 W plan,
fading -5/-8/-13% by thirds). Not live-checked on a device. Compares against the plan as it stands now, not
necessarily the one sent to the Karoo. Details: `handoffs/archive/2026-10-05-claude-plan-vs-actual.md`.

# Handoff: RR dropout clock recovery built offline; device left on 0.10.40

The offline `0.10.41` candidate immediately re-anchors RR time after a clear packet dropout, writes
an explicit invalid gap observation, prevents RMSSD from bridging the discontinuity, resets metric
eligibility, and logs `h10_rr_gap`. Forty-nine focused tests, lint and build pass. It was intentionally
not installed: the Karoo still reports 0.10.40/code63 for tomorrow's clean approach test. Details:
`handoffs/archive/2026-10-05-2147-codex-rr-dropout-gap.md`.

# Handoff: 0.10.40 H10 recovery and tomorrow's checklist are ready

Codex reviewed Claude's follow-up, fixed the ride-time stranger-strap hazard, and updated
`docs/NEXT_RIDE_TEST_CHECKLIST.md`. Automatic approach now reconnects only a manually confirmed H10;
without one it logs setup-required and uses Karoo HR. GATT errors/disconnects get bounded 2s/5s/10s
retries. The safety-corrected 0.10.40/code63 APK passed 45 focused tests plus lint/build and is
installed on the Karoo. Moving verification remains tomorrow. Details:
`handoffs/archive/2026-10-05-2126-codex-h10-approach-recovery.md`.

# Handoff: next-ride checklist for the rider + follow-up review of the H10 work (FOR CODEX)

**Codex: please read `docs/NEXT_RIDE_TEST_CHECKLIST.md`** (the rider's checklist for the next ride on `0.10.39`),
correct its log-event sequence and expectations against the build, add Karoo-side checks, and record the
results after the ride. Claude's follow-up review `docs/REVIEW_H10_FOLLOWUP.md` confirms B1-B4 fixed and flags,
in priority order: **G8** the automatic scan can pair with and then *remember* a stranger's strap (never pair from
a ride-time scan); **G1/G2** the beat clock lags ~3 s for ~10 min after a short dropout with no gap marker, and a
mid-segment disconnect is never retried; **G3** capture is per segment (approach -> +2 min), not per ride;
**G4/G5** fsync on the Binder thread, artifacts not tied to segment/attempt ids. No preferred H10 is saved on the
Karoo yet, so the checklist has the rider save one in H10 Diagnostics first. Docs only; the two docs and the archive are committed. Details:
`handoffs/archive/2026-10-05-claude-next-ride-checklist-h10-followup.md`.

# Handoff: bounded H10 approach recovery installed

GritMap `0.10.40` (code 63) adds bounded 2s/5s/10s recovery for GATT errors and
unexpected disconnects during approach preparation, then safely falls back to Karoo HR. It also
adds explicit diagnostic events for the full automatic lifecycle. Approach mode reconnects only a
previously confirmed H10 and never ride-time scans for a stranger's strap. Forty-five focused tests,
lint and build pass; the APK is installed on the connected Karoo. The moving approach test remains.
Details: `handoffs/archive/2026-10-05-2126-codex-h10-approach-recovery.md`.

# Handoff: automatic approach-time H10 preparation installed

GritMap `0.10.39` (code 62) now warms up H10 Enhanced automatically when a rider comes within a
separate 250 m coarse approach area. Matching remains the same directed 30 m algorithm. It directly
reconnects a locally remembered H10 and silently falls back to ANT+ HR when none is confirmed.
Capture begins during approach, with abandoned-approach and post-segment
release timers. All 42 focused physiology/service tests, lint and build pass; the APK is installed.
The automatic moving-ride trigger still needs physical verification. Details:
`handoffs/archive/2026-10-05-2102-codex-automatic-approach-h10.md`.

# Handoff: H10 ride lifecycle verified end to end

GritMap `0.10.38` completed the full physical lifecycle: simultaneous BLE RR plus Karoo ANT+ HR,
BLE retained on the native ride screen, capture through Recording/Paused, then automatic save of
265 RR records and BLE teardown on Idle. The finalized artifact header, exact length and SHA-256
were verified; telemetry consumers stopped and the service left foreground mode without errors.
Manual first pairing remains; saved-address auto-reconnect is the next safe step. Details:
`handoffs/archive/2026-10-05-2042-codex-h10-ride-lifecycle-verified.md`.

# Handoff: service-owned H10 capture sustained during a Karoo ride

GritMap `0.10.38` (code 61) now owns H10 BLE/RR capture in `LiveSegmentService`, not the diagnostics
Activity. On the physical Karoo, the H10 connection survived returning to the native ride screen;
the RR artifact gained 64 records in 20 seconds while ANT+ HR continued and the foreground service
remained healthy. Focused physiology/service tests, lint and build pass. The current ride is still
running, so automatic ride-end artifact finalization/disconnect is the remaining physical check.
Details: `handoffs/archive/2026-10-05-2035-codex-service-owned-h10-capture.md`.

# Handoff: phone remembers the Karoo address; Karoo pairing contract drafted

Rider found typing the Karoo IP "terrible". Phone-only fixes are in (uncommitted): the last address
that worked is saved (migration v12) and pre-filled, and send failures now say "couldn't reach
<address> ... may have changed" instead of a raw network error. For Codex: `docs/KAROO_PAIRING_CONTRACT.md`
proposes `GET /ping` with a capability list, `POST /transfer` answering after import with
`imported`/`rejected: <reason>` (today it returns 200 before importing), an authenticated
`GET /segments`, a persistent receiver, and QR pairing with HMAC-signed requests; mDNS discovery is
optional. Nothing on the Karoo is built. Also found: the 2026-10-05 plan did import, onto a new
segment "Realize" (different route => different fingerprint from the old "Relize"). 426/426 tests.
Details: `handoffs/archive/2026-10-05-claude-saved-karoo-address-pairing-contract.md`.

# Handoff: versioned rider profile + coach-plan contract (phone app, uncommitted)

Claude implemented the phone side of the plan's provider-neutral guidance contract: a validated
`gritmap-coach-plan` document (rider / human coach / AI coach) -> preview -> active segment plan ->
sent as a normal baseline plan, plus `athlete_profile.profile_version` and plans flagged outdated
when FTP changes. **No Karoo change needed**: imported plans go out as `generator.type: "manual"`
with provenance in `modelVersion`, because the Karoo parser rejects unknown fields. A richer Karoo
extension (generator types, `riderProfileVersion`, capability handshake) is proposed, not built.
Schema is now v11; 417/417 tests; UI not yet live-checked. Commit note: it shares
`sendGuidancePackageToKaroo.ts` with Codex's uncommitted `karooTransferEndpoint` fix. Details:
`docs/COACH_PLAN_CONTRACT.md` and `handoffs/archive/2026-10-05-claude-coach-plan-contract.md`.

# Handoff: Polar H10 RR capture verified on Karoo

The first physical H10 capture succeeded: 163 real RR observations, enhanced metrics READY,
atomic `.rr` finalization, exact record length/header and SHA-256 verified, with no app or GATT
error. The active-partial count wording found during the test was fixed; all 18 focused tests,
lint and build pass. GritMap `0.10.37` (code 60) is installed on the connected Karoo. The artifact
remains app-private; ride-service capture and simultaneous recorded-ride validation are still
pending. Details: `handoffs/archive/2026-10-05-1550-codex-h10-physical-capture.md`.

# Handoff: H10 RR diagnostics hardened and versioned for physical testing

Codex completed debug build `0.10.36` (code 59) for the first Polar H10 desk test and addressed
Claude's B1-B4 data-integrity findings: no partial overwrite, durable 30-second checkpoints,
jitter-resistant RR timing, and recent-window validity gating. BLE state races/stale callbacks and
malformed-packet handling were also hardened. All 18 focused physiology tests, Android lint, and
the APK build pass. No Karoo was connected, so nothing was installed and physical H10 behavior is
still unverified. Details:
`handoffs/archive/2026-10-05-1504-codex-h10-rr-hardening.md`.

# Handoff: Claude reviewed the AI/physiology plan and the H10 code (findings only)

Claude's review is `docs/REVIEW_KAROO_AI_PHYSIOLOGY.md`; no code was changed. The architecture
stands. Four defects in the existing `physiology/` code should be fixed before any ride wiring:
**B1** `RrArtifactStore.kt:51` truncates a recoverable `.partial` on reopen; **B2** 8 KiB buffer
with no periodic flush loses ~8 min of RR on a process kill; **B3** arrival-time RR timestamps
flag good beats as out-of-order after a delivery stall; **B4** `RrLiveBuffer.kt:49` validity is a
lifetime ratio, not windowed. Also: karoo-ext FIT effects only take single numeric developer
fields (raw RR must stay out of the SDK; FIT's native `hrv` message needs a post-ride export
tool); upstream Needle's primary model is now Needle 3, not the plan's Needle 2; privacy/consent/
deletion/export additions; shared files (`AndroidManifest.xml`, `MainActivity.kt`,
`KarooHomeScreen.kt`) carry other uncommitted work. Run the diagnostics APK on the Karoo first.
Details: `handoffs/archive/2026-10-05-1455-claude-physiology-plan-review.md`.

# Handoff: desk-testable H10 RR diagnostics APK ready

Codex added Android 12 BLE scan/connect support, standard Heart Rate Service GATT subscription,
multi-RR timestamping, and a private H10 diagnostic screen accessible at GritMap > Settings >
Open H10 Diagnostics. It shows BPM, RR, contact, quality/readiness and sample count, then saves an
atomic SHA-256 `.rr` artifact. All 12 focused physiology tests pass and `assembleDebug` succeeds.
No device was connected at build time, so the APK is not installed and real H10 behavior is not
yet verified. Active ride service, HR Drift, Room and phone code remain untouched by the data path.
Details: `handoffs/archive/2026-10-05-1447-codex-h10-diagnostics-apk.md`.

# Handoff: isolated H10 packet/RR foundation implemented

Codex started the approved H10 work in new `apps/karoo/.../physiology` files only. The module now
decodes standard-BLE H10-style Heart Rate Measurement packets (BPM, contact state, multiple RR
values), validates/preserves observations, bounds the live window, tracks quality, writes
recoverable fixed-record `.rr.partial` artifacts, atomically finalizes with SHA-256, and rejects
unsafe paths. All 9 focused tests pass. The full 138-test Karoo suite has one unrelated existing
failure in `KarooPreviewStateTest`; it also fails alone and was not touched. Bluetooth connection,
service, Room, and UI wiring remain pending Claude's boundary review. Details:
`handoffs/archive/2026-10-05-1431-codex-h10-packet-rr-foundation.md`.

# Handoff: independent GritMap AI/H10 physiology plan ready for Claude review

Codex consolidated today's Needle, Polar H10, standard-HR fallback, RR retention, privacy, and
rollout decisions in `docs/PLAN_KAROO_AI_PHYSIOLOGY.md`. GritMap has no external coaching-product
dependency: until its own full planning product exists, riders can enter versioned guidance from
themselves, a human coach, or an AI coach. All 12 local FIT files were audited: none contains
RR/HRV; the 2026-09-13 file recorded Polar as ANT+ BPM. Claude is requested to review the plan
before implementation. Details:
`handoffs/archive/2026-10-05-1417-codex-independent-ai-physiology-plan.md`.

# Handoff: native Karoo map pacer installed

Codex installed `0.10.35` (code 58). GritMap now enables a native Karoo map layer, draws the
active segment trace, and updates one stable custom pacer symbol at the route coordinate derived
from target progress. Both are removed outside a valid active match. Projection, encoding,
identity, and teardown tests pass. Karoo may need the extension toggled off/on once because its
declared capability changed. Details: `handoffs/archive/2026-10-02-native-map-pacer.md`.

# Handoff: Pacing Coach continuous zone transitions installed

Codex installed `0.10.34` (code 57). Zone rows now move/scale/fade continuously from fractional
zone progress instead of jumping at boundaries. Adjacent/far context has a much stronger opacity
gradient, and moving content is clipped below the recommendation header. Karoo's ~1 Hz field
limit means a smooth stepped conveyor rather than 60 fps animation. Tests and build pass. Details:
`handoffs/archive/2026-10-02-pacing-coach-zone-transitions.md`.

# Handoff: Pacing Coach stack order corrected

Codex installed `0.10.33` (code 56). Future target-only zones now sit above the current zone;
completed frozen-average zones sit below. Future rows are neutral instead of resembling actual
power fill. At 20/20, zones 19 and 18 remain visible beneath the current zone. Ordering regression
tests and build pass. Details: `handoffs/archive/2026-10-02-pacing-coach-stack-order.md`.

# Handoff: Pacing Coach 20-zone demo installed

Codex installed `0.10.32` (code 55). The running demo and page-editor preview now share a
contiguous 20-zone REST/HOLD/PUSH plan, without changing real imported plans. This visibly tests
the `x/20 ZONES` counter, frozen past averages, live current power, and target-only future rows.
Focused tests and build pass. Details:
`handoffs/archive/2026-10-02-pacing-coach-20-zone-demo.md`.

# Handoff: Pacing Coach zone lifecycle corrected

Codex installed `0.10.31` (code 54). Future zones now show target only; only the current zone
updates from live/settling actual power; past zones use their frozen per-zone recorded average.
The counter moved into the recommendation banner (`HOLD · 2/3 ZONES`). Focused tests and build
pass. Details: `handoffs/archive/2026-10-02-pacing-coach-zone-lifecycle.md`.

# Handoff: Pacing Coach vertical zone progress installed

Codex installed `0.10.30` (code 53). The stacked Pacing Coach now fills zone completion bottom
to top, restores the primary recommendation banner and `current/total ZONES` counter, uses dark
recommendation/target labels, and places the bars closer together. Actual power still fills
horizontally and remains printed inside the bar. Focused tests and `assembleDebug` pass. Details:
`handoffs/archive/2026-10-02-pacing-coach-vertical-zone-progress.md`.

# Handoff: Pacing Coach zone-stack renderer installed

Codex replaced the text-led Pacing Coach with the approved Canvas zone stack and installed
`0.10.29` (code 52) on the connected Karoo. Actual watts now fill each power bar and appear
inside it; target watts sit under REST/HOLD/PUSH with one target line; zone completion is a
separate translucent layer; past/future zones recede. Focused tests and `assembleDebug` pass.
Physical large/compact screenshots are the next validation step. Details:
`handoffs/archive/2026-10-02-1129-pacing-coach-zone-stack.md`.

# Handoff: Pacing Coach interruption recovered

Codex reconstructed the completed `0.10.28` Pacing Coach work after the app crash. The physical
Karoo still runs code 51 and retains all three segments. A new regression test confirms the
next-zone preview follows the phone's adaptive plan boundaries rather than assuming quarter-mile
zones; all 12 focused tests pass. Physical large/compact visual review is still next. Details:
`handoffs/archive/2026-10-02-pacing-coach-resume-adaptive-zone-check.md`.

# Handoff: adaptive pacing-zone length + ride previews + segment-creation redesign (phone app)

- Updated: `2026-10-02 09:10 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'` -- **everything below is uncommitted**
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` are Codex's and were not
  touched. The previous LATEST.md (Codex's stacked Karoo entries: Pacing Coach `0.10.28`, global
  FTP sync `0.10.27`, etc.) was archived verbatim to
  `handoffs/archive/2026-10-02-0903-claude-pre-adaptive-zones-plus-codex-pacing-coach.md`;
  read it for the Karoo history.

## FOR CODEX -- the one contract change that touches the Karoo

**`baselinePacingPlan.zones[]` zone length is no longer a fixed quarter mile.** The phone now
picks it from the segment length (`chooseZoneLengthMeters` in `src/pacing/computeZoneGrades.ts`):
aim for ~20 zones, then snap to the nearest of **100m / 200m / 402.336m / 804.672m**.

| Segment | Zone length | Zones |
|---|---|---|
| half mile (805m) | 100m | 8 |
| 2 mi | 200m | ~16 |
| Diablo (10.4km) | 402.336m | 26 (unchanged from before) |
| 25 km+ | 804.672m | capped at half-mile zones |

- **Wire schema is unchanged** -- same fields, still contiguous, first zone starts at 0, last
  ends at the segment length, 80W step limit still applied, `RECOVER`/`HOLD`/`PUSH` still the
  enum. Only the zone *count* (~8-40) and *length* vary per segment. `generator.modelVersion` is
  now `pacing-anchor-grade-v2` (was `-v1`) so you can tell old plans from new.
- **Why**: client asked how this works on short segments; fixed quarter-mile gives a 0.5mi
  segment 2 zones. 100m is the Karoo climber feature's resolution, per the client. A fixed 100m
  was rejected: ~104 zones on Diablo = a new watt target every ~22s, and per-100m grade is noisy.
- **Please verify on the Karoo side** (I only grepped, did not read these paths in depth):
  - `ActiveAttemptSession.kt` has its own hardcoded `QUARTER_MILE_METERS = 402.336` for live
    time-bank splits. That is independent of the plan zones, so nothing breaks, but on short
    segments the plan's 100m target bands won't line up with the Karoo's quarter-mile live splits.
  - The new Pacing Coach "next-zone preview" / zone-progress logic must read zone boundaries
    from the plan (`startDistanceMeters`/`endDistanceMeters`), not assume ~402m. I found no
    `402.8`/zone-length constant or zone-count cap in `apps/karoo/app/src/main/java`, but did not
    trace the preview code.
  - `AiPlanValidator.kt` limits (100W step, 150% FTP, contiguity) are unchanged assumptions; I
    did not find a zone-count cap.
- The 402.336 choice is deliberately the true quarter mile (the previous phone constant was
  402.875, copied from a Needle-era sample fixture) so Diablo's bands now align with the
  Karoo's own 402.336 live splits.
- **Not yet re-sent to a real Karoo** with the new zoning. The first end-to-end transfer
  confirmed earlier used the old fixed-length zones. A resend of Diablo should look identical
  (26 zones); a short segment would exercise the new path.

## Also built this session, uncommitted (phone app only, no Karoo impact)

1. **Quarter-mile breakdown was invisible -- fixed.** `ElevationProfileChart.tsx` squeezed all
   zones into one container width; on Diablo that was 12.6px/zone, under my own 26px label
   threshold, so no watt numbers ever rendered. Zones now get a fixed 36px each in a
   horizontally scrollable chart.
2. **Rides list route-shape thumbnails.** Migration v8 adds `rides.preview_polyline_json`
   (35-point decimated polyline computed once at import in `persistImportedRide.ts`, same
   convention as total distance/ascent); `RidePreviewThumbnail.tsx` draws it (uniform scale +
   cos(lat) correction). Rides imported before v8 keep the generic icon (no backfill).
3. **Segment-creation redesign** (`DefineSegmentScreen.tsx`): Start/Finish tabs at the top (same
   `activeHandle` state), new full-ride `RideElevationChart.tsx` with the selection shaded, and
   chart zoom synced to map zoom via a new `onViewportChange` prop on `RouteMapView.native.tsx`
   (uses `MapRef.getBounds()`, confirmed to exist in the installed MapLibre types; fires on
   `onRegionDidChange` only) -> `computeVisibleDistanceRange.ts`. Native-only: web has no map.
   `DistanceRangeScrubber` kept as a secondary fine-adjust control.

## Verified

- `npm run typecheck` clean; `npm test` **366/366**; `npm run web:smoke` clean.
- Diablo fixture: adaptive zoning yields 26 zones at 402.336m (checked directly).
- Tests added: `chooseZoneLengthMeters`, `computeAdaptiveZoneGrades`, relative remainder-merge,
  `computeVisibleDistanceRange`, ride preview polyline (insert + list), half-mile plan has 100m zones.
- **Not live-checked on a device**: the simulator had no data. The scrolling zone chart, ride
  thumbnails, tabs, and map->chart zoom sync have only automated/code-level verification.
  `batchImport.test.ts` is timing-sensitive (30s ceiling) and flaked once under full-suite load;
  it passes in ~15s alone.

## Hazards

- Per-100m grade from 10m-resampled elevation is noisy; with `GRADE_SENSITIVITY = 0.05`, 1pp of
  grade noise = 5% power jitter on short segments. The 80W step limiter bounds it but
  classifications on 100m zones may flicker. Untested against real short-segment data.
- **Uncommitted and mixed ownership.** Mine: `src/pacing/*`, `src/db/{migrations,persistImportedRide,
  listRides}*`, `src/screens/{ElevationProfileChart,RideListScreen,RidePreviewThumbnail,
  RideElevationChart,DefineSegmentScreen,RouteMapView.*,SegmentDetailScreen}.tsx`,
  `src/segments/computeVisibleDistanceRange*`. Appear to be Codex's phone-side URL fix, also
  uncommitted: `src/karoo/{sendSegmentToKaroo,sendGuidancePackageToKaroo}.ts`,
  `karooTransferEndpoint*`, `SendToKarooScreen.tsx` -- whoever commits should not sweep the
  other's files. `docs/PLAN_KGHOST_IPHONE_UPDATES.md` is untracked and not mine.
- Schema migration v8 runs automatically on next app launch; no native rebuild needed (JS only).

## Next safe action

Client: reload the phone app, open Diablo, confirm watt labels are visible/scrollable; define a
short segment and check the 100m zones. Codex: check the Pacing Coach next-zone preview against
variable zone lengths, then resend a short segment to the Karoo to exercise the new zoning.
