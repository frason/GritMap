# Handoff: Karoo phone-transfer receive window extended

- Updated: `2026-10-01 19:48 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: `apps/karoo/app/build.gradle.kts`, `MainActivity.kt`, and `HttpSegmentInbox.kt` include this uncommitted fix among substantial concurrent uncommitted Karoo/phone work.

## Outcome

Live diagnostics proved the failed phone send did not reach the Karoo because its manual HTTP
receiver had already expired. The Mac (`192.168.7.38`) could ping the Karoo (`192.168.7.32`), but
TCP port 8734 returned `Connection refused`. The receive window is now ten minutes rather than two,
and the Karoo status text explicitly states the ten-minute window.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/HttpSegmentInbox.kt`: default timeout increased from 120 seconds to ten minutes; exported `DEFAULT_TIMEOUT_MINUTES` for UI copy.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/MainActivity.kt`: waiting status now says `Waiting 10 min for phone…`.
- `apps/karoo/app/build.gradle.kts`: bumped to `0.10.24` / code 47.

## Verified

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew testDebugUnitTest assembleDebug` — passed.
- Live LAN checks: both devices are on `192.168.7.0/24`; Karoo ping passed; port 8734 refused after the old receiver timed out.
- `adb install -r .../app-debug.apk` — succeeded; device reports `0.10.24` / code 47.

## External state

- Karoo device `00442GA241760203` has version `0.10.24` installed with existing app data preserved.
- The Karoo was locked after diagnosis; the user must unlock it and tap **Receive from Phone** to start a fresh receiver.

## Hazards and blockers

- A real phone-to-Karoo transfer has not yet succeeded end-to-end after this timeout change.
- The receiver intentionally remains manual and expires after ten minutes; it is not a permanent background server.
- The worktree contains extensive concurrent uncommitted UI and phone work; do not discard or mass-format it.

## Next safe action

Unlock the Karoo, tap **Receive from Phone**, confirm the status says `Waiting 10 min`, then immediately retry the phone send using `http://192.168.7.32:8734/transfer` and inspect both device logs if it fails.
