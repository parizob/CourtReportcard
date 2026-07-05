---
name: add-proofread-rule
description: Guides turning source material into new rules for the court-transcript proofreading prompt (PROOFREAD_ONLY_PROMPT in supabase/functions/analyze-case/prompts.ts, mirrored verbatim in src/lib/gemini.js). Use this whenever the user shares or photographs pages from a court-reporting style guide (Morson's English Guide for Court Reporters, the Gregg Reference Manual, etc.) to incorporate, reports a missed error or a false positive from the proofreader, or asks to "add a rule," "add homophone pairs," "improve the proofreading prompt," "catch more errors," or "stop flagging X." Do NOT use for EXTRACTION_ONLY_PROMPT changes, UI copy, or any prompt work that isn't about PROOFREAD_ONLY_PROMPT's rule content.
---

# Add Proofread Rule

The proofreading prompt catches errors in scanned/dictated court transcripts by pattern-matching against known error types (homophones, steno substitutions, grammar, punctuation). Every new rule added to it either catches more real errors or accidentally suppresses/misfires on correct text — there's no free lunch, so each addition needs the same scrutiny before it goes in.

## 1. Check whether the current prompt already covers this

Before triaging anything, read the current `PROOFREAD_ONLY_PROMPT` in `supabase/functions/analyze-case/prompts.ts` (mirrored in `src/lib/gemini.js`) and check whether the candidate rule — or a guardrail/check that already produces the same effect — is already present. Adding a near-duplicate rule bloats the prompt without adding capability, and can quietly contradict wording that's already there. If the rule is already covered, that's your answer: route it into the "not applicable" bucket below as "already covered" instead of drafting new text for it.

## 2. Triage the source rule into one of four buckets

Not every rule in a style guide is something a text-only AI reviewing a finished transcript can actually apply. Decide which bucket the candidate rule falls into:

- **Mechanically checkable** — verifiable from the text alone, no missing context. Becomes a new active check (can flag and suggest a correction). Example: "only one period when a sentence ends in an abbreviation," "the period goes inside the closing quotation mark."
- **Guardrail only** — reflects a real convention, but the "violation" can't be reliably judged from text alone, because the person who made the call (the reporter, in real time) had information we don't have after the fact — courtroom relationships, who's obligated to answer, vocal inflection at the moment of speech. Becomes a "do NOT flag X" addition. Never an active correction.
- **Not applicable** — the rule doesn't need new prompt text, for any of three reasons: (a) it's already covered by something in the current prompt (per step 1); (b) it's generic, non-court-specific language ability the model already has (e.g., "a sentence ends with a period" needs no court-reporting-specific elaboration); or (c) it depends on something the tool's own pipeline can't represent — e.g., a typesetting convention like spacing after a period, which doesn't survive as a meaningful signal in JSON-extracted transcript text.
- **Drop entirely** — requires context that isn't recoverable from text at all (audio, who addressed whom, real-time courtroom dynamics) and isn't even safe to phrase as a guardrail.

If you're unsure which bucket a rule belongs in, ask: "could the model get this right using only the words on the page, with no assumptions about who's speaking to whom or how it was said?" If no, it's a guardrail at best, not an active check.

## 3. Scope every guardrail narrowly

A guardrail must name the exact error *category* it suppresses — never write a blanket "don't flag this text." A broad guardrail written to kill one false-positive type will silently suppress detection of real, unrelated errors in the same span, which is a worse outcome than the false positive it was meant to prevent.

Bad (too broad): "Don't flag short fragment answers as errors."
Good (scoped): "Don't flag short fragment answers as incomplete sentences or second-guess their terminal punctuation. This does NOT exempt them from spelling, missing-apostrophe, homophone, or capitalization checks." Concrete test: a guardrail like this must still catch `A: Dont recall.` (missing apostrophe) even though the fragment itself is fine.

When drafting a guardrail, always state explicitly which categories still apply to the same text. If you can't name what still applies, the guardrail is too broad.

## 4. Copyright: extract the rule, never the book's expression

Style guides like Morson's or Gregg are commercial, copyrighted works. The underlying rule/idea is not copyrightable, but the book's specific wording, example sentences, and case-name flavor text are. For any rule sourced from one of these:

- Pull out the rule itself, stated as a fact ("a sentence ending in an abbreviation only gets one period").
- Write entirely fresh example sentences. Do not reuse or closely paraphrase the source's examples, character names, or case details — write your own from scratch, unrelated in specifics to the book's illustrations.

This is a hard requirement on every rule sourced from a named guide, not a nice-to-have.

## 5. Check universality before adding to the shared prompt

Ask whether the rule is a universal court-reporting convention (something virtually every reporter follows, regardless of which guide they trained on) or a house-style choice specific to one guide. The project's own `TODO.md` already flags this tension: Zoe doesn't follow one named ruleset, so a rule lifted straight from her copy of Morson's may not generalize.

- Universal → add to the shared `PROOFREAD_ONLY_PROMPT` now.
- Guide-specific, or something a reasonable reporter using a different style could disagree with → do not force it on everyone. Note it as a candidate for the future per-user ruleset selection feature (tracked in `TODO.md` under "Revisit ruleset support") instead of baking it into the default.

If genuinely unsure which bucket a rule falls in, say so to the user rather than guessing — this is exactly the kind of judgment call worth a quick confirmation.

## 6. Default to "warning" + `[sic]` when the source of an error is ambiguous

The prompt already distinguishes two error origins: the reporter mis-heard/mis-struck a word the speaker didn't say (critical, suggest the correction), versus the reporter transcribed accurately but the speaker themselves misspoke (warning, suggest `<original> [sic]`, never silently rewritten). When a new rule's error type could plausibly be either — this comes up constantly with eggcorns/malapropisms like "for all intensive purposes" — default to treating it as the speaker's own error: severity `warning`, suggestion formatted as `<original> [sic]`. Never auto-correct when the origin is ambiguous. This mirrors the prompt's existing stated philosophy of "when in doubt, flag it" without silently rewriting what may have actually been said.

## 7. State severity explicitly for rules that aren't word-substitution errors

The prompt's built-in severity framework (critical = TYPE A reporter/steno substitution, warning = TYPE B speaker error with `[sic]`) exists to resolve one specific ambiguity: whether the reporter misheard a word the speaker never said. Rules that aren't about substituting one word for another — punctuation mechanics, formatting, capitalization — don't have that kind of ambiguity, so that framework gives the model nothing to go on. Leaving severity unstated for these rules doesn't mean "let the model decide sensibly" — it means the model guesses, and the guess will vary run to run.

Severity in this codebase is a strict binary, `critical` or `warning` (see `src/pages/dashboard/DashboardEditor.jsx` and the default in `supabase/functions/analyze-case/index.ts`) — there's no middle tier to lean on. So for every rule outside the word-substitution framework, name its severity directly in the rule text. Default to `warning` unless the error genuinely changes meaning or creates legal risk, per the prompt's own definition of "critical." A double period or a misplaced quotation mark is unambiguously wrong but doesn't meet that bar — it's `warning`.

## 8. Draft in place before touching any file

Write the reworded rule and/or guardrail as a preview first, matching the voice and structure of the existing categories in `prompts.ts` (see how `context`, `grammar`, and `punctuation` are written — short rule statement, then example(s), then any exceptions). Show this to the user and get explicit approval on the wording before editing anything. Do not edit `prompts.ts` (or its mirror) as your first move, even if the rule seems obviously correct — wording is the whole product here, and it's much cheaper to fix in a chat message than after it's live in two files.

## 9. Apply to both files, then validate

Once wording is approved:

1. Edit `supabase/functions/analyze-case/prompts.ts` and `src/lib/gemini.js` together — they must stay byte-for-byte identical for the shared prompt constants (see the comment at the top of `prompts.ts`). Never update one without the other.
2. Run `scripts/run-proofread-test.mjs` against `scripts/test-transcripts/` to check for false-positive regressions before calling the change done. This matters most for any rule with real-world exceptions (numbers formatting, hyphenation, and anything touching sentence-completeness judgment have all been flagged as historically risky in this project) — don't skip validation just because the rule "looks" safe.
3. Report back what changed and what the test run showed, rather than assuming a clean-looking diff is sufficient proof.
