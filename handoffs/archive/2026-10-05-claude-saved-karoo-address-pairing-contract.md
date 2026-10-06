# Handoff: phone remembers the Karoo address; pairing contract drafted for Codex

- Updated: `2026-10-05`
- Agent: `Claude`
- Branch: `main`
- Head: `d739851` -- **everything below is uncommitted** (together with the earlier
  `2026-10-05-claude-coach-plan-contract.md` work)
- Worktree: Codex's `apps/karoo/`, `ios/`, `docs/PLAN_*` and other archives untouched.

## Why

Rider verdict on the phone-to-Karoo connection: typing a local IP is "terrible". Diagnosis from the
code (`HttpSegmentInbox.kt`) and from the Karoo's own database after the 2026-10-05 transfer:
one-shot listener behind a button, a `200` written before the import runs, no authentication, no
read path, address typed every time. (That transfer did import -- onto a new segment "Realize"
(1,796 m) because the phone's route differs from the Karoo's old "Relize" (1,907 m); different
geometry is a different fingerprint, so the Karoo kept both. The rider was looking at the old one.)

## Done (phone only, no Karoo change)

- Migration **v12** `app_settings` (schema `user_version` now 12); `src/db/appSettings.ts`.
- `src/karoo/savedKarooAddress.ts`: after a send succeeds, the address is stored as canonical
  `host:port`; both send screens (`SegmentDetailScreen`, `SendToKarooScreen`) pre-fill it. Never saved
  on failure, so a typo cannot overwrite a good address.
- `src/karoo/describeSendResult.ts` + `unreachable` flag on send results (set only when a request was
  attempted and got no HTTP answer; address-validation errors are no longer reported as unreachable):
  "Couldn't reach <address>. Is the Karoo on 'Receive from Phone' ... address may have changed".

## Proposed (Karoo work, for Codex) -- `docs/KAROO_PAIRING_CONTRACT.md`

Phase 1: `GET /ping` (+ capability list = the handshake the coach-plan contract needs); respond to
`POST /transfer` *after* import with `imported` / `rejected: <reason>`; authenticated `GET /segments`.
Phase 2: persistent receiver + QR pairing (QR carries a one-time 256-bit key; both sides derive the
secret locally, so nothing secret crosses the network) + HMAC-signed requests with timestamp/nonce.
Phase 3 (optional): NSD service for IP changes. Phase 4: duplicate-segment warning, "installed on
Karoo" status. Open assumptions to verify on the device are listed at the end of that doc.

## Verified

- `npm run typecheck` clean; `npm test` **426/426** (new: saved address 4, describeSendResult 3,
  unreachable-vs-invalid-address 2 per send function, migration v12 via the version assertions).
- Not live-checked: pre-fill and the new error text on a device.

## Hazards and blockers

- Same commit-boundary hazard as the coach-plan handoff: `sendSegmentToKaroo.ts`,
  `sendGuidancePackageToKaroo.ts` and `SendToKarooScreen.tsx` also carry Codex's uncommitted
  `karooTransferEndpoint` change (and `savedKarooAddress.ts` imports it), so the endpoint files
  (`karooTransferEndpoint.ts`, `.test.ts`) must be committed with them.
- The saved address goes stale when the router reassigns the Karoo's IP; the first failed send then
  shows the "address may have changed" message and a successful send with the corrected address
  replaces it.
- Phases 2-3 add native phone dependencies (`expo-camera`, a Bonjour module): they need a dev-client
  rebuild, and the iOS permission strings noted in the contract.

## Next safe action

Codex reviews `docs/KAROO_PAIRING_CONTRACT.md` (start with Phase 1 items 2-3: small, and they give the
phone a real "imported / rejected" answer). Rider: reload the phone app and confirm the address
pre-fills after one successful send.
