# Court Reportcard — Internal TODO

Internal task list / project notes. Not shipped to the site (Vite only bundles `src/` and `public/`).

## Open

- [ ] Set up Parizo Labs LLC, with DBA as Court Reportcard, so we can charge customers
    - [ ] File Parizo Labs LLC with state Secretary of State
    - [ ] File DBA for Court Reportcard (state or county, depending on location)
    - [ ] Get EIN from IRS
    - [ ] Open business bank account under Parizo Labs LLC
    - [ ] Set up Stripe (or similar) business account once LLC/EIN/bank account are in place
- [ ] Celebrate when a user uploads a perfect transcript (something fun + bonus tokens) — needs a UID per uploaded document to prevent duplicate claims, or a monthly cap on free celebration tokens
- [ ] Survey popup to collect feedback after a key action (e.g. after downloading a transcript)
- [ ] Allow users to optionally upload audio alongside their transcript; transcribe the audio and diff it against the written transcript to surface additional discrepancies/errors
- [ ] Manually validate chunking end-to-end on staging/production before calling Phase 1 fully done — upload `scripts/test-transcripts/large_synthetic_180pages.txt` (and the 25-page one) through the real upload flow and confirm the case completes, entries/annotations look continuous with no duplicates at chunk seams, and check Supabase function logs for per-call timing/token usage (see `phase1-validate` in the chunking plan)
- [ ] Phase 2 fast-follow — glossary support: extraction emits notable terms, proofread batches receive the merged glossary as context (drafted in `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md`, deferred until Phase 1 chunking is proven solid in production)
- [ ] Phase 2 — extend the editor's "Re-analyze" button to use the same chunked/batched approach as initial upload; it's currently a single non-chunked call and is guarded/blocked above 75 pages (`REANALYZE_MAX_PAGES` in `DashboardEditor.jsx`) until this is built
- [ ] Revisit `DashboardEditor.jsx` rendering for very large transcripts (200+ pages) — it renders all pages/lines at once with no virtualization, and re-derives highlights/pagination from scratch on every render (not memoized); flagged during chunking work as a likely performance bottleneck once large documents start flowing through, not yet fixed
- [ ] Fix the authenticated/case page on mobile so court reporters can edit on mobile as they go
- [ ] Build a resources/guide landing page offering a legal/medical homophone & commonly-confused-word reference sheet (not a "how to proofread" checklist — Zoe's feedback is reporters won't use that, they already know how to edit), gated behind an email capture form (no download until email is submitted) — content should get an accuracy pass from someone with real court-reporting expertise (Brandon/Zoe/Veronica) first
- [ ] Send NCRA cold emails — add `?ref=email1` to the URL and ensure telemetry captures it in the `referrer` column of `telemetry_events`

## Backlog

- [ ] Identify addresses in documents and hook up a tool to look up/verify they're correct
- [ ] Allow stenographers to upload their dictionaries so we can extract proper nouns/party names/technical jargon as a per-user glossary — no steno/stroke data available to us, so this can't verify translation accuracy, but it can (1) suppress false-positive spelling flags on legit unusual terms and (2) catch real inconsistent-spelling errors of those terms across a transcript. Will need to filter dictionary exports down to "interesting" entries (proper nouns, rare/technical words) rather than ingest the whole file, since most entries are just common briefs
- [ ] Completeness checklist: flag if standard sections (certificate page, appearances, index) or notations (recess, off-the-record) seem to be missing from an upload — raised by Veronica

## Done

- [x] Chunking: `analyze-case` now supports large transcripts (200+ pages) instead of failing outright on the 135s Edge Function deadline
    - Calibrated against real Gemini calls (`scripts/calibrate-chunk-size.mjs`) — extraction (Flash) is the binding constraint at ~4.21s/page, not proofreading (Pro), despite Pro's uncapped thinking
    - Text transcripts over 20 pages are split into ~15-page chunks at speaker-turn boundaries (never mid-sentence); each chunk carries a small read-only trailing-context block from the previous chunk so judgment calls at the seam (e.g. their/there) still have context. Below 20 pages, behavior is byte-for-byte unchanged from before
    - Chunks/batches are chained via self-fetch, each with its own fresh 135s budget, with per-chunk/per-batch idempotency (safe to retry or duplicate-invoke) and up to 2 automatic retries before falling back to the existing refund+delete+email failure path
    - Proofreading is similarly batched by entry count (300 entries/batch) with a deterministic annotation-range guard so batches never annotate another batch's context-only entries
    - Results are merged/deduplicated (renumbered ids + existing `deduplicateTranscript`) into the exact same file format the rest of the pipeline already expects — fully transparent to the editor UI
    - Cost impact: ~$0.17 for a 200-page/14-chunk document (up from ~$0.09 pre-chunking on smaller docs), from repeated prompt overhead per chunk
    - Editor's "Re-analyze" button is NOT chunked yet (still a single call) — guarded at 75 pages in the meantime, see Open items
    - Tested with Node unit tests (`scripts/test-chunk-split.mjs` — splitting, boundary snapping, trailing-context, cross-chunk merge/dedup) + `deno check` type-checking; still needs one real staging/production upload test with a 150+ page document before calling Phase 1 fully validated (see Open items)
- [x] Background processing: Gemini calls moved to async background function; upload page saves file and returns immediately, dashboard polls for completion — fixes stay-on-screen problem and token loss on navigation
- [x] Decided to keep free signup tokens at 50; top up manually on request during beta
- [x] Refund tokens on failed uploads — if a transcript errors out (e.g. too large, needs to be split), the user should not be charged; credits should be returned automatically
- [x] Build a testing bot: run against existing/uploaded transcripts, or have an agent generate new sample transcripts with known seeded errors, to verify Court Reportcard catches them all — `scripts/run-proofread-test.mjs` + `scripts/test-transcripts/` (5 seeded transcripts, manifests, recall/false-positive scoring, and UI apply/highlight/round-trip integrity checks)
- [x] Create a Facebook page for Court Reportcard
- [x] Add social media links to the site
- [x] Fix confirm password field layout on mobile (misaligned)
- [x] Make the suggestions panel on the right side of the editor sticky so it scrolls with the user as they move through the transcript
- [x] Revisit ruleset support (Morson's, Gregg, etc.) once we have more feedback from power users
    - Sam Mattern (Spectrum Reporting) specifically asked about this and is a good resource — follow up with him on which rules matter most in practice
    - Zoe doesn't follow a specific named ruleset, so this may not be universal — validate before building
    - Copyright concern: can't copy rulebook text directly into prompt; would need to summarize rules in our own words
