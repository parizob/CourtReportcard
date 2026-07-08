# Prompt Engineering Workflow

The two prompts that matter are `EXTRACTION_ONLY_PROMPT` and
`PROOFREAD_ONLY_PROMPT`. **Production** reads them from
`supabase/functions/analyze-case/prompts.ts`; `src/lib/gemini.js` holds a
second, separately maintained copy used only by the test harness and
calibration scripts (see `architecture.md`). They are long, deliberately
verbose, and tuned through real testing. **Treat them like production code
under change control, not like a draft.**

## The rule

**Never edit either prompt directly without explicit user sign-off.** This
applies even if the fix seems obviously correct (e.g. "just add this
homophone pair") — small additions can shift model behavior in unrelated
ways given the prompt's length and the model's non-determinism.

**Both copies must change together.** A change applied only to `gemini.js`
never reaches real users; a change applied only to `prompts.ts` never gets
validated by the harness (which calls the `gemini.js` copy). Drift between
the two means the harness stops meaning anything for production — always
check both are in sync before marking a prompt change `applied`.

## The workflow

1. **Baseline.** Run `node scripts/run-proofread-test.mjs` 3x (full set).
   Record aggregate recall, false positives, type/severity accuracy.
2. **Identify.** Pin the finding to a specific, reproducible gap:
   - Missing instruction (e.g. a homophone pair not in the list)
   - Over-broad instruction causing a false positive (e.g. "correct" an
     accepted variant)
   - Structural issue (e.g. `original` field not a standalone phrase)
3. **Propose.** Add a row to
   `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md` under "Findings":
   theme, observation, suggested change, status = `proposed`. Include the
   exact text you'd add/change and where (which section of which prompt).
4. **Wait for sign-off.** Present the proposal to the user. Do not apply.
5. **Apply (small), to both copies.** Once approved, make the smallest edit
   that addresses the finding — typically adding one line to an existing
   list (e.g. the homophone table) or one bullet to an existing rule
   section — **identically in `prompts.ts` and `gemini.js`**. Match the
   existing tone/format exactly (the prompts use specific formatting:
   `"word1 / word2"` pairs, `"original" (correction)` examples, etc.).
6. **Re-test.** Run the full set 3x again. Compare:
   - Did the targeted issue improve?
   - Did anything regress (new false positives, other misses)?
7. **Record.** Update the `PROMPT_IMPROVEMENTS.md` row to `applied`, with
   date and before/after aggregate numbers.

## What NOT to do

- Don't rewrite a whole section "while you're in there." Surgical edits only.
- Don't add a third pass, a new prompt, or a separate model call to handle an
  edge case — fold it into the existing pass if possible, or flag it as a
  separate feature (e.g. the completeness-checklist idea in `TODO.md` would be
  its own pass and is explicitly a future feature, not a tweak).
- Don't change `temperature`, `maxOutputTokens`, or `model` as a side effect
  of a prompt fix — those are cost/determinism levers, call them out
  separately (see `token-economy.md`).
- Don't "fix" a `[sic]` vs. critical-correction judgment call unless it's
  genuinely reproducible and one-sided. Some ambiguity (idioms, malapropisms)
  is inherent — see `PROMPT_IMPROVEMENTS.md` → "Known judgment calls".

## Format conventions in the existing prompts

- Homophone pairs are listed as `• word1 / word2` in a bulleted table inside
  `PROOFREAD_ONLY_PROMPT`, grouped under the `"context"` error type.
- Each error type has: a definition line, then `Examples:` with
  `"wrong" (correct)` pairs.
- The severity/`[sic]` rules are centralized under "CRITICAL RULE — TRANSCRIPTS
  RECORD WHAT WAS SPOKEN" and "RULES" — don't duplicate severity logic
  elsewhere in the prompt.
- The output JSON schema example at the bottom of `PROOFREAD_ONLY_PROMPT`
  doubles as a few-shot example (it shows one `critical`/context and one
  `warning`/`[sic]` annotation). If a new error category needs a few-shot
  example, consider whether extending this schema example (rather than adding
  prose) is more effective — but this is a bigger change and needs explicit
  discussion before attempting.
