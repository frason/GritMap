# Handoff: Karoo transfer listener recovery fix

- Updated: `2026-10-01 17:24 PDT`
- Agent: `Codex`
- Branch: `main`
- Worktree: shared and dirty; this milestone is uncommitted.

## Outcome

Fixed the Karoo phone-transfer receiver failure reported by Claude. The receiver previously
accepted exactly one TCP connection; a bare `nc -z` probe, abandoned client, malformed request,
or partial connection caused parsing to throw and permanently closed the manual receive session.
It now keeps accepting until one complete valid POST arrives, the user cancels, or the overall
timeout expires. Stop/cancel now closes cleanly as an empty receive result.

Segment Performance was also adjusted so expected finish is once again the dominant number in
large and compact layouts, while keeping the gradient time bank and split chart beneath it.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/HttpSegmentInbox.kt`
- `apps/karoo/app/src/test/java/com/gritmap/karoo/importing/HttpSegmentInboxTest.kt`
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/SegmentPerformanceBitmapRenderer.kt`
- `apps/karoo/app/build.gradle.kts`: `0.10.23`, code 46.

## Verified

- Added regression coverage for a bare TCP probe followed by a successful valid transfer.
- Added coverage for malformed requests followed by a successful valid transfer.
- `./gradlew testDebugUnitTest assembleDebug`: passed, 87 actionable tasks.
- ADB install succeeded on `00442GA241760203`; installed package reports `0.10.23`/46.

## Important correction to prior diagnosis

The earlier `nc`-succeeds then `curl`-refused sequence was itself destructive: `nc` consumed the
old one-shot accept and caused the server to close before curl ran. TCP reachability was valid,
but the probe sequence exposed the lifecycle bug rather than proving an accept loop was stuck.

## Next safe action

On Karoo open **Receive from Phone**, then retry **Send pacing plan to Karoo** from the phone.
Do not run a network probe first; although probes are now tolerated, the phone send is the actual
end-to-end acceptance test.
