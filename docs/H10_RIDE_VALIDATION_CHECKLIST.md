# GM H10 Cardiac physical validation

Use this checklist for the first exercise validation of `GM H10 Cardiac`. The field is experimental
and advisory; it never changes the pacing plan.

## Before the ride

- Confirm the GritMap version and build on the **Segments** screen.
- Add **GM H10 Cardiac** and **GM Cardiac Drift** to a ride page.
- Wear the saved Polar H10, start a recorded ride, and approach a loaded segment with a plan.
- Use an active segment lasting at least three minutes. Six minutes or longer is preferable for the
  full drift presentation.

## During the segment

- Confirm ordinary heart rate remains visible on the Karoo.
- Watch `GM H10 Cardiac`: it should show `COLLECTING RR`, then publish a live alpha-1 value after
  approximately two minutes of sufficiently clean RR data.
- Check that the value is readable under effort and does not flicker between a number and waiting.
- Note any signal warning, dropout, frozen value, blank field, or extension slowdown.
- Check `GM Cardiac Drift`: short data should show HR response, then emerging drift, then full drift
  on a sufficiently long effort. H10 context must remain supplemental.

## Immediately after the ride

- Photograph both cardiac fields before leaving the ride screen.
- Open **GritMap > Settings > Diagnostics**, tap **Refresh Diagnostics**, and photograph the latest
  events.
- Export the FIT file. Do not reinstall or clear GritMap before collecting the diagnostics.
- Record the approximate time when alpha-1 first appeared and any dropout interval.

## Post-ride comparison

Compare the displayed alpha-1, RR validity, and dropout behavior with the saved RR artifact. Report:

- total RR observations and valid percentage;
- time from capture start to the first qualified alpha-1 value;
- minimum, median, and maximum displayed/calculated alpha-1;
- number and duration of dropouts, including whether the field recovered;
- whether the ordinary cardiac field continued working throughout;
- whether text and status were readable while riding.

A beta-blocking issue is any crash, sustained Karoo slowdown, loss of ordinary HR, missing artifact,
or failure to recover after a brief H10 dropout.
