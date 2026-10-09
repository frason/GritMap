# Open Segments: sharing without a personal GitHub token

Status: **proposal for Jason to decide. Nothing here is built.** Written 2026-10-08 for `docs/GOALS.md` priority 3
("publish your own without needing a personal GitHub token"). Related: `docs/SEGMENT_REGISTRY.md` (how the registry works today).

## The problem

Browsing and adding segments from Open Segments already works for anyone with no account: the phone lists
`registry/segments/*.json` in the public repo through GitHub's read API and downloads each file. **Sharing** a segment is the
problem: it writes a file into that repo with `PUT /repos/frason/GritMap/contents/...`, which needs a GitHub token with write access to the
repo. Strangers on the beta don't have one and must not be given one. For the beta the share screen now says sharing is
maintainer-only (`PublishToRegistryScreen`), and the token field is behind "I'm the GritMap maintainer".

## What a solution has to satisfy (from `docs/GOALS.md`)

1. **No subscription, no paywall for segments, ever.** Free for riders; running cost near zero for Jason.
2. **Local-first.** A rider's data stays on their phone; sharing is an explicit, optional act that sends the segment and nothing else.
3. **Public repository registry.** Segments stay as public, content-addressed files in the repo (`<fingerprint>.json`); reading stays account-free.
4. **Strangers can do it.** No GitHub account, no token, no sign-up if avoidable.
5. **Safe to run.** Moderation, abuse resistance and a privacy answer, because a segment cut from a ride shows where that person rides.
6. Phone-side contracts unchanged: portable segment JSON and fingerprint (`src/segments/*`), validated on import.

## Constraints that shape every option

- **Git history is forever.** Anything merged into the public repo can't really be un-published. That is why a human or automated
  check must sit **before** the merge, not after.
- A published segment is ~1,000 points for a 10 km segment (10 m resampling): roughly 60 KB of JSON. Too large for a URL.
- No server exists, and creating accounts (Cloudflare, GitHub App, Apple) is something only Jason can do.
- The beta is short (about 2026-10-15 start): nothing here should block it.

## Options

### A. Export / AirDrop a segment file (peer to peer)
The rider shares the segment as a `.json` file (Share sheet, AirDrop, Messages); the recipient uses **Import a segment file**
(already built). Not a registry at all, but it gets segments between friends and clubs today.
- Pros: nothing to run, no accounts, maximum privacy (only people the rider chooses see it), tiny effort.
- Cons: no discovery, so it doesn't deliver "Open Segments"; no moderation needed because it isn't public.
- Effort: about 0.5 day (a Share button that writes the portable JSON to a temp file). Cost: $0.

### B. Pre-filled GitHub issue or PR via a link
The app copies the segment JSON and opens a "new issue" form on GitHub; the maintainer converts it to a file.
- Pros: no server, built-in moderation (a human sees every submission), uses GitHub's own spam controls.
- Cons: the rider needs a **GitHub account** (most cyclists don't have one), ~60 KB doesn't fit in a URL so it is copy-paste, and the maintainer does
  manual work for every segment. It exchanges a token requirement for an account requirement.
- Effort: 1 day. Cost: $0 plus maintainer time. Doesn't meet "strangers can do it".

### C. GitHub App with a small relay
A GitHub App can commit to the repo without a person's token, but it can't be called by anonymous strangers directly: something has to hold the
app's private key and accept requests, which is a relay (that is option D). Treated as a component of D, not an alternative.

### D. Cloudflare Worker "submission relay" that opens a pull request  *(recommended)*
The app POSTs the portable segment JSON to one HTTPS endpoint. A small Cloudflare Worker (free tier: 100,000 requests/day) validates it, then uses a GitHub App (or a fine-grained token limited to this one
repository: contents + pull requests) stored as a Worker secret to open **a pull request** adding `registry/segments/<fingerprint>.json`. A maintainer (or an
automated check, see below) merges it; once merged it shows up in Open Segments with no change to the reading side.
- The rider needs no account and no token. The app embeds only the relay URL (public).
- **Validation in the Worker**, reusing the same code as the phone (`ride-segments` package / `fromPortableSegmentJson`): schema and size limits (e.g. 150 KB, 2,000
  points), fingerprint recomputed (never trusted), sensible length and geometry, name length and character checks, de-duplication by fingerprint (already published or already pending means no new PR).
- **Abuse limits**: per-IP and global rate limits, Cloudflare Turnstile (free, invisible CAPTCHA) or Apple App Attest later, a cap on open PRs, a kill switch.
- **Moderation**: every submission is a reviewable PR. A GitHub Action runs the same checks plus rules (minimum length, no near-duplicate geometry, name filter) and labels it; the maintainer approves with one click. Later, auto-merge for submissions that pass every check.
- Pros: free, no accounts, keeps the public-repo registry and the existing read path, human-in-the-loop before anything becomes permanent, scales to the beta and beyond.
- Cons: introduces the project's first running service (the Worker), so a Cloudflare account is needed (Jason), plus secrets to guard; `SPEC.md` guardrails against backend infrastructure must be explicitly relaxed
  for this one stateless relay; the maintainer reviews PRs.
- Effort: about 3 to 4 days (Worker, GitHub App, validation, Action, phone share screen, tests, abuse limits, docs). Cost: $0 within free tiers; about $5/month if traffic outgrows them.

### E. CloudKit public database (Apple-only)
Segments go to Apple's free public database using the rider's iCloud sign-in; no server to run.
- Pros: no account beyond Apple ID, free quota, no relay.
- Cons: the registry would leave GitHub (breaks "public repository" and the open read path, no web or Android reader), iPhone-only, harder moderation tooling, Apple-specific lock-in, and a rewrite of discovery.
- Effort: 5+ days. Cost: $0 within quota. Rejected: conflicts with the public-repo and openness goals.

### F. Own backend (database + API + hosting)
Full control, search, accounts.
- Cons: ongoing cost and maintenance, contradicts "no subscription" economics and the project's guardrails. Rejected for now.

## Comparison

| | A. Export / AirDrop | B. Issue / PR link | D. Worker relay opens PR | E. CloudKit | F. Own backend |
|---|---|---|---|---|---|
| Rider needs an account | No | **GitHub account** | No | Apple ID (already) | Usually yes |
| Delivers public discovery | No | Yes (slow) | **Yes** | Yes (not on GitHub) | Yes |
| Keeps public-repo registry | n/a | Yes | **Yes** | No | No |
| Moderation before it is public | not needed | Human, manual | **PR review + automated checks** | Weak | Build it |
| Running cost | $0 | $0 | **$0 (about $5/mo at scale)** | $0 | $$ ongoing |
| New infrastructure | None | None | One stateless Worker | CloudKit | Full service |
| Effort | 0.5 day | 1 day | **3-4 days** | 5+ days | weeks |
| Fits GOALS (no subscription, local-first, public repo, strangers) | Partly | Not for strangers | **Yes** | No | No |

## Privacy: a segment reveals where someone rides

A segment cut from someone's ride is a stretch of road they ride, and its start or end can be their home or workplace. Mitigations, in order of importance:
1. **Say it before sharing** (done in the share screen copy): public, can't be removed from the app, don't share anything starting or ending at home.
2. **Trim before sharing (recommended build):** offer "Hide my start and finish": the app trims the first and last ~200 m of any shared segment (a different segment with a different fingerprint, so
   it matches rides that cover the trimmed part) or refuses segments whose first or last point is within a chosen radius of a place the rider marks as home.
3. **Share only what's needed:** the portable JSON holds a random segment ID, name, direction, matching settings, the route with elevation and a fingerprint (see `src/segments/toPortableSegmentJson.ts`). It has no ride ID, timestamps, times, power, heart rate or profile;
   verify with a test that a shared file contains no field outside that list.
4. **Names are public text:** warn that the name is public; the relay and PR checks reject names that look like personal data (email, phone, full address patterns).
5. **No identity stored:** the relay stores no user ID or device ID. Cloudflare sees IP addresses for rate limiting; the relay must not write them anywhere persistent or into the PR.
6. **Takedown path:** a published email address and a `registry/removed.json` blocklist that the app consults, so a removed segment disappears from Open Segments even though git history still has it. Be honest in the privacy policy that history keeps old files;
   this is why review before merge matters.

## Moderation and abuse in practice

- **Volume:** beta of 20 or more riders, so a handful of submissions a week. Manual PR review is minutes each. If it grows, auto-merge only submissions that pass every check and come from an App Attest-verified app.
- **Spam / flooding:** rate limits (per IP per day and global per hour), Turnstile, open-PR cap, reject duplicates by fingerprint, size and point-count caps.
- **Offensive or misleading names:** word filter in the check, human review before merge, report link in the app that opens a prefilled email.
- **Junk geometry** (tiny, huge, or straight lines): minimum length (e.g. 300 m) and maximum (e.g. 100 km), points must follow plausible speeds on resampling, bounding-box sanity.
- **Malicious payloads:** all JSON is untrusted: validated with the same code the app uses on import, size-capped, and the app never trusts a file's claimed fingerprint (already recomputed on import).
- **Compromise:** the Worker holds one repo-scoped credential. Use a GitHub App limited to this repository (contents + pull requests, no admin), rotate on suspicion, protect `main` so a merge requires the check to pass.

## Recommendation

**For the beta (about 2026-10-15): do nothing beyond what's shipped.** Keep sharing maintainer-only (the screen already says so), and let beta riders exchange segments with **A** if
wanted (about half a day, worth doing only if testers ask for it). Strangers can already add everything Jason publishes.

**After the beta: build D** (Cloudflare Worker relay that opens a reviewed pull request), with the **privacy trim** from the list above as part of the first version. It is the only option that gives strangers
a no-account share, keeps the public-repo registry and the open read path, costs nothing to run, and keeps a human check in front of the only permanent step.

### Decisions for Jason
1. OK to introduce one stateless Cloudflare Worker (and relax the `SPEC.md` backend guardrail for it)? Needs a Cloudflare account created by Jason.
2. Who reviews PRs, and what takedown email and policy do you want published?
3. Privacy trim: trim the first and last 200 m automatically, or require marking a home location, or only warn?
4. Do you want option A (share a segment file) before the beta ends?

### Rough plan if approved
1. Phone: `Hide my start and finish` option plus a Share-to-Open-Segments action that POSTs (kept behind a flag until the relay exists).
2. Relay: Worker + validation reusing `ride-segments`; GitHub App; tests with fixtures shared with the phone; rate limits and Turnstile.
3. Repo: GitHub Action checks, branch protection, `registry/removed.json`, review checklist.
4. Docs: privacy policy wording (`docs/BETA_TESTFLIGHT.md` already lists what it must say), takedown process, maintainer runbook.
