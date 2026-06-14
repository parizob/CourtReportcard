# Architecture Map

## Stack

- **Frontend:** React 18 + Vite + Tailwind. SPA, client-side routing.
- **Backend:** Vercel serverless functions (`api/`).
- **AI:** Google Gemini (`gemini-2.5-pro`) via `api/gemini.js`.
- **Data/Auth/Storage:** Supabase (Postgres, Auth, Storage).
- **Deploy:** Vercel (`vercel.json` rewrites everything to the SPA shell).

## Request flow: upload → proofread

1. **Upload** (`src/pages/dashboard/DashboardUpload.jsx`) — user uploads a
   transcript file (RTF/CRE/TXT/PDF). Page count is estimated
   (`src/lib/pageCount.js`) and tokens are spent via `spendTokens` in
   `AuthContext` (1 token per page, `user_profiles.balance`).
2. **Background extraction** (`src/lib/backgroundAnalysis.js`) —
   `startAnalysis(caseId, files, userId)`:
   - For PDFs: reads as `ArrayBuffer`, passes to Gemini as inline file data.
   - For RTF/CRE/TXT: strips RTF (`src/lib/rtf.js` / `parseRtf.js`), passes
     raw text.
   - Calls `extractTranscriptWithGemini` (the two-pass pipeline below).
   - Writes the extracted JSON (`entries` + `annotations`) to Supabase
     Storage, updates `case_files`, `case_metrics`, and `cases.status`.
3. **Two-pass Gemini pipeline** (`src/lib/gemini.js`):
   - **Pass 1 — `EXTRACTION_ONLY_PROMPT`**: extracts the entire transcript
     into structured `{ speaker, text }` entries. No proofreading. Includes
     cover/appearances/index/certificate/exhibits/testimony, each labeled.
   - **Dedup** (`deduplicateTranscript`): removes duplicate entries Gemini
     sometimes emits, remaps annotation `entry_id`s.
   - **Pass 2 — `PROOFREAD_ONLY_PROMPT`**: takes the clean entries (testimony
     only — CAPTION/INDEX/CERTIFICATE/EXHIBITS/HEADING are skipped) and
     returns `annotations`: `{ type, severity, original, suggestion,
     explanation, confidence }`.
   - **Position repair** (`fixAnnotationPositions` / `flexFind`): Gemini's
     character offsets are unreliable, so annotations are relocated by
     searching for the `original` string (exact → case-insensitive →
     whitespace-flexible → cross-page-break-tolerant).
4. **Editor** (`src/pages/dashboard/DashboardEditor.jsx`) — renders entries
   with inline annotation highlights. "Re-analyze" calls
   `proofreadTranscript(entries)` (Pass 2 only, no re-extraction).
   `applyCorrection` (in `gemini.js`) applies an accepted suggestion back into
   the entry text, preserving line numbers / column width via `_reflowLines`.
5. **Export** (`src/pages/dashboard/DashboardExport.jsx`) — produces the final
   corrected transcript.

## `api/gemini.js` (the only Gemini-facing endpoint)

- POST only. Requires `process.env.GEMINI_API_KEY` (server-side, set in
  Vercel — **note: locally this lives under `VITE_GEMINI_API_KEY` in `.env`,
  see `references/testing.md`**).
- **No user auth check** — it's a thin proxy. Token spending happens
  client-side in `AuthContext.spendTokens`, separately from this endpoint.
  This is why the test harness can call it directly without faking a session.
- Guards: 1MB max file size, plain-text/UTF-8 validation, `temperature: 0`,
  `maxOutputTokens: 131072`, `responseMimeType: 'application/json'`.

## Auth & Tokens (`src/context/AuthContext.jsx`)

- `user_profiles.balance` — token balance (signup grant currently 50, see
  root `TODO.md`).
- `spendTokens(amount)` — decrements balance, inserts a `token_ledger` row
  with `type: 'spend'`. Used on upload (per page) and on re-analyze.
- `refreshTokens()` — re-fetches balance from Supabase.

## Internal-only / not shipped

- `TODO.md` (repo root) — internal task list.
- `scripts/` — test harness, not bundled by Vite (only `src/` and `public/`
  ship).
- `.agents/skills/` — skill definitions (cmo, design, cto,
  supabase-postgres-best-practices) — internal authoring aids, not shipped.
