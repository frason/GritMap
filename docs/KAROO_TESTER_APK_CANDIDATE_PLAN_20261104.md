# Tester Karoo APK: proposed candidate and release gates

2026-11-04. Proposal only under main ea4290b top Karoo to-do item2 / tester sectionG. No APK built/signed here; no signing files read, device queried, installed or released.

## Recommendation

Prepare and validate a separately approved persistent-beta candidate for the existing cardiac countdown and Recent Segments source, without including new map or reverse-BLE behavior. Do not make the phone sign-in/liked rollout depend on these future features. The owner must decide whether testers get the current public Karoo version first or the new candidate after hardware validation. Public73 lacks the new screens; last independently observed device76 is not fresh device state.

## Proposed identity, not an artifact

Freeze exact source commit and complete dependency tree before building; currently pushed source0ae52da and local documentation follow-upf828191 have the same runtime (cardiac6e183d0, Recent Segments7ca657d, highlight6c5d472). Proposed versionCode79 and versionName0.10.49-tester-candidate, conditional on checking no newer code was used elsewhere. Debug78 is not an install candidate. Version79 is a proposal, not reserved or built. Final SHA-256/size/signer digest are UNAVAILABLE until the actual artifact is generated; never recycle a prior APK hash or claim a source hash is the APK hash.

Use existing beta build/signing configuration only, via existing private beta-signing properties outside Git; no key rotation or signing configuration change. apps/karoo/app/build.gradle.kts beta uses release minification with the persistent beta signer; debug behavior is not a substitute for testing this artifact. Record exact variant, JDK/SDK, Gradle command/overrides, source SHA, version, size, artifact SHA-256, signer SHA-256 and generated feature flags in a local reviewable manifest before requesting exact installation approval. Verify signer continuity against the last approved candidate without printing credentials. Never commit APKs, properties, keystores or private backups.

## Room upgrade and recovery

Local source is Room5. DatabaseProvider registers1→2→3→4→5 and no destructive fallback. Migration4→5 is five nullable attempt-result columns, preserving existing records; older results show qualified approximate time and unknown goal. Public73/Room3 requires3→4→5; installed76/Room4 requires4→5; fresh installs start at5. Existing synthetic migration coverage is evidence, not a physical upgrade check on either old version.

Once the new app opens Room5, direct return to76/Room4 or73/Room3 is unsupported. Never uninstall or clear data to recover. Recovery strategy is a forward-fixed APK with same signer and higher version; alternatively an explicitly approved, verified consistent pre-upgrade backup restore that restores the matching old schema/app state. No such device backup/restore has been performed in this review, and no app-private data extraction is authorized. Do not present copying a running SQLite DB without WAL/SHM coordination as a valid backup.

## Required verification before requesting install

Run full JVM suite, lint and assembly for the frozen candidate; resolve failures before requesting approval. Recheck migration3→5,4→5 and reopen, existing segments/plans/profile/ownership/results retention, delayed-entry/final-save ordering, repeated attempts, goal snapshots, legacy rows and malformed/missing data. Confirm11 registered field IDs and synthetic light/dark/small previews. No new test suite was run in this docs-only task; prior full296 and focused15 tests do not certify a newly signed/minified variant.

Inspect the actual beta APK: com.gritmap.karoo identity, version, expected persistent signer, arm64 packaging/native assets, feature flags (direct BLEtrue; records/ceilings/replanner/concurrentfalse; disconnect injection0) and no debug-only artifacts/credentials. Do not turn on experimental features to bundle them into this release. Conduct the requested privacy scan across every newly pushed commit and any final release package.

Present the exact candidate manifest + migration/recovery limitations to the owner. Ask an explicit yes for the named artifact/device before any in-place install. The current branch push approval does not authorize installation or release. Use in-place update only after approval; verify startup/migration and retained library, then check all rendered fields. No reinstall/data clear.

## Supervised ride and release decision

Saturday2026-11-07 is the earliest proposed ride window in the current handoff, not a booking or guarantee of availability. Confirm with the owner before arranging device/ride work. Check baseline countdown pauses/restarts/readiness and current HR fallback; completed segment saves during the ride; newest result highlight shrinks over30 seconds and remains after expiry; repeat attempt/order/goal capture; process/view reopen retention; ordinary phone→Karoo Bluetooth import and H10 capture remain healthy. Map check validates only the already-existing active-line/marker path, not the unimplemented upcoming proposal. End/save before RR finalization checks. Recovered artifacts stay private; no personal ride data or screen identifiers in public fixtures.

Record build-specific pass/fail and any incomplete conditions, not merely an installed version. Only after satisfactory checks propose a separate public release: exact tested bytes, APK checksum and signer, release notes describing Room5/no downgrade, manual FIT workflow, optional experimental H10 and no reverse sync. Public download replacement, tag/release and tester invitation each remain separately approved actions. Shipping a signed build is not proof of completed supervised ride verification.

## Blocked or awaiting owner action

- Candidate build/validation is a next proposal; no signed artifact or hash exists from this task.
- Verify highest used version and source freeze before choosing final version identity.
- Approve named in-place candidate only after manifest, migration/recovery and QA review.
- Supervised ride availability and whether this Karoo update joins the first phone tester push are undecided.
- Nearby discovery policy, new map implementation and reverse BLE are outside this candidate; none needs to block its review.
