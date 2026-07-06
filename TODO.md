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
- [ ] Investigate real per-page COGS now that chunking is confirmed more expensive than planned (~$0.70/50 pages, ~$2.50-3.50/200 pages) — current pricing is 1 token/page regardless of size, all 50 signup tokens are free, and billing infrastructure doesn't exist yet (see Parizo Labs LLC item), so nothing urgent, but this should inform token pricing once paid plans are built. Not a prompt bug — cost is inherent to using Gemini 2.5 Pro's uncapped thinking for proofreading (a deliberate quality choice) and extraction regenerating the full transcript as JSON; chunking itself only adds a small, quantifiable tax from repeating the ~10k-token proofreading ruleset per batch (~$0.03-0.05/extra batch) — could reduce that specific tax later by raising the 300-entries/batch threshold (proofreading has far more time budget headroom than extraction), but no immediate action needed
- [ ] Manually validate chunking end-to-end on a 150+ page document before calling Phase 1 fully done — the 50-page synthetic upload confirmed the pipeline (see Done), but the 180-page file (`scripts/test-transcripts/large_synthetic_180pages.txt`) hasn't been run through production yet
- [ ] Phase 2 fast-follow — glossary support: extraction emits notable terms, proofread batches receive the merged glossary as context (drafted in `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md`, deferred until Phase 1 chunking is proven solid in production)
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
    - Cost impact (corrected — see Open items): real production run confirmed ~$0.70 for a 50-page/4-chunk document, extrapolating to roughly $2.50-3.50 for a 200-page/14-chunk document. The original ~$0.17 planning estimate undercounted extraction's output-token cost (it regenerates the whole transcript as verbose JSON) and Gemini 2.5 Pro's uncapped thinking tokens on proofreading, both of which dominate over chunking's own repeated-prompt overhead
    - The editor's "Re-analyze" button was removed entirely rather than chunked — re-analyzing an already-reviewed transcript (that the reporter has likely already edited) is a rare enough action that it wasn't worth the complexity of a second async/backgrounded pipeline (new case status, locked-editor-while-running state, separate failure/refund path that can't reuse the existing delete-on-failure handler since real data already exists). If a user wants a fresh pass, they re-upload. `proofreadTranscript` (the old single-call re-analyze path) was removed from `src/lib/gemini.js` as dead code
    - Tested with Node unit tests (`scripts/test-chunk-split.mjs` — splitting, boundary snapping, trailing-context, cross-chunk merge/dedup) + `deno check` type-checking, plus a real production upload of a 50-page synthetic transcript (4 chunks) that completed cleanly end to end (1,084 entries, 22 annotations, no stuck/duplicate state) — still needs one run with a 150+ page document to fully validate Phase 1 (see Open items)
    - `scripts/generate-large-transcript.mjs` (the synthetic test-transcript generator) had two bugs found during the 50-page validation, now fixed: it was silently dropping the answer to any question landing on a page's last line instead of continuing it onto the next page, and its Q/A text was long enough to soft-wrap in normal viewers (real transcripts don't). All three fixture files were regenerated
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
