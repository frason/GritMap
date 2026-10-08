# Handoff: real Coco Jumbo live-activation bug fixed and 0.10.41 installed

- Updated: `2026-10-06 20:43 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `9b5f594 feat: import a portable segment JSON file on the phone`
- Worktree: shared uncommitted tree; this milestone changes `LiveSegmentCoordinator.kt` plus the phone send-timeout files listed below

## Outcome

The 2026-10-06 20:04 Coco Jumbo drive did reach approach and discover the correct enriched segment, but the live coordinator erased the candidate and `ForwardProgressGate` after the first sample. Because the gate requires two consecutive forward increases, activation could never occur. The coordinator now retains a tracking candidate while direction confirmation is pending. GritMap 0.10.41/code64 containing this fix and the extension-to-service binding fix is installed on the physical Karoo.

The attached `Karoo-Evening_Ride-2026-10-06-2004.fit` independently matches Coco Jumbo at 100% coverage, 6.85 m maximum deviation, 3.25 m median deviation, zero backward movement and zero GPS gaps, proving the route definition was not the failure.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/service/LiveSegmentCoordinator.kt`: do not reset viable candidates while the forward-direction gate is still collecting confirmation samples.
- `src/karoo/fetchWithTimeout.ts` and `.test.ts`: phone transfers now abort after 15 seconds rather than remaining on `Sending…` forever.
- `src/karoo/sendSegmentToKaroo.ts` and `sendGuidancePackageToKaroo.ts`: use the bounded fetch helper.

## Verified

- Real FIT replay through the TypeScript matcher: accept, 100% coverage, 6.8498 m max deviation, no gaps.
- `:app:testDebugUnitTest` for matcher/service packages, `:app:lintDebug`, and `:app:assembleDebug` passed.
- Phone send tests (17), root typecheck, and the full 497-test root suite passed during this session.
- APK install succeeded. Physical device reports 0.10.41/code64 and retained `gritmap-karoo.db`.
- Post-install diagnostics show `service_bind_requested`, `service_created`, `karoo_observation_requested origin=bound`, `karoo_connected`, and `service_bound`.

## External state

- Physical Karoo `00442GA241760203` now runs 0.10.41/code64.
- Existing segments/plans and app database were preserved by `adb install -r`.
- Phone Expo dev server remains active on port 8081, so the JavaScript send timeout can reload without a native reinstall.

## Hazards and blockers

- The corrected activation path still needs a moving physical traversal; offline replay and the exact causal diagnostics are strong, but no second drive has occurred yet.
- The test ride had HR but no power or cadence. Tracking should still activate and show sensor warnings, but adaptive pacing will remain frozen without those sensors.

## Next safe action

Perform one short Coco Jumbo traversal with the GritMap field visible. Then read `live-segment.log`; expected sequence is `candidate_discovered`, followed after two forward increases by `candidate_selected` and an active attempt.
