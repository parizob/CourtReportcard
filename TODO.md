# Court Reportcard — Internal TODO

Internal task list / project notes. Not shipped to the site (Vite only bundles `src/` and `public/`).

## Open

- [ ] Add CAPTCHA to signup (protect free trial tokens from bot abuse)
- [ ] Revisit sales tax nexus once revenue crosses ~$5k — FL doesn't tax SaaS, other states do at $100k+/year nexus. Not close yet; check with a CPA before it matters. Note: sales tax is a trust-fund tax, LLC protection doesn't fully shield personal exposure if owed and unremitted
- [ ] File U.S. Copyright Office registration for the codebase — needed to preserve statutory damages/attorney's fees eligibility. Grace window (3 months from 2026-07-24 launch) runs to ~late Oct 2026. ~$45-65. Use the confidential-portions redaction option so the prompts (`src/lib/gemini.js`) don't become public record
- [ ] Parallelize **extract** chunks the same way as proofread (capped waves + race-safe merge) — proofread parallelization shipped first; extract still serial
- [ ] Phase 2 glossary support (extraction emits terms, proofread batches get them as context) — deferred until Phase 1 chunking is proven solid in production
- [ ] Move Supabase, Vercel, and the domain registrar off Brandon's personal Gmail onto Parizo Labs LLC's business email — payment method already switched to Mercury checking; avoids single-inbox recovery risk
- [ ] Watch Prod `analyze-case` logs for `bare annotations` (normalize already keeps those flags). If it stays noisy for a week+ of normal uploads, trial Gemini `responseSchema` on proofread — don't build that until the log tripwire says it's worth it
- [ ] After next Prod `Gemini returned no content` failure: read the new warn log (`finishReason` / `blockReason` / part summaries) and `last_error` — empty-response diag live on Prod 2026-08-11

### Marketing / Growth (CMO review, 2026-07-11)

- [ ] Get real, attributable testimonials for the landing page (full name + title/firm, ideally photo) — current quotes read as unverifiable placeholder copy, hurts trust with a risk-averse legal-adjacent audience
- [ ] Add a lower-commitment conversion path (demo video or interactive sample report) for visitors not ready to sign up — every current CTA requires an account

## Backlog

- [ ] **Bulk Accept all / Ignore all (whole transcript)** — customer asked; parked on purpose. Too easy to rubber-stamp contextual flags and break the “human owns every change” promise. Do not build unless several users hit the same wall *after* same-error tools land
- [ ] **Bulk action for the same exact error only** (Accept/Ignore every open card with identical original→suggestion) — safer than Accept-all; revisit after document-wide exact-repeat propagate has real usage. Propagate already surfaces the clones as open cards
- [ ] Move outbound transactional email off `noreply@courtreportcard.com` to a dedicated subdomain (e.g. `mail.courtreportcard.com`) — isolates sending reputation/DKIM/SPF from the root domain
- [ ] Revisit `DashboardEditor.jsx` rendering for very large transcripts (200+ pages):
    - Higher priority: memoize the pagination/highlight computation (~line 1120) — currently recomputes on every render, and large docs mean more accept/ignore clicks, each retriggering it
    - Lower priority / watch item: no virtualization (all pages mount at once) — no confirmed perf problem yet at 212 real pages, treat as speculative until it is
- [ ] Better prompt so entry_id / original match more often. Log dropped examples (type + original) for review
- [ ] Optional audio upload, diffed against the transcript to surface additional discrepancies
- [ ] Survey popup after a key action (e.g. after download) — not worth building yet, personal outreach already produces richer signal at this scale
- [ ] Identify addresses in documents and verify they're correct
- [ ] Let stenographers upload their own dictionaries as a per-user glossary — suppresses false-positive spelling flags on real terms and catches real inconsistent spelling of them; will need filtering down to "interesting" entries, not the whole file
- [ ] Per-reporter preferences to permanently opt out of a suggestion type across all transcripts — e.g. don't flag ordinal dates ("6th" vs "6"), since verbatim record means what was said stands over the grammar rule — requested by Tonie Thompson and Alison. Good idea, confirmed by 2 users, but incremental UX vs core accuracy/export trust — keep backlog until FP noise is a louder, repeated complaint across more reporters

## Done

- [x] Parallelize proofread batches (capped waves of 3, claim files + merge lock) — see `src/lib/proofreadParallel.js` + `analyze-case` proofread pass
- [x] Connect Stripe and turn on payments — `create-checkout-session` + `stripe-webhook` edge functions deployed (ACTIVE), `DashboardBilling.jsx` wired to `TOKEN_PACKS` with purchase history
- [x] Set up a separate Supabase branch (Pro plan) for dev/testing, isolated from production data
- [x] Fixed "Jump to in transcript" silently failing on long transcripts (real customer report, ~200 pages) — root cause was a separate, more fragile text-matching pass just for the transcript-pane highlight. Now falls back exact highlight → entry → transcript line, logging each tier, never silent. Also closed a related risk: `acceptAnnotation` now fails closed if either the entry or export-text apply fails, so an annotation can never show "accepted" while the correction is silently missing from the export
- [x] Bug/enhancement-report reward (100 tokens if we ship it) — messaging live on `Pricing.jsx`; tracking/crediting is informal (email + manual grants) for now
- [x] Pricing page built and live (`Pricing.jsx`), linked from the header nav
- [x] Blog built for SEO/content (`Blog.jsx`, `BlogPost.jsx`), live at `/blog` and `/blog/:slug`
- [x] Removed the "Early Access — Now Open" hero badge from `LandingPage.jsx`
- [x] Added "Pricing" to the header nav (`SiteHeader.jsx`)
- [x] Updated ToS liability clause (was $0 cap justified by being free) — now capped at the greater of 12-months-paid or $50; removed all "beta"/"individual operator" language now that payments are live
- [x] Turn on receipts in Stripe
- [x] Set up Parizo Labs LLC, DBA Court Reportcard, so we can charge customers
    - Filed with FL Division of Corporations (Sunbiz) — tracking 700478240197, approved
    - DBA (Fictitious Name) filed under Parizo Labs LLC — tracking 200478627822, $50
    - EIN obtained from IRS
    - Mercury business checking opened
    - Stripe business account set up
- [x] Set token pricing from real COGS (~$0.015/token) — packs at $20/300, $30/500, $50/1000 (3-4x markup, still well under human scopist rates)
- [x] Made the case/editor page mobile-responsive (slide-out annotations drawer, responsive header/layout)
- [x] Confirmed `?ref=email1` NCRA campaign tracking works (lands in the `path` column, not `referrer`)
- [x] Added founder story ("Why We Built This") to the homepage, linking to About Us
- [x] Extended the "no AI wording" policy to hidden schema/meta content (JSON-LD), not just visible copy — `<meta name="keywords">` is exempt
- [x] Applied the AI-wording fix across `index.html`'s JSON-LD (Organization/SoftwareApplication/WebSite descriptions, featureList, FAQ answers)
- [x] Validated chunking end-to-end on a real 212-page production upload
- [x] Document-wide exact-repeat propagate — if spelling/caps is flagged once, clone open cards for every other exact `original` hit (not auto-accept)
- [x] Calendar / year freelancing ban + runtime reference date on proofread (stops “2026 is in the future” style FPs)
- [x] Switched extraction (Pass 1) to `gemini-3.1-flash-lite` — ~51% faster, ~48% cheaper, same accuracy. Proofread batch size stays at 300 entries (600+ risks blowing the 135s deadline)
- [x] Chunking: `analyze-case` now supports 200+ page transcripts instead of failing on the 135s deadline — ~15-page chunks at speaker-turn boundaries, self-fetch chaining with retries, merged/deduped back into the same file format the editor already expects. Real cost ~$0.70/50 pages, ~$2.50-3.50/200 pages. "Re-analyze" button removed (re-upload instead) rather than chunked
- [x] Background processing: Gemini calls moved to async background function, dashboard polls for completion
- [x] Free signup tokens kept at 50; manual top-ups on request during beta
- [x] Refund tokens automatically on failed uploads
- [x] Built a testing bot for proofreading accuracy (`scripts/run-proofread-test.mjs` + seeded test transcripts, recall/false-positive scoring)
- [x] Created a Facebook page for Court Reportcard
- [x] Added social media links to the site
- [x] Fixed confirm-password field misalignment on mobile
- [x] Made the suggestions panel sticky so it scrolls with the user
- [x] Revisited ruleset support (Morson's, Gregg, etc.)
    - Sam Mattern (Spectrum Reporting) is a good resource on which rules matter most
    - Zoe doesn't follow a named ruleset, so this may not be universal — validate before building
    - Can't copy rulebook text directly (copyright) — would need to summarize in our own words
