# GritMap product goals

Owner: Jason. Last confirmed: 2026-10-08. Agents (Claude and Codex) read this before planning
feature work. If a request or plan conflicts with this file, say so before building.
`docs/MVP.md` records the original MVP slice; where it differs on direction, this file wins.

## Vision

GritMap helps cyclists get faster on the climbs and segments they care about: plan a pacing
strategy, execute it live on the Karoo, and see where the effort matched or broke from the plan,
ride after ride.

Segments are open. **Open Segments** lets anyone create segments, share them, and use popular
segments created by others, with no subscription.

## Audience

Started as Jason's own training tool. **Now aiming at a beta of 20+ cyclists who are strangers to
the project. Original target 2026-10-15 slipped: build 7 (iPhone, Bluetooth hidden) was submitted for
external TestFlight Beta App Review on 2026-10-19; the beta opens when Apple approves it (expected about
2026-10-21) via a public TestFlight link. Karoo side: public release `karoo-beta-0.10.44`, Karoo 3 only.**

Beta platform: iPhone (TestFlight) plus the GritMap Karoo extension (sideloaded APK). Android phone
support is not required for the beta.

**What a rider needs (decided 2026-10-23).** GritMap is built for riders with a **power meter and a heart-rate monitor**. Pacing plans are
power targets, and the live guidance, energy budget and cardiac fields all depend on power and heart rate. Without a power meter GritMap can match
segments and show progress, but it cannot do what it exists to do. Every rider-facing document and onboarding step must say this plainly, up front,
before the rider installs anything: the README, the TestFlight description and "What to test" text, the Karoo install guide, and onboarding.

Consequence for every change: nothing may assume Jason's data, devices, FTP, weight, segments or
tokens. A fresh install with an empty database must work.

## The beta loop (all of it is required)

1. Install the phone app and the Karoo extension.
2. Get a segment: import a FIT and define one, or pull one from Open Segments.
3. Set a goal and get a pacing plan.
4. Send the segment and plan to the Karoo.
5. Ride it with live pacing.
6. Import the ride's FIT on the phone (manual import is acceptable for the beta).
7. See plan vs actual per zone and progress over time on that segment.

## Priorities, in order

1. **Beta-ready loop (submitted for review 2026-10-19).** Tagged, reproducible Karoo build; EAS/TestFlight setup;
   first-run onboarding (FTP, weight, connecting to the Karoo, empty states); full loop walked on a fresh
   install. Includes:
   - **Beta-loop screens meet standard mobile design practice** (see Phone design below):
     onboarding, segment detail, plan, send-to-Karoo, FIT import, and post-ride results.
   - **Phone → Karoo send is direct Bluetooth in the next beta build** (decided 2026-10-23, before the public link is shared widely). The IP route stays
     only as a fallback, offered from the Send-to-Karoo screen when Bluetooth does not work, and the IP send is removed from the segment page. This needs a
     public Karoo release that includes the BLE reader (versionCode 71 or higher) and a new TestFlight build with Bluetooth enabled.
2. **Full phone redesign.** Apply the design system to every remaining screen and replace
   one-off layouts.
3. **Open Segments usable by strangers.** Browse and pull popular segments; publish your own
   without needing a personal GitHub token.
4. **Pacing plans as a first-class phone feature.** A plans view that is not buried in Segment
   Detail, built on what exists (generated plans, coach-plan import, predicted finish).
5. **Progress over time per segment.** Extend the historical trend view (#68).
6. **Deeper post-ride analysis.** Extend plan vs actual per zone toward why a zone was missed
   (power fade, HR drift, terrain).
7. **Karoo tracks every segment you start, and shows your PR when there is no plan** (decided
   2026-10-19, post-beta, `docs/KAROO_MULTI_SEGMENT_AND_PR.md`). The Karoo currently tracks one segment at a
   time. Target: every started segment is tracked concurrently and records its attempt. The screen headlines
   the segment that has a plan, else the one that ends first, with a small line for the others. A segment with
   no plan shows the rider's PR with live ahead/behind. The phone sends each segment's best time and splits
   (new `segmentRecord` contract field; Karoo parser first, phone sender second).
8. **Realistic plan targets and live replanning** (decided 2026-10-20). Plans must never target above what the rider has actually sustained on a
   quarter-mile (history ceiling, with a %FTP fallback and an energy-budget check); capped effort is redistributed to easier grades, with adjacent-step
   smoothing; an infeasible goal returns the best achievable time and the gap. The Karoo replans the remaining quarter-miles at each boundary from what
   the rider actually did (deadband, within the same ceilings). Needle assists the live layer only, clamped to the ceilings, with silent fallback to the
   deterministic replanner. Phone: ceilings and plan. Karoo: replanning and Needle. Ceilings travel in the plan contract.

**Parallel Karoo track, active (must not block the beta loop): H10 / cardiac physiology.** The GM
H10 Cardiac field ships in the beta as an optional, experimental, advisory field. Riders without an
H10 must never see a broken or empty state; GM Cardiac Drift stays the default. Next milestone:
physical validation (collecting → live DFA α1, compared with the saved RR artifact, readable under
effort). It does not change pacing automatically.

## Phone design

The phone app currently falls short of standard design practice. The redesign target:
- One design system: spacing scale, type scale, color tokens (light and dark), and shared
  components (buttons, cards, list rows, forms, empty/loading/error states) in `src/theme/`.
  New screens use it; no ad-hoc styles.
- Platform conventions: iOS Human Interface Guidelines for navigation, headers, sheets and
  menus; 44 pt touch targets; Dynamic Type; VoiceOver labels; sufficient contrast.
- Every screen designs its empty, loading and error states; no internal or algorithm terms
  (corridor, fingerprint, coverage) on rider-facing screens unless explained.
- Plain-language copy aimed at a cyclist who has never seen GritMap.

## Phone ↔ Karoo sharing

Moving data between the phone and the Karoo must get easier over time, and each change should
move toward that, not around it:
- Beta (next build): Bluetooth is the main send; the IP route remains as a fallback with clear instructions.
- Verified on hardware 2026-10-20 (Karoo side) and ships in the next beta build (build 7 hides it): **direct Bluetooth, no
  server** (decided 2026-10-12, `docs/BLE_DIRECT_TRANSFER_CONTRACT.md`). The plan, which is small and
  private, always goes over Bluetooth. The segment, which is large and public, is skipped if the Karoo
  already has it, or else sent in chunks or fetched from Open Segments. The Karoo writes back an
  imported/rejected receipt. No IP to type, works with no signal, and nothing passes through a server. The
  earlier token-plus-HTTPS "capsule" design is shelved: it needed hosting and put private plans on a server.
- Then: the phone can read what the Karoo already has (segments, plans, versions) to avoid
  duplicates and stale plans.
- Later: completed attempts and live summaries flow back from the Karoo automatically, replacing
  manual FIT import.
- Every payload goes through a versioned shared contract with a fixture tested on both sides.
  No side-channel formats.

## Non-goals and deferred items

- AI-generated pacing plans inside GritMap: deferred. Pasting an external AI's plan through the
  coach-plan contract (`source: "ai-coach"`) stays supported.
- Needle / on-device AI recommendations on the Karoo: **no longer deferred only for the realistic-targets and live-replanning work** (decided 2026-10-20, see priority 8). Needle stays advisory and clamped by the deterministic engine; other Needle uses remain deferred.
- H10-driven automatic pacing changes: deferred until validated, and a separate decision.
- Automatic Karoo → phone ride sync: deferred past the beta (manual FIT import is fine), but
  planned. See Phone ↔ Karoo sharing.
- Further visual polish of Karoo data fields beyond beta legibility: deferred.
- Android phone app support for the beta: deferred.
- Subscriptions or paywalled segments: never, for segments.

## Responsibilities

**Phone (React Native, `src/`; mostly Claude)**
- Rider profile (FTP, weight, versioned) and onboarding.
- FIT import, segment creation, matching against ride history.
- Open Segments: browse, pull, publish.
- Pacing plans: goal → generated plan, coach-plan import, predicted finish. The phone is the only
  place plans are created or edited.
- Post-ride analysis: plan vs actual, progress over time, attempt comparison.
- Karoo pairing and send-to-Karoo.

**Karoo (Kotlin, `apps/karoo/`; mostly Codex)**
- Live execution: segment detection/matching, attempt state, pacer, finish projection, safety.
  Deterministic and authoritative while riding.
- Live data fields (pacing coach, segment performance, cardiac drift, H10 cardiac) and the map
  pacer.
- Sensor capture, including H10 RR artifacts.
- Receives segments and plans; does not author plans.

**Shared contracts.** A change on either side needs a handoff note for the other: portable
segment JSON and fingerprint, the `gritmap-transfer` package, the coach-plan contract
(`docs/COACH_PLAN_CONTRACT.md`), the rider-profile version, and the pairing contract
(`docs/KAROO_PAIRING_CONTRACT.md`).

## Reference data point

Diablo Northgate to Junction, ridden 2026-09-13: generated plan 39:00, finished 45:45. The phone's
calibrated prediction puts that plan nearer 42:00 for this rider, so the plan was optimistic; closing that gap is
what priorities 4–6 are for.

## Repository rules that bear on goals

The repository is public. Never commit personal GPS data, ride files or credentials without
asking Jason first.
