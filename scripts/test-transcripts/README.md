# Proofreader Test Harness

Internal QA for the Gemini proofreading pipeline. Not shipped to the site.

## Files

- `sample_transcript.txt` — real transcript, the **formatting baseline** all
  seeded transcripts imitate. Do not add errors to this one.
- `transcript_NN.txt` — seeded test transcripts (deliberate, known errors).
- `transcript_NN.manifest.json` — answer key for each: every seeded error with
  its expected type, severity, and suggestion, plus false-positive traps.
- `results_*.json` — output from a test run (gitignore-able).
- `PROMPT_IMPROVEMENTS.md` — living log of recommended prompt changes.

## Running

```bash
npm run dev                          # serves /api/gemini at http://localhost:3000
node scripts/run-proofread-test.mjs  # all transcripts
node scripts/run-proofread-test.mjs transcript_01.txt   # one
```

The runner imports the real `extractTranscriptWithGemini` from
`src/lib/gemini.js`, so it exercises the exact production prompt and
post-processing — it just rewrites the relative `/api/gemini` fetch to the local
server. It reports recall (seeded errors caught), type/severity accuracy, and
possible false positives.

## Adding a new test transcript

1. Copy the format of `sample_transcript.txt` (page headers, line numbers,
   caption / appearances / index / testimony).
2. Plant errors in the **testimony** only (the prompt skips CAPTION/INDEX/etc.).
3. Write a matching `transcript_NN.manifest.json` with the exact `original`
   substring for each error so the scorer can locate it.
