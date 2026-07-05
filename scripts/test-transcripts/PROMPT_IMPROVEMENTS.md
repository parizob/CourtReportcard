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
