# Segment Sync: Design Proposal (NOT IMPLEMENTED)

Status: design review only, per explicit instruction. Nothing in this document has been
built. This proposes how segments (and eventually rider history) get from the main GritMap
app to the Karoo device without ADB and without relying on `ACTION_OPEN_DOCUMENT`, which
real-device testing confirmed Karoo does not support.

## 0. The gap this has to work around

The main GritMap app (React Native/Expo, see `docs/` at the repo root) is **local-first
with no backend** — that's an explicit, deliberate MVP decision (`docs/MVP.md`: "No cloud
sync work needed for MVP"). Meanwhile, `karoo-ext`'s only relevant capability is
`OnHttpResponse.MakeHttpRequest` (`vendor/karoo-ext/.../KarooEvent.kt`) — the Karoo can
**only make outbound HTTP requests**, routed over Wi-Fi or (if supported) BT to a paired
Hammerhead Companion app. There is no inbound webhook/push capability documented anywhere
in the vendored SDK. That combination means:

- The Karoo must be the one to *initiate* every sync — it polls, it is never pushed to.
- Something has to be listening at a URL the Karoo can reach. The phone app currently has
  no server of any kind.

**This is a real scope decision the two possible designs below resolve differently, and
I don't think it should be picked silently — see §7.**

## 1. Protocol — two tiers, pick one (or both, in sequence)

### Tier A: local-network only, no new backend (recommended starting point)
The phone runs a small local HTTP server (a few routes, in-process with the Expo app —
Expo/RN can host a local server via a native module, or a companion lightweight process)
while both devices share a network: home Wi-Fi before a ride, or the Karoo joined to the
phone's personal hotspot. The Karoo polls `http://<phone-local-ip>:<port>/sync` on a timer
(app foreground, e.g. every 15-30s) and on demand (user taps "Check for segments" in the
Karoo app's extension UI).

- **No new infrastructure.** Consistent with the main app's local-first MVP stance.
- **Real limitation, stated plainly:** doesn't work if the two devices aren't on the same
  network — i.e., not mid-ride, not away from home Wi-Fi/hotspot. Fine for "prep your
  segment the night before"; not fine for "define a segment during today's ride and use it
  tomorrow from the road."
- Phone's local IP/port needs to be discoverable by the Karoo — either the user types it
  in once (shown on the phone app's sync screen), or mDNS/Bonjour discovery if Expo can
  host that reliably (needs a spike; not assumed here).

### Tier B: cloud-mediated inbox (what the ChatGPT report suggested)
A small hosted relay: phone pushes segment JSON to a cloud endpoint, Karoo polls the same
endpoint from anywhere with Wi-Fi/BT-companion connectivity. Works regardless of network
overlap between the two devices.

- **This requires standing up and paying for real backend infrastructure** — the thing
  the main app's MVP explicitly deferred. That's a legitimate scope expansion, but it's a
  cost/ops decision (hosting, uptime, who maintains it), not just an engineering task, and
  I don't think it should get bundled into "implement segment sync" without being named
  as its own decision first.
- If chosen, keep it minimal: no accounts system needed yet — a single per-installation
  shared secret (§2) is enough to scope one user's segments in one inbox row/blob. Don't
  build multi-tenant auth for a single-user MVP.

**Recommendation: build Tier A first.** It's genuinely useful today (the realistic
workflow is "define/edit a segment at home, sync before tomorrow's ride"), needs no new
infrastructure or ongoing cost, and doesn't foreclose Tier B later — the Karoo-side polling
client and the JSON wire format are identical either way; only the URL and how it's
discovered change.

## 2. Security / pairing model

No accounts exist yet on either side, so this needs to be lightweight and local:

1. On first launch, the Karoo app generates a random pairing token (e.g. 128-bit, shown as
   a short alphanumeric code, similar to how smart-TV apps do "enter this code on your
   phone") and stores it in Room (a new tiny `device_pairing` table, one row).
2. The phone app's sync screen has an "Add Karoo device" flow: user enters that code (or
   scans a QR code rendered on the Karoo's screen, if the extension UI can render one —
   worth checking, not assumed).
3. The phone stores the paired token alongside a device label. Every sync request the
   Karoo makes includes the token as a bearer-style header
   (`Authorization: Bearer <token>`); the phone (Tier A) or relay (Tier B) rejects
   requests with an unrecognized token.
4. **This is not cryptographically strong authentication** — it's a shared-secret
   pairing code, appropriate for "prevent a stranger on the same coffee-shop Wi-Fi from
   pulling your segments," not for anything with real security stakes. Good enough given
   the data involved (GPS segments and pacing plans, not payment/health-record-grade
   sensitive data) — but say so explicitly rather than imply it's more than it is.
5. Re-pairing (lost/reset device) just generates a new token; the phone's old token entry
   becomes stale and can be removed from the device list manually.

## 3. Wire format and the 100KB constraint

Reuse the existing segment JSON schema unchanged (`SegmentJsonParser.kt`'s
`schemaVersion: 1` format) — no new format needed, the Karoo app already parses it.

**Real, measured constraint, not theoretical:** `samples/Coco_Jumbo.segment.json` (55
points, a 533m segment) is 5.3KB. The project's actual motivating use case — a 6.5-mile
hill climb resampled at 10m — is roughly 1,046 points. At the same ~96 bytes/point, that's
**~100KB, right at `MakeHttpRequest`'s hard 100KB body limit** (enforced by a `check()` in
`OnHttpResponse.MakeHttpRequest` that throws `IllegalStateException("REQUEST_TOO_LARGE")`
before the request is even sent). This will bite on exactly the segment this whole project
exists for. Two mitigations, both worth doing rather than picking one:

- **Minify the JSON on the wire** (no pretty-printing, short but still self-describing
  keys aren't worth the churn — whitespace alone is the bulk of the win). Cuts maybe
  30-40%, not enough alone for the worst case.
- **Chunk segments across multiple requests** when a single segment's JSON exceeds a
  conservative threshold (say 80KB, leaving headroom): `GET /sync/segments/{id}?chunk=0`,
  `chunk=1`, etc., phone-side splits `referencePolyline` into point ranges, Karoo
  reassembles before parsing. This is the robust fix — handles segments of any length,
  not just today's specific one.

Rider history sync (profile/training loads/historical samples) should use the same
chunking approach if/when it's built — no reason to solve this twice.

## 4. Room transaction behavior

The existing `SegmentDao.insertDefinition()` uses `OnConflictStrategy.ABORT` on both the
segment row and its reference points (`Entities.kt`/`KarooDatabase.kt`) — **importing a
segment ID that already exists currently throws**, and `fingerprint` has its own unique
index, so even a different ID with byte-identical content also throws. Neither is
correct for a sync flow that will legitimately see the same segment again.

Proposed replacement logic in the sync-triggered import path (not necessarily changing the
existing manual-import path's semantics, which can stay strict):

```
importSegmentForSync(json):
  definition = parser.parse(json)
  existing = segmentDao.segment(definition.id)
  if existing == null:
    insert as today (ABORT is fine — this is genuinely new)
  elif existing.fingerprint == definition.fingerprint:
    no-op — this is a re-sync of something already present, not an error
  else:
    # same id, different content = the segment was edited on the phone since last sync
    transaction:
      delete old reference points for this id (cascade handles it)
      update segment row (new fingerprint/name/corridor/coverage)
      insert new reference points
      # segment_attempts referencing this id are NOT touched -- past attempts against
      # the old geometry remain historically valid records of what was actually ridden;
      # only new attempts use the updated reference polyline. Flag this choice for
      # explicit confirmation -- the alternative (invalidate/re-flag old attempts) is
      # defensible too, but silently picking one is exactly the kind of thing this
      # design review should settle before code gets written.
```

This needs one new DAO method (a real upsert, not `OnConflictStrategy.REPLACE` naively,
since `REPLACE` on the segment row would cascade-delete and orphan `pacing_plans`/
`segment_attempts` rows that reference it by FK — needs to be a deliberate
update-in-place, not a delete-and-reinsert).

## 5. Offline behavior

- The Karoo has no connectivity assumption at ride time — sync only happens when the
  polling loop successfully reaches the phone/relay; if it can't, the app just keeps
  using whatever's already in Room. This is already the right default given local-first
  storage; nothing needs to change here, just confirming the sync layer doesn't introduce
  a hard dependency on connectivity for core matching to work — it doesn't, by construction,
  since matching reads from Room, not from the network.
- Sync attempts should be silent/background by default (a small "last synced: 2h ago"
  indicator in the Karoo extension UI is enough), not a blocking dialog — consistent with
  `waitForConnection: false` for routine polls (don't queue and retry forever if there's no
  connection right now; just try again next cycle) versus `waitForConnection: true` only
  for a user-initiated "sync now" tap, where waiting briefly for a connection is expected.

## 6. Conflict / fingerprint handling

Fingerprint (`SegmentFingerprint.compute()` in `SegmentJsonParser.kt`) is already
deterministic and excludes mutable id/name — good, reuse it as the sync layer's dirty-check
without inventing a second mechanism:

- Phone-side sync endpoint (Tier A or B) can respond to a lightweight `GET /sync/manifest`
  first — just `{id, fingerprint}` pairs for every segment, well under any size limit even
  for many segments — so the Karoo only fetches full segment bodies for ids it's missing or
  where the fingerprint differs from what it already has. Avoids re-downloading unchanged
  segments every poll.
- True conflict (both sides edited) isn't really possible in this design, because segment
  *definition* editing only happens on the phone (the Karoo app has no segment-editing UI,
  only import + ride-time attempts) — so the phone is always the source of truth for
  segment content, and sync is one-directional for segments (phone → Karoo). The reverse
  direction (attempt results, checkpoints) syncing Karoo → phone is a separate, later
  concern not covered by this design (the ask was specifically about segment delivery to
  the Karoo) — flagging it exists but is out of scope here.

## 7. UI

- **Phone (Expo app):** a "Devices" or "Karoo Sync" screen — pairing flow (§2), a list of
  segments with sync status (synced / pending / this device doesn't have it yet), a manual
  "sync now" action. This is new screens in an app that currently has zero navigation
  beyond three tabs (per `docs/MVP.md`) — worth noting this is itself a real chunk of work,
  not a footnote.
- **Karoo (this app):** extend the existing `MainActivity` fallback-import screen (already
  built for the staged-file fallback) with a "Sync from phone" action alongside the
  existing "check staging folder" one, plus the small last-synced indicator from §5. Reuse
  `SegmentImportRepository`/`SegmentJsonParser` as-is for the actual parse+persist step
  once bytes arrive over HTTP instead of from a staged file — no new parsing logic needed.

## Open decisions this review should settle before any implementation

1. **Tier A only, or build toward Tier B eventually?** Recommend A now, explicitly defer B
   as a separate scoped decision (it has real hosting/ops cost).
2. **Segment edit-after-sync**: do past `segment_attempts` against an old geometry stay as
   historical record (recommended, §4), or get invalidated/flagged when the segment is
   re-synced with new content?
3. **Pairing UX**: typed code vs. QR code — depends on whether the Karoo extension surface
   can render a QR code at all (not confirmed here).
4. **Local network discovery for Tier A**: manual IP entry (simplest, works today) vs. mDNS
   auto-discovery (nicer, needs a feasibility spike on Expo).
5. Rider-history sync (profile/training load/historical samples) — same pattern as
   segments, deliberately not designed here since it wasn't the ask; flagging it'll need
   its own pass using the same chunking/manifest approach once segment sync is proven.
