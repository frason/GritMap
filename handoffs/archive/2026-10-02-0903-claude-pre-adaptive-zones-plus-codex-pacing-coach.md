# Handoff: KGhost-informed Pacing Coach installed

Karoo `0.10.28`/code 51 redesigns the text-led GM Pacing Coach with segment/progress context,
Rest/Hold/Push plus signed pace relation, target watts, 3-second actual/delta, next-zone preview,
and explicit `LIVE`/`ESTIMATED`/`STALE`/`UNAVAILABLE` quality. Focused tests and APK assembly
passed; it is installed in place on the physical Karoo with app data preserved. Visual review in
large and compact field sizes is next. Details:
`handoffs/archive/2026-10-02-pacing-coach-quality-redesign.md`.

# Handoff: Karoo global FTP synchronization installed

Karoo `0.10.27`/code 50 uses `karoo-ext` `UserProfile.ftp` as GritMap's global rider FTP. Settings
shows the synced value; plans retain generation FTP only as provenance and become `PLAN OUTDATED`
when it differs, rather than failing import or silently rescaling. JVM/build checks passed and all
5 Room instrumentation tests passed on the physical Karoo. Live logs confirm the device currently
reports **FTP 290 W**. A location permission prompt is visible after testing; grant Precise location
before riding. Details: `handoffs/archive/2026-10-01-karoo-global-ftp-sync.md`.

# Prior handoff: Karoo segment detail navigation installed

Karoo `0.10.26`/code 49 makes every segment card navigable. The dedicated page shows plan status,
goal/source/zones/FTP/update date, matching configuration, receive/replace-plan routing, and safe
delete confirmation. Library delete buttons are gone. Physical-device tapping verified navigation;
a discovered reused-scroll-position issue was fixed before the final reinstall. Details:
`handoffs/archive/2026-10-01-karoo-segment-detail-navigation.md`.

# Prior handoff: Karoo library-first extension UX installed

Karoo `0.10.25`/code 48 replaces the long utility page with three destinations: Segments, Inbox,
and Settings. The default library now separates `NO PLAN` segments into Needs Attention and shows
goal/source/FTP/zone/date metadata for `PLANNED` segments. Transfer/imports and settings/diagnostics
are cleanly separated. Unit tests and assembly passed; the build is installed and visually checked
on the physical 480×800 Karoo. Details:
`handoffs/archive/2026-10-01-karoo-library-first-ux.md`.

# Prior handoff: Phone-to-Karoo transfer verified end to end

The client confirmed the physical iPhone successfully sent the package to the physical Karoo using
Karoo `0.10.24`. The live transport bug is resolved. The working path combines phone URL
normalization, a resilient Karoo HTTP accept loop, and a ten-minute manual receive window. Remember
that an APK install force-stops the MainActivity, so reopen GritMap and tap **Receive from Phone**
after installing a new build. Details:
`handoffs/archive/2026-10-01-phone-karoo-transfer-verified.md`.

# Prior handoff: Karoo phone-transfer receive timeout fixed

Live network diagnostics after the phone showed “Sending” then failed proved both devices were on
the same subnet and mutually reachable, but Karoo port 8734 was refusing connections because the
manual receiver's two-minute window had expired. Karoo `0.10.24`/code 47 now keeps the receiver
open for ten minutes and states that window in the UI. The full Karoo unit suite and debug assembly
passed, and the APK is installed with app data preserved. A real phone retry is still required.
Details: `handoffs/archive/2026-10-01-karoo-transfer-timeout-fix.md`.

# Prior handoff: BUG REPORT — Karoo transfer listener refuses live connections

## Phone URL fix installed

Codex confirmed Karoo `192.168.7.32:8734` was actively listening while the phone request never
arrived. The phone sender blindly wrapped its input with `http://.../transfer`, but the Karoo UI
shows a complete URL; pasting it produced a duplicated invalid hostname. Both phone transfer paths
now accept an IP, `IP:port`, or full displayed URL. All 351 tests and type-checking passed; a signed
iOS build was installed and launched on Jason's iPhone. Real phone-to-Karoo retry is still required.
Details: `handoffs/archive/2026-10-01-phone-karoo-url-normalization.md`.

## Resolution installed by Codex

The listener lifecycle bug described below is fixed and installed as Karoo `0.10.23`/code 46.
The old receiver accepted one TCP connection, so Claude's successful `nc -z` probe consumed the
session and made the following curl correctly see a closed port. The same failure could be caused
by any incomplete client. The receiver now tolerates probes/malformed connections and continues
until a valid POST, cancellation, or overall timeout. Regression tests reproduce probe-then-valid-
transfer and malformed-then-valid-transfer; the full Karoo suite and APK assembly passed. Segment
Performance now leads with expected finish again. The only remaining verification is a real phone
send while **Receive from Phone** is open. Detailed archive:
`handoffs/archive/2026-10-01-karoo-transfer-listener-fix.md`.

## Concurrent Segment Performance visual update

Codex rebuilt the Segment Performance field across large, medium, and small Karoo shapes and
installed `0.10.22`/code 45 on device `00442GA241760203`. It now has a result-first hierarchy,
large zero-centered gradient time bank, labeled horizontal quarter-mile split bars, a deliberate
pre-first-split state, contained bottom metrics, and dedicated compact layouts. Full Karoo unit
tests and APK assembly passed. This visual milestone does **not** fix the transfer-listener bug
reported below. Details: `handoffs/archive/2026-10-01-segment-performance-responsive-redesign.md`.

- Updated: `2026-10-01 17:12 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'` (clean -- nothing uncommitted
  from this investigation; no GritMap phone-app code was touched)
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` remain under
  concurrent Codex work (most recently the Segment Performance field, Karoo `0.10.21`/code
  44 -- see `handoffs/archive/2026-10-01-segment-performance-dashboard.md`) -- **this
  handoff is itself a bug report about that Karoo app's transfer-receiving code**, found
  during the client's own live testing, not something this session changed.
  `handoffs/LATEST.md` again had a Codex section appended since this session's own prior
  handoff; that combined content was archived verbatim to
  `handoffs/archive/2026-10-01-claude-segment-redesign-plus-codex-perf-field.md` before
  being replaced by this one.

## Outcome -- this is a bug report, not a feature increment

With the client's Oct 3 goal attempt 2 days out, the priority was live-verifying the
just-built pacing-plan Karoo transfer (`sendGuidancePackageToKaroo.ts`) actually works. It
doesn't, and the root cause is on the Karoo app's side, not the phone app's.

**Symptom**: tapping "Send pacing plan to Karoo" on the phone fails with:
```
Send failed: fetch failed: UnexpectedException: A server with the specified hostname
could not be found. (at ExpoModulesCore/Promise.swift:56)
```

**Diagnosis, done live against the real devices** (this Mac, the client's phone, and the
client's Karoo are all on the same WiFi network, confirmed):

1. Ruled out phone-side/app-config causes first: checked `app.json`'s and
   `ios/GritMap/Info.plist`'s iOS local-network permissions
   (`NSLocalNetworkUsageDescription`, `NSAppTransportSecurity.NSAllowsLocalNetworking`) --
   both correctly configured. Not an ATS/local-network-permission issue.
2. Tested the Karoo's address (`192.168.7.32:8734`, from its own "Receive from Phone"
   screen) directly from this Mac, which is unambiguously on the same subnet
   (`192.168.7.38`):
   - `nc -z -v -w 3 192.168.7.32 8734` -> **"Connection to 192.168.7.32 port 8734
     succeeded!"** every time (tested 3 separate times across the whole investigation).
   - `curl http://192.168.7.32:8734/transfer` (and a second curl run immediately after) ->
     **"Connection refused"**, every time, within ~1.1s.
3. Asked the client to fully force-quit and restart the Karoo app, then re-open "Receive
   from Phone" fresh (ruling out "the one-shot listener already consumed its single accept
   from an earlier failed attempt," since a full app restart should produce a genuinely new
   listener instance). **Same exact symptom persisted** -- same address shown, same
   TCP-succeeds/HTTP-refused split.

**Conclusion**: the TCP listen socket on the Karoo is open and completing handshakes at the
kernel level (hence `nc` succeeding), but whatever is supposed to `accept()` and service
that connection at the application layer either isn't running, is stuck, or is closing
connections before an HTTP request can be read -- and this reproduces identically after a
full app restart, so it is not a one-shot-already-used timing issue. This blocks **both**
Karoo transfer paths (the pre-existing bare-segment "Send to Karoo" and the new
pacing-plan send), since both share the same `/transfer` HTTP endpoint and the same
receiving code on the Karoo side.

## Where to look (Karoo app, `apps/karoo/`, not touched by this investigation)

Per this session's own earlier reads of this code (cited in prior increments' handoffs, not
re-verified line-by-line in this investigation since this session doesn't edit Karoo code):

- `apps/karoo/app/src/main/java/com/gritmap/karoo/.../HttpSegmentInbox.kt` -- described
  elsewhere in this project's own comments as "a user-initiated, one-shot listener, not a
  persistent server." Worth checking whether its accept loop is actually still running
  after whatever changed across the last several Karoo releases (`0.10.16` through
  `0.10.21`/code 44 landed in just the last two days, per the archive trail above) -- a
  regression in one of those recent passes is plausible given this previously worked
  (segment definitions were sent to this same Karoo earlier in the project's history).
- `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/ImportRepositories.kt` /
  `SegmentInboxProcessor.kt` -- the dispatch-on-`packageType` logic that would run once a
  connection is actually accepted; not reached at all here, since the failure is before any
  HTTP request completes.

## Verified

- Phone-side iOS permission configuration: confirmed correct (not the cause).
- Network reachability: confirmed working (TCP handshake succeeds from an independent
  machine on the same subnet).
- Application-layer HTTP handling on the Karoo: confirmed broken, reproducibly, across a
  full Karoo app restart.
- Not re-tested after this handoff was written -- next step is for whoever picks this up
  Karoo-side to reproduce against current `apps/karoo/` code and check the inbox server's
  accept loop / threading / lifecycle.

## External state

- Client's Karoo (`00442GA241760203`) was force-quit and restarted during this
  investigation, at the client's own action, prompted by this session. No other device
  state changed. No GritMap phone-app code or Karoo code was modified by this session.

## Hazards and blockers

- **This blocks the Oct 3 goal attempt's pacing-plan feature entirely** until fixed --
  with only 2 days left, this is the single highest-priority item in the whole project
  right now. It also blocks the plain bare-segment "Send to Karoo" path, which is
  longer-standing and presumably worked before -- worth checking whether a recent Karoo
  release (the rapid `0.10.16` -> `0.10.21` sequence over the last two days) introduced a
  regression here, versus this being a pre-existing-but-never-retested issue.
- This session will not attempt a Karoo-side fix (per the client's own earlier instruction
  to keep this session focused on the phone app) -- flagging this clearly so whoever drives
  the Codex session picks it up with the specific repro steps above rather than needing to
  rediscover them.

## Next safe action

Karoo-side: reproduce against current code, inspect `HttpSegmentInbox.kt`'s connection
accept/handling lifecycle for why TCP-level connections aren't reaching the HTTP layer,
fix, then have the client retry the exact same "Send pacing plan to Karoo" action from the
phone as the end-to-end verification (not just a unit test) -- this has never actually
succeeded on a real device and needs to before Oct 3.
