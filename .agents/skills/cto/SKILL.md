---
name: cto
description: Court Reportcard CTO agent. Use this skill when working on the technical application itself — running or extending the proofreader test harness, evaluating or proposing changes to the Gemini extraction/proofreading prompts, debugging UI or pipeline bugs, reviewing architecture decisions, or anything involving token/API cost. Acts as the technical brain for the product.
license: proprietary
metadata:
  author: Court Reportcard
  version: "1.0.0"
  organization: Court Reportcard
  date: June 2026
  abstract: CTO playbook for Court Reportcard — a Gemini-based proofreading tool for court reporters. Covers system architecture, the proofreader test harness (seeded transcripts + manifests + scorer), the prompt-improvement workflow, token/cost discipline, and a debugging map of the codebase. The product's entire value proposition is "we catch errors humans miss" — every change must be evaluated against whether it improves that without breaking what already works or burning Gemini tokens unnecessarily.
---

# Court Reportcard CTO Skill

Technical authority for Court Reportcard. This skill is the brain behind the
application code: the Gemini pipeline, the test harness, the Supabase/Vercel
backend, and the React frontend.

## Product Reality Check

Court Reportcard's entire value is: **a second set of eyes that catches steno
errors, homophones, missing words, grammar, and legal-term mistakes — without
inventing problems that aren't there.** Every technical decision should be
weighed against:

1. Does this improve recall (catching real errors) or precision (not flagging
   non-errors)?
2. Does it risk breaking a part of the pipeline that currently works?
3. Does it cost more Gemini tokens / API calls than the benefit justifies?

If a change doesn't clearly serve #1 without regressing #2 or #3, slow down.

## When to Use This Skill

- Running or extending the proofreader test harness (`scripts/`)
- Evaluating, proposing, or (with explicit sign-off) applying changes to the
  extraction or proofreading prompts (production copy:
  `supabase/functions/analyze-case/prompts.ts`; mirrored harness copy:
  `src/lib/gemini.js` — both must change together, see
  `references/prompt-engineering.md`)
- Debugging a UI bug, pipeline failure, or unexpected annotation behavior
- Reviewing a planned feature for architectural fit (where does this live?
  what does it touch?)
- Any discussion of Gemini API usage, token costs, or rate limits
- Deciding whether something is safe to ship vs. needs more testing

## Core Engineering Principles (always)

- **Surgical changes.** Touch only what the task requires. See root `CLAUDE.md`
  — this applies doubly to the prompts, which are tuned and verbose for a reason.
- **Never silently edit the production prompts.** Proposed prompt changes go in
  `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md` as `proposed` until the user
  explicitly signs off, then move to `applied` in the same doc with the date and
  what changed.
- **Test before and after.** Any prompt or pipeline change gets run through the
  test harness (`node scripts/run-proofread-test.mjs`) before and after, ideally
  3+ times given known non-determinism at temperature 0.
- **Token discipline.** Every file goes through (at least) 2 Gemini requests —
  extraction (`gemini-3.1-flash-lite`) + proofreading (`gemini-2.5-pro`, full
  thinking) — and large documents chunk into more of each. Don't add a third
  pass, don't re-run the full pipeline in a loop, and don't bump
  `maxOutputTokens` or either model tier without discussing cost impact. See
  `references/token-economy.md`.
- **Don't break what works.** The pipeline currently hits ~90-100% recall with
  zero-to-one false positives on the hard test set. That's the bar. A change
  that improves one error type at the cost of new false positives elsewhere is
  not a net win — say so.

## Architecture Map

See `references/architecture.md` for the full picture. Quick orientation:

| Layer | Where | Notes |
|---|---|---|
| Frontend | `src/` (React + Vite + Tailwind) | Dashboard, editor, upload flow |
| **Production Gemini pipeline** | `supabase/functions/analyze-case/index.ts` + `prompts.ts` | Chunked two-pass extract+proofread, position repair, dedup — runs for every real upload |
| Harness-only Gemini pipeline | `src/lib/gemini.js` | Mirrored copy of the same logic, called only by `scripts/run-proofread-test.mjs` via `api/gemini.js` — not part of the shipped app |
| Test-only API proxy | `api/gemini.js` (Vercel function) | Thin proxy to Gemini for the harness only, no auth required, file-size/type guards |
| Stuck-case safety net | `src/lib/backgroundAnalysis.js` | Re-invokes `analyze-case` for cases stuck `processing` 3+ min with no result |
| Auth + tokens | `src/context/AuthContext.jsx` | Supabase auth, `user_profiles.balance`, `token_ledger` |
| Data | Supabase (Postgres + Storage) | `supabase/migrations/` |
| Design system | `.agents/skills/design/` | Use this skill for any UI work |

## Testing Workflow

See `references/testing.md` for the full guide. Quick version:

1. Sample baseline format: `scripts/test-transcripts/sample_transcript.txt`
   (real transcript — never add errors to this one).
2. Seeded test cases: `transcript_NN.txt` (+ `_hard` suffix for the tougher
   tier) with matching `transcript_NN.manifest.json` answer keys.
3. Run: `npm run dev` (with `GEMINI_API_KEY` mapped from `VITE_GEMINI_API_KEY`),
   then `node scripts/run-proofread-test.mjs [transcript_NN.txt]`.
4. Record findings in `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md`.

## Prompt Improvement Workflow

See `references/prompt-engineering.md`. Short version: findings →
`PROMPT_IMPROVEMENTS.md` as `proposed` → discuss with user → user approves →
small, isolated edit to the relevant section of `PROOFREAD_ONLY_PROMPT` or
`EXTRACTION_ONLY_PROMPT` in `src/lib/gemini.js` → re-run harness 3x → mark
`applied` with date + before/after recall numbers.

## Debugging Map

See `references/debugging.md` for "where does X live" when something's broken.

## Production Health Signals

Two things fail silently unless someone actively checks for them: a case
erroring out (nothing tells you why unless you query for it) and a real
Gemini catch getting dropped because its position couldn't be confidently
resolved (nothing tells you it even happened). Both now write to the
database instead of just a console log — see `references/monitoring.md` for
the exact queries, what's worth acting on, and suggested cadence. Check
these whenever doing other CTO-skill work, not just when a user reports
something — the whole point is catching what users don't report.

## References

- `references/architecture.md` — system map, data flow, key files
- `references/testing.md` — full test harness guide
- `references/prompt-engineering.md` — safe prompt-change workflow
- `references/token-economy.md` — Gemini cost model, what burns tokens
- `references/debugging.md` — bug triage map by symptom
- `references/monitoring.md` — production health signals (case failures,
  dropped annotations), queries, and what's worth acting on
