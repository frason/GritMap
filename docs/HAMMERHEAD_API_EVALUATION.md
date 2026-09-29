# Hammerhead/Karoo API Evaluation (issue #63)

Research/decision deliverable per issue #63. **Not an implementation** — building anything
described here needs a separate follow-up issue and explicit client sign-off, per
SPEC.md's guardrails.

## Current state

The app imports rides via manual FIT-file export from the Karoo, through the document
picker (`src/screens/ImportScreen.tsx`). This works reliably today, has no ongoing cost,
and no account/OAuth dependency. It has never been flagged as painful in any handoff
across this project's history — it's low-friction, not a known pain point.

## What actually exists today (2026-09-28 research, not the original spec's assumption)

The original spec (`Grip-Map-app-spec.md`) was written assuming no confirmed Hammerhead
API existed and treated direct integration as speculative. That's no longer accurate —
Hammerhead (now part of SRAM) has since stood up a real, documented public API.

### Hammerhead's own API — directly relevant, and free

Live documentation at `https://api.hammerhead.io/v1/docs` (fetched directly, not
paraphrased from marketing copy). Confirmed real endpoints:

- **OAuth 2.0** authorization-code flow (`/oauth/authorize`, `/oauth/token`) — standard,
  no unusual requirements.
- **Activity sync webhook** — Hammerhead POSTs `{ activityId, userId }` to a registered
  webhook URL whenever a new activity syncs.
- **`GET /activities`** — paginated list of activity summaries (name, duration, distance,
  polyline, etc).
- **`GET /activities/{activityId}/file`** — returns the actual FIT file for one activity.
  This is the literal capability the issue asks about.
- **`GET /routes`, `POST /routes/file`** — could theoretically push segment routes *to* a
  rider's Karoo this way too, as an alternative to the existing local-WiFi
  `sendSegmentToKaroo.ts` path — not evaluated further here, out of this issue's scope.

**License terms** (`API Licence Document`, last modified 2025-05-22, fetched in full):

- **No fees today** (§6) — but Hammerhead/SRAM explicitly reserves the right to start
  charging at any time, with no notice period specified beyond "we reserve the right."
- Registration is not fully self-serve: you get an API key by **emailing
  `hammerhead.integration@sram.com`** (§2) after creating a developer account and accepting
  the license in the Hammerhead Dashboard — a real, if small, manual approval step.
- **No support, no uptime guarantee, revocable at any time, may change without notice**
  (§5, §9, §12) — normal for a free first-party API, but means this could break or
  disappear without warning, unlike a paid SLA'd vendor.
- One restriction worth flagging explicitly: §3(h) prohibits using the API to "replicate
  or attempt to replace the user experience of the Company Offering." GritMap is a
  downstream analysis/goal-tracking app, not a Karoo-device-experience replacement, so this
  doesn't appear to apply — noted for the record, not as a blocker.

### Terra — real, but priced for a different scale entirely

Terra offers a genuine unified webhook-based API across 500+ wearables, including FIT
delivery. Pricing as of 2026: **~$399–499/month minimum**, including roughly 100,000
credits/month, scaling with active authentications and events. For a single personal user
importing a handful of rides a week, this is wildly disproportionate — the original spec's
"too high for MVP" conclusion still holds, and holds even more strongly now that
Hammerhead's own API exists for free.

### `karoo-ext` (already in use) is a different thing entirely

`apps/karoo/`'s existing companion app is built on `karoo-ext`, Hammerhead's **on-device**
Android extension SDK (installed and running directly on the Karoo hardware, communicating
with the on-device `KarooSystemService`). It has nothing to do with retrieving completed
activity data on a server/phone — it's the mechanism already solving a completely different
problem (live pacing overlays, data fields). Worth stating plainly since "Hammerhead
Developer Platform" marketing copy conflates both under one name, and it would be a real
mistake to think the existing Karoo extension work is a step toward automatic FIT sync — it
isn't; they're unrelated capabilities of the same platform.

## The real remaining obstacle: webhooks need a public server

Hammerhead's webhook delivers to a registered public HTTPS URL. GritMap has **no backend
server today**, by deliberate MVP design (local-first, no accounts, no hosting). Standing
up just enough infrastructure to receive one webhook would reintroduce exactly the backend
dependency the MVP guardrails were written to avoid — a disproportionate cost for what it
buys.

**The webhook is skippable.** `GET /activities?startDate=...` can simply be **polled
directly from the phone app** (e.g., on app open, or via pull-to-refresh on the Import
screen) using the stored OAuth access/refresh token — no public endpoint needed at all.
This gets the same practical outcome (new rides show up without a manual file export) with
zero new server-side infrastructure, fully consistent with local-first, no-backend
operation. The app already has a registered custom URL scheme (`gritmap://`, in
`app.json`) that could serve as the OAuth redirect URI without adding anything new there.

## Recommendation

**Worth building, but not urgent — revisit after Oct 3.**

- The cost calculus has fundamentally changed since the original spec: this is now a free,
  documented, first-party API rather than a $400+/month third-party service. That alone
  reverses the original "don't build" lean for cost reasons.
- It removes real (if currently tolerated) friction: manually exporting and picking a FIT
  file after every ride, versus rides just appearing.
- It is **not free of integration cost**: OAuth token storage/refresh, one manual
  registration step with SRAM, handling API changes/outages gracefully (no SLA), and a
  polling schedule — a real, if modest, feature, not a trivial toggle.
- Given the client's goal is a fixed Oct 3, 2026 PR attempt and manual import has caused
  zero friction so far, this is explicitly **not** worth spending time on before then.
- **Revisit trigger:** pick this up post-Oct-3 if manual FIT export ever becomes actual
  daily friction (e.g., forgetting to export, wanting rides captured from a device that
  doesn't regularly connect to this Mac), or opportunistically as a quality-of-life
  improvement once the Oct 3 goal is behind you.

Building this (OAuth flow, token storage, activity polling, wiring into the existing
`importRideFile()` pipeline) needs its own follow-up issue and explicit sign-off before any
code is written, per SPEC.md's guardrails — nothing here authorizes starting that work.
