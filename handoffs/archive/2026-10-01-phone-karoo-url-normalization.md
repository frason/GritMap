# Handoff: phone-to-Karoo transfer URL normalization

- Updated: `2026-10-01`
- Agent: `Codex`
- Branch: `main`
- Worktree: shared and dirty; changes are uncommitted.

## Outcome

The Karoo listener was confirmed healthy at `192.168.7.32:8734`, but the phone request never
reached it. The phone sender previously required only `host:port` while the Karoo UI displayed a
complete URL. Pasting that complete URL caused the sender to duplicate the scheme/path and iOS to
report that the hostname could not be found. Both segment and pacing-package senders now normalize
an IP, `IP:port`, or complete displayed URL to one canonical endpoint.

## Changed

- Added `src/karoo/karooTransferEndpoint.ts` and tests.
- Updated `src/karoo/sendGuidancePackageToKaroo.ts` and `sendSegmentToKaroo.ts`.
- Updated both phone address placeholders to say `IP or full Karoo URL`.

## Verified

- `npm test`: 351/351 passed.
- `npm run typecheck`: passed.
- Generic signed iOS device build: succeeded.
- Installed and launched `com.gritmap.app` on Jason's iPhone 15 Pro Max.
- Karoo `0.10.23` listener was observed bound to `*:8734` at `192.168.7.32`.

## Next safe action

Open **Receive from Phone** on Karoo and retry the pacing-plan send from the freshly installed
phone app. This real send remains the required end-to-end confirmation.
