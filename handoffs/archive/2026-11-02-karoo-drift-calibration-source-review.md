# Handoff: Cardiac Drift indefinite collection source review complete

- Updated: `2026-11-02 America/Los_Angeles`
- Agent: `Codex`
- Branch: `codex/karoo-screen-redesign`
- Head before review documentation: `382c759 docs(karoo): record approved preview76 installation and startup`
- Worktree: only review document, this new archive and LATEST changed; no runtime edits. Documentation commit stays local pending push authorization.

## Outcome

Read main handoff6826089 and traced installed76 tracker, service, matcher, native streams and actual registered renderer. Found indefinite waiting paths and a concrete presentation ambiguity: a frozen baseline with incomparable workload produces null drift and is labelled initial baseline collection indefinitely. Not a proven cause of the owner's reported ride; original ride evidence is still needed.

## Changed

Added `docs/KAROO_CARDIAC_DRIFT_CALIBRATION_REVIEW.md`: complete gate table, version/history correction, explanation of per-segment lifetime, proposed readiness-reason fix and sampler follow-up, synthetic replay matrix, exact minimal evidence and optional owner-run logcat steps. Updated this branch's LATEST; no apps/karoo changes, wire changes or new tests.

## Verified

Source inspected: CardiacDriftTracker, ActiveAttemptSession/SensorFreshness, LiveSegmentCoordinator, LiveSegmentService/enrichLiveMetrics, GlanceGraphicDataType, GlancePresentation/GlanceFieldRenderer, LiveUiState, existing tracker/presentation tests, H10 renderer, service starter and diagnostics. Git diff installed-source efaf5f6 against fetched main6826089 showed no changes for tracker/coordinator/service paths. Main and installed tracker SHA256 both55825d67d10f7d1b36f46354446573d9f55953acf7a7aff397dff9410d780858. Reviewed d38057f and later c9da364 restrictions. No build/test/replay execution: proposed scenarios are source-derived predictions only. Existing280-test evidence belongs to prior installation work, not rerun here. git diff --check run before commit.

## External state

No device command, query, log pull, FIT read, install, new ride, publication, deployment or cross-chat message. Last verified install remains approved76/0.10.46-screen-preview on October31, source efaf5f6/runtime e7a7c45, 7 installed/7 ready library; not fresh device evidence or definitive reported ride version proof. Main's70 assumption and unapproved-redesign note are stale relative to this chat. Main unchanged. Runtime changes not proposed for direct device deployment.

## Goal alignment

Default Cardiac Drift reliability and useful live execution, GOALS beta loop / parallel cardiac track. Native power/HR metric, not H10 RR/DFA pipeline. No new contract needed for proposed reason display. Nearby Segments and reverse-BLE ride sync remain separate queued reviews, not completed by this work.

## Hazards and blockers

Tracker starts per matched segment, not per ride; requires finite power>=100W/HR>=80,180s eligible paired time (each interval capped2s),60 samples in120s window and powerCV<=12%. >10s invalid/gap clears reference/time; short segments, sparse GPS-ticked processing and variable power can prevent baseline indefinitely. Post-baseline mean outside +/-15% suppresses drift without rebase; UI calls it collection. Missing FTP/zones/plan/H10 RR is not a direct gate. Sensor freshness3s and recording/matching/service gates also matter. High cumulative paired percent is not readiness proof. No literal CALIBRATING in registered76 drift rendering path; async question asks actual field/title, unanswered at writing. Exact ride cause unconfirmed. Never fix by silently relaxing quality thresholds or auto-rebasing. Device reads/install remain approval-gated for this task. Do not downgrade76/Room4 to older73/74.

## Next safe action

Correlate original reported ride Karoo FIT (user supplies, local/private only), exact field wording and whether a segment was active. Proposed first fix: explicit readiness/reason state and honest useful HR-response fallback, with real-Kotlin replay tests for variable power, post-baseline workload shift, coasting resets, low power, repeated short attempts and sparse ticks before runtime changes. Main handoff asks no push without the owner's yes in this chat; review/handoff commit remains local, not pushed in this turn. Do not interpret source review completion as implementation/install approval.
