# Prompt Improvement Log (Living Document)

Recommended changes to the proofreading prompt (`PROOFREAD_ONLY_PROMPT` in
`src/lib/gemini.js`), derived from test-harness findings.

**This is a recommendations log only. Do NOT apply changes here without explicit
sign-off — the prompt is not edited by the test harness.**

How to use: run `node scripts/run-proofread-test.mjs` (with `npm run dev`
running), then record below any seeded error that was missed, mis-typed,
mis-severitied, or any false positive that recurs. Group by theme so we can
make one deliberate prompt edit per theme rather than thrashing the prompt.

---

## Findings

_(populated after each test run — newest first)_

### Rule: 2026-07-08 — Unique locatability + entry_id self-verification — PROPOSED, awaiting sign-off

**Not from a test-harness run — from a real production case.** A user
(Zoe) reported several annotations displayed on completely unrelated
sentences, with explanations describing content ("an order", "the
speaker's neck", "entry 722... pain") that had nothing to do with the
highlighted text. All examples were common short words ("on", "any",
"same").

**Root cause:** the app-side position-repair logic (`fixAnnotationPositions`
in `src/lib/gemini.js` / `supabase/functions/analyze-case/index.ts`)
relocates an annotation when its claimed `entry_id` doesn't contain the
`original` text. This is a code-level rescue mechanism, not a prompt issue —
but the prompt is the only place we can reduce how often the model emits a
mismatched `entry_id` in the first place, and the only place we can make the
`original` field distinctive enough that our code can relocate it correctly
when a mismatch does happen. (A code-level fix already shipped 2026-07-08 —
windowed-nearby-match repair + logging + drop-if-truly-ambiguous — but that's
a safety net, not a fix for the underlying cause.)

**Proposed additions to `PROOFREAD_ONLY_PROMPT`:**

1. Extends the existing "original field must be a COMPLETE standalone word
   or phrase" rule (line 312):
   ```
   - UNIQUE LOCATABILITY FOR COMMON WORDS: If the flagged word or phrase is a common word likely to appear more than once in this transcript (an article, preposition, pronoun, conjunction, or other short function word — "on", "any", "same", "the", "it", "that", etc.), the "original" field must include enough surrounding words to make this specific occurrence unique, not just the bare word alone. Example: instead of original "same", use original "give you the same courtesy". This does not apply to rare or distinctive words/phrases that are unlikely to repeat elsewhere in the transcript.
   ```
2. Extends the existing "each annotation must reference the entry_id of the
   entry containing the error" rule (line 349):
   ```
   - VERIFY ENTRY_ID BEFORE OUTPUT: Before including any annotation, confirm the "original" text is verbatim present in the specific entry cited as "entry_id" — not merely present somewhere else in the transcript. If your explanation references another entry as supporting context (e.g., "based on how the witness answered in an earlier entry"), "entry_id" must still be the entry where the error itself physically appears, never the context entry you're citing for reasoning. If you cannot verify the flagged text is actually in the entry you're citing, correct "entry_id" to the right entry or do not output the annotation.
   ```

**Validation plan:** baseline full 5-transcript set, 3 runs, before editing.
Apply both additions to `prompts.ts` and `gemini.js` identically. Re-run full
set 3x. Compare aggregate recall, false positives, and (new focus) whether
`original` fields get needlessly padded with extra words on rare/distinctive
matches where it isn't required — that would be a regression in the
opposite direction (a good exact match becoming an over-broad one, which
could reduce `flexFind` precision on subtly different repeated phrasing).

**Validation results:**
- **Before (baseline, 3 runs):** 32/35, 32/35, 32/35 → 96/105 (91.4%)
  aggregate recall. False positives: 1, 1, 3 (all recurring known noise —
  see below). UI apply/highlight integrity: 33/33, 33/33, 35/35 (100%
  clean).
- **After (3 runs):** 33/35, 32/35, 32/35 → 97/105 (92.4%) aggregate
  recall. False positives: 3, 2, 2. UI apply/highlight integrity: 36/36,
  34/34, 34/34 (100% clean).
- Recall is unchanged within the pipeline's known run-to-run
  non-determinism (same single pre-existing miss, "supreme court" in
  transcript_05_hard, in 2/3 runs both before and after).
- Every false positive in both before and after sets is one of three
  already-documented recurring items ("Its" → "It's" partial-match
  artifact, "Counsel"/"counsel" capitalization drift, "correct, I" →
  "correct. I" comma-splice catch) — no new false positives, and
  specifically no sign of the regression risk flagged in the validation
  plan (the model did not start needlessly padding `original` on
  rare/distinctive matches).

Status: **applied 2026-07-08.**

---

### Rule: 2026-07-06 — Chunk-aware extraction addendum (for large-transcript chunking) — PROPOSED, awaiting sign-off

**Not a change to `EXTRACTION_ONLY_PROMPT` itself.** This is a new, separate,
optional addendum block that only gets prepended when a document is large
enough to require chunking (proposed 20-page activation threshold; see the
chunking plan). Below that threshold, `EXTRACTION_ONLY_PROMPT` is sent
completely unchanged, exactly as today — zero behavior change for the vast
majority of current traffic.

**Motivation:** without this, a chunked call has no way to know it's only
seeing *part* of the document, so it would (a) invent a caption/appearances/
index page that doesn't exist in that part, (b) invent a certificate/
signature page that doesn't exist in that part, and (c) potentially
re-extract the trailing-context snippet carried over from the previous chunk
as if it were new content (duplicate entries at the seam).

**Proposed addendum** (new exported template function, not a literal edit to
the existing prompt constant — applied to both `prompts.ts` and `gemini.js`):

```
CHUNKING CONTEXT — you are receiving PART {K} of {N} of a larger transcript that has been split for processing. This changes what you should expect:
{{IF K > 1}}
- This is NOT the first part. Do NOT expect, invent, or fabricate a caption, appearances, or index page — those exist only in part 1 and are not part of your input.
{{END IF}}
{{IF K < N}}
- This is NOT the final part. Do NOT expect, invent, or fabricate a certificate, signature, or closing page — those exist only in the last part and are not part of your input.
{{END IF}}
{{IF trailing context present}}
- The content below begins with READ-ONLY CONTEXT from the end of the previous part, wrapped in <PREVIOUS_CONTEXT> and </PREVIOUS_CONTEXT> tags. This is provided only so you understand what came immediately before — do NOT extract, re-number, or duplicate anything inside these tags as a new entry. Begin extracting fresh content only from what follows </PREVIOUS_CONTEXT>.
{{END IF}}
```

(`{{...}}` blocks are conditionally included by the orchestration code based
on chunk position — not literal text sent to the model.)

**Validation plan (not yet run — blocked on sign-off):** run
`node scripts/test-chunk-split.mjs` (pure split-logic, no API calls, already
passing 11/11) plus a live extraction test on a 2-3 chunk synthetic document,
checking (a) no caption/certificate hallucinated in middle chunks, (b) the
`<PREVIOUS_CONTEXT>` block is not re-extracted as duplicate entries, (c) full
5-transcript regression suite still at baseline recall since this addendum
never fires below the chunking threshold.

**Implementation note:** added as `buildChunkAddendum()` in
`supabase/functions/analyze-case/prompts.ts` only — not mirrored into
`src/lib/gemini.js`. The prompts.ts/gemini.js mirroring convention covers the
`EXTRACTION_ONLY_PROMPT` / `PROOFREAD_ONLY_PROMPT` constants themselves
(both files send identical prompt text to Gemini for their respective call
paths); this new function is chunking-orchestration-specific and only used
by `index.ts`, which is the only place chunking exists. `gemini.js`'s
`extractTranscriptWithGemini` has no chunking logic to call it from, so
adding it there would be unused/dead code.

Status: **applied 2026-07-06** (function added; full live validation still
pending as part of the Phase 1 checkpoint once orchestration wiring is done).

---

### Rule: 2026-07-05 — Exclamation points — applied

New `punctuation` subsection (EXCLAMATION POINTS, inserted after PERIODS):
flag every exclamation point present and suggest a period in its place,
severity `warning`. Deliberately the "blanket, no tone-judgment" version
(flag on mere presence of "!") rather than a version asking the model to
decide whether the exclamatory tone was "deserved" — the latter would require
inferring courtroom tone/volume from flat text, which the model structurally
can't verify, so it was rejected in favor of a mechanical presence-check that
lets the reporter (who was actually there) make the real call.

Motivated by user discussion (not a style-guide excerpt): verbatim
transcripts conventionally avoid exclamation points; a low-severity nudge
lets the reporter confirm/dismiss in one click rather than silently
never checking for it.

**Validation:**
- Full 5-transcript regression suite (1 run, none of the existing fixtures
  contain "!"): 33/35 (94%) recall, 2 unmatched — both pre-existing,
  explainable noise (genuine comma-splice catch on "correct, I"; a
  pre-existing "Its"/"It's" partial-match artifact), consistent with the
  established baseline. No new false positives from this addition.
- Targeted ad hoc check (not added to tracked fixtures, run twice): a
  5-entry mini-transcript with one witness line ending in "!" and four
  clean surrounding lines. Both runs correctly flagged only the "!" —
  `type: punctuation`, `severity: warning`, `original: "!"`,
  `suggestion: "."` — with zero false positives on the clean lines.

Status: **applied 2026-07-05**.

---

### Batch: 2026-07-05 — Morson's-derived additions from PROMPT_ADDITIONS.md — applied

Large batch add (not a single-theme fix): homophones (who's/whose, altogether/all
together, awhile/a while, into/in to, onto/on to, sometime/some time,
guaranty/guarantee), spelling (alright, -ful suffix, hard-c +k), legal_term
(citation format rules + curated Latin/foreign term list), capitalization
(unifying principle + 10 rules), and a full expansion of the `punctuation`
category covering periods, question marks, semicolons, colons, commas (19
rules), dashes, quotation marks, parentheses, apostrophes (11 rules), hyphens
(6 rules + X-ray added to FIXED-LIST HYPHENATION), numbers (18 rules + a
verbatim-priority guardrail + phone-number-parentheses handling), abbreviations,
ellipsis points, and slants — plus ~24 new/extended guardrails (DASH FOR
INTERRUPTION broadened, STATEMENT vs QUESTION extended, new GRAMMAR FRAGMENT
EXEMPTION and EXTRA_WORD DOUBLED-WORD EXEMPTION, and ~19 narrowly-scoped
guardrails covering polite-request punctuation, possessive-apostrophe edge
cases, verbatim-preservation of quoted external material, etc.). Also fixed a
pre-existing whitespace misalignment between `prompts.ts` and `gemini.js` so
the two files are byte-identical again. Full rule text and reasoning: see
(now-applied) `PROMPT_ADDITIONS.md` at the repo root.

Prompt size grew from ~15.3KB to ~39.9KB (~2.6x) — flagging for cost
awareness per the token-economy guardrail; this doesn't add API calls but
does meaningfully increase input tokens on every proofread pass.

**Validation: baseline (1 run) 33/35 (94%) recall, 1 FP → after all edits,
final run 33/35 (94%) recall, 3 unmatched (all explainable, not new noise:
one genuine comma-splice catch, one genuine duplicate-word catch, one
pre-existing "Its"/"It's" partial-match artifact that predates this batch).**

Two real regressions were caught mid-validation and fixed before finalizing:
- `capitalization` rule 5 (direct-address titles) caused a false positive
  correcting the pre-existing "counsel" false-positive trap to "Counsel" —
  fixed by explicitly excluding "counsel" (generic noun) from the title list,
  distinct from "Counselor" (a real title).
- A blanket "severity warning for every item below" on the capitalization
  category accidentally downgraded ordinary uncapitalized-proper-noun errors
  (e.g., "florida atlantic university") from critical to warning — fixed by
  scoping the warning-severity statement to only the 10 new numbered rules,
  explicitly preserving critical severity for ordinary proper-noun misses.
- The expanded punctuation section caused the model to start flagging
  single-vs-double space after periods as a punctuation error (hitting a
  pre-existing clean false-positive trap) — fixed with an explicit guardrail
  that spacing is a typesetting convention, not enforceable signal in
  extracted plain text.

One unresolved item from PROMPT_ADDITIONS.md's own open question was decided
by the user before implementation: keep current behavior (flag every
read-back variance individually; no "(as read)" dense-passage exception).

Status: **applied 2026-07-05**.

### Run: 2026-06-14 — HARD set (transcript_03/04/05_hard), run twice
Designed to be tougher: subtle in-context homophones, multi-error sentences,
cross-page-break errors, errors buried in colloquy, ambiguous [sic] calls, and
correct-legal-Latin false-positive traps.

- **Recall (run 2): t03 8/9, t04 5/6, t05 5/5 → 18/20 (90%).** Run-to-run it
  varies (t04 was 6/6 on run 1), so **the pipeline is non-deterministic even at
  temperature 0 — single runs aren't reliable; average 3+ runs.**
- The 3-error sentence (Their/past/accept) was fully caught both runs — strong.
- Cross-page-break error (negligible→negligent) caught both runs — strong.
- Errors buried in long colloquy (pending emotion→motion) caught — strong.
- Correct legal-Latin (res ipsa loquitur, sua sponte, nunc pro tunc, res
  judicata) correctly NOT flagged — strong.

| # | Theme | Observation | Suggested prompt change | Status |
|---|---|---|---|---|
| 1 | Missing homophone pair | **`discrete`/`discreet` missed both runs.** Not in the prompt's homophone list. | Add `discrete / discreet` (and consider `elicit/illicit`, `flaunt/flout`, `pour/pore`) to the "Steno homophones to watch" list. **Highest-value change.** | applied 2026-06-14 |
| 2 | Over-correction false positive | **`pled` → `pleaded` (run 1).** Model "corrected" an accepted U.S. legal past tense. Intermittent. | Add to rules: "`pled` is an accepted past tense of `plead`; do not flag. Likewise do not 'correct' accepted variants." | applied 2026-06-14 |
| 3 | Bare-pronoun original | `between you and I`: one run missed it; the other flagged it by setting `original` to a bare `"I"` with suggestion `"I [sic]"` — violates the "original must be a COMPLETE standalone word or phrase" rule and is unlocatable in the UI. | Add `between you and I → you and me` as a grammar example, and reinforce: for pronoun-case errors the `original` must be the full phrase (`"you and I"`), never a bare pronoun. | applied 2026-06-14 |
| 4 | Idiom severity/type swing | `mute point` flipped between critical "moot" and warning "mute point [sic]"; `could care less` / `escape goat` typed `grammar` vs `context`. | Known judgment call (see below). Low priority — caught + reasonable suggestion both runs. | accepted-as-noise |
| 5 | Type-label noise | Correct catch + correct suggestion, but `type` label drifts: `negligible→negligent` and `pending emotion→motion` typed `legal_term` instead of `context`; `prepared accordance` typed `grammar` instead of `missing_word`. | Cosmetic only (severity + suggestion right). Don't chase unless the UI groups by type in a way that matters. | low priority |

### Run: 2026-06-14 — baseline (transcript_01 + transcript_02)
- **Recall: 15/15 (100%)** — every seeded error caught.
- **False positives: 0** — both false-positive traps avoided (the "Did you
  recall whether..." line and the clean page-5 closing exchanges).
- Severity correct: 15/15. Suggestion correct: 14/15 (the one "miss" is a
  manifest issue, not a model issue — see below).

| Theme | Observation | Suggested prompt change | Status |
|---|---|---|---|
| Type label for nonstandard words | "Irregardless" was flagged correctly (warning + `[sic]`) but typed `grammar` instead of `context`. Severity and suggestion were right, so impact is cosmetic. | Optional: add "irregardless" to the homophone/nonstandard-word examples under `context` to nudge the type label. Low priority. | applied 2026-06-14 |
| (manifest fix, not prompt) | "the the" → model suggested `"the"`, which is the correct fix; our manifest expected `"the plaintiff"`. | Loosen `transcript_01` seed #2 `expected_suggestion_contains` to `"the"`. No prompt change. | applied 2026-06-14 |

**Takeaway:** baseline proofreader is performing at ceiling on this error set.
To get signal, the next test transcripts need to be *harder* — subtler
homophones in context, multi-error sentences, cross-page-break errors, errors
inside long colloquy blocks, and trickier `[sic]` vs. correction judgment calls.

---

## Known judgment calls (expect noise here)

- **`[sic]` vs. correction (severity warning vs. critical):** deciding whether a
  wrong word is a reporter steno error (critical, replace) or a speaker error
  (warning, `[sic]`) is genuinely ambiguous for some words (e.g. moot/mute).
  Track these but weigh them lightly — a flag at the wrong severity is far less
  serious than a miss.
- **Missing-word inference:** the model can hallucinate a missing "not". Watch
  the false-positive trap in `transcript_01` ("Did you recall whether...").
