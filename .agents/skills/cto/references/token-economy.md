# Token & Cost Economy

Two different "tokens" exist in this product — don't conflate them.

## 1. User-facing tokens (product currency)

- Stored in `user_profiles.balance`, managed via `AuthContext.spendTokens` /
  `refreshTokens`, logged in `token_ledger`.
- Spent on upload (roughly 1 token per page, see `src/lib/pageCount.js`) and
  on "Re-analyze" in the editor.
- Signup grant is currently 50 (see root `TODO.md` for the 50-vs-100
  discussion — that's a product/growth decision, not a technical one).
- `api/gemini.js` itself does **not** check balance — balance checks happen
  client-side before the call is made. This is fine in practice because
  `api/gemini.js` is only called by the test harness/calibration scripts,
  never by a real user session (see `architecture.md`) — real uploads charge
  tokens in `DashboardUpload.jsx` before the `analyze-case` Edge Function is
  ever invoked.

## 2. Gemini API tokens (real cost — production)

This is the one to be careful with from an engineering standpoint. Production
(`supabase/functions/analyze-case/index.ts`) uses **two different models**,
not one — don't assume both passes cost/behave the same:

- **Extraction** — `gemini-3.1-flash-lite`. Measured (`scripts/
  calibrate-extraction-model.mjs`) at ~51% faster and ~48% cheaper per page
  than `gemini-2.5-flash` with matching entry counts. Runs once per chunk for
  documents over `CHUNK_THRESHOLD_PAGES` (20 pages) — see `architecture.md`.
- **Proofreading** — `gemini-2.5-pro`, uncapped thinking. "Full quality here
  because proofreading IS the product" per the code comment. Runs once per
  batch of `ENTRIES_PER_PROOFREAD_BATCH` (300 entries).
- A single-file upload is therefore: **1+ extraction calls** (1 if ≤20
  pages, else 1 per ~15-page chunk) **+ 1+ proofreading calls** (1 per
  300-entry batch), all against the Edge Function's 135s wall-clock budget.
- `maxOutputTokens: 131072`, `temperature: 0` — same as before, don't change
  either casually (temperature 0 doesn't guarantee determinism, see
  `testing.md`, but is still the right default for reproducibility).
- **Test harness / `gemini.js`:** as of 2026-07-08 this uses the same model
  split as production (fixed — it previously hardcoded `gemini-2.5-pro` for
  both passes, see `testing.md`). `api/gemini.js`'s `ALLOWED_MODELS`
  allowlist and `thinkingConfig` passthrough need to stay in sync with
  whatever `index.ts` uses, or a model/thinking-budget change in production
  will silently not take effect in the harness (the API route falls back to
  `DEFAULT_MODEL` for anything not on the allowlist rather than erroring).
  Harness timing still isn't a precise stand-in for production cost (no
  chunking, different call overhead) — use the calibration scripts for that.
- There is no client-side "re-analyze" feature currently shipped
  (`DashboardEditor.jsx` only post-processes annotations already produced by
  the Edge Function) and no `proofreadTranscript`/proofread-only entry point
  in `gemini.js` either — `extractTranscriptWithGemini` (full two-pass) is
  the only exported Gemini-calling function, and only the test harness calls
  it.

## Engineering rules of thumb

- **Don't add a third Gemini pass** to the production pipeline without
  discussing cost with the user. A completeness-checklist feature (in
  `TODO.md`) would be a new pass and should be scoped/costed explicitly before
  building.
- **Don't loop the pipeline.** The test harness calling 5 transcripts x 2
  passes x 3 runs = 30 calls is fine for occasional QA, but don't wire
  anything into CI or a cron that re-runs the full harness automatically
  without the user opting in.
- **Don't increase input size casually.** The proofreading pass sends the
  *entire* entries JSON. A feature that adds a lot of per-entry metadata
  (e.g. dictionary lookups, address-verification results) sent into that
  prompt increases token cost on every call — consider whether such data
  needs to go to Gemini at all, or can be handled in a separate, targeted
  call/feature.
- **Analysis runs per uploaded file** (`analyze-case/index.ts` loops the
  case's `case_files`) — a multi-file case multiplies the per-file call cost
  (itself variable now, since extraction may be 1 or many chunk calls — see
  above). Be aware of this when estimating cost for bulk-upload-related
  features.

## When estimating cost for a new feature

State explicitly: how many new Gemini calls per user action, and roughly how
much input/output size each adds. This is the number that matters for beta
budget — not lines of code.
