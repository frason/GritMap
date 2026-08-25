# Handoff: Phone-to-Karoo local-network segment transfer, verified end-to-end on real hardware

- Updated: `2026-08-25 07:18 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `4423dee app: send saved segments to Karoo over local WiFi`
- Worktree: substantial uncommitted work remains in `apps/karoo/` (Codex's W′/cardiac-drift/UI
  work, see prior handoff `2026-08-24-2157-codex-active-routes-reserve-markers.md`) — untouched
  by this increment.

## Outcome

A segment saved on the phone can now be sent directly to a Karoo over local WiFi and shows up
in the Karoo's own segment library — no cable, no file staging, no cloud relay. This was the
"next safe action" flagged in the 2026-08-17 handoff (`Design and implement a local-network
companion transport that writes the existing versioned transfer package into the SegmentInbox
boundary`) and had not been started until this session.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/HttpSegmentInbox.kt` (new) —
  implements the existing `SegmentInbox` interface over a plain `java.net.ServerSocket`
  (karoo-ext's HTTP capability is outbound-only, confirmed by reading `KarooSystemService.kt`).
  Hand-rolled minimal HTTP/1.1 POST parsing (`Content-Length`-based body read, 405/411/413 error
  paths), hands the body to the existing `SegmentInboxProcessor` so it reuses the same
  duplicate/raw-segment dispatch logic as the file-based transport. Default port 8734.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/importing/HttpSegmentInboxTest.kt` (new) — 5
  tests against real `java.net.Socket`/`ServerSocket` connections (no mocking), ephemeral ports.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/MainActivity.kt` — new "Receive from Phone" /
  "Cancel receiving" button; shows the Karoo's LAN address and port to type into the phone.
- `apps/karoo/app/src/main/AndroidManifest.xml` — added `INTERNET` permission (required even for
  pure LAN sockets, not just outbound internet).
- `src/karoo/sendSegmentToKaroo.ts` (new) + test — POSTs `toPortableSegmentJson()` output to
  `http://{host}:{port}/transfer`; never throws, returns `{ok, statusCode?, message?}`.
- `src/screens/SegmentDetailScreen.tsx` — new "Send to Karoo" section: address `TextInput`
  (placeholder `192.168.1.42:8734`) + Send button + status text.
- `app.json` / `ios/` (regenerated via `expo prebuild`) — `NSAllowsLocalNetworking` +
  `NSLocalNetworkUsageDescription` in `NSAppTransportSecurity`; required or iOS's ATS silently
  blocks plain HTTP to LAN IPs. Use the narrow `NSAllowsLocalNetworking` exception, not the
  broad `NSAllowsArbitraryLoads`.
- Commits: `7f1aa77` (Karoo receiver), `4423dee` (phone sender). Both on local `main`, **not
  yet pushed** — `origin/main` is 10 commits behind; pushes have needed to be run manually by
  the user all session.

## Verified

- `./gradlew :app:testDebugUnitTest` — full suite incl. the 5 new `HttpSegmentInboxTest` cases,
  0 failures (had to fix a real bug first: the header-parser originally checked bare `\n\n`
  instead of `\r\n\r\n`, so every real HTTP request hung until the 15s socket timeout).
  `lintDebug` has one pre-existing failure in `WPrimeEngine.kt` (Codex's file, untouched by this
  work — not a regression from this change).
- `npm test` (root) — `sendSegmentToKaroo.test.ts` passes.
- **Real end-to-end, twice**, on two different phones:
  1. iOS Simulator + real connected Karoo: typed the Karoo's live LAN address into the phone
     UI, sent "Morning Climb" (25.3mi, 4066-point polyline), confirmed via `adb`-pulled copy of
     the Karoo's own Room DB that the segment row and all 4066 reference points landed intact.
  2. Jason's physical iPhone (real device build via `npx expo run:ios --device`, Metro reached
     manually at `192.168.7.30:8081` since Bonjour auto-discovery didn't find it) + the same
     Karoo: user did the send themselves through the real UI, confirmed success on the Karoo
     screen live.
- A direct `curl` POST of the exact real `Morning Climb` payload (pulled straight from the
  phone app's own SQLite file) was also used as an intermediate check when the iOS Simulator's
  touch-injection broke mid-session (see Hazards) — got a real `200 OK` from the Karoo.

## External state

- The Karoo has "Morning Climb" in its segment library right now (`corridorMeters=30`,
  `requiredCoveragePct=0.9`), persisted via this transport.
- The Karoo's receive listener is a one-shot, user-armed 120s window ("Receive from Phone"
  button) — not a persistent server. It is very likely **not currently armed**.
- Jason's iPhone now has a real device build of the dev-client app installed (separate from the
  iOS Simulator build). Both point at the same Metro instance on the Mac.
- **The Karoo's data-field demo mode may currently be running** (`Start/Stop data-field demo`
  toggle) — it got toggled on accidentally during this session's UI navigation more than once.
  Non-destructive (loops a canned segment without writing to the DB) but worth checking/stopping
  before it confuses a real ride test.

## Hazards and blockers

- **The iOS Simulator MCP control tool's touch injection broke mid-session** — confirmed
  simulator-wide (even the springboard stopped responding to taps) and survived a full
  simulator reboot. Root cause not identified. If it's still broken, real-device testing
  (`npx expo run:ios --device <udid>`) is the working fallback — code-signs automatically with
  `jfrason@gmail.com`'s Apple Development identity, no further account setup needed.
- The phone's "Send to Karoo" address field has no format validation — pasting a full URL
  (`http://…/transfer`) instead of bare `host:port` silently doubles up in the request URL and
  fails with a hostname-resolution error. Not fixed; low priority (worth a follow-up if this
  becomes a real usability complaint, not urgent).
- `apps/karoo/`'s ADB automation occasionally hit a hardware/OS quirk where a swipe near certain
  y-ranges triggers the Karoo's native navigation (ride data-field picker, home menu) instead of
  scrolling the app's own Compose UI. Recoverable via `KEYCODE_BACK` + `am start -n
  com.gritmap.karoo/.MainActivity`, but not root-caused.
- Nothing in this increment is pushed to `origin/main`. Issues #6 and #7 (segment definition,
  from an earlier increment this session) are also unpushed and so still show open on GitHub
  despite being done.

## Next safe action

Wire the existing matcher (confidence scoring + persistence) into segment-creation and
ride-import triggers — GitHub issue #30. The matcher logic itself already exists from earlier
in the session; "Attempts" sections on the ride/segment detail screens are still placeholder
text because nothing calls it yet.
