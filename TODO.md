# Court Reportcard — Internal TODO

Internal task list / project notes. Not shipped to the site (Vite only bundles `src/` and `public/`).

## Open

- [ ] Identify addresses in documents and hook up a tool to look up/verify they're correct
- [ ] Allow stenographers to upload their dictionaries so we can store them and know which words they typically write / have saved more than others
- [ ] Set up Parizo Labs LLC, with DBA as Court Reportcard, so we can charge customers
- [ ] Add options to upload NOD/style guide, pleadings, and exhibits
- [ ] Celebrate when a user uploads a perfect transcript (something fun + bonus tokens) — needs a UID per uploaded document to prevent duplicate claims, or a monthly cap on free celebration tokens
- [ ] Survey popup to collect feedback after a key action (e.g. after downloading a transcript)
- [ ] Completeness checklist: flag if standard sections (certificate page, appearances, index) or notations (recess, off-the-record) seem to be missing from an upload — raised by Veronica
- [ ] Allow users to optionally upload audio alongside their transcript; transcribe the audio and diff it against the written transcript to surface additional discrepancies/errors
- [ ] Add chunking to analyze-case so transcripts up to ~100 pages process in one upload without hitting the edge function's 135s deadline — split into segments, run extraction+proofread per segment, stitch entries/annotations back together (reuse deduplicateTranscript/fixAnnotationPositions)
- [ ] Fix confirm password field layout on mobile (misaligned)
- [ ] Fix the authenticated/case page on mobile so court reporters can edit on mobile as they go
- [ ] Create a free downloadable guide for court reporters (marketing/traffic driver) — hide an easter egg inside, e.g. "I love Court Reportcard" written in steno, email it in for free tokens

## Done

- [x] Background processing: Gemini calls moved to async background function; upload page saves file and returns immediately, dashboard polls for completion — fixes stay-on-screen problem and token loss on navigation
- [x] Decided to keep free signup tokens at 50; top up manually on request during beta
- [x] Refund tokens on failed uploads — if a transcript errors out (e.g. too large, needs to be split), the user should not be charged; credits should be returned automatically
- [x] Build a testing bot: run against existing/uploaded transcripts, or have an agent generate new sample transcripts with known seeded errors, to verify Court Reportcard catches them all — `scripts/run-proofread-test.mjs` + `scripts/test-transcripts/` (5 seeded transcripts, manifests, recall/false-positive scoring, and UI apply/highlight/round-trip integrity checks)
