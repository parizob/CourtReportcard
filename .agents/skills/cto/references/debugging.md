# Debugging Map — Where Does X Live?

Triage by symptom. Reproduce before fixing — for anything proofreading-related,
use the test harness (`testing.md`) to get a concrete repro rather than
reasoning from code alone.

## "Gemini missed an error" / "Gemini flagged something wrong" (false positive)

- This is a **prompt** issue, not a code bug. Go to `prompt-engineering.md`.
- Reproduce with the test harness first — add a manifest entry if it's a new
  case worth tracking long-term.
- Do not "fix" by post-processing annotations in `gemini.js` /
  `analyze-case/index.ts` unless the issue is structural (e.g. malformed
  `original` field, bad offsets) — those are code bugs; wrong-word/wrong-type
  judgment is a prompt issue.

## "Highlight is in the wrong place" / "annotation doesn't line up with text"

- `src/lib/gemini.js` (client-side re-fix, used by `DashboardEditor.jsx`) and
  `supabase/functions/analyze-case/index.ts` (server-side, production
  pipeline — separately maintained copy, not auto-synced): `flexFind`,
  `fixAnnotationPositions`, `buildCleanContentMap`. This is the
  position-repair logic that compensates for Gemini's unreliable offsets and
  occasional wrong `entry_id`.
- Check: does `flexFind` need a new fallback strategy for this transcript's
  formatting (e.g. a new kind of page-break pattern)? `flexFind` already has
  4 tiers (exact → case-insensitive → whitespace-flexible → cross-page-break).
- If the `original` string itself is wrong/malformed (not a complete word or
  phrase), that's a prompt issue — see above.
- **2026-07-08 incident:** a real case had annotations displayed on
  unrelated sentences (explanation describing content that didn't match
  what was highlighted) — caused by `fixAnnotationPositions`'s entry_id
  mismatch recovery blindly grabbing the first document-wide text match for
  common words ("on", "any", "same"). Fixed with a tiered
  nearby-window-first, unique-match-only recovery strategy, plus a prompt
  change (self-verify `entry_id`, require unique phrasing for common words —
  see `PROMPT_IMPROVEMENTS.md`). Any annotation that still can't be
  confidently placed is dropped and counted rather than guessed at — see
  `monitoring.md` → `case_metrics.dropped_annotations_count` for how to
  check whether this is happening and how often.

## "Applying a correction broke the line numbers / column formatting"

- `src/lib/gemini.js`: `applyCorrection`, `_reflowLines`, `_detectColumnWidth`,
  `_tokenize`. This handles word-for-word replacement across line breaks and
  re-flows overflow to the next numbered line.
- Reproduce with a specific transcript + annotation; these functions are
  pure and unit-testable in isolation (no Gemini call needed).

## "Duplicate entries" / "annotation pointing at wrong entry_id"

- `deduplicateTranscript` — production copy in
  `supabase/functions/analyze-case/index.ts`, mirrored in `src/lib/gemini.js`
  (test harness / calibration scripts only). Runs after Pass 1 extraction to
  collapse duplicate `{speaker, text}` entries and remap annotation
  `entry_id`s and positions.

## "Upload failed" / "extraction never completes"

- **First stop:** `select name, last_error, created_at from public.cases
  where id = '<case_id>'` (or by name/user if you don't have the id yet).
  `handleFailure` in `supabase/functions/analyze-case/index.ts` writes a
  `[stage] message` string here on every hard failure and should answer "why
  did it fail" (which chunk/batch/attempt, what error) without needing to
  dig through logs. See `monitoring.md` for how to scan across all cases,
  not just one.
- All real analysis runs in the `analyze-case` Edge Function — see
  `architecture.md` for the full chunking/extraction/proofread/finalize flow.
  There is no separate client-driven analysis path to check.
  `src/lib/backgroundAnalysis.js`'s `retryStuckCases()` is a client-side
  safety net only — it re-invokes `analyze-case` for cases stuck
  `'processing'` for 3+ minutes with no extracted result, in case the
  original invoke from `DashboardUpload.jsx` never reached the server. If a
  case is stuck (not failed — `last_error` is null and it's just sitting in
  `'processing'`), this is the first thing to check for.
- RTF/CRE files: `src/lib/rtf.js` (client, page counting) — actual
  RTF-stripping for the extraction call happens in `index.ts` itself, not
  the browser. Garbled/empty extracted text on RTF uploads points here.
- `api/gemini.js` is **not part of the upload/analysis path** — it's only
  called by the test harness and calibration scripts. Don't look here for a
  real user's failed upload.

## "Token balance didn't update" / "spend didn't happen"

- `src/context/AuthContext.jsx`: `spendTokens`, `fetchTokenBalance`,
  `refreshTokens`. Check `user_profiles.balance` and `token_ledger` directly
  in Supabase if the UI seems stale — `refreshTokens` may just need to be
  called after an action.

## "Local dev can't reach Gemini" / `GEMINI_API_KEY not configured`

- `.env` has the key as `VITE_GEMINI_API_KEY`; `api/gemini.js` reads
  `GEMINI_API_KEY`. Map it for local dev (see `testing.md`). This is a known
  naming mismatch between local and Vercel — flag to the user if it causes
  recurring friction, but don't "fix" by renaming without checking Vercel's
  configured env var name first (changing it locally is much lower risk than
  changing it in production).

## UI bugs (layout, styling, component behavior)

- Defer to the `design` skill for anything visual — tokens, components,
  typography all live in `.agents/skills/design/references/`.
- Component locations: `src/components/` (shared), `src/pages/dashboard/`
  (dashboard screens), `src/pages/` (marketing/public pages).
- `src/context/AuthContext.jsx` + `src/components/SignInModal.jsx` for
  auth-related UI.

## Telemetry

- `src/lib/telemetry.js`, `src/components/TelemetryTracker.jsx`,
  `src/pages/dashboard/DashboardTelemetry.jsx`, and the
  `supabase/migrations/20260609201911_create_telemetry_events.sql` table.
  `trackEvent()` calls are scattered through components with `data-track-id`
  attributes — useful for understanding what user actions are instrumented
  when debugging a "why didn't we see this event" question.
