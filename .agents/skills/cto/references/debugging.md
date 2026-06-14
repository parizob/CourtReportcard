# Debugging Map — Where Does X Live?

Triage by symptom. Reproduce before fixing — for anything proofreading-related,
use the test harness (`testing.md`) to get a concrete repro rather than
reasoning from code alone.

## "Gemini missed an error" / "Gemini flagged something wrong" (false positive)

- This is a **prompt** issue, not a code bug. Go to `prompt-engineering.md`.
- Reproduce with the test harness first — add a manifest entry if it's a new
  case worth tracking long-term.
- Do not "fix" by post-processing annotations in `gemini.js` unless the issue
  is structural (e.g. malformed `original` field, bad offsets) — those are
  code bugs; wrong-word/wrong-type judgment is a prompt issue.

## "Highlight is in the wrong place" / "annotation doesn't line up with text"

- `src/lib/gemini.js`: `flexFind`, `fixAnnotationPositions`,
  `buildCleanContentMap`. This is the position-repair logic that compensates
  for Gemini's unreliable offsets.
- Check: does `flexFind` need a new fallback strategy for this transcript's
  formatting (e.g. a new kind of page-break pattern)? `flexFind` already has
  4 tiers (exact → case-insensitive → whitespace-flexible → cross-page-break).
- If the `original` string itself is wrong/malformed (not a complete word or
  phrase), that's a prompt issue — see above.

## "Applying a correction broke the line numbers / column formatting"

- `src/lib/gemini.js`: `applyCorrection`, `_reflowLines`, `_detectColumnWidth`,
  `_tokenize`. This handles word-for-word replacement across line breaks and
  re-flows overflow to the next numbered line.
- Reproduce with a specific transcript + annotation; these functions are
  pure and unit-testable in isolation (no Gemini call needed).

## "Duplicate entries" / "annotation pointing at wrong entry_id"

- `src/lib/gemini.js`: `deduplicateTranscript`. Runs after Pass 1 extraction
  to collapse duplicate `{speaker, text}` entries and remap annotation
  `entry_id`s and positions.

## "Upload failed" / "extraction never completes"

- `src/lib/backgroundAnalysis.js`: `startAnalysis` — check `activeJobs` map,
  Supabase `cases.status` transitions (`processing` → `analyzed` or back to
  `uploaded` on error), and `case_files`/`case_metrics` writes.
- `api/gemini.js`: check for `TRANSCRIPT_TOO_LARGE` (1MB file cap),
  `415` (non-plain-text content), or missing `GEMINI_API_KEY`.
- RTF/CRE files: `src/lib/rtf.js` / `parseRtf.js` — stripping issues would
  surface as garbled or empty extracted text.

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
