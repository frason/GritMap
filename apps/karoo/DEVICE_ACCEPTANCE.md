# Karoo 3 acceptance checklist

- [ ] Install the ARM64 debug APK on a Karoo 3 running Android 12/API 31.
- [ ] Grant overlay permission and verify native Karoo controls receive every touch.
- [ ] Deny overlay permission and verify the official graphical data field still works.
- [ ] Start a recorded ride; confirm streams are inactive before recording and active during it.
- [ ] Verify overlapping candidates rank deterministically and lock after 50 m.
- [ ] Verify reverse traversal and an endpoint-only alternate route never activate guidance.
- [ ] Leave the corridor, reacquire within 10 seconds, and confirm the attempt continues.
- [ ] Remain off-route for more than 10 seconds and confirm abandonment/overlay teardown.
- [ ] Disconnect each required sensor; guidance freezes while geometric matching continues.
- [ ] Verify provisional guidance appears immediately and Needle replaces it within 5 seconds,
      or the provisional plan remains when inference times out.
- [ ] Verify the Compose overlay and Karoo data field convey the same semantic state.
- [ ] Record Room write counts during a long simulation: no writes on ordinary 1 Hz ticks.
- [ ] Kill/restart the process and confirm checkpoint recovery does not fabricate completion.
- [ ] Capture time-to-first-token, total inference time, native allocation, total RSS, CPU,
      temperature, and battery impact.

