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
  client-side before the call is made. Don't assume the API is protected by
  token balance; it's protected only by file-size/type guards and the
  `GEMINI_API_KEY`.

## 2. Gemini API tokens (real cost, `gemini-2.5-pro`)

This is the one to be careful with from an engineering standpoint.

- Every `extractTranscriptWithGemini` call = **2 requests** to
  `gemini-2.5-pro`: extraction pass (can include a full PDF as inline data)
  and proofreading pass (full entry JSON, can be large for long transcripts).
- `proofreadTranscript` (re-analyze) = **1 request** (proofreading pass only).
- `maxOutputTokens: 131072` per call — already generous; raising it further
  has direct cost and latency impact.
- `temperature: 0` is set deliberately for reproducibility (though, per
  `testing.md`, it doesn't guarantee determinism) — don't change this casually.

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
- **Background analysis runs per uploaded file** (`backgroundAnalysis.js`
  loops `files`) — a multi-file upload multiplies the 2-call cost per file.
  Be aware of this when estimating cost for bulk-upload-related features.

## When estimating cost for a new feature

State explicitly: how many new Gemini calls per user action, and roughly how
much input/output size each adds. This is the number that matters for beta
budget — not lines of code.
