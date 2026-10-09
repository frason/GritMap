# Open Segments on Vercel: proposal

Status: **proposal, nothing built.** Written 2026-10-08 by the coordinator at Jason's request. It builds on
`docs/OPEN_SEGMENTS_SHARING.md`, which compared sharing options and recommended a serverless relay that opens a
reviewed pull request. This document picks **Vercel** as the host for that relay **and** for a public Open Segments
website, so there is one platform instead of two.

## Why

- `docs/GOALS.md` vision: free, shared segments that anyone can create, share and use, with no subscription.
  Jason wants a dedicated Open Segments website eventually.
- Apple requires a **public privacy policy URL** for external TestFlight testing (`docs/BETA_TESTFLIGHT.md`, step 9).
  A minimal site solves that for the ~2026-10-15 beta. This is the only part with a beta deadline.
- Today strangers can browse and add segments but cannot share: publishing needs Jason's GitHub token
  (the share screen says sharing is maintainer-only during the beta).

## What exists today (unchanged by phase 0)

- The registry is the public repo: one portable segment JSON per file in `registry/segments/<fingerprint>.json`
  (2 segments today). The fingerprint is deterministic and shared byte-for-byte with the Karoo.
- The app lists segments with one GitHub contents-API call, then reads each file from `raw.githubusercontent.com`
  (`src/registry/registryClient.ts`). Anonymous API calls are limited to 60 per hour per IP, which is fine for the beta
  because it's one call per browse.
- Validation logic exists in `packages/ride-segments` (AGPL-3.0) and the phone's `fromPortableSegmentJson`.

## Proposal

One Next.js app in `apps/web/`, deployed on Vercel from this repository (Vercel "root directory" = `apps/web`).
It rebuilds automatically on every push to `main`, so a merged segment appears on the site with no extra step.

| Part | What it is | Phase |
|---|---|---|
| `/privacy` | Privacy policy covering exactly what the app does (content listed in `docs/BETA_TESTFLIGHT.md` step 9) | 0, beta |
| `/` and `/s/<fingerprint>` | Segment list and segment pages generated at build time from `registry/segments/*.json`: map (MapLibre plus the same OpenFreeMap tiles as the app), elevation profile, distance, climbing, average grade, "Download segment file" | 0 or 1 |
| `/segments/index.json` | One CDN-cached index of all segments (fingerprint, name, distance, climbing, start point) | 1 |
| App reads the index | `registryClient` lists from the site's index instead of the GitHub API, with the GitHub path as fallback. Removes the rate limit and makes browse faster | 1 |
| `POST /api/submit` | Vercel Function: validates the portable JSON with the same code as the phone, recomputes the fingerprint (never trusted), checks for duplicates, then uses a **GitHub App** (key stored as a Vercel secret) to open a pull request adding the file | 2 |
| Review | A GitHub Action re-runs validation and labels the PR; Jason merges. Merge, then Vercel rebuild, then the segment is live in the site and the app | 2 |
| "Open in GritMap" | Universal link from a segment page into the app (needs an `apple-app-site-association` file on the domain) | 3 |

### Privacy and abuse (phase 2, required before submissions open)

- **Privacy trim:** "Hide my start and finish" trims the first and last part of a segment derived from a ride, so a
  shared segment doesn't reveal a home address. Jason picks the rule (the options are in `OPEN_SEGMENTS_SHARING.md`).
- **Abuse limits:** per-IP rate limiting (Vercel Firewall rules, or a small Upstash Redis limiter if the plan's
  limits don't fit), Cloudflare Turnstile (works on any host) on the submit call, size and geometry limits, a cap on open
  PRs, and a kill switch environment variable.
- **Takedown:** a published contact and policy page, plus `registry/removed.json` so removed fingerprints never come back.

## Cost and terms

- Vercel **Hobby** (free) covers this traffic, but Vercel limits Hobby to **personal, non-commercial** use. A free,
  open-source project fits that today. If GritMap ever charges or takes sponsorship, move to **Pro (about $20 per month)**.
  Check the current terms when signing up.
- GitHub App and Turnstile are free. A custom domain is about $10–15 per year (optional; a `*.vercel.app` address works for phase 0).

## Vercel or Cloudflare

Both work. Cloudflare (Pages plus Workers) has more generous free limits and built-in rate limiting and Turnstile.
Vercel is simpler for a growing Next.js website, has first-class GitHub deploys and preview URLs per pull request, and puts
the site and the API in one project. Since the goal is a dedicated website, Vercel is the better fit. The relay code
stays portable (standard `fetch` handler) if the move ever makes sense.

## Phases and effort

| Phase | Scope | Effort | When |
|---|---|---|---|
| 0 | `apps/web` skeleton, `/privacy`, optional read-only segment pages; Jason creates the Vercel project | about 0.5–1 day | Beta week (unblocks TestFlight step 9) |
| 1 | `/segments/index.json`; the app reads it with GitHub fallback | about 1 day | After the beta |
| 2 | `/api/submit`, GitHub App, validation, Action, privacy trim, abuse limits; phone share flow behind a flag | about 3–4 days | After the beta |
| 3 | Custom domain, universal links, search and filters | open | Later |

## Ownership

`apps/web/` is TypeScript and reuses phone code, so it belongs with the phone side (Claude sessions). The Karoo is
unaffected: segments still arrive through the existing transfer contract. Add `apps/web/` to the responsibilities in
`docs/GOALS.md` once approved.

## Decisions for Jason

1. Approve Vercel for the Open Segments site and relay, and relax the `SPEC.md` "no backend" guardrail for this one
   stateless site and function.
2. Phase 0 now (privacy policy page for TestFlight), or host the privacy policy elsewhere for the beta?
3. Domain: start on `*.vercel.app`, or register a name now?
4. Privacy-trim rule, reviewer, and takedown contact (same as decisions 2–3 in `OPEN_SEGMENTS_SHARING.md`).
