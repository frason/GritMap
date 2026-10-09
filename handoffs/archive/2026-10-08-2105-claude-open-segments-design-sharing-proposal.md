# Handoff: Open Segments browse and share on the design system; token-free sharing proposal (committed locally, not pushed)

- Updated: `2026-10-08 21:05 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `8ea294c feat: Open Segments browse and share on the design system; token-free sharing proposal` (handoff committed on top)
- Worktree: clean for phone files; `apps/karoo/*` untouched.

## Outcome

- **Open Segments** (`RegistryBrowseScreen`): each shared segment is a card with its name, distance and **climbing** (new: computed from the segment file's own elevation by
  `summarizeRegistrySegment`, no extra requests), and an "Add to my segments" button; segments the rider already has show "Already added. Open it". States: loading,
  **offline** ("You're offline"), busy, server problem, empty (explains how to be first), per-segment "couldn't load" with Try again, "Reading segment details...", cap note
  beyond 60, pull-to-refresh. Sorted by name. All text is `AppText` (live text size), 44 pt buttons, one VoiceOver element per card.
- **Share to Open Segments** (`PublishToRegistryScreen`): plain explanation of what would be shared (name and route, never rides/times/goals/plans/profile), a clear public + "shows where you
  ride, don't share one that starts or ends at home" warning, and a blue note that **sharing isn't open to everyone yet; during the beta only the maintainer can add segments**. The GitHub-token
  path is behind **"I'm the GritMap maintainer"** (auto-open if a token is already stored); strangers never see a token field. Errors are plain words (`describePublishError`), no HTTP codes
  or "repo scope".
- **`docs/OPEN_SEGMENTS_SHARING.md`**: proposal comparing export/AirDrop, issue/PR link, GitHub App + relay, Cloudflare Worker, CloudKit and own backend against GOALS (no subscription, local-first,
  public repo, strangers), with moderation, abuse, privacy, cost and effort. **Recommendation: nothing new for the beta (maintainer-only, optionally a share-a-segment-file action); after the beta build a
  Cloudflare Worker that opens a reviewed pull request, with a "hide my start and finish" privacy trim.** Nothing built; decisions for Jason listed at the end.
- Small theme additions: `TextField.secureTextEntry`, `ScreenScroll.refreshControl`.

## Verified

- `npx tsc --noEmit` clean; `npm test` 620/620 (new tests: climbing summary, error kinds, publish error wording); `npm run web:smoke` clean.
- Simulator, demo/registry data (public Diablo and "Papa bear" entries): `docs/screenshots/open-segments/{before,after}/`: browse default and largest text, share default (stranger view) and
  maintainer view, share at largest text. The browse list showed climbing (1827 ft) and recognised the already-added segment.
- **Not captured:** offline/busy/error states on device (covered by unit tests of the wording; I did not switch the Mac's network off), and the publish success/failure result (a real publish would write
  a public commit; a bad-token attempt would also store the fake token). No real publish was run.

## External state

- Simulator DB: demo data only. Nothing pushed; local unpushed commits now: `be21320`, `3b3e590`, `078e131`, `854e224`, `ba8419e`, `d4aa1af`, `8e66df4`, `4106a8e`, `8ea294c` (+ this handoff).

## Goal alignment

- `docs/GOALS.md` Priority 3 (Open Segments usable by strangers): browse/add polished now; sharing without a token is designed, not built. Beta loop step 2 ("pull one from Open Segments") is solid.
  Priority 2 (redesign) advanced. "zones"/"sections" wording untouched (hold). No shared contract touched (portable segment JSON unchanged).
- Decision needed from Jason: see the four questions at the end of `docs/OPEN_SEGMENTS_SHARING.md` (Cloudflare Worker OK, reviewer/takedown policy, privacy trim, whether to build the segment-file share before the beta ends).

## Hazards and blockers

- The browse list reads the segment files for names (up to 60 requests at once); it is fine for a handful of segments but should become a single index file (or paged) as the registry grows.
- Open Segments reads from the maintainer's GitHub repo; GitHub's unauthenticated API limit (60/hour per IP) can show the "busy" state for strangers on shared networks.
- The beta privacy policy (`docs/BETA_TESTFLIGHT.md`) must keep saying shared segments are public and can't be removed.
- Remaining old-style screens: Attempt Review, Attempt Comparison, Rides list rows; still no VoiceOver pass by a person.

## Next safe action

Jason answers the decisions in `docs/OPEN_SEGMENTS_SHARING.md` and OKs pushing the local commits. Then migrate Attempt Review / Attempt Comparison (remove diagnostics jargon), and a VoiceOver pass on a real iPhone.
