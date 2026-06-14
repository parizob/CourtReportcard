# Proofreader Test Harness Guide

Full reference: `scripts/test-transcripts/README.md`. This is the CTO-level
summary plus operational gotchas.

## What it tests

The harness runs **the real production pipeline** (`extractTranscriptWithGemini`
from `src/lib/gemini.js`, unmodified) against seeded transcripts with known,
hand-placed errors, and scores recall (errors caught), type/severity accuracy,
suggestion correctness, and false positives (unmatched annotations).

## Files

- `scripts/test-transcripts/sample_transcript.txt` — real transcript, the
  **formatting baseline**. Never add errors to this file; it exists purely to
  show correct page-header/line-number/caption/appearances/index/testimony
  structure for new test transcripts to imitate.
- `scripts/test-transcripts/transcript_NN.txt` (and `_hard` tier) — seeded
  test transcripts.
- `scripts/test-transcripts/transcript_NN.manifest.json` — answer key: every
  seeded error's exact `original` substring, `type`, `expected_severity`,
  `expected_suggestion_contains`, plus `false_positive_traps`.
- `scripts/run-proofread-test.mjs` — the runner/scorer.
- `scripts/test-transcripts/results_*.json` — per-run output (gitignored).
- `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md` — living log of findings
  and proposed/applied prompt changes.

## Running it

The harness needs `/api/gemini` reachable, so the Vite dev server must be
running. **Gotcha:** locally the Gemini key is stored as `VITE_GEMINI_API_KEY`
in `.env`, but `api/gemini.js` reads `GEMINI_API_KEY` (the name Vercel uses in
production). Map it when starting dev:

```bash
export GEMINI_API_KEY=$(grep '^VITE_GEMINI_API_KEY=' .env | cut -d= -f2-)
GEMINI_API_KEY="$GEMINI_API_KEY" npm run dev
```

Then, in another shell:

```bash
node scripts/run-proofread-test.mjs                      # all transcripts
node scripts/run-proofread-test.mjs transcript_03_hard.txt  # one
```

Each transcript costs **2 Gemini calls** (extraction + proofreading passes).
Running the full hard set 3x = 18 calls. Be mindful — see
`token-economy.md`.

**Stop the dev server when done** (it holds the port and the mapped env var).

## Known non-determinism

Even at `temperature: 0`, repeated runs on the same transcript can return
different annotations (different type labels, occasional missed/extra
errors). **A single run is not conclusive.** For any "did this prompt change
help" question, run 3x before and 3x after and compare aggregate recall, not
single-run recall.

## Difficulty tiers

- `transcript_01`/`transcript_02` (baseline tier): straightforward steno
  homophones, spelling, grammar, punctuation, `[sic]` cases. Currently at
  ~100% recall — useful as a regression check (did a prompt change break
  something easy?) but won't surface new gaps.
- `transcript_03/04/05_hard`: subtle in-context homophones, multi-error
  sentences, cross-page-break errors, errors buried in long colloquy,
  ambiguous `[sic]`-vs-correction idioms, and heavy correct-legal-Latin
  false-positive traps. ~90% recall as of 2026-06-14 — this is where real
  signal lives.

## Adding new test transcripts

1. Copy `sample_transcript.txt`'s structure (page headers like
   `                                                                           N`,
   line-numbered testimony, A P P E A R A N C E S / I N D E X sections).
2. Plant errors **only in testimony** (the prompt explicitly skips
   CAPTION/INDEX/CERTIFICATE/EXHIBITS/HEADING).
3. For each seeded error, write a manifest entry with the exact `original`
   text as it appears in the file (the scorer does whitespace/case-insensitive
   substring matching — see `findMatch` in the runner).
4. Add `false_positive_traps` — things that look like errors but aren't
   (correct legal-Latin, accepted variants like "pled", correct homophone
   usage in context).
5. Name harder tiers with a clear suffix (`_hard`, and escalate naming if a
   future tier is needed, e.g. `_extreme`) so the directory listing alone
   communicates difficulty.

## Interpreting results for prompt decisions

A finding is **worth a prompt change** if:
- It's reproducible across multiple runs (not one-off non-determinism), AND
- It's a real gap in the prompt's instructions (missing homophone pair,
  missing rule), not an inherent judgment call.

A finding is **noise to log but not act on** if:
- It's a severity/type label drift on an error that was still caught with a
  reasonable suggestion, or
- It's an inherently ambiguous `[sic]`-vs-correct call (see
  `PROMPT_IMPROVEMENTS.md` → "Known judgment calls").

Always weigh a proposed fix against precision: adding more homophone pairs or
loosening "when in doubt, flag it" can increase false positives elsewhere.
Re-run the full set (not just the transcript that surfaced the issue) after
any change.
