# Privacy changes for lawyer review (DRAFT, 2026-11-04)

**Status: draft prepared by the product coordinator for Jason to send to a lawyer. Not legal advice, not published, not yet true of any shipped build.**
The current published policy is [`docs/PRIVACY.md`](PRIVACY.md) (last updated October 12, 2026). It says GritMap has **no accounts, no sign-in, nothing sent to us, nothing about us stores data**. That stops being true as soon as the iPhone app signs in to Open Segments, publishes, or syncs likes. Nothing below is live in the phone app today (the Open Segments account features are behind an OFF flag); this memo prepares the wording and the questions so the policy changes **before** the build that ships them (the current policy already promises that: "we will update this page and the Last updated date before the change reaches you").

Companion sources: the Open Segments website privacy and help text (drafted by the web developer, in `apps/web/src/PolicyPages.tsx` on the unpushed branch `codex/open-segments-platform`, updated November 3, 2026) and the proposed API contract `docs/OPEN_SEGMENTS_LIKES_API_CONTRACT_20261104.md` (same branch; proposed v1, not deployed). If those drafts and this memo disagree, the lawyer should treat the running service as the source of truth and tell us which to fix.

## 1. What is changing, in plain terms

| Today (policy says) | After the Open Segments account features ship |
|---|---|
| No accounts or sign-in | Optional **account**: sign in with an emailed one-time code, same account on the website and the phone. Browsing and pulling segments needs no account; **publishing, liking and "My uploads" need one**. |
| Nothing is sent to us | The **email address** is sent to Open Segments' service providers for sign-in. Published segments (name, route, elevation, credit) are sent and stored. Likes are stored with the account. |
| We cannot see your data | We (and our providers) **can** see account email, generated account name, published segments, private likes, reports, and limited abuse counters. Rides, plans, times, power and heart-rate stay on the phone. |
| Open Segments = a public GitHub folder, maintainer-only publishing | Open Segments = **our own website and service** (opensegments.org); the app reads from and publishes to it. The GitHub folder and the maintainer token section become obsolete once the app switches. |
| Public segments cannot be removed from within the app | Same, plus: account deletion detaches the account from publications but **does not remove** public credit or licensed data; removal on request. |

## 2. Data inventory (what exists server-side, by purpose)

| Data | Purpose | Visible to | Retention / deletion |
|---|---|---|---|
| Sign-in email | Sign-in, sending codes and generic moderation notices | Us and providers; **never published** | Until account deletion (confirm backups below) |
| Account name (server generated, like `rider-4821`; never from email or real name; read-only for now) | Public credit when the rider ticks "Credit me" | Public only when credited | Stays on published segments after deletion (see licence) |
| Published segment: name, route points with elevation, credit or "Anonymous rider", visibility (Listed or Link only), fingerprint | The product | Public (Listed) or anyone with the link (Link only) | Permanent, licensed ODbL 1.0; removal on request; copies already downloaded cannot be recalled |
| Likes: (account, segment, created time) | Private "Liked" list, phone and web | Account owner only; **no counts, no who-liked** | Deleted on unlike or account deletion; may remain in encrypted backups until normal retention expires |
| Reports (and report text) | Moderation | Administrator only | Needs a stated retention period |
| Abuse controls: per-account counters (5 publishes per UTC day, like-toggle and sign-in attempt limits) and **daily IP digests** | Rate limiting, abuse prevention | Us | Needs a stated retention period |
| Session credential: encrypted HttpOnly cookie on the web (up to 60 days sliding); on the phone a refresh credential in the iOS Keychain and a short-lived access token in memory | Staying signed in | The device | Until sign-out, expiry or deletion |
| Map tile requests (OpenFreeMap), IP address and area viewed | Maps | The map provider | Their policy applies |
| Backups | Recovery | Us | Private database backups are encrypted; retention to be stated |

Never sent to Open Segments: ride files, times, power, heart rate, goals, plans, profile (FTP, weight), or the phone's location. The website's own help text says the full recording is not uploaded; only the chosen section and reviewed public fields are sent. **Confirm for the phone**: what exactly is sent at publish time (route section, name, credit choice) and that the "near home" safety check runs on the phone against local data only.

## 3. Third parties and processors to list

Cloudflare (hosting and Turnstile bot check), Supabase (authentication and database storage), Resend (sign-in code and moderation emails), OpenFreeMap (map tiles) and OpenStreetMap data, Apple (TestFlight, App Store, iOS backups), Hammerhead (Karoo itself). **Questions for the lawyer:** whether a processor list, data-processing agreements and a cookie/"strictly necessary storage" statement are needed; what to say about data location.

## 4. Proposed replacement text for `docs/PRIVACY.md` (drafts; sections not listed stay as they are)

**Short version (replaces the "short version" paragraph):**
> GritMap keeps your rides, segments, plans and body numbers on your own devices. You can use GritMap without an account. If you choose to sign in to Open Segments, we handle your email address and the segments you publish, and we store which segments you like. We do not use advertising or analytics, and we do not sell or share your information. We never receive your ride files, times, power, heart rate, goals, plans or profile.

**"What GritMap does not do" (replace the first bullet):**
> - No account is needed to use GritMap. An optional Open Segments account is needed only to publish, like, or manage your uploads.

**New section "Your Open Segments account (optional)":**
> You can sign in to Open Segments from the app or the website with your email address. We send a one-time code to that address; we do not use passwords. Your email address is used only to sign you in and to send sign-in codes and generic notices about reports. It is never shown publicly.
> Each account gets a generated rider name (for example "rider-4821"). It is not based on your email or real name and you cannot change it yet. When you publish a segment you choose whether to be credited with that name; if you do not, it is shown as "Anonymous rider".
> The app keeps a sign-in credential in your iPhone's Keychain so you stay signed in; signing out removes it. [Confirm session length for the phone.]
> You can delete your account from the app or the website. This removes your account and your likes. It does not remove segments you published or their public credit, which are licensed as open data (see below).

**Replace "Sharing a segment to Open Segments (public and permanent)":**
> Segments you publish are public: shown to everyone ("Listed") or available to anyone with the link ("Link only"). Published segments cannot be edited, and Link only cannot be changed back once public. A segment contains its name, its route (points with elevation), the settings used to recognise it, an identifier, and your chosen credit. It does not contain your rides, times, heart rate, power, goals, plans or profile.
> By publishing you offer the segment data under the Open Database Licence (ODbL 1.0). You can ask us to remove a segment, but copies already downloaded cannot be recalled.
> A route is a place. A segment cut from your ride shows where you ride, including where it starts and ends. Do not publish a segment that starts or ends at your home or workplace. GritMap checks for this before you publish [describe the check once confirmed].
> [If auto-share ships:] You can choose "Share new segments to Open Segments" in Settings. It is off by default. When on, new segments you create are published automatically as Link only after the home check, with only the route, name and your credit choice. Existing segments are never published by this setting. You can turn it off at any time; segments already published stay public.

**New section "Private likes":**
> When you like a segment, we store the segment and the time against your account so you can find it on your phone and the website. Likes are private: there are no public like counts and nobody can see what you liked. Unliking removes the record; deleting your account removes your likes. Encrypted backups may keep earlier likes until normal backup retention expires.

**"When GritMap uses the internet" (replace item 1):**
> 1. **Open Segments.** To search, pull, publish and sync likes, the app talks to Open Segments (`opensegments.org`). Browsing and pulling a segment do not require sign-in and send no personal information beyond what any web request carries (for example your IP address). Searching a map area sends an approximate map area. [Remove the GitHub wording once the app stops using it.]

**Add:** Cloudflare and Supabase (hosting, authentication, storage), Resend (email), and the abuse controls (account counters and daily IP digests) to the third-parties section.

**"Deleting your data":** keep the app-deletion text; **remove the maintainer token paragraph**; add account deletion as above and the backup-retention caveat.

**"Children":** the current text says the app collects nothing. With accounts, **the lawyer must advise** on an age rule for accounts (13+, 16+ in some places), whether to ask age at sign-in, and wording.

**"Contact":** replace the personal Gmail takedown address with a dedicated address (the website already uses `help@opensegments.org`). **Jason to decide and create it.**

## 4a. Separation: Open Segments as an independent service, not part of "GritMap"

**Jason's intent:** the iPhone app should treat Open Segments as a separate service the app connects to (like any integration), not as part of a GritMap "company", even though no company exists today. **Not legal advice; the lawyer should confirm what is achievable.**

**What the product can do (and the policy can truthfully say):**
- Data goes **directly from the phone to Open Segments**; there is no GritMap server in between. GritMap (the app and the project) never receives or stores the sign-in email, likes or published segments. The app holds only a sign-in credential in the iPhone Keychain.
- Separate identity: own name and domain (opensegments.org), own privacy policy, terms, contribution terms and contact address (`help@opensegments.org`), own sign-in (an Open Segments account is not a GritMap account), and separate provider accounts (Cloudflare, Supabase, Resend).
- In the app: wording such as "Connect to Open Segments, a separate open service"; a first-use screen saying what is sent, that Open Segments' own terms and privacy policy apply, and that GritMap does not receive it; a Settings "Open Segments" section linking to those documents; auto-share opt-in and OFF by default.
- In the GritMap privacy policy: describe Open Segments as operated separately, link to its policy, and state that GritMap itself holds none of that data.

**What wording alone cannot change (please advise):**
- With no legal entity, one person (Jason) is the operator of both. Controller or processor roles and liability follow who decides the purposes and means of processing, not the names. Two brands do not create two parties.
- Apple's App Store privacy answers cover data collected through the app, including by a service the app calls, so email and user content must still be disclosed.

**Structure options to compare:** (1) keep as is, one person operating both with clear disclosures; (2) a separate entity (for example an LLC) that owns the Open Segments domain, provider accounts, terms and licence, limiting personal liability; (3) a fiscal host or nonprofit steward for independent governance. Costs, annual obligations and what each changes for liability, privacy roles and licensing.

**Questions for the lawyer:**
1. Who is the **licensor** under the ODbL 1.0 grant in the contribution terms? An unincorporated project has no clear holder to receive the grant, so who should the terms name?
2. Who owns the domain, the "Open Segments" and "GritMap" names, the logos and the content licences, and should they sit with different owners?
3. Who is the **controller**, and who are the **processors** (Supabase, Cloudflare, Resend), for Open Segments account data? Does a separate legal entity change the answer for GritMap, which holds none of it?
4. Does the GritMap privacy policy need to be the same document as Open Segments' or can it simply link to it?
5. At what point (accounts, public launch, donations or sponsorship, paid features) should a legal entity be formed?
6. Does presenting Open Segments as separate in the app reduce any obligation, or must the app's own privacy answers and policy cover it anyway?

## 5. Other documents that must change at the same time

- `docs/GOALS.md`: remove or qualify "nothing leaves the phone" wording for accounts, publishing and likes; keep "ride GPS, plans and times never go to a server."
- `ios/GritMap/PrivacyInfo.xcprivacy` (Apple privacy manifest) and the **App Store privacy answers**: email address (account), user content (published segments), identifiers/usage as applicable, no tracking. [Lawyer or whoever files the App Store answers to confirm the categories.]
- TestFlight "What to test" text, the README Open Segments section, onboarding copy, and the Open Segments website Terms (contribution terms) and Privacy page: keep identical on shared facts.
- Karoo extension: unchanged (no network use beyond the local receiver); no change needed unless Karoo-to-cloud ideas are adopted (they are not).

## 6. Open questions for the lawyer (please answer or advise)

1. **Account data and rights:** which regimes apply to a US-based small open project with likely EU/UK users (GDPR/UK GDPR, CCPA/CPRA, others)? Do we need a lawful-basis statement, a data-subject-request process, a Data Protection contact, or an EU/UK representative at beta scale?
2. **Retention periods** to state for: reports, abuse counters and daily IP digests, encrypted backups, security logs.
3. **Licence and credit:** is "ODbL 1.0 on data, credit as a generated name or Anonymous rider" adequate when a contributor later deletes their account? Wording for "removal on request" (grounds, response times: the website promises 24 hours for a home-at-start-or-end report and 7 days otherwise).
4. **Location privacy:** exposure from public routes that start or end at a home; adequacy of the near-home check, reporting and takedown path; whether Link only changes any duty.
5. **Age rule** and sign-in age gate (see "Children").
6. **Terms of service** and acceptable use for the website and the app (contribution terms exist for the website; the app needs a matching entry point).
7. **Third-party map and data attribution** (OpenFreeMap, OpenMapTiles, OpenStreetMap) wording and placement, and the licences of fonts and icons used on the website.
8. **Apple App Store** privacy-answer categories and any account-deletion requirement (Apple requires in-app account deletion for apps that offer account creation).
9. **Trademark** search for the names "GritMap" and "Open Segments" (USPTO, EUIPO, classes 9 and 42) before the public launch, and a view on the logo.
10. **Takedown/contact address:** confirm a dedicated, monitored address and who handles requests.

## 7. Timing

These changes gate the first build that ships sign-in, publishing or likes (and the hosted likes release on the website). Nothing in the current TestFlight build (17) needs them. Until then the existing policy remains accurate for the shipped phone app.
