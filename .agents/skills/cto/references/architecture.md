# Architecture Map

## Stack

- **Frontend:** React 18 + Vite + Tailwind. SPA, client-side routing.
- **Analysis pipeline:** Supabase Edge Function (`analyze-case`, Deno/TypeScript)
  — runs entirely server-side. The browser never calls Gemini for a real
  upload.
- **AI:** Google Gemini — `gemini-3.1-flash-lite` for extraction,
  `gemini-2.5-pro` for proofreading (see "Two-pass Gemini pipeline" below).
- **Data/Auth/Storage:** Supabase (Postgres, Auth, Storage).
- **Email:** Resend (`sendEmail` in `index.ts`) — success/failure notifications.
- **Deploy:** Vercel for the frontend (`vercel.json` rewrites everything to the
  SPA shell); Supabase for the Edge Function and database.

## Request flow: upload → proofread → email

1. **Upload** (`src/pages/dashboard/DashboardUpload.jsx`) — user uploads a
   `.txt`/`.rtf` transcript. Page count is estimated client-side
   (`src/lib/pageCount.js`) and tokens are spent up front via `spendTokens`
   in `AuthContext` (1 token per page, `user_profiles.balance`).
   - Creates the `cases` row, uploads the file to Supabase Storage, inserts
     a `case_files` row (`file_type: 'transcript'`), sets `cases.status =
     'processing'`, then invokes the `analyze-case` Edge Function with
     `{ case_id }` and **awaits confirmation of the handoff** (not the
     analysis itself — supabase-js resolves with `{ error }` on function
     invoke failures instead of throwing, so this has to be checked
     explicitly or a failed handoff leaves the case stuck forever).
   - If invoke confirmation fails, tokens are refunded and the case is
     soft-deleted client-side — the same failure path used elsewhere.
   - The user is told to close the tab; they get an email when it's done.
2. **`analyze-case` Edge Function** (`supabase/functions/analyze-case/index.ts`)
   — one HTTP request does the entire two-pass pipeline for every file on the
   case, synchronously, subject to a 135s deadline (Edge Functions are
   hard-killed at 150s; the deadline leaves room for the failure path —
   refund + cleanup + email — to still run if analysis itself times out).
   - **Chunking** (large-document support): if the transcript is above
     `CHUNK_THRESHOLD_PAGES` (20), it's split into ~`PAGES_PER_CHUNK` (15)
     chunks at speaker-turn boundaries (mirrors `src/lib/chunkSplit.js`),
     each extracted separately with trailing context carried forward, then
     merged. Below the threshold, it's a single extraction call — unchanged
     behavior for the majority of (smaller) real-world traffic.
   - **Retries:** each chunk/proofread-batch gets up to `MAX_CHUNK_ATTEMPTS`
     (3) attempts before falling through to `handleFailure`.
   - **Pass 1 — extraction** (`EXTRACTION_ONLY_PROMPT`, `gemini-3.1-flash-lite`):
     extracts the transcript into structured `{ speaker, text }` entries, no
     proofreading. Includes cover/appearances/index/certificate/exhibits/
     testimony, each labeled.
   - **Dedup** (`deduplicateTranscript`): removes duplicate entries Gemini
     sometimes emits across chunk boundaries, remaps annotation `entry_id`s.
   - **Pass 2 — proofread** (`PROOFREAD_ONLY_PROMPT`, `gemini-2.5-pro`):
     testimony entries only (CAPTION/INDEX/CERTIFICATE/EXHIBITS/HEADING are
     skipped) are proofread in batches of `ENTRIES_PER_PROOFREAD_BATCH` (300),
     with `CONTEXT_ENTRIES` (8) carried from the previous batch. Returns
     `annotations`: `{ type, severity, original, suggestion, explanation,
     confidence, entry_id }`.
   - **Position repair** (`fixAnnotationPositions` / `flexFind`): Gemini's
     `entry_id`/offsets are sometimes wrong. `flexFind` searches for the
     `original` string (exact → case-insensitive → whitespace-flexible →
     cross-page-break-tolerant). If it's not in the claimed `entry_id`,
     `fixAnnotationPositions` looks for a *unique* match within
     `ANNOTATION_REPAIR_WINDOW` (15 entries), then a *unique* match
     anywhere in the document; if neither is unique, the annotation is
     **dropped** (counted, not guessed at — see `monitoring.md`).
   - **Finalize:** writes the extracted+annotated JSON to Storage
     (`case_files`, `file_type: 'extracted'`), upserts `case_metrics`
     (`total_entries`, `total_issues`, `dropped_annotations_count`), sets
     `cases.status = 'analyzed'`, and emails the user a success notification
     via Resend.
   - **On failure** (`handleFailure`): refunds tokens, deletes the case's
     storage files and `case_files` rows, soft-deletes the case
     (`status: 'deleted'`), writes a `[stage] message` string to
     `cases.last_error`, and emails a failure notification.
3. **Editor** (`src/pages/dashboard/DashboardEditor.jsx`) — renders entries
   with inline annotation highlights and lets the user accept/reject each
   one. `applyCorrection` (in `src/lib/gemini.js`) applies an accepted
   suggestion back into the entry text, preserving line numbers/column width
   via `_reflowLines`. The editor imports only the post-processing helpers
   from `gemini.js` (`fixAnnotationPositions`, `deduplicateTranscript`,
   `flexFind`, `applyCorrection`, `buildCleanContentMap`) — **it does not
   call Gemini itself**; all analysis already happened server-side before
   the case reached `'analyzed'`.
4. **`src/lib/backgroundAnalysis.js`** — not the analysis path. It's a
   client-side safety net: `retryStuckCases()` re-invokes `analyze-case` for
   any of the current user's cases still `'processing'` after
   `STUCK_AFTER_MS` (3 min) with no extracted result yet, covering the case
   where the initial invoke never reached the server (e.g. tab closed too
   fast). The Edge Function is idempotent, so re-invoking is safe.
5. **Export** (`src/pages/dashboard/DashboardExport.jsx`) — produces the
   final corrected transcript.

## `src/lib/gemini.js` vs `supabase/functions/analyze-case/index.ts`

These are **two separately maintained copies of the same logic**, not one
shared module — Deno Edge Functions can't import from `src/`. `gemini.js` is
the browser-side copy (used by `DashboardEditor.jsx` for post-processing, and
by the test harness / calibration scripts in `scripts/` to call Gemini
directly via `api/gemini.js`). `index.ts` is the production copy that
actually runs for every real upload. Both files say so in a header comment.
**Whenever you change extraction/proofread/dedup/position-repair logic or
either prompt, update both files** — `prompts.ts` (used by `index.ts`) and
the prompt constants in `gemini.js` must stay in sync (see the `cto` skill's
core rule on this).

## `api/gemini.js` (Vercel function — test harness only, not production)

- POST only. Requires `process.env.GEMINI_API_KEY` (set in Vercel — locally
  it lives under `VITE_GEMINI_API_KEY` in `.env`, see `references/testing.md`).
- **Not called anywhere in the shipped app.** `DashboardEditor.jsx` doesn't
  call Gemini at all (see above); the only caller is
  `scripts/run-proofread-test.mjs`, via `extractTranscriptWithGemini` in
  `gemini.js` (the harness's only exported entry point — there is no
  `proofreadTranscript`/re-analyze function in `gemini.js`). The
  `scripts/calibrate-*.mjs` scripts don't go through this endpoint at all —
  they call the Gemini API directly with their own `fetch`, reading prompts
  straight from `prompts.ts`.
- No user auth check — it's a thin proxy, fine for this since only the test
  harness hits it, never a real user session.
- Guards: 1MB max file size, plain-text/UTF-8 validation, `temperature: 0`,
  `maxOutputTokens: 131072`, `responseMimeType: 'application/json'`.

## Auth & Tokens (`src/context/AuthContext.jsx`)

- `user_profiles.balance` — token balance (signup grant currently 50, see
  root `TODO.md`).
- `spendTokens(amount)` — decrements balance, inserts a `token_ledger` row
  with `type: 'spend'`. Used on upload (per page); charged up front and
  refunded by either the client (handoff failure) or the Edge Function
  (`handleFailure`, analysis failure) if things don't complete.
- `refreshTokens()` — re-fetches balance from Supabase.

## Production health signals

`cases.last_error` and `case_metrics.dropped_annotations_count` — see
`references/monitoring.md` for what they mean and how to check them.

## Internal-only / not shipped

- `TODO.md` (repo root) — internal task list.
- `scripts/` — test harness + calibration scripts, not bundled by Vite (only
  `src/` and `public/` ship). `run-proofread-test.mjs` is the only real
  caller of `api/gemini.js`; the calibration scripts call Gemini directly.
- `.agents/skills/` — skill definitions (cmo, cpo, cto, design,
  supabase-postgres-best-practices) — internal authoring aids, not shipped.
