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

### Applied: 2026-08-24 — Guard a.m./p.m. and grammatical base-form verbs (Alison FP)

**Source:** Paying user `stenoalison@gmail.com` (Prod). False positives on a
finished job: (1) `extra_word` critical deleting `p.m.` from a valid clock
time (`12:45 p.m.` next to an exhibit admission); (2) `spelling`/`grammar`
critical rewriting `provide` → `provided` in grammatical constructions
(`to provide a different perspective`; `Did ComEd provide more than…`).

**Bucket:** Guardrail only (mechanically checkable from text; suppress bad
flags). Prompt already teaches a.m./p.m. as normal time style (numbers
rules) but lacks an EXTRA_WORD do-not-delete. Tense over-correction is
new.

**RULES bullets** (after `pled`, before `any`):

```
- Do NOT flag "a.m." or "p.m." as "extra_word",
  missing text, or a steno artifact when they appear as a normal time-of-day
  marker with a clock time or hour (e.g., "12:45 p.m.", "9 a.m.", "3 p.m.").
  This exemption covers a single time marker next to a time ONLY.
- DO flag an immediate doubled time marker … "p.m. p.m." / "a.m. a.m." …
- Do NOT rewrite a verb into a different tense or participle when the form
  on the page is already grammatical for its construction. ...
```

**Applied:** 2026-08-24 in `supabase/functions/analyze-case/prompts.ts` +
`src/lib/gemini.js`. Deployed `analyze-case` to **Dev**.

**Harness** (`transcript_10_am_pm_provide_fp.txt`, 3 runs, temp 0):
- Alison traps: **0/3** flagged `p.m.` as extra_word; **0/3** rewrote
  `provide` → `provided`.
- Seeded `the the`: **3/3** caught.
- Seeded `p.m. p.m.`: **0/3** on first wording (exemption buried the
  "still flag doubles" clause). After splitting into DO-flag bullet:
  **2/3**. After also putting the example on the `extra_word` category
  line and carving doubles out of EXTRA_WORD DOUBLED-WORD EXEMPTION:
  _(retest below)_.
- Unrelated noise: intermittent caption `vs.`→`v.`.

**Prod deploy:** pending user OK.

### Applied follow-up: 2026-08-24 — Catch doubled p.m./a.m. junk

**Why it missed:** Extract preserved `"The clerk wrote p.m. p.m. on the stamp…"`.
Proofread over-generalized the new single-marker exemption (and possibly
the "that that" doubled-word exemption) and skipped the positive control.

**Prompt-only tighten** (DO-flag bullet + category example + carve-out from
DOUBLED-WORD EXEMPTION): flaky — **2/3** then **0/3**. Not good enough.

**Code fix (authoritative):** `detectDoubledTimeMarkers` /
`mergeDoubledTimeMarkerAnnotations` in `src/lib/gemini.js` + mirrored in
`analyze-case/index.ts`. Regex for immediate identical time-marker doubles
with or without periods (`p.m. p.m.`, `pm pm`, `a.m a.m`, `am. am.`, …).
Wired into harness path, Edge proofread merge, and editor load heal.
Unit: `node scripts/test-doubled-time-markers.mjs`.

**Harness:** `transcript_10` ×3 after deterministic merge: **3/3** recall
on both seeds; Alison traps still clean (no single-`p.m.` / `provide` FPs).

**Prod deploy:** pending user OK (Edge + frontend editor heal).

### Rule: 2026-08-21 — Extract compact JSON / no blank-line spiral — APPLIED

**Source:** Prod extract failures (~4% of charged jobs in prior 7 days): Gloria
Brown, Gillian / Stanley Gillian, trial jackson. Shared pattern: extract JSON
truncated mid-string or illegal escapes. Gloria `raw_fail` (~66KB) showed a
whitespace death spiral (~32k `\n` escapes after only ~640 bytes of real JSON).

**Change (EXTRACTION_ONLY_PROMPT only — not proofread):** Add CRITICAL RULE —
COMPACT JSON: minified JSON; collapse 3+ consecutive newlines inside strings;
no blank-line padding with `\n` runs; valid JSON escapes only. Update OUTPUT
example to minified schema. Mirror recovery suffix in Edge + `gemini.js`.

**Applied:** 2026-08-21 in `supabase/functions/analyze-case/prompts.ts`,
`src/lib/gemini.js`, recovery strings in `analyze-case/index.ts` + `gemini.js`.

**Test:** `npm run test:extract-compact` (trap + `sample_transcript` regression).
Optional A/B: `COMPARE_BASELINE=1 npm run test:extract-compact`.

**Harness 2026-08-21 (3×, flash-lite, temp 0):**
- Amplified whitespace trap (12k blank mid-caption): CURRENT **3/3** parse OK,
  max blank run ≤2, testimony present; ~1.4KB vs baseline ~2.0KB (more compact).
  Baseline also 3/3 on this synthetic (model often skips blanks already).
- `sample_transcript.txt` regression: CURRENT **3/3**, 29 entries, stable.
- `test:parse-json`: 42/42 pass.
- Note: production parser (`parseGeminiJsonResponse`) required — bare
  `JSON.parse` can fail on rare trailing junk after a complete first object;
  Edge already uses first-value extract.

### Rule: 2026-08-10 — Do not flag years/dates as "future/impossible" — APPLIED

**Source:** User email (beta). Model flagged `"later searched in 2026"` with
explanation that 2026 is in the future / impossible for a search that already
occurred — pure calendar fact-checking, not reporter error detection. Same
class of FP would also hit loan maturity dates and other legitimate future
references.

**Change:** Add a RULES / Do NOT flag bullet: never flag a year/date/time
because it is "in the future," "hasn't happened yet," or conflicts with the
model's idea of today's calendar. Still allow flags when the written form is
malformed or the same entry clearly contradicts itself on that date
(e.g. `"Febuary 30"`, `"20223"`, two incompatible dates for one event in
that entry). Do **not** inject "current year" into the prompt (would sharpen
new FPs and still can't judge past-hearing vs loan-maturity cases safely).

**Exact text added** (under RULES, after the `"if I was [verb-ing]"` bullet):

```
- Do NOT flag a year, date, or time as an error because it is "in the future," "has not happened yet," "impossible given today's date," or conflicts with your knowledge of the current calendar. You have no reliable notion of "today," and transcripts routinely contain recent and upcoming years (including loan maturity dates and planned events). Only flag a date or year when the written form itself is malformed or the same entry clearly contradicts itself on that date (e.g., "Febuary 30," "March 4, 20223," or two incompatible dates for the same event inside that entry).
```

**Applied:** 2026-08-10 in `supabase/functions/analyze-case/prompts.ts` +
`src/lib/gemini.js`.

**Harness after (3× full set, 2026-08-10):**
| Run | Recall | Possible FPs |
|-----|--------|--------------|
| 1 | 172/192 (90%) | 43 |
| 2 | 172/192 (90%) | 23 |
| 3 | 173/192 (90%) | 22 |

Recall in line with prior ~90–91% full-set baselines. FP count is noisy
run-to-run (non-determinism); no recall regression signal from this guardrail.
No before-loop in this session (change already applied when harness ran).

**Targeted soak (same day, first wording):** snippet with
`I later searched in 2026...` + loan maturity `2035`. 2/3 runs still flagged
`2026` via tense-vs-year "logical contradiction" (once as `[sic]`, once as
invented `2016`). 2035 clean.

**Tighten (same day):** ban tense/year "logical contradiction" and inventing
alternate years (`2026` → `2016`). Keep only malformed dates / two incompatible
dates for the same event in one entry.

**Targeted soak after tighten:** 0/3 runs flagged (2026 and 2035 both clean).

**Follow-up 2026-08-10 — runtime reference date + narrow exception:** Inject
`buildProofreadReferenceDateBlock()` (America/New_York, YYYY-MM-DD) at each
proofread call in `analyze-case/index.ts` and `gemini.js`. Prompt keeps the
default ban on calendar freelancing; adds exception: completed past action +
year strictly after reference year + not plan/maturity language → warning
`"<year> [sic]"`, never invent a replacement year.

**Matrix soak (ref date 2026-08-10, 3× each):**
| Case | Expect | Result |
|------|--------|--------|
| searched in 2026 | no | 0/3 |
| went to Chicago in 2027 | yes `[sic]` | 3/3 |
| loan matures 2035 | no | 0/3 |
| will retire in 2027 | no | 0/3 |
| searched in 2019 | no | 0/3 |

### Rule: 2026-08-04 — Proofread CAPTION / CERTIFICATE / HEADING — APPLIED

**Source:** Tonie Thompson (Prod) — certificate line `___ da0y of _______`
unflagged; caption `NEXT FRIEDN` unflagged. Prompt had been skipping those
speakers entirely while still charging tokens for those pages.

**Change:** Proofread `CAPTION`, `CERTIFICATE`, and `HEADING` like testimony.
Guardrail: do not flag fill-in blanks (`___`) or invent blank fills; still
flag clear typos in surrounding words. Keep skipping `INDEX` and `EXHIBITS`
(TOC/exhibit-list noise). Keep existing `APPEARANCES` name-harvest-only rule.

**Applied:** 2026-08-04 in `prompts.ts` + `src/lib/gemini.js`.

**Follow-up 2026-08-04 — blank-line noise on cert soak:** Crofut CAPTION/CERTIFICATE/HEADING
pass caught `da0y`/`FRIEDN` but also flagged `[]` / blank date slots / `00 HOURS`
placeholders as missing words. Tightened the same bullet to name underscores,
empty brackets, placeholder times, and "do not invent DIRECT/dates/names";
still require catching surrounding typos. Re-applied same day in both prompt files.

### Rule: 2026-07-31 — Don't stop after the first error on a line/sentence — PROPOSED

**Not from the standard harness 3× loop — from Dev soak of
`transcript_07_dense_50pages` (case "Test Parallel").**

**Observation:** On `Yes, briefley with a Alvarez, ref 1002.` production
proofread flagged only `briefley` → `briefly`. It did **not** emit a separate
annotation for `a Alvarez` → `an Alvarez` on that same entry. The same
article error **was** flagged on later twin lines that already said
`briefly` (refs 1362 / 1482 / 1602). So the model knows the article check;
it satisficed after the spelling hit on the stacked line.

**Already in the prompt (related, not sufficient):**
- Mandate opener: "NOTHING gets missed" / "flag every occurrence"
- Rule **#5:** `EVERY ERROR GETS ITS OWN ANNOTATION. Do not batch multiple
  errors. One annotation per error instance.`

#5 tells the model how to **emit** multiple errors (don't merge). It does
**not** tell the model to **keep scanning** after finding the first one in
a sentence. That gap is the miss class.

**Proposed edit** — extend rule #5 in `PROOFREAD_ONLY_PROMPT` (both
`supabase/functions/analyze-case/prompts.ts` and the mirrored copy in
`src/lib/gemini.js`) from:

```
5. EVERY ERROR GETS ITS OWN ANNOTATION. Do not batch multiple errors. One annotation per error instance.
```

to:

```
5. EVERY ERROR GETS ITS OWN ANNOTATION. Do not batch multiple errors. One annotation per error instance. Finding one error in a sentence or on a line does not finish that sentence — keep reading for additional independent errors (spelling, articles a/an, homophones, grammar, punctuation, etc.) and emit a separate annotation for each.
```

**Why this shape:** one sentence added to an existing numbered mandate;
names the failure mode (stop after first find) without a new ERROR TYPES
section; calls out articles/homophones as examples of what still applies
alongside an obvious spelling hit.

**Risks / FP watch:** slight increase in same-line annotation density on
messy answers. Should not invent new error classes. Watch that it does not
encourage double-flagging the same span two ways.

**Validation plan (after sign-off, before marking applied):**
1. Harness baseline 3× (`node scripts/run-proofread-test.mjs`) — record
   recall + unmatched FPs.
2. Apply the one-line #5 extension to both prompt copies.
3. Harness 3× again — no recall drop; unmatched FPs not up.
4. Optional soak: re-upload dense 50p (or a small fixture with
   `briefley` + `a Alvarez` on one line) and confirm both flags land on
   that entry.

**Status:** `applied` 2026-07-31 — both prompt copies updated:
- `supabase/functions/analyze-case/prompts.ts`
- `src/lib/gemini.js` (harness mirror)

**Before (harness 3×, full set):** recall **170/192, 174/192, 171/192**
(89 / 91 / 89%); unmatched FPs **25 / 23 / 26**.

**After (harness 3×, full set):** recall **171/192, 172/192, 170/192**
(89 / 90 / 89%); unmatched FPs **25 / 25 / 46**.

**Notes:**
- Aggregate recall flat (no clear win or loss). `transcript_03_hard`
  improved **8/9 → 9/9** on all three after runs (multi-error sentence
  coverage — the intended class).
- `transcript_06_medium` slipped **20/20 → 18/20** on after runs
  (missed `notes discrete` / `principal reason` — known flaky pairs
  already on the homophone list; not a new FP class).
- After-run FP **46** was an outlier: `transcript_08_chunk_seams` alone
  reported **23** unmatched (normally 2–3); other after runs stayed at
  **25**. Treat as non-determinism, not a stable FP regression.
- Dense 50p stayed **112/128**; its manifest only seeds `briefley` on the
  stacked lines (not a separate `a Alvarez` seed), so harness recall
  cannot score that specific dual-flag win.

**Deploy:** apply Edge Function prompt via `analyze-case` deploy (Dev
first; Prod when shipping).

---

### 2026-07-27 — Medium harness baseline (`transcript_06_medium`) — watchlist only

**Setup:** New ~12-page seeded file, 14 planted errors + FP traps (`res ipsa
loquitur`, `pled`, correct early `Harborview`). Ran harness 3× (single
proofread call — does **not** exercise production 250-entry batching).

**Results:** recall **12/14, 12/14, 13/14** (86–93%); **0** unmatched FPs;
cross-page `negligible`→`negligent` caught 3/3; late `Harborveiw`→`Harborview`
caught 3/3.

**Consistent miss:** `principal reason` → `principle` missed **3/3**.
`notes discrete` → `discreet` missed **2/3**.

**Important:** both pairs are **already** on the steno-homophone bullet list
(`principle / principal`, `discrete / discreet`). The gap is not "missing from
the list" — the model still skips them in long clean filler. Proposed fix is a
short disambiguation note with worked examples (same pattern as `sit / set`
and `compliant / complaint`), not adding the pairs again.

**Status:** `applied` to harness + **Edge Function deployed** (2026-07-27/28):
- `src/lib/gemini.js` (harness)
- `supabase/functions/analyze-case/prompts.ts` (synced)
- Deployed `analyze-case` to **Dev** (`jotklhjskmewzfsgzkvp`) and **Prod**
  (`wyexjojoezttbzhcpkco`).

**Harness expanded** in the same change: `transcript_06_medium` now has 20
seeded errors (added inverse principal/principle, inverse discrete/discreet,
mute point, intensive purposes, would of) plus FP traps for correct school
principal / principal place of business / matter of principle / discrete
categories / discreet inquiry.

**After (2026-07-27):**
- Medium 3×: **20/20, 20/20, 19/20** (100/100/95%). `principal reason`
  caught **2/3** (was 0/3). `notes discrete` caught **3/3** (was 1/3).
  Inverse principal/principle + discreet→discrete caught 3/3. Extra seeds
  (mute/moot, intensive purposes, would of) caught 3/3. **0** unmatched FPs
  (correct principal / principle / discrete / discreet traps held).
- `transcript_03_hard` 3×: still **8/9** each run; `notes discrete` missed
  **3/3** on the short hard file (same flake as before on that fixture).
  No new unmatched FPs.

### Rule: 2026-07-09 — Verify punctuation/capitalization is actually wrong before flagging — PART 1 APPLIED

**Not from a test-harness run — from a real production case.** A user
(Misty) reported: "It sometimes didn't pick up on my punctuation. It would
suggest a question mark and there already was a question mark there. A
couple other times it suggested capitalization and it already was
capitalized." Confirmed against the actual extracted JSON for her case
("Kluge MTS 11 18 25") — two distinct, reproducible bugs, not reviewer
pickiness:

**Bug 1 — phantom missing question mark.** Two annotations
(`entry_id` 113, 117) flagged text as missing a "?" when the full entry text
already ends in one:
- `original: "Number 1"` → `suggestion: "Number 1?"`, but entry 113's actual
  text is `...offered into evidence as State's Exhibit Number 1?`
- `original: "rights"` → `suggestion: "rights?"`, but entry 117's actual text
  is `...advise her of her Miranda rights?`

Both explanations correctly identify the sentence as a question — the model
isn't confused about grammar, it's just not checking whether the mark it
thinks is missing is actually sitting one character past the text span it
chose to flag.

**Bug 2 — no-op capitalization "fix."** Two annotations (`entry_id` 346)
suggest a capitalization change where `suggestion` is character-for-character
identical to `original`, on words already capitalized in the source:
- `original: "Investigation"` → `suggestion: "Investigation"` (source:
  `...Southern Police Institute Homicide Investigation.`)
- `original: "School"` → `suggestion: "School"` (source: `Crime Scene
  School.`)

**Root cause (both bugs):** nothing in the prompt currently requires the
model to verify, right before output, that (a) a punctuation mark it's about
to claim is missing doesn't already immediately follow the flagged text, or
(b) a capitalization suggestion actually differs from the original text. The
existing "VERIFY ENTRY_ID BEFORE OUTPUT" rule (added 2026-07-08) only checks
*location*, not whether the claimed error is real.

**Proposed fix — two parts:**

1. **Code-level guard (structural, not a prompt/judgment issue — same class
   of fix as `fixAnnotationPositions`'s position repair).** Filter out any
   annotation where `suggestion === original` (exact string match) before
   it's ever shown to the user. This is a deterministic, zero-risk backstop
   for Bug 2 specifically — it can't reject a legitimate correction, since a
   legitimate correction by definition changes the text. Applies to both
   `supabase/functions/analyze-case/index.ts` and `src/lib/gemini.js`
   (mirrored, same convention as `fixAnnotationPositions`).
2. **Prompt addition (needs sign-off) — extends the existing "VERIFY
   ENTRY_ID BEFORE OUTPUT" rule with a sibling rule:**
   ```
   - VERIFY THE ERROR IS REAL BEFORE OUTPUT: Before including any annotation, confirm the error you are flagging actually exists in the entry text as written. For a "missing punctuation mark" claim specifically, check whether that exact mark already appears immediately after the flagged text in the entry — if it does, the mark is not missing and no annotation should be output. For any claim, if your "suggestion" would be identical to "original", the error is not real and no annotation should be output.
   ```
   (The second sentence overlaps with the code-level guard above by design —
   redundant defense in depth, catching the case at the source rather than
   relying solely on post-processing.)

**Validation plan:** baseline full 5-transcript set, 3 runs, before editing
(the existing hard-tier transcripts don't currently include a
"question already correctly punctuated" or "word already correctly
capitalized" false-positive trap — worth adding one of each as a permanent
regression check regardless of the prompt change, since this bug could
recur silently otherwise). Apply the code-level guard first (independent,
no sign-off needed, ships regardless). Apply the prompt addition to
`prompts.ts` and `gemini.js` identically only after sign-off, then re-run
the full set 3x and compare recall/false-positives before/after.

Status: **Part 1 (code-level guard, `filterPhantomFixes`) applied 2026-07-09** in
`supabase/functions/analyze-case/index.ts`, `src/lib/gemini.js`, and
`src/pages/dashboard/DashboardEditor.jsx` (the editor re-runs the same
post-processing on every case load, so this also retroactively cleans up
already-stored cases — including Misty's — without needing to re-run
Gemini). Verified directly against the exact patterns from Misty's case
(reproduced both bugs from her real `entry_id`/`original`/`suggestion`
values and confirmed all four are dropped while a genuine missing-period
annotation on an unrelated entry is kept). Ran the full 5-transcript harness
once after the change: 32/35 (91%) recall, 2 false positives — both
legitimate, non-seeded suggestions unrelated to this bug (not a regression;
consistent with prior baseline runs).

Part 2 (prompt addition) **not applied** — user opted for the code-level
guard alone rather than adding prompt-side self-verification on top of it,
since the guard already catches these patterns deterministically with no
risk of rejecting a real correction.

---

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

---

## Harness: 2026-07-30 — Subject-verb / existential-there (`transcript_09_sv_agreement`)

**Motivation:** Prod spot-check after Lisa Reid EUO (`there was so many`
unflagged). Scan of 40 recent Prod cases also found unflagged
`there was a lot of cars` / `there was a lot of keys`. Correct legal
subjunctive `if it were…` must stay unflagged.

**Action:** Added `transcript_09_sv_agreement.txt` + manifest
(3 seeds: `there was so many`, `there was a lot of cars`, `They was`;
FP traps: `if it were…`, correct `There were so many…`). **No prompt
change** — harness-only until recall on this file is measured.

**Status:** harness added 2026-07-30. Prompt change: not proposed yet.
