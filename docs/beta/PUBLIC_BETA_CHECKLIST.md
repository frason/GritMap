# Public beta readiness checklist (coordinator draft, 2026-11-05)

Goal: widen the beta to 20+ cyclists who are strangers (`docs/GOALS.md`) using what exists today:
phone build 19 (TestFlight), the Karoo extension, and Open Segments as deployed (web browse, download, publish, sign-in, private likes).
NOT needed for this beta: phone sign-in, Liked on the phone, publishing from the phone, the all-lines Explore map (all later).
Open Segments cannot be redeployed until the Open Segments Codex is back (about 2026-11-09); only Jason can approve a deploy.
Status words: DONE (evidence in repo), VERIFY (believed true, check), OPEN (work needed), BLOCKED (needs Codex or Jason). Owner in brackets.

## 1. Facts to confirm first (all VERIFY, [Jason])
- [ ] External TestFlight: is the public link in `README.md` live and which build does it serve? Build 19 is internal; add it to the external group, check whether Beta App Review is required again and answer it.
- [ ] Which Karoo APK do testers get? Public latest release is `karoo-beta-0.10.45` (2026-10-24). Jason's Karoo runs version 76 (approved redesign), which is NOT a public release. Decide: tag a new beta from version 76, or keep 0.10.45. Recommendation: ship 76 (it is what has been ridden); hold back the cardiac countdown and Recent Segments (Room 5 migration, needs a supervised ride).
- [ ] Phone/Karoo compatibility: README says the phone sends over Bluetooth and needs Karoo extension 0.10.45 or newer. Confirm build 19 works with the chosen APK.

## 2. Phone app, build 19
- [ ] [Jason] Fresh-install walk of the whole beta loop (import or pick a segment, goal and plan, send to Karoo, ride, import FIT, plan vs actual). Record failures in `handoffs/LATEST.md`.
- [ ] [Jason] Decide whether the rare "lists stop responding to taps until restart" bug blocks strangers. Cause unproven; list it as a known issue in "What to test" (draft below) or hold.
- [ ] [phone session] If it blocks, scope a fix as build 20a without sign-in work (separate from the sign-in release).
- [ ] [Jason] App Store Connect: update "What to Test" and beta description with `PUBLIC_BETA_TESTFLIGHT_TEXT_DRAFT.md`; confirm export compliance and privacy answers are unchanged (flag off, no accounts).
- [ ] Confirm the in-app text says power meter and heart-rate monitor are required, before install and in onboarding (GOALS rule).

## 3. Karoo extension
- [ ] [Karoo session / Jason] Release procedure in `docs/KAROO_BETA_RELEASE.md`: bump versionCode/versionName, tag `karoo-beta-X.Y.Z`, the workflow signs with the persistent beta key and publishes `gritmap-karoo.apk` + `SHA256SUMS.txt`. Karoo Codex is out of usage; the tag must come from the exact tested commit and needs Jason's yes in the Karoo session chat. Do not release from an unreviewed branch.
- [ ] [Jason] Install the exact released APK on his Karoo over the previous one and ride it once before telling testers.
- [ ] Update `docs/BETA_KAROO_INSTALL.md` and `README.md` versions, required Karoo software version (currently 1.538.2049+), screenshots of what shipped.
- [ ] Karoo 3 only, iPhone only: say it in README, TestFlight text and the install guide.

## 4. Open Segments (live; no redeploy until Codex returns)
- DONE: browse, download, web sign-in, publish, private likes (live 2026-11-05, smoke-tested), responsive Home/Explore/detail, FAQ with draft labels.
- [ ] [BLOCKED, Codex] Batch of small edits in `OPEN_SEGMENTS_EDITS_FOR_CODEX.md`.
- [ ] [Jason] Decide: leave "draft wording" labels visible during the beta (honest, looks unfinished) or deploy a version without them after the lawyer reviews.
- [ ] [VERIFY] The live Terms/Privacy/Help pages match what testers need to know (takedown, removal, report path). Read the live pages once.

## 5. Legal and trust (biggest gap)
- [ ] [Jason] Send `docs/PRIVACY_CHANGES_FOR_REVIEW.md` to the lawyer (draft, not legal advice; 10 questions). Beta can run before answers if wording stays honest and labelled draft.
- [ ] [Jason] Create a dedicated support/takedown address and replace the personal Gmail in `docs/PRIVACY.md` and anywhere else it appears (public repo). Needs Jason's approval for the address; I will make the doc edits once it exists.
- [ ] [Jason] Trademark search for GritMap and Open Segments.
- [ ] `docs/PRIVACY.md` (last updated Oct 12) says no accounts and nothing sent to us: still accurate for build 19 (account flag off). It MUST be updated before build 20 (sign-in, deletion, report).
- [ ] Apple: app privacy answers match the policy; privacy policy URL points at a public page (confirm the URL).

## 6. Running the beta
- [ ] Feedback path: one address plus GitHub issues (no personal data in public issues; README already says so). Decide who answers, and within how long.
- [ ] Tester one-pager (`PUBLIC_BETA_TESTER_GUIDE_DRAFT.md`): what to test, what is out of scope, how to report, how to send a FIT privately.
- [ ] Recruiting: where the first 20 come from (cycling clubs, Karoo owner forums, friends); Karoo 3 + power meter + HR strap is a narrow audience, say so up front to avoid wasted installs.
- [ ] Define "the beta worked": share of testers who complete the loop once, plus count of blocking bugs. Review after one week.
- [ ] Open Segments safety: report path exists on web; name who triages reports and the takedown response time; confirm the encrypted backup has an offsite copy (Codex reported local restore only).
- [ ] Support loop for the Karoo: ask testers for app version, extension version, Karoo software version (README already lists this).

## 7. Known issues to disclose to testers
- Lists in Rides/Segments can stop responding to taps; restarting fixes it.
- Karoo cardiac, drift and physiology fields are experimental and advisory.
- Phone: no accounts or Liked in this build; Open Segments sign-in and likes are on the website only.
- Karoo holds one segment at a time (multi-segment is post-beta per GOALS).
- iPhone and Karoo 3 only.

## Suggested order for the next 4 days (no Codex)
1. Jason: external TestFlight status, fresh-install walk, decide the tap bug (section 1, 2).
2. Jason: Karoo APK decision; Karoo session prepares the tag; Jason approves and rides it (section 3).
3. Jason: lawyer email, support address, trademark search (section 5). I update docs when the address exists.
4. Coordinator: README/install guide updates, tester guide, GOALS update once decisions land.
5. When Codex returns: Open Segments edits batch, hosted deploy proposal, sign-in work for build 20.
