# Coordinator: next task for Codex (2026-10-08 16:20)

Read `docs/GOALS.md` first. The previous task (signed beta APK, install guide, empty states) is **complete**
(`1eb405f`, `01aeaf6`, tag `karoo-beta-0.10.42`). Coordinator QA: 176/176 JVM tests, lint and debug build pass;
the device reads `0.10.42-beta`/65. (The 0.10.42 handoff's "175 tests" is superseded; QA counts match.)

**HOLD on wording:** the phone renamed pacing "zones" to "sections"; the Karoo fields and
`docs/BETA_KAROO_INSTALL.md` still say "zones". Jason is choosing one term. Do not rename anything yet.

**Task: physical validation of GM H10 Cardiac (the GOALS.md H10 track milestone), plus support for stranger bug reports.**
- Prepare a one-page rider checklist for Jason's next ride: add the field, ride an active segment with
  the H10 for 3+ minutes, and what to watch for (`COLLECTING RR` → live α1, readability under effort).
- After the ride, compare the displayed values with the saved RR artifact, and report stability and
  dropout behavior with numbers.
- Make sure a beta tester's problem report is actionable: the "Report a beta problem" section of the
  guide should tell them exactly what to send (logs and version), and the Karoo should expose them.
- Out of scope: automatic H10-driven pacing, Needle, pairing.

Done when: the checklist is committed, the post-ride comparison is in a handoff with the Goal
alignment section, and any beta-blocking H10 issue is listed first.

# Coordinator: current phone task (2026-10-08 16:20, sent to the GritMap MVP session)

For Codex's awareness. Do not edit these phone files.

The previous phone tasks are done and pass coordinator QA: onboarding (`be21320`), Home fix (`3b3e590`),
beta-loop screen migration (`078e131`); 616/616 tests. Unpushed, awaiting Jason.

**Task:** redesign Define Segment (with handle accessibility); bring the progress-over-time load under 2 s
or give it a loading state; reflow live when the text size changes. The zones/sections wording is on hold.

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
