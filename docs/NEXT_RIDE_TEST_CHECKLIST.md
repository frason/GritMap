# Next ride: what to test

Updated 2026-10-05. Build under test: **Karoo GritMap 0.10.40 (code 63)**, already installed on your
Karoo. The source tree contains an offline 0.10.41 RR-gap candidate, but it is deliberately not installed
until this clean approach test is complete. The phone also has Claude's uncommitted Plan vs Actual work
(445 passing tests; reload the app). Tick the boxes, write notes
in the margins, and hand the filled-in file (or a photo of it) back; the "What to bring back" section at
the end says what evidence to pull.

**Safety first.** Wattage targets are guidance, not orders. The "Realize" coach plan asks for 420 W
(150% of FTP) in its last 100 m -- ride to how you feel. Don't look at the screen in traffic.

Automatic approach never scans for a new strap. It reconnects only the H10 you previously confirmed
in diagnostics. Codex verified that your preferred H10 address is now saved on this Karoo.

**Don't, during or before this ride:** force-stop, reinstall or "Clear data" on GritMap (it would lose the
saved H10, the segments and the plans); open Polar Beat or any other app that connects to the H10; start
the ride with Karoo Bluetooth off.

---

## 1. At the desk (about 20 minutes, the evening before or before you leave)

### Phone (plan-transfer checks are optional if the correct plan is already on the Karoo)
- [ ] Reload the phone app (shake -> Reload). It opens normally (database upgrades to v12 on launch).
- [ ] Open **Realize** -> 3-dot menu -> **Import coach plan** -> **Share request**. The share sheet opens with
      the segment's distance, grade table, rules and a JSON template. (Send it to yourself.)
- [ ] Paste the template back -> **Check plan** says "Plan looks good" with a chart -> **Use this plan**.
      Back on Realize the section shows "Coach plan" / "AI coach plan", zones, average watts.
- [ ] Break the plan on purpose (e.g. change one watt value to 600) -> **Check plan** lists the problem in
      plain words and **Use this plan** is not offered.
- [ ] Open Realize's **Goal & Pacing Plan**: the Karoo address is **already filled in** from last time.
- [ ] **Send plan to Karoo** with the Karoo on its "Receive from Phone" screen. Phone says "Sent". Karoo shows
      the import succeeded.
- [ ] Turn the Karoo's receive screen off and send again: phone says "Couldn't reach <address>... may have
      changed" (not a raw network error).
- [ ] Change your FTP by 1 W (Zones settings) -> Realize shows the **"written for an FTP of 280 W; yours is
      now 281 W"** warning and the send button is disabled. Change FTP back to 280 -> warning clears.
- [ ] **Use GritMap's generated plan instead** -> the plan is regenerated from FTP + goal; send it; the Karoo
      replaces the coach plan.
- [ ] Decide what you will ride on the Karoo (see "Relize vs Realize" below) and send *that* segment's plan last.

### Karoo
- [ ] About shows GritMap **0.10.40**. Battery full. H10 strap charged/moist, fits snugly.
- [ ] Karoo's own sensor page shows the H10 as the **ANT+** heart-rate sensor (that is how your earlier FIT files
      recorded it). Karoo records HR from ANT+; GritMap listens separately over Bluetooth for RR.
- [x] Preferred H10 saved and verified by Codex. **Do not open H10 Diagnostics before or during the ride**;
      tomorrow's purpose is to prove that approach detection reconnects it automatically.
- [ ] Defer the optional process-kill recovery test until **after** this ride; opening diagnostics or
      force-stopping now would compromise the clean automatic-approach test.
- [ ] Karoo Bluetooth permission for GritMap already granted (it is on this Karoo).
- [ ] Segments installed: **Realize** has the plan you just sent (18 zones for 1,796 m).
- [ ] Do not reinstall/update GritMap tonight or tomorrow morning; About must still show 0.10.40/code63.

### Relize vs Realize (read once)
The Karoo has two segments: the old hand-made **Relize** (1,907 m, 3-zone plan from Aug 22) and the new
**Realize** (1,796 m, the phone's route). Different geometry means a different segment. The Karoo matches the
route you ride against both; whichever one's start/finish you actually cross is the one that activates. Note
which one(s) activate in section 2.

---

## 2. During the ride (things you can see on the bike)

Ride the segment(s) normally. You are checking that nothing interferes with the ride first, and that the
features work second.

### Ride is not disturbed (check these first)
- [ ] Karoo records the ride normally: power, cadence, GPS, ANT+ HR all present, no dropouts, no screen lag around
      the time you approach a segment (when the H10 Bluetooth warm-up happens).
- [ ] Battery drain feels normal (note % at start and end, ride length).

### Segment guidance
- [ ] Segment entry alert appears when you cross the start (and *not* before, and not on the wrong segment).
- [ ] **Pacing Coach field**: shows the right plan and `x/18 ZONES` (Realize) -- zone counter advances about
      every 100 m, not every quarter mile.
- [ ] Zone stack order: future target-only zones above the current one, completed zones below with a frozen
      average; actual power fills the current bar; recommendation banner (REST/HOLD/PUSH) matches the plan.
- [ ] Large and compact layouts are both legible in daylight.
- [ ] Zone transitions look smooth (stepped conveyor, about 1 Hz is expected).
- [ ] **Map pacer** symbol moves along the route ahead/behind you in a way that matches your actual
      ahead/behind; it disappears after the segment ends.
- [ ] Karoo's own time-bank / quarter-mile splits vs the plan's 100 m zones: note if the mismatch is confusing
      (known, expected hazard).
- [ ] Segment completion alert appears at the finish; the time shown is believable.
- [ ] Optional: ride the segment in the **reverse direction** or only half-way -> guidance must *not* start
      (reverse traversal / endpoint-only never activates).
- [ ] Stop at a light (auto-pause) and resume mid-ride: nothing breaks.

### Notes (anything odd, with rough time / place)
-

---

## 3. After the ride (same day, at the Mac)

### End the ride the normal way
- [ ] Stop and save the ride on the Karoo as usual. Don't force-stop GritMap first.

### Pull the evidence (Karoo connected by USB)
```bash
ADB=~/Library/Android/sdk/platform-tools/adb
mkdir -p ~/Desktop/ride-$(date +%F) && cd ~/Desktop/ride-$(date +%F)
$ADB exec-out run-as com.gritmap.karoo cat files/diagnostics/live-segment.log > live-segment.log
for f in $($ADB shell run-as com.gritmap.karoo ls files/physiology | tr -d '\r'); do
  $ADB exec-out run-as com.gritmap.karoo cat files/physiology/$f > "$f"; done
shasum -a 256 *.rr
for f in gritmap-karoo.db gritmap-karoo.db-wal gritmap-karoo.db-shm; do
  $ADB exec-out run-as com.gritmap.karoo cat databases/$f > $f; done
```
(`live-segment.log` is the app's own bounded 256 KB event log, which holds several hours; the Android
logcat buffer is only 1 MiB and overwrites in ~20 minutes, so don't rely on it.)

### Read the log: the expected sequence
**How the capture works in 0.10.40 (read this first):** RR is captured **around segments, not for the whole
ride.** It starts when you come within about 250 m of a saved segment's start, and stops and saves
**about 2 minutes after the segment ends** (or after 3 minutes if you approach and never enter). So expect
**one `.rr` file per segment effort**, not one per ride; if you ride two segments less than 2 minutes apart they
share one file. A capture is only saved at ride end if one is still running then.

Open `live-segment.log` and look for these in order for each segment you rode:
- [ ] `ride_state state=Recording`
- [ ] `segment_approaching` (about 250 m before the start)
- [ ] `h10_approach_requested`, then `h10_auto_reconnect`, then `h10_auto_state` transitions through
      `CONNECTING` / `DISCOVERING` / `SUBSCRIBING` / `CONNECTED`, then
      `h10_auto_capture_started` -- all **before** `attempt_started`
- [ ] `candidate_discovered` / `candidate_selected`, then `attempt_started`, then `attempt_finished`
- [ ] about 2 minutes after the finish: `h10_capture_saved reason=segment-ended samples=<N>` and
      `h10_auto_released reason=segment-ended` (if you rode on and the 2 minutes passed mid-ride)
- [ ] at ride end, only if a capture was still running: `ride_state state=Idle`, then
      `h10_capture_saved reason=ride-ended samples=<N>`
- [ ] **No** `h10_capture_save_failed`, `telemetry_processing_failed`, `telemetry_update_rejected`; if you see
      `h10_auto_skipped`, write down its reason.
- [ ] If the strap slips or H10 drops out, expect `h10_auto_retry_scheduled` and
      `h10_auto_retry_started` using bounded 2s/5s/10s delays. A successful retry returns to `CONNECTED`;
      exhaustion logs `h10_auto_fallback` and continues with Karoo ANT+ HR. Karoo HR must remain unaffected.

`h10_rr_gap` is not expected in this ride: that marker belongs to the offline 0.10.41 candidate and will
be tested separately after this 0.10.40 approach test.

### Check the RR file
- [ ] A finalized `.rr` exists for each segment you rode and **no** new `.rr.partial` was left behind (the older two-record
      partial from the failed Activity-owned test is expected and harmless).
- [ ] File size = 16 + 14 x samples bytes (the log's `samples=N`).
- [ ] Sample count is plausible for the capture window (approach + segment + 2 minutes): roughly
      window-seconds x average-HR / 60 x (valid fraction ~ 0.9+). Example: a 10-minute window at 150 bpm is about
      1,500 samples.
- [ ] Mean heart rate from RR (60000 / mean RR in ms) over the segment is within about **2 bpm** of the Karoo
      FIT's heart-rate average for the same stretch. (The `.rr` header holds the capture's start wall-clock time;
      record times are offsets from it.)

After pulling the FIT, live-segment log and RR artifacts, the source tree can produce the comparison report
(the analyzer accepts both the installed schema-1 artifacts and the offline schema-2 format):

```bash
npm run analyze:karoo-ride -- --fit ride.fit --log live-segment.log --rr capture.rr
```

### Plans on the Karoo (from the database copy)
```bash
sqlite3 -readonly -header -column gritmap-karoo.db \
  "select substr(id,1,8) id, substr(segmentId,1,8) seg, datetime(createdAtMs/1000,'unixepoch','localtime') created, source, generatorModelVersion mv, ftpWatts, isBaseline from pacing_plans order by createdAtMs;"
```
- [ ] The plan you sent last for the ridden segment is the baseline (`manual` / `ai-coach` for a coach plan,
      `phone-ai` for the generated one).

### Bring the ride back to the phone
- [ ] Get the ride's FIT file off the Karoo the way you did for earlier rides and import it on the phone.
- [ ] The ride appears in the list **with a route thumbnail**.
- [ ] The phone detects an attempt on each segment you rode (Realize / Diablo...).
- [ ] The phone's attempt time is within about **2-3 seconds** of the time the Karoo reported at the finish.
      If they differ more, write both numbers down -- that is a matcher disagreement worth investigating.
- [ ] Open the ridden segment -> **Your Efforts** -> **Plan vs actual** (or use **Compare with your pacing
      plan** from attempt review). Confirm the zone bars/table match how the effort felt: actual average,
      zones on target, early/late fade, and biggest miss.
- [ ] Record which plan the comparison used. The current implementation compares against the segment's
      **current** plan, which may not be the exact historical plan ridden if it was replaced afterward.

### Battery / heat
- [ ] Battery % used per hour is similar to a ride without GritMap's H10 capture (note both if you know).
- [ ] Karoo did not feel hot.

---

## 4. What to bring back (so we can act on it)

- [ ] `live-segment.log`, the `.rr` file(s), the `shasum` output, `gritmap-karoo.db*` (the copies above)
- [ ] The FIT file
- [ ] Your ticked-off copy of this checklist with notes, plus anything that looked wrong on the screen
      (a photo of the Pacing Coach field at the odd moment helps)
- [ ] Which segment(s) activated, and ride date/time

### Quick results table (fill in)

| Area | Pass / fail | Notes |
|---|---|---|
| Ride recorded normally (power/cadence/GPS/HR) | | |
| Approach H10 auto-connect (log sequence) | | |
| RR capture saved (about 2 min after each segment) | | |
| RR heart rate vs FIT heart rate (within ~2 bpm) | | |
| Pacing Coach: plan, zone counter, transitions | | |
| Map pacer | | |
| Segment entry/completion alerts | | |
| Reverse/partial traversal did not activate | | |
| Phone attempt time vs Karoo time (within 2-3 s) | | |
| Phone Plan vs Actual matches the effort | | |
| Battery / heat | | |

---

## For Codex

After the ride, Codex should pull the Karoo-side log/artifacts, compare the sequence above, and record
the physical result in a dated archive entry. Preserve the `Realize`/`Relize` distinction and the 100 m
plan-zone versus quarter-mile split distinction when interpreting results.

### Observed short ride — 2026-10-06

- Installed build remained `0.10.40`/code63.
- No planned segment was ridden, so attempt entry, pacing guidance, map pacer and completion were
  not exercised.
- The Coco Jumbo coarse approach trigger fired. The saved preferred H10 connected in 3.2 seconds,
  capture started in 3.2 seconds, and there were no retries or fallback.
- Ride end finalized a schema-1 RR artifact with 236/236 valid samples, no gaps, no trailing bytes,
  238.3 seconds of coverage and an RR-derived mean of 59.2 bpm.
- The exported FIT contains 238 ordinary HR points from a Polar ANT+ heart-rate device. Over the RR
  capture window its mean was 59.6 bpm, only 0.4 bpm above the independently captured Bluetooth RR
  result. This passes the 2 bpm agreement criterion and confirms simultaneous ANT+ FIT HR plus BLE RR.
- One extension-created background-service start was denied by Android, but the map-layer start
  succeeded about 0.8 seconds later; telemetry then ran through ride end with no crash.
- FIT comparison passed; this ride contained no power or cadence data, as expected for the short test.
