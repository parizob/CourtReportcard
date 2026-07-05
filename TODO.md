# Court Reportcard — Internal TODO

Internal task list / project notes. Not shipped to the site (Vite only bundles `src/` and `public/`).

## Open

- [ ] Identify addresses in documents and hook up a tool to look up/verify they're correct
- [ ] Allow stenographers to upload their dictionaries so we can store them and know which words they typically write / have saved more than others
- [ ] Set up Parizo Labs LLC, with DBA as Court Reportcard, so we can charge customers
    - [ ] File Parizo Labs LLC with state Secretary of State
    - [ ] File DBA for Court Reportcard (state or county, depending on location)
    - [ ] Get EIN from IRS
    - [ ] Open business bank account under Parizo Labs LLC
    - [ ] Set up Stripe (or similar) business account once LLC/EIN/bank account are in place
- [ ] Add options to upload NOD/style guide, pleadings, and exhibits
- [ ] Celebrate when a user uploads a perfect transcript (something fun + bonus tokens) — needs a UID per uploaded document to prevent duplicate claims, or a monthly cap on free celebration tokens
- [ ] Survey popup to collect feedback after a key action (e.g. after downloading a transcript)
- [ ] Completeness checklist: flag if standard sections (certificate page, appearances, index) or notations (recess, off-the-record) seem to be missing from an upload — raised by Veronica
- [ ] Allow users to optionally upload audio alongside their transcript; transcribe the audio and diff it against the written transcript to surface additional discrepancies/errors
- [ ] Step 1 — Add chunking to `analyze-case` to support 100+ page transcripts
    - Current bottleneck: Supabase Edge Function has a 135s deadline; most real transcripts are 100+ pages (confirmed by Zoe, users already asking)
    - Split transcript into ~25-page segments, run extraction+proofread per segment, stitch results back together
    - Helpers already exist: `deduplicateTranscript` and `fixAnnotationPositions` handle the stitching
    - This alone should get to 100-150 pages and solve the immediate user problem
- [ ] Step 2 — Add Vercel Workflow on top of chunking if mid-processing failures become a real problem
    - Wraps each chunk as a durable step with no timeout ceiling and resume-on-failure
    - Pricing is event-based (~50k events/month free on Hobby) — essentially free at current scale
    - Only build this if Step 1 chunking alone isn't reliable enough in practice
- [ ] Fix the authenticated/case page on mobile so court reporters can edit on mobile as they go
- [ ] Build a resources/guide landing page that links the transcript proofing checklist PDF (`marketing/guides/transcript-proofing-checklist.pdf`), gated behind an email capture form (no download until email is submitted) — content should get an accuracy pass from someone with real court-reporting expertise (Brandon/Zoe/Veronica) first
- [ ] Send NCRA cold emails — add `?ref=email1` to the URL and ensure telemetry captures it in the `referrer` column of `telemetry_events`
## Done

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
