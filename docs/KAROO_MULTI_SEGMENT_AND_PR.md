# Karoo: track every segment you start, and show your PR when there is no plan

Status: **development runtime integrated behind a default-off flag; PR import/display pending.** Written 2026-10-19 by the coordinator after Jason's direction. Post-beta work, queued behind
the direct-Bluetooth fix. Needs Codex review (Karoo) and the phone session (contract fixtures) before any code.

Karoo implementation design and contract review (2026-10-20): `KAROO_MULTI_SEGMENT_DESIGN.md`.
The tracker is connected to a default-off service/UI path. PR storage/import and wire contract changes remain pending.

## Why

Today the Karoo tracks **one segment at a time** (`LiveSegmentCoordinator`): it only looks for new candidates when it has none, locks onto
one segment after 50 m, and ignores every other segment that starts while it is active. On the real overlap in Open Segments (The Full Diablo
starts 950 m into Diablo Northgate to Junction and runs about 6 km past its end), riding from the Northgate gate gives live guidance and a
recorded attempt for Northgate only. The Full Diablo gets neither, and the rider sees nothing for it live. The phone later finds both
efforts when the FIT is imported, so the gap is live-only. Jason's direction (2026-10-19): the Karoo should not be limited to one
segment at a time, and a segment with no plan should show the rider's **PR** for it.

## Behavior (decided)

1. **Track every segment you start, concurrently.** Each started segment has its own live matcher and its own recorded attempt. Finishing or
   abandoning one never resets the others. Cap concurrent tracking (suggest 4) and say so in the diagnostics.
2. **Headline rule** (Jason approved): the screen headlines the active segment **that has a pacing plan**. If none or several have one,
   headline the one that **ends first**. Show a small secondary line for the others, for example "Also: The Full Diablo, 6.2 km to go".
3. **No plan on the headlined segment: show the PR.** Show the rider's best time and a live ahead/behind against it. If there is no PR yet
   (a first attempt), show progress and elapsed time only.
4. **A plan always wins the display over a PR** on the same segment.
5. When the rider beats the PR live, the Karoo stores the new best locally. The phone learns it on the next FIT import, as today.

## What exists, what is missing

- Exists: the matcher handles several candidates, the Karoo records its own attempts (`segment_attempts`), and the live UI state already
  has a per-segment plan and sensor status.
- Missing on the Karoo: discovery while another segment is active; concurrent `ActiveAttemptSession`s; a headline selector replacing the
  50 m lock; a secondary-segment line in the fields; PR and ahead/behind rendering.
- Missing as data: the Karoo only knows attempts recorded **on the Karoo**. The rider's PR usually comes from rides imported on the
  phone, so the phone must send each segment's best time.

## Confirmed timing basis (phone code review, 2026-10-20)

The phone selects the minimum `endTimestampMs - startTimestampMs` among attempts whose decision is
`accept` or which are manually approved (`src/screens/SegmentDetailScreen.tsx`, `bestByDuration` and
`validAttempts`). `src/db/persistMatchCandidate.ts` reads those timestamps directly from the selected
start/end `ride_points` rows, identified by the matcher's source point indices. This is **sampled elapsed
time, including pauses and gaps**, not moving/timer time and not interpolated crossing time.
`segmentRecord.bestDurationSeconds` must be that exact duration divided by 1000, without integer rounding;
split elapsed times must use the same start timestamp. Manual approvals follow the phone's eligibility
rules, rather than an additional Karoo-only filter. Matching algorithms may still choose different boundary
samples; matching the time basis does not by itself guarantee identical detected attempts.

## Contract proposal: `segmentRecord`

An optional object describing the rider's best effort on the segment being sent, added to the `gritmap-transfer` package next to
`baselinePacingPlan`:

```json
"segmentRecord": {
  "segmentFingerprint": "<64 lowercase hex, equals the segment's fingerprint>",
  "bestDurationSeconds": 2745,
  "achievedAtMs": 1789300000000,
  "effortCount": 6,
  "splits": [{"distanceMeters": 250, "elapsedSeconds": 62}, {"distanceMeters": 500, "elapsedSeconds": 121}]
}
```

- `splits`: elapsed time from the best effort at fixed distance steps (suggest every 250 m, at most 80 entries) so the Karoo can show
  ahead/behind live. About 3 KB for a 15 km segment.
- Built by the phone from the fastest accepted effort (the same effort its "Your Efforts" summary calls the personal record).
- Karoo parser: strict keys, fingerprint must match, durations positive and monotonic. Treated as data only; it never changes a plan.
- **Wi-Fi package:** the Karoo's parser fails closed on unknown keys, so the phone must not send this until the Karoo accepts it.
  Ship order: Karoo parser first, then the phone sender.
- **Bluetooth:** add an optional fourth resource `record` (at most 8 KiB) to `docs/BLE_DIRECT_TRANSFER_CONTRACT.md`, with the same
  SHA-256 and chunk rules. Do not change the BLE contract until the current transfer bug is fixed and the physical test passes.
- The record is sent whenever a plan is sent, and a "send PR only" action can send it for a segment that has no plan.

## Work split

- **Codex (Karoo):** design note first (concurrency model, headline selector, rendering), then implementation behind the existing dev
  flag; parser support for `segmentRecord`; tests with a fake multi-segment ride (the Diablo pair is a good fixture).
- **Phone session:** builder for `segmentRecord`, fixtures shared with Codex, a "send PR" path; later the BLE resource. Held until the
  Karoo parser exists.
- **Coordinator:** QA against this document and the live behavior on the Karoo (read-only checks).

## Open questions

- Should reverse-direction or partial attempts count toward a PR? Suggest no: completed, directed, accepted attempts only.
- Concurrent segment cap and how to show a fifth (suggest ignore with a diagnostic).
- Should a segment that is *entered mid-way* (rider joins the route after the start) ever be tracked? Out of scope here.
