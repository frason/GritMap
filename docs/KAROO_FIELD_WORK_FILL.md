# Karoo field changes: accumulated work and legibility

Requested by Jason 2026-10-20. He confirmed actual accumulated work versus planned work for Pacing Coach.
Installed on the connected Karoo as `0.10.44-fields1` / versionCode 70 on 2026-10-22. No public release; the installed field source is committed in `c9da364`.

## Pacing Coach

The active section has 1.5 times the original row height (revised by Jason 2026-10-21), with its contents scaled by the same height.
Past/future context stays smaller. The colored fill moves left to right across the full block from actual integrated
work, and a vertical white line moves from target watts integrated over the same elapsed time.
For example, 250 W for four seconds contributes 1000 J actual work; a 200 W target contributes 800 J.
A fill to the right of the line means more work than prescribed over that interval, not proof of being faster
along the route. Existing target-power guidance is unchanged.

Full scale uses target watts times the existing planned section-duration estimate: total planned finish
seconds multiplied by section distance / total distance. It is labeled EST. SCALE because the current
plan contract has no per-section time anchors. Actual adaptive boundaries are retained, including sections
shorter or longer than a quarter mile. No finish target means NO TIMED WORK GOAL rather than an invented
budget. Above full scale, the caption reports actual/target percentages. No plan/wire change is made.

`SectionWorkTracker` uses trapezoidal power integration and splits boundary-crossing intervals by their
fractional distance. Missing power or a gap longer than five seconds invalidates actual fill for that
section rather than inventing joules; coasting with valid 0 W remains real zero work. Duplicates cannot
count twice. Changed plan zones reset the work history. Coach averages use work/time when complete work
is available, with the previous power history fallback otherwise. All section budgets are visual estimates.

## Pacing Profile

The PACE card between TARGET and ACTUAL is removed. Those two cards now share the space, are taller,
and have larger values/labels. Compact metric values, route annotations, contour numbers, and elevation
axis numbers are enlarged. The large bitmap now owns its title and action/timing banner, with duplicate outer headers hidden; left-side route elevation labels, a small white rider dot and brighter terrain were added on 2026-10-21. Three elevation ticks replace four to retain space; units move to the lower
right of the profile.

## Cardiac drift and H10

The existing 120-second window remains. Baseline establishment now requires steady power; drift is
withheld if window power CV exceeds 12% or average power differs by more than 15% from baseline.
These are engineering qualification rules, not validated medical thresholds. The default EMA coefficient
is 0.05 at one second and scales with elapsed time instead of packet count. Missing data ages out;
long interruptions reset the reference. Valid-time counting excludes invalid samples. This prevents
variable-power response and old data from masquerading as a current drift value; it does not force a
physiological number toward zero. Real-ride behavior is not yet validated.

GM H10 Cardiac is a separate existing field. In GM Cardiac Drift, the H10 strip is now visible when a
connection is starting/connected or RR data exists; it no longer silently waits for a six-minute effort.
It says connecting, waiting for RR, signal quality or collecting while unqualified. Alpha-1 is shown only
when enhanced metrics are available, alpha exists, and valid RR is at least 95%; the existing RR-window
qualification remains. ANT+ BPM in FIT does not establish a BLE RR connection. No H10 device was connected
or measured during this implementation; ADB listed no device.
