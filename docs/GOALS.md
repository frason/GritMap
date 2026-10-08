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
the project, targeted for about 2026-10-15.**

Beta platform: iPhone (TestFlight) plus the GritMap Karoo extension (sideloaded APK). Android phone
support is not required for the beta.

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

1. **Beta-ready loop by ~2026-10-15.** Tagged, reproducible Karoo build; EAS/TestFlight setup;
   first-run onboarding (FTP, weight, connecting to the Karoo, empty states); full loop walked on a fresh
   install. Includes:
   - **Beta-loop screens meet standard mobile design practice** (see Phone design below):
     onboarding, segment detail, plan, send-to-Karoo, FIT import, and post-ride results.
   - **Phone → Karoo send stays on the existing IP route for the beta.** It works today; the beta
     work is clear in-app instructions a stranger can follow (where to find the Karoo's address,
     what to open on the Karoo, what success and failure look like). Pairing is not a beta blocker.
2. **Full phone redesign.** Apply the design system to every remaining screen and replace
   one-off layouts.
3. **Open Segments usable by strangers.** Browse and pull popular segments; publish your own
   without needing a personal GitHub token.
4. **Pacing plans as a first-class phone feature.** A plans view that is not buried in Segment
   Detail, built on what exists (generated plans, coach-plan import, predicted finish).
5. **Progress over time per segment.** Extend the historical trend view (#68).
6. **Deeper post-ride analysis.** Extend plan vs actual per zone toward why a zone was missed
   (power fade, HR drift, terrain).

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
- Beta: keep the working IP route, with clear instructions.
- Next after the beta: pair once, then "Send" just works (no retyped IP, no receive screen left
  open on the Karoo), sends are authenticated, and the phone shows the Karoo's real import result
  (`docs/KAROO_PAIRING_CONTRACT.md`).
- Then: the phone can read what the Karoo already has (segments, plans, versions) to avoid
  duplicates and stale plans.
- Later: completed attempts and live summaries flow back from the Karoo automatically, replacing
  manual FIT import.
- Every payload goes through a versioned shared contract with a fixture tested on both sides.
  No side-channel formats.

## Non-goals and deferred items

- AI-generated pacing plans inside GritMap: deferred. Pasting an external AI's plan through the
  coach-plan contract (`source: "ai-coach"`) stays supported.
- Needle / on-device AI recommendations on the Karoo: deferred.
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
