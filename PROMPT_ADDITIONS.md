# Proofreading prompt additions — consolidated handoff

Drafted across a full pass through Morson's English Guide for Court Reporters (Periods through Latin), using the `add-proofread-rule` skill at `.claude/skills/add-proofread-rule/SKILL.md`. **Nothing in this document has been applied to `prompts.ts` or `gemini.js` yet.** This file is the single source of truth for what to implement — read it in full before starting, since several items reference each other.

## Before you touch any code

1. Read the current `PROOFREAD_ONLY_PROMPT` in `supabase/functions/analyze-case/prompts.ts` fresh — some earlier recommendations from this same effort (homophone list expansion, eggcorns, "would of/could of", irregular past-participles, fixed-list hyphenation, dash-for-interruption, semicolon-before-confirmation-tags) were **already merged outside this drafting process** and are live. Don't re-add them.
2. `prompts.ts` and `src/lib/gemini.js` are currently **slightly out of sync** — a whitespace misalignment in the homophone bullet columns (cosmetic, but fix it while you're in there so they're byte-identical per the file's own header comment).
3. Apply everything below to **both files**, identically.
4. After applying, run `scripts/run-proofread-test.mjs` against `scripts/test-transcripts/` and report the results before calling this done. Don't skip validation because individual items "look safe" — several (numbers formatting especially) have real edge cases.
5. Severity is a strict binary (`critical`/`warning`) — every item below states its severity explicitly. Don't leave severity to inference.

## One unresolved question — needs your decision, not mine

From the Parentheses chapter: Morson's recommends using a single `(as read)` notation for a read-back passage with many minor misreadings, specifically to avoid flagging every tiny variance individually (what the book calls a "painfully and terminally [sic]" result). This is in real tension with the prompt's own current mandate — "EVERY ERROR GETS ITS OWN ANNOTATION" and "a false positive is infinitely better than a missed error." I did not resolve this either way. Options: (a) leave current behavior as-is (flag everything, no exception), or (b) add some kind of "dense read-back passage" exception. I lean toward (a) unless you're actually seeing this be a UX problem in practice, but it's a philosophy call, not a mechanics one — decide before implementing, or explicitly punt it.

## Known gap

Parentheses Rule 125's phone-number-parentheses note (`(609) 221-6565` gets parens around the area code only when a local number follows it) was deferred to "handle with Numbers" but never actually picked up when the Numbers chapter was drafted. Low priority — pick up later if it matters, or fold in now while you're editing numbers content.

---

## Additions to `context` (homophone list)

Checked against a user-supplied list of commonly-confused word pairs found while reading the book's grammar section: **affect/effect, past/passed, its/it's/their/there/they're were already covered** in the existing homophone list — no action needed on those four. The following are genuinely new:

- Add **who's / whose** — parallel gap to the existing `its/it's` pair. Same steno-homophone risk.
- Add **altogether / all together** — "altogether" (entirely) vs. "all together" (as a group). Severity `critical` when it's a reporter mix-up. Example: `This is altogether unacceptable` vs. `They arrived all together.`
- Add **awhile / a while** — "awhile" is an adverb standing alone; "a while" is a noun phrase used after a preposition. Example: `Rest awhile` vs. `Rest for a while` (never "for awhile").
- Add **into / in to** — "into" is movement toward/inside something; "in to" is two words when "in" belongs to a verb phrase and "to" is separate. Example: `He turned himself in to police` (not "into police") vs. `He walked into the room.`
- Add **onto / on to** — same pattern as into/in to. Example: `Hold on to the railing` vs. `The cat jumped onto the table.`
- Add **sometime / some time** — "sometime" (unspecified point in time) vs. "some time" (an amount/duration). Example: `Call me sometime` vs. `I need some time to think.`
- Add **guaranty / guarantee** — legal distinction: "guaranty" is the legal noun (a pledge or collateral undertaking); "guarantee" is the general noun/verb. Ties to `legal_term` given the legal-specific usage. Example: `the loan guaranty` vs. `a money-back guarantee.`

**Judgment call, deliberately not added — who / whom:** "Whom" for the object case is nearly extinct in actual spoken American English ("Who did you give it to?" is standard, unmarked speech even for educated speakers and judges). Flagging every spoken "who" that's technically "whom" would nag on normal verbatim speech rather than catch an error — different in kind from "between you and I" (already in the prompt), which is recognized as a slip even in casual speech. Left out; revisit only if real transcript evidence suggests it's worth the false-positive risk.

## Additions to `spelling`

- **"alright" → "all right"** — nonstandard, always two words. Severity `critical` (same treatment as the existing "alot" → "a lot" entry).
- **Words ending in the suffix "-ful" take only one L, never two** (cheerful, hopeful, careful — not "cheerfull," "hopefull"). Severity `critical`.
- When a word ending in a hard "c" sound becomes a verb via "-ed"/"-ing", insert a "k" to preserve the hard sound. Severity: `warning`. Example: correct — `Had you picnicked there before?` incorrect — `picnicced`.

## Additions to `legal_term`

**Citation/reference format** (ties to the category's existing "wrong citation format" language):
- No spaces around a colon in legal/literary citations (volume:page, chapter:verse). Severity: `warning`. Example: `Section 4:12` not `Section 4 : 12`.
- Numbered legal references (paragraphs, lines, exhibits, questions, articles, "No.") use figures and are capitalized; an informal, non-official "number" reference is spelled out and lowercase. Severity: `warning`. Example: `Question No. 8` vs. `she's my number one fan`.
- Page, line, stanza, verse, size, and vitamin references stay **lowercase** even before a figure — unlike Article/Section/Question/Exhibit/Figure, which are capitalized. Severity: `warning`.
- Only "v." is correct for "versus" in an actual case citation; spell out "versus" when it just means "opposes" outside a citation. Severity: `warning`.
- "et al." — never "et als." (a common but wrong pluralization). Severity: `warning`.

**Latin/foreign legal term spellings** — watch for steno/phonetic misspellings of these (curated for frequency + phonetic-error risk, not completeness):
```
voir dire, habeas corpus, certiorari (writ of certiorari — common misspellings: "certiori," "certiorary"),
res ipsa loquitur, res judicata, amicus curiae (not "amicus curae"), subpoena duces tecum,
subpoena ad testificandum, corpus delicti (not "corpus delecti"), nolo contendere (not "nolo contender"),
nolle prosequi (accepted short forms: nol-pros, nol-prossed, nol-prossing — NOT errors), mens rea
(not "men's rea"), prima facie, sui generis (not "sue generis"), guardian ad litem, pendente lite,
per curiam, de novo, de facto, de jure, ex parte, in camera, in personam, in rem, in loco parentis,
caveat emptor, quid pro quo, mea culpa, ipso facto, sine qua non, sine die, arguendo, gravamen, jurat,
non compos mentis
```

## Additions to `capitalization`

Unifying principle worth stating once: **a specific, formally-named entity is capitalized on full reference, but a shortened/generic reference to the same entity later is lowercase** (the State of Ohio → the state; the Superior Court of California → in court; the National Mediation Board → the board).

1. "Court" capitalized only for the presiding judge or as short form of a specific court already named — not generic reference. `warning`.
2. "Judge" lowercase unless immediately before a name or used as direct address. `warning`.
3. "State"/"City" capitalized only in formal corporate/legal-party sense, not ordinary geographic reference. `warning`. **Handle with care** — same stakes-class as the plaintiff/plaintiffs issue below; don't guess when ambiguous.
4. Occupational titles capitalized only immediately before a name with no comma — not generically, not after the name, not in apposition. `warning`.
5. Direct-address professional titles capitalized (Doctor, Sergeant, Counselor, Your Honor); generic terms of address are not (sir, madam, officer, miss). `warning`.
6. Generic legal-document words (deposition, interrogatories, motion, petition, stipulation, will, contract, deed, lease) stay lowercase in running text unless preceded by "marked," "labeled," or "entitled." `warning`.
7. Family-relation titles capitalized when substituting for a name with no possessive pronoun before them; lowercase with a possessive pronoun. `warning`.
8. Abbreviated professional titles after a name always capitalized (R.N., Esq., C.S.R., Ph.D.). `warning`.
9. "federal," "government," "nation," "republic" lowercase by default; capitalize only as part of a formal org name. `warning`.
10. "black"/"white" as racial descriptors stay lowercase even though other ethnicity terms are capitalized. `warning`.

## Additions to `punctuation`

**From Periods:**
- Indirect question (reporting-statement main clause) wrongly punctuated with a `?` instead of `.` — except when the main clause is itself an inverted question. `warning`.
- Double period when a sentence ends in an abbreviation. `warning`.
- Period placed outside a closing quotation mark (should be inside). `warning`.

**From Question Marks:**
- Tag/echo question (same-clause tag like "isn't it") missing its `?`. `warning`.
- Standalone confirmation-tag sentence ("Right?", "Correct?") missing its `?`. `warning`.
- Question ending in an abbreviation needs BOTH the abbreviation's period AND the `?`. `warning`.
- Question mark misplaced relative to a closing quote (inside only if the quote itself is the question). `warning`.
- "If you recall/remember/know" tag question missing its comma or `?`. `warning`.

**From Semicolons:**
- Comma splice/run-on: two independent clauses joined by only a comma or nothing, no coordinating conjunction present. `warning`.
- Missing semicolon before a transitional word (however, therefore, consequently...) joining two independent clauses — only when it begins a genuinely new clause, not when it merely interrupts one. `warning`.
- Missing semicolon before an explanatory word (namely, that is, for example) introducing a substantial list. `warning`.
- Missing semicolon separating series items that themselves contain commas (addresses, names-with-titles). `warning` — **high frequency, high value**.
- Missing semicolon before a coordinating conjunction when a joined clause already has internal commas. `warning`.
- Missing semicolon after items in a numbered/lettered/word-based enumeration (first,... second,...). `warning`.
- Semicolon always outside a closing quotation mark. `warning`.

**From Colons:**
- Missing colon before a list introduced by a signal phrase (as follows, the following, thus) — not for an ordinary list with no signal phrase. `warning`.
- Colon mandatory (not comma/nothing) when a demonstrative sits between "to be" and a question (`My question is this:`). `warning`.
- Colon should never immediately follow a preposition (of, in, at, on) or "that." `warning`.
- Colon always outside a closing quotation mark. `warning`.
- No colon after a noun of direct address — use a comma instead. `warning`.

**From Commas** (largest batch — 19 items):
1. Missing comma before a coordinating conjunction (and/but/or/nor) joining two independent clauses — not required when either clause is very short (~5 words or fewer). `warning`.
2. Missing serial/Oxford comma in a series of three or more. `warning`.
3. Missing comma(s) around a noun of direct address, wherever it falls. `warning`.
4. Missing/misplaced comma with a direct quotation — comma before/around, always inside the closing quote. `warning`.
5. Missing comma(s) in dates/addresses after every item following the day or street name — **the commonly-missed one is the closing comma** (`June 17, 1993, and...`). `warning` — **high value**.
6. Missing comma(s) around a title/degree following a name (Esq., Ph.D., CEO). `warning`.
7. Missing commas around "etc." mid-sentence. `warning`.
8. Missing comma(s) separating numbered citation references (section, page, line). `warning` — ties to `legal_term`.
9. Missing comma after an introductory adverb from a fixed common list (actually, accordingly, however...) — except hence/thus/so/yet. `warning`.
10. "Okay"/"All right" as standalone acknowledgment should be its own period-terminated sentence, not comma-spliced into the next one. `warning`.
11. Missing comma after "yes"/"no" when what follows confirms it; period instead when it adds new information. `warning`.
12. Missing comma after a long (4+ word) introductory prepositional phrase. `warning`.
13. Missing comma after an introductory participial phrase, infinitive phrase, or adverbial dependent clause. `warning`.
14. Missing comma before a nonessential clause introduced by a fixed list: although, even though, though, whereas, no matter what/who, some/none of which/whom, at which time, for (meaning "because"). `warning`.
15. "Which"-clauses get set off with commas; "that"-clauses never do. `warning`.
16. Missing comma(s) around an appositive introduced by especially, or, particularly. `warning`.
17. Missing comma(s) around an "accompanied by/along with/as well as/besides/in addition to/plus/together with" phrase specifically when it falls between subject and verb. `warning`.
18. Missing comma after a mild command word (Remember, Look, Mind you, See) followed by a complete clause — no comma when "that" immediately follows. `warning`.
19. Missing comma before a contrasting expression (even though, never, rather, though, though not) — except when "rather than" ends the sentence. `warning`.

**From Dashes:**
- A comma, colon, or semicolon should never sit directly adjacent to a dash (a period belonging to an abbreviation is the one exception). `warning`.
- Missing dash before a summarizing main clause following an introductory list (`Fire, ice, drought — these are the risks.`). `warning`.
- A dash interrupting a speaker's own quoted material generally goes outside the closing quote. `warning`.

**From Quotation Marks:**
- Comma/capitalization when an attribution phrase ("she said") splits a direct quote — comma+lowercase-fragment if same sentence continues, period+capital if the two quoted parts are separate independent clauses. `warning`.
- No comma, no capital on a quoted fragment embedded mid-sentence. `warning`.
- "Quote... unquote" (or variants) should never appear alongside actual quotation marks for the same passage — one or the other, never both. `warning`.
- Nested quotations use a single quote mark for the inner quote. `warning`.
- Only one mark of end punctuation when an inner and outer quotation end at the same point. `warning`.
- Capitalize the first word of a complete unspoken thought/wondering ("I thought, If only...") — no quotation marks required. `warning`.
- Quotation marks around a bare single letter referring to itself (spelling something out, a variable) — except when it's part of a real word like "nth." `warning`.
- A translation or definition of a foreign/technical term should be quoted. `warning`.

**From Parentheses:**
- End punctuation on a reporter's parenthetical sentence goes inside the closing parenthesis. `warning`.
- Avoid filler openers ("whereupon," "at this point in time," "at this time") inside a parenthetical notation. `warning`.
- Avoid the words "interrupting," "continuing," "reading" inside a parenthetical notation (dashes/quotes already signal these). `warning`.
- Parentheses should not be used to set off a spoken aside within testimony — use dashes or commas instead. `warning`.
- **`critical`, not `warning`**: a reporter's parenthetical notation describing a witness's non-verbal action must state only the bare fact — no interpretive/descriptive/qualifying detail (manner, distance, characterization). This one clears the "changes meaning / creates liability" bar the rest of this chapter's items don't — a reporter editorializing on the record is a real integrity issue.

**From Apostrophes** (11 items):
1. Missing possessive apostrophe on a singular noun. `warning`.
2. Malformed plural possessive (apostrophe placement neither valid singular nor plural). `warning`.
3. Compound-word possessive goes on the last word only (`mother-in-law's`). `warning`.
4. Multi-word name/title possessive, no comma before the apostrophe (`Baker, Inc.'s`). `warning`.
5. Missing possessive apostrophe on inanimate time/value expressions (`two weeks' notice`) — not when the following word is an adjective (`three months pregnant`). `warning`.
6. Missing apostrophe on abbreviated decades/years (`the late '80s`). `warning`.
7. "'til" is nonstandard — always "till" or "until." `warning`.
8. Missing apostrophe pluralizing a bare lowercase letter or lowercase abbreviation with periods (`two s's`, `a.m.'s`). `warning`.
9. Apostrophe before a suffix when a letter/number/abbreviation functions as a verb, not a noun (`star-69'd`, `OK's` as verb) — distinguish from plural noun form, which has no apostrophe (`a dozen OKs`). `warning`.
10. Indefinite-pronoun possessive apostrophe (`someone else's`). `warning`.
11. Joint vs. separate ownership possessive, checked against the number of the following noun (`Isaac and Virginia's alibi` [singular noun, joint] vs. `Isaac's and Virginia's alibis` [plural noun, separate]) — flag when the pattern doesn't match noun number. `warning`.

**From Hyphens** (6 items):
1. Hyphens between letters when spelling a name/word out for the record. `warning`.
2. Hyphen for exhibit labels, aircraft designations, military rank designations. `warning`.
3. No hyphen between an -ly adverb and the participle/adjective it modifies — except when the -ly word is itself an adjective (`worldly-minded`). `warning`.
4. No hyphen between more/most/less and the adjective they modify. `warning`.
5. Never hyphenate a percent expression before a noun (`10 percent reduction`). `warning`.
6. Hyphenate a prefix attached directly to a capitalized word or a number (`anti-Communist`, `post-1987`) — not a general rule for all prefix+word combos. `warning`.

Consider also adding **X-ray** (verb/adjective form only) to the existing `FIXED-LIST HYPHENATION` rule — same pattern as cross-examine/attorney-client/work-product/well-being.

**From Numbers** (18 items — read the verbatim-priority guardrail below first, it governs several of these):
1. A numeral shouldn't begin a sentence (spell it out; figures acceptable if too long/unwieldy). `warning`.
2. Complete dates: figures for day/year, no ordinal suffix in standard month-day-year order; ordinal suffix used when day precedes/is separated from month. `warning`.
3. Address house numbers use figures except "One." `warning`.
4. Numbered street names 1-10 spelled out; above 10, figures. `warning`.
5. Numbers before "o'clock" spelled out; numbers before a.m./p.m. are figures; a.m./p.m. never capitalized (except first letter at sentence start). `warning`.
6. Even hours don't take ":00" in running text. `warning`.
7. Even dollar amounts: dollar sign + figure, no decimal/trailing zeros. `warning`.
8. Cents alone: figure + "cents" if ≥10; spelled out below 10. `warning`.
9. Dollars and cents together always use figures with a decimal. `warning`.
10. Million/billion/trillion: dollar sign + figure + spelled-out word. `warning`.
11. Never combine a bare number with "hundred"/"thousand" to form a compound figure (`22 hundred` is wrong). `warning`.
12. Ordinals spelled out through tenth, figures+suffix above; a mixed-range series uses figures+ordinals throughout for consistency. `warning`.
13. Dimensions use figures but always spell out the unit; avoid "x" for "by"/"times." `warning`.
14. Percentages: figure + spelled-out "percent" in running text, not the % symbol (symbol OK only in an enumerated series). `warning`.
15. Decimals take a leading zero when there's no whole number — except gun calibers/gauges, which never do (`.38-caliber`). `warning`.
16. Medical measurements with bodily significance always use figures; Fahrenheit/Celsius capitalized, centigrade not. `warning`.
17. When two numbers sit adjacent, one is spelled out and one is a figure, to avoid visual confusion. `warning`.

**CRITICAL guardrail governing all of the above and worth its own prominent placement:** never suggest a "corrected," completed, or rounded numeral for any dollar amount, quantity, or range the speaker left incomplete, ambiguous, or rounded — the ambiguous/incomplete form exactly as spoken is correct, even when the intended full number seems obvious from context. Same principle extends to shortened spoken measurement forms (`"five-four"` for height) — preserve as spoken, don't "reconstruct" into standard format.

**From Abbreviations:**
- "Dr." abbreviated only when a name immediately follows; otherwise spell out "doctor." `warning`.
- Titles of dignity/respect (Reverend, Honorable, Father, Sister) spelled out, never abbreviated. `warning`.
- Period after a letter standing in for someone's real name-initial; no period when the letter is an arbitrary placeholder (Mr. X, Motorist A). `warning`.
- Don't abbreviate "okay" to "OK" as a spoken response/acknowledgment (distinct from the verb-form "OK's" already covered under Apostrophes). `warning`.
- **General principle** (recurs across Numbers and this chapter — state once): when a normally-lowercase abbreviation begins a sentence, capitalize only its first letter, never the whole abbreviation (`A.m. or p.m.`).
- **Verbatim-priority guardrail**: write the abbreviation exactly as spoken — don't expand ("TV" → "television") or contract based on which reads more naturally.
- **Guardrail**: don't insert/remove an ampersand based on preference — only use it when it's part of a specific firm's actual established name (parallel to the company-name-comma guardrail dropped in Commas — depends on external knowledge, not grammar).
- **Guardrail**: time-zone abbreviations (EST, PST) only when the speaker actually said them as abbreviations; otherwise spell out with only the location word capitalized.

**From Ellipsis Points** (extends the `DASH FOR INTERRUPTION` guardrail family):
- Ellipsis ("...") inside quoted material marks an intentional, correct omission — never flag as an error, incomplete sentence, missing word, or punctuation problem.
- **Distinct guardrail, don't conflate with the dash rule**: an ellipsis marks a speaker's own voice trailing off inconclusively (often with unspoken body language completing the thought) — different phenomenon from a dash's external interruption/cutoff. Don't flag a trailing ellipsis as an incomplete sentence or missing words.

**From Slants:**
- Missing slash in fixed alternative-word expressions (and/or, if/when, unless/until, either/or). `warning`.
- **Guardrail**: don't flag the choice between a slash, spoken "per," or literally-spoken "slash" in ratio notations as wrong — depends on whether the text verbatim-copies a written exhibit notation vs. transcribes what was actually said (same verbatim-priority family as Numbers/Abbreviations).

## Guardrails to extend on existing rules already in the prompt

- **`DASH FOR INTERRUPTION`** (currently only covers end-of-utterance cutoff) → broaden to also cover: mid-sentence self-correction dashes; a leading dash at the start of an entry marking resumption after interruption (don't try to verify cross-entry continuity — just never flag a leading/trailing dash as an error); no capitalization flag on text resuming after a dash unless it's "I" or a proper noun.
- **`STATEMENT vs QUESTION PUNCTUATION`** → add: identical or near-identical short phrases can correctly be punctuated as either a statement or a question depending on what was actually said (`That's all.` vs. `That's all?`) — reporter's rendering is authoritative absent an internal grammatical contradiction.
- **The existing `grammar` category's "fragment" flag** → does NOT apply to short courtroom answers, objections, or follow-up clarifications that stand alone as a complete response (`A: Not sure.`, `MR. HALE: Objection. Leading.`) — don't flag these as fragments or second-guess their terminal punctuation (period or `?`, covers both). This exemption is ONLY for fragment/completeness judgment — spelling, apostrophes, homophones, capitalization within the fragment are still checked normally (e.g., still catch `A: Dont recall.`).
- **The existing `extra_word` category** → intentionally doubled words that are grammatically distinct instances of each other (`that that`, `had had`, `is, is`) must NEVER be flagged as `extra_word` duplication.

## Other scoped guardrails (new, not tied to an existing named rule)

- Polite-request punctuation (`Will you please...`, `May I...`) — don't flag/correct period-vs-`?` choice; courtroom-role/real-time context the text can't supply.
- Mid-sentence question mark placement before an add-on tag (`Are you willing to help? because...`) — don't move it; meaning-dependent, only the reporter who heard it knows.
- "Just so I'm clear"/"So I have a complete picture" lead-ins — don't flag whether a colon or comma follows; audio-inflection judgment.
- Don't force serial commas into a series where a conjunction appears between every item.
- Don't second-guess short direct-address comma placement where inflection determines meaning.
- Don't flag "now"/"then" comma placement at sentence start — meaning-dependent (conversational filler vs. literal time).
- "As, because, if, since, so, unless" don't get a comma by default when introducing an essential clause — Morson's own text admits this distinction "seems vague," so don't actively check it.
- Don't require quotation marks around indirect (reported) speech.
- Don't apply context/homophone corrections to a witness's own quoted account of past speech — that's their sworn testimony, not a transcription artifact.
- Don't require quotation marks around an exhibit designation following "marked"/"labeled."
- Extends verbatim-preservation: quoted material from an external document should never be silently corrected for spelling/wording.
- Don't add an apostrophe to former-contraction words now standard (phone, bus, plane, cello, possum).
- Don't require apostrophe+s for plural numbers or capitalized abbreviations (`the 1990s`, `two IOUs`).
- Don't add apostrophes to common everyday word plurals (ifs, ands, buts, ins, outs, ups, downs, pros, cons).
- Don't flag either form of a singular possessive on an s/z-ending name as wrong (`Reynolds'` / `Reynolds's`) — audio-dependent, both valid. Same for ce/ss-ending "sake" idioms.
- Don't apply general possessive-apostrophe rules to organization/publication names.
- **High-stakes**: singular vs. plural possessive on a party/witness name can change case substance (`the plaintiff's` vs. `the plaintiffs'`) — only suggest a correction when that entry's own text clearly establishes which is meant; never guess.
- Don't require a possessive apostrophe on a proper noun used descriptively/adjectivally rather than to show ownership (`the Morgan farm` vs. `Morgan's farm`).
- Don't hyphenate a foreign expression or proper noun used as a modifier (`ad hoc committee`, `Bay Area restaurant`).

## Deliberately NOT included — full reasoning preserved in case you want to revisit

**Explicitly discretionary per the source (either form is correct, not a correctness rule):** round numbers, ages, centuries-as-"hundreds," decades, two-word time expressions, reporter's consistent digital time format, company-name comma/ampersand conventions, Jr./Sr./Inc. comma treatment.

**Fuzzy thresholds or semantic judgment calls with no clean textual signal (real false-positive risk):** coordinate-adjective commas, postpositive adjective commas, long-vs-short renaming phrase commas, nonessential participial phrases, "such as"/"like" essential-vs-nonessential, comma between confusing proper nouns, verbal-filler commas ("you know," "I mean"), "not only...but also" commas, "that"-clause series semicolons (Semicolons Rule 23), elliptical-verb semicolons (Rule 26), apposition-colon rule (Colons Rule 30), formal-quotation colons (Rule 32), general compound-adjective hyphenation (the whole bulk of the Hyphens chapter — dictionaries themselves disagree, see that chapter's full reasoning), double-possessive ("a friend of my uncle's"), quotes-around-unusual-word-usage, quotes-around-slang.

**Pipeline can't verify/represent this:** anything depending on italics (word-as-word emphasis, book/movie/newspaper title italics, case-citation italics) — extraction produces plain text with no confirmed markup preservation. Also: tabulated-list formatting (colons/commas), multi-paragraph quotation marks — paragraph/line-break structure may not survive the extraction step's line-grouping.

**Requires cross-entry context, conflicts with the existing `CROSS-ENTRY CONTAMINATION RULE`:** quoted-question-repeated-verbatim-from-earlier-in-transcript (Question Marks Rule 14 Caution B), appositive necessity depending on how many defendants/sons exist in the case (Commas Rule 66), parenthetical-notation tense consistency across the whole transcript.

**Requires real-time audio/context the tool doesn't have:** all the "reporter heard an extra syllable or not" cases (apostrophe placement on s/z-ending names, ce/ss "sake" idioms), polite-request punctuation, "now/then" meaning, mid-sentence question-mark-before-tag placement, dash-vs-comma for suspended ideas.

**Narrow/rare constructions, low payoff for the prompt-space cost:** series-of-questions-with-conjunction-logic (Question Marks 12/13/17), colon after QUESTION/ANSWER read-back labels, colon-before-formal-quotations, poetry-line slashes, dual-role noun hyphens/slashes, military time formatting, "not only...but also," understood-but-incomplete possessives, elliptical-verb-omission constructions.

**Already fully covered elsewhere — don't duplicate:** period/comma-inside vs. semicolon/colon-outside quote placement (consolidated across five chapters into the Quotation Marks entry above), echo-question comma (same construction as the Question Marks tag-question check), "Number" → "No." abbreviation (Numbers chapter, referenced again in Abbreviations), "etc." period-doubling (Periods chapter), Jr./Sr./Esq. abbreviated forms (Apostrophes chapter), date/mixed-number slash formatting (Numbers chapter), dual-role noun slash-vs-hyphen (same skip decision as Hyphens).
