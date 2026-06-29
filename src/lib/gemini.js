const MODEL = 'gemini-2.5-pro'

async function callGemini(prompt, filePart, timeoutMs = 300000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ prompt, filePart, model: MODEL }),
    })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new Error('TRANSCRIPT_TOO_LARGE')
    }
    throw err
  }
  clearTimeout(timer)

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error || `Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!rawText) throw new Error('Gemini returned no content.')

  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Fixes annotation start/end positions by searching for the `original` text
 * within the entry. Gemini's character offsets are frequently wrong, so this
 * is the only reliable way to highlight the right word.
 */
/**
 * Searches for `search` in `text`, treating all whitespace (spaces, newlines,
 * tabs) as equivalent. Returns { start, end } in the ORIGINAL text coordinates,
 * or null if not found.
 */
// Returns true if the character at position i in str is a word character
function _isWordChar(str, i) {
  if (i < 0 || i >= str.length) return false
  return /\w/.test(str[i])
}

// Checks that a match at [start, end) in text has word boundaries on both sides
// when the search phrase starts/ends with a word character.
function _checkBoundaries(text, start, end, search) {
  const searchStart = search[0]
  const searchEnd = search[search.length - 1]
  if (/\w/.test(searchStart) && _isWordChar(text, start - 1)) return false
  if (/\w/.test(searchEnd) && _isWordChar(text, end)) return false
  return true
}

export function flexFind(text, search) {
  if (!text || !search) return null

  // 1. Exact match with boundary check
  let idx = text.indexOf(search)
  while (idx !== -1) {
    if (_checkBoundaries(text, idx, idx + search.length, search)) {
      return { start: idx, end: idx + search.length }
    }
    idx = text.indexOf(search, idx + 1)
  }

  // 2. Case-insensitive exact match with boundary check
  const lowerText = text.toLowerCase()
  const lowerSearch = search.toLowerCase()
  idx = lowerText.indexOf(lowerSearch)
  while (idx !== -1) {
    if (_checkBoundaries(text, idx, idx + lowerSearch.length, lowerSearch)) {
      return { start: idx, end: idx + lowerSearch.length }
    }
    idx = lowerText.indexOf(lowerSearch, idx + 1)
  }

  // 3. Whitespace-flexible match (handles \n vs space, multi-line entries)
  try {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/\s+/g, '\\s+')
    const startsWord = /^\w/.test(search)
    const endsWord = /\w$/.test(search)
    const wrapped = `${startsWord ? '(?<![\\w])' : ''}${pattern}${endsWord ? '(?![\\w])' : ''}`
    const regex = new RegExp(wrapped, 'i')
    const match = text.match(regex)
    if (match) return { start: match.index, end: match.index + match[0].length }
  } catch (_) { /* regex safety */ }

  // 4. Cross-page-break match: allows a standalone page number between words
  try {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/\s+/g, '(?:\\s+\\d+)?\\s+')
    const startsWord = /^\w/.test(search)
    const endsWord = /\w$/.test(search)
    const wrapped = `${startsWord ? '(?<![\\w])' : ''}${pattern}${endsWord ? '(?![\\w])' : ''}`
    const regex = new RegExp(wrapped, 'i')
    const match = text.match(regex)
    if (match) return { start: match.index, end: match.index + match[0].length }
  } catch (_) { /* regex safety */ }

  return null
}

/**
 * Builds a "clean content" version of originalText by stripping line-number
 * prefixes (e.g. " 1  ", " 12  ") from the start of each line.
 * Returns { cleanContent, parsedLines, cleanToOrig }.
 * - cleanContent: text with line numbers removed, lines joined by \n
 * - parsedLines[i]: { prefix, content, fullLine, cleanStart, cleanEnd }
 * - cleanToOrig[i]: position in originalText of the i-th char in cleanContent
 */
export function buildCleanContentMap(text) {
  const rawLines = text.split('\n')
  const parsedLines = []
  const cleanToOrig = []
  let cleanContent = ''
  let lineOrigStart = 0

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const m = line.match(/^(\s*\d{1,4}\s{2,})/)
    const prefix = m ? m[1] : ''
    const content = line.substring(prefix.length)
    const cleanStart = cleanContent.length

    if (i > 0) {
      cleanContent += '\n'
      cleanToOrig.push(lineOrigStart - 1)
    }

    for (let j = 0; j < content.length; j++) {
      cleanToOrig.push(lineOrigStart + prefix.length + j)
      cleanContent += content[j]
    }

    parsedLines.push({ prefix, content, fullLine: line, cleanStart: i === 0 ? 0 : cleanStart + 1, cleanEnd: cleanContent.length })
    lineOrigStart += line.length + 1
  }

  return { cleanContent, parsedLines, cleanToOrig }
}

const _tokenize = (s) => {
  const tokens = []
  let i = 0
  while (i < s.length) {
    if (/\s/.test(s[i])) {
      let j = i
      while (j < s.length && /\s/.test(s[j])) j++
      tokens.push({ type: 'sep', value: s.substring(i, j) })
      i = j
    } else {
      let j = i
      while (j < s.length && !/\s/.test(s[j])) j++
      tokens.push({ type: 'word', value: s.substring(i, j) })
      i = j
    }
  }
  return tokens
}

const _LINE_NUM_RE = /^(\s*\d{1,4}\s{2,})(.*)/s

/**
 * Estimates the intended column width of a transcript by taking the 85th-percentile
 * length of numbered content lines (most lines sit at or below the column limit).
 */
export function _detectColumnWidth(text) {
  const lengths = text.split('\n')
    .filter(l => _LINE_NUM_RE.test(l) && l.trim().length > 10)
    .map(l => l.length)
  if (!lengths.length) return 66
  lengths.sort((a, b) => a - b)
  return lengths[Math.floor(lengths.length * 0.85)] || 66
}

/**
 * After a correction widens a line beyond `colWidth`, moves the overflow words
 * to the beginning of the next numbered line (before its existing first word).
 * Iterates until no numbered line exceeds the column width.
 */
export function _reflowLines(text, colWidth) {
  const lines = text.split('\n')
  let changed = false

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length <= colWidth) continue

    const m = _LINE_NUM_RE.exec(lines[i])
    if (!m) continue

    const prefix = m[1]
    const content = m[2]

    // Find the split point: walk words right-to-left until line fits
    const words = content.split(' ')
    let splitIdx = words.length
    for (let w = words.length - 1; w >= 1; w--) {
      if ((prefix + words.slice(0, w).join(' ')).length <= colWidth) {
        splitIdx = w
        break
      }
    }
    if (splitIdx === words.length) continue // line can't be shortened

    const overflow = words.slice(splitIdx)
    if (!overflow.length) continue

    // Find next numbered line
    let nextIdx = i + 1
    while (nextIdx < lines.length && !_LINE_NUM_RE.test(lines[nextIdx])) nextIdx++

    lines[i] = prefix + words.slice(0, splitIdx).join(' ')

    if (nextIdx < lines.length) {
      const nm = _LINE_NUM_RE.exec(lines[nextIdx])
      if (nm) {
        // Prepend overflow before the first word of the next numbered line
        const nextContent = nm[2].trimStart()
        lines[nextIdx] = nm[1] + overflow.join(' ') + (nextContent ? ' ' + nextContent : '')
      }
    }
    changed = true
    // Don't advance i — the next line may now also overflow; loop will catch it
  }

  return changed ? lines.join('\n') : text
}

/**
 * Applies a correction to `text` while preserving original whitespace structure.
 * Handles court-transcript formatting where line numbers appear between words
 * (e.g. "as\n 2  identified" when searching for "as identified").
 * Returns the corrected text, or the original unchanged if not found.
 */
/**
 * Like applyCorrection, but also returns where in the resulting text the
 * replacement landed and the exact raw substring that was replaced.
 * Callers that need to revert a correction later (e.g. the editor's
 * reopenAnnotation) should store `start`/`end`/`matchedText` and splice
 * `matchedText` back in directly — searching for `suggestion` again with
 * flexFind can match the wrong occurrence (e.g. a common word like "the")
 * or, for corrections that spanned a line break, can't reconstruct the
 * blanked-out tokens on the continuation line.
 * Returns { text, start: -1, end: -1, matchedText: null } if `original`
 * isn't found.
 */
export function applyCorrectionDetailed(text, original, suggestion) {
  if (!text || !original || !suggestion) return { text, start: -1, end: -1, matchedText: null }

  const buildReplacement = (matchStart, matchEnd, skipLineNums) => {
    const matchedRegion = text.substring(matchStart, matchEnd)
    const tokens = _tokenize(matchedRegion)
    const suggWords = suggestion.split(/\s+/).filter(Boolean)

    const contentIndices = []
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'word') continue
      if (skipLineNums) {
        const isLineNum = /^\d+$/.test(tokens[i].value) &&
          i > 0 && tokens[i - 1].type === 'sep' && /\n/.test(tokens[i - 1].value)
        if (isLineNum) continue
      }
      contentIndices.push(i)
    }

    if (contentIndices.length === suggWords.length) {
      let wi = 0
      for (const idx of contentIndices) {
        tokens[idx] = { type: 'word', value: suggWords[wi++] }
      }
      return tokens.map((t) => t.value).join('')
    }

    // When word counts differ across a line boundary, a flat string replace would
    // destroy the transcript line structure (line numbers and newlines vanish).
    // Instead: put all replacement words on the first content word's position and
    // blank the remaining matched content words, preserving separators/line numbers.
    if (matchedRegion.includes('\n') && contentIndices.length > 0) {
      tokens[contentIndices[0]] = { type: 'word', value: suggWords.join(' ') }
      for (let i = 1; i < contentIndices.length; i++) {
        tokens[contentIndices[i]] = { type: 'word', value: '' }
      }
      return tokens.map((t) => t.value).join('')
    }

    return suggestion
  }

  const apply = (matchStart, matchEnd) => {
    const matchedText = text.substring(matchStart, matchEnd)
    const replacement = buildReplacement(matchStart, matchEnd, true)
    return {
      text: text.substring(0, matchStart) + replacement + text.substring(matchEnd),
      start: matchStart,
      end: matchStart + replacement.length,
      matchedText,
    }
  }

  // Fast path: direct match in text.
  // Always skip line numbers — whitespace-flexible matches can span newlines and
  // include transcript line numbers (e.g. "as\n 16        identified") which must
  // not be counted as content words during word-for-word replacement.
  const m = flexFind(text, original)
  if (m) return apply(m.start, m.end)

  // Fallback: search in clean content (strips line numbers from .txt transcripts)
  const { cleanContent, cleanToOrig } = buildCleanContentMap(text)
  const cm = flexFind(cleanContent, original)
  if (!cm) return { text, start: -1, end: -1, matchedText: null }

  const origStart = cleanToOrig[cm.start]
  const origEnd = cleanToOrig[Math.min(cm.end - 1, cleanToOrig.length - 1)] + 1
  return apply(origStart, origEnd)
}

export function applyCorrection(text, original, suggestion) {
  if (!text || !original || !suggestion) return text
  return applyCorrectionDetailed(text, original, suggestion).text
}

export function fixAnnotationPositions(entries, annotations) {
  return annotations.map((a) => {
    if (!a.original) return a

    // Try the referenced entry first
    const entry = entries.find((e) => e.id === a.entry_id)
    if (entry) {
      const m = flexFind(entry.text, a.original)
      if (m) return { ...a, start: m.start, end: m.end }
    }

    // Text not found in referenced entry — search ALL entries and reassign
    for (const e of entries) {
      if (e.id === a.entry_id) continue
      const m = flexFind(e.text, a.original)
      if (m) return { ...a, entry_id: e.id, start: m.start, end: m.end }
    }

    return a
  })
}

/**
 * Deduplicates entries by normalized speaker+text.
 * Remaps all annotations from removed duplicates to the surviving entry.
 * Returns { entries, annotations } with clean sequential IDs.
 */
export function deduplicateTranscript(rawEntries, rawAnnotations) {
  const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const entryKeyMap = {}
  const idRemapTable = {}
  const deduped = []

  for (const entry of rawEntries) {
    const key = `${normalize(entry.speaker)}|||${normalize(entry.text)}`
    if (entryKeyMap[key] !== undefined) {
      idRemapTable[entry.id] = entryKeyMap[key]
    } else {
      deduped.push(entry)
      entryKeyMap[key] = entry.id
    }
  }

  if (deduped.length < rawEntries.length) {
    console.log(`Deduplication removed ${rawEntries.length - deduped.length} duplicate entries`)
  }

  const oldToNewId = {}
  deduped.forEach((e, i) => {
    oldToNewId[e.id] = i + 1
    e.id = i + 1
  })

  let annots = (rawAnnotations || []).map((a) => {
    let targetId = a.entry_id
    if (idRemapTable[targetId] !== undefined) targetId = idRemapTable[targetId]
    if (oldToNewId[targetId] !== undefined) targetId = oldToNewId[targetId]
    return { ...a, entry_id: targetId }
  })

  // Fix entry_ids by searching for original text across all entries BEFORE filtering
  annots = fixAnnotationPositions(deduped, annots)

  const entryIds = new Set(deduped.map((e) => e.id))
  annots = annots.filter((a) => entryIds.has(a.entry_id))

  const seenAnnotations = new Set()
  annots = annots.filter((a) => {
    const key = `${a.entry_id}:${normalize(a.original)}:${a.type}`
    if (seenAnnotations.has(key)) return false
    seenAnnotations.add(key)
    return true
  })

  annots.forEach((a, i) => { a.id = i + 1 })

  return { entries: deduped, annotations: annots }
}

// ── PASS 1: Extraction only (no proofreading) ──

const EXTRACTION_ONLY_PROMPT = `You are a world-class legal transcript extraction engine. You will receive the content of a court transcript file (RTF, CRE, TXT, or PDF format). Your ONLY job is to extract all text into structured JSON entries. Do NOT proofread or flag any errors.

EXTRACTION RULES:
- Extract the ENTIRE transcript content in order, preserving ALL sections:
  * Cover/title page (court name, case number, parties, caption)
  * Appearances page (attorneys and their information)
  * Index/table of contents
  * Certificate pages (reporter certificate, certificate of oath)
  * Errata sheets and read-and-sign letters
  * Exhibit lists
  * ALL testimony and colloquy (Q&A, speaker dialogue, stipulations, on/off-record notes)
- For non-testimony sections, use a descriptive speaker label: "CAPTION", "APPEARANCES", "INDEX", "CERTIFICATE", "EXHIBITS", or "HEADING".
- For testimony sections, identify speakers (e.g. "MR. HENDERSON", "MS. MILLER", "THE COURT", "THE WITNESS", "Q", "A").
- Preserve the original text EXACTLY as written, including all errors. Do NOT correct anything.
- Group consecutive lines under the same speaker/section into ONE entry.
- Strip only raw formatting codes (RTF control words, PDF artifacts). Preserve all actual text.

CRITICAL RULE — EVERY PASSAGE APPEARS EXACTLY ONCE:
- Each passage of text must appear as EXACTLY ONE entry. NEVER duplicate an entry.
- If you see repeated text in the source, include it only ONCE.

OUTPUT — respond with ONLY valid JSON:
{
  "title": "<case title if found>",
  "entries": [
    { "id": 1, "speaker": "SPEAKER NAME", "text": "The original text exactly as written..." }
  ]
}

Now extract the following file content:`

// ── PASS 2: Proofreading only ──

const PROOFREAD_ONLY_PROMPT = `You are the most meticulous court transcript proofreader and scopist in the country. You have reviewed thousands of depositions, trials, and hearings. You know that a single wrong word in a legal transcript can alter its meaning, create liability, and damage careers. Your standard is absolute: NOTHING gets missed.

You will receive a JSON array of transcript entries extracted from a court reporter's .txt file. These files are produced by stenotype machines and voice writers — both are prone to specific error patterns you must know cold.

CRITICAL CONTEXT — HOW THESE ERRORS HAPPEN:
Court reporters type at 200+ words per minute using phonetic shorthand. The most dangerous errors are NOT misspellings — they are CORRECT words used in the WRONG place. The machine or voice writer heard a sound and wrote a plausible word. Your job is to catch every instance where the written word is phonetically close but legally wrong.

YOUR PROOFREADING MANDATE:
1. READ EVERY WORD. No skimming. No assumptions. Treat each sentence as if it will be read aloud in a courtroom.
2. WHEN IN DOUBT, FLAG IT. A false positive the reviewer dismisses is infinitely better than a missed error that reaches the judge. If a word seems off, annotate it.
3. UNDERSTAND THE MEANING. Read for what the speaker is actually trying to say. Then ask: does each word match that meaning precisely?
4. CHECK ACROSS SENTENCE BOUNDARIES. Missing words and run-on errors often span two lines.
5. EVERY ERROR GETS ITS OWN ANNOTATION. Do not batch multiple errors. One annotation per error instance.

ERROR TYPES — flag every occurrence:

"spelling" — Misspelled word. The word does not exist or is clearly malformed, OR is a single-character steno drop/substitution that produces a near-miss of the correct word.
  Examples: "residance" (residence), "goverment" (government), "atourney" (attorney)
  Single-character steno drops to catch: "Fith" (Fifth), "writ" for "written", "acept" (accept), "judgement" (judgment — in U.S. courts the correct legal spelling is always "judgment" without the 'e'; "judgement" is British and incorrect in U.S. legal transcripts)

"context" — Correct spelling, WRONG word. This is the most common and most dangerous error class.
  Steno homophones to watch obsessively:
  • counsel / council          • plaintiff / plaintive       • waive / wave / waiver / waver
  • depose / dispose           • do / due / dew              • are / our
  • passed / past              • affect / effect             • your / you're
  • their / there / they're    • its / it's                  • hear / here
  • to / too / two             • principle / principal       • cite / site / sight
  • brake / break              • bare / bear                 • peace / piece
  • lose / loose               • where / were / we're        • for / fore / four
  • than / then                • whether / weather           • right / write / rite
  • capitol / capital          • compliment / complement     • assent / ascent
  • aloud / allowed            • coarse / course             • forth / fourth
  • liable / libel             • statue / stature / statute  • tenet / tenant
  • writ / rit / rid           • voir dire (spelling)        • corpus / corpse
  • discrete / discreet        • elicit / illicit            • flaunt / flout
  • pour / pore / pore over    • moot / mute                 • waiver / waver
  • sit / set (e.g., "sit aside" → "set aside"; "sit forth" → "set forth")
  • eminent / imminent (neither belongs in a motion name — flag if used; likely steno error for "emergency" or "amended")
  • compliant / complaint (near-miss in legal filings: "amend the compliant" is always wrong)
  Nonstandard words — flag as "context" (not "grammar"), severity "warning", suggestion "<word> [sic]":
  • irregardless (nonstandard; speaker likely meant "regardless" — speaker error, not reporter error)

"grammar" — Subject-verb agreement, tense shift, double negative, fragment, pronoun case error, dangling modifier.
  Pronoun case example: "between you and I" — the correct form is "between you and me" (object of preposition). This is a grammar error. IMPORTANT: the "original" field MUST be the full phrase containing the error ("you and I"), never a bare standalone pronoun ("I") — a bare pronoun is impossible to locate in context and will break the UI.

"legal_term" — Misspelled or incorrect legal term, wrong statute number, wrong citation format, incorrect case name formatting, or an impossible motion name.
  Examples: "habeous" (habeas), "voir dire" misspellings, statute numbers that don't match context.
  Motion name check: Standard legal motion names include Motion to Dismiss, Motion to Set Aside, Motion for Summary Judgment, Emergency Motion, Amended Motion, Motion to Strike, Motion in Limine, Motion for Default Judgment. If you see a motion described with a word that has no recognized legal meaning in that position (e.g., "Eminent Motion", "Imminent Motion"), flag it as a likely steno substitution for "Emergency Motion" or "Amended Motion".

"punctuation" — Missing or wrong punctuation that changes meaning or readability.
  Examples: missing question mark on a question, missing comma creating ambiguity, wrong apostrophe.

"capitalization" — Improper capitalization of proper nouns, party names, court names, judicial titles, legal terms that require capitals.

"missing_word" — A word is clearly absent that makes the sentence incomplete or changes its meaning.
  Example: "The witness did [not] recall" — if "not" is missing, this is critical.

"extra_word" — A word appears twice, or an extraneous word is present that shouldn't be there.

CRITICAL RULE — TRANSCRIPTS RECORD WHAT WAS SPOKEN:
A court transcript is a verbatim record of spoken words. You must distinguish between two entirely different kinds of errors:

REPORTER ERROR (phonetic/steno substitution): The reporter heard a word and wrote a different word that sounds similar. The speaker did NOT say what is written. Example: speaker said "counsel" but reporter wrote "council". Flag these as "spelling" or "context" with severity "critical". Suggestion: the correct word.

SPEAKER ERROR (the speaker said the wrong word): The reporter accurately transcribed what was spoken, but the speaker themselves used the wrong word. Example: a witness says "thesis" when the correct academic term is "dissertation." The transcript is accurate — the speaker made the error. These must NEVER be corrected. Instead, add the legal notation [sic] immediately after the word to document that the error belongs to the original speaker. Suggestion format: "<original_word> [sic]" — do NOT substitute the correct word. Severity: always "warning".

SEVERITY:
- "critical": TYPE A error only — reporter wrote the wrong word due to phonetic/steno substitution. The suggestion is the correct replacement word.
- "warning": TYPE B error — speaker said the wrong word; the transcript is accurate. The suggestion MUST be formatted as "<original_word> [sic]" with no other changes.

RULES:
- For TYPE B / "warning" errors: the suggestion field MUST be exactly the original word followed by a space and [sic]. Example: original "thesis" → suggestion "thesis [sic]". Do NOT put the correct word in the suggestion field.
- "context" type annotations where the speaker may have genuinely said that word MUST use severity "warning" and the [sic] suggestion format.
- The "original" field MUST be the EXACT string from the entry text, character for character. This is how the UI locates the error. If it is not exact, the highlight will fail.
- The "original" field must be a COMPLETE standalone word or phrase — never a substring of a longer word, and never a bare pronoun extracted from a larger grammatical error (use the full containing phrase instead).
- Do NOT flag "pled" as an error. "Pled" is a fully accepted U.S. legal past tense of "plead" (alongside "pleaded") and appears routinely in court transcripts. Flagging it as incorrect is a false positive.
- Do NOT flag "any" as a potential "an" error. "Any" (determiner meaning "some" or "every") and "an" (indefinite article) are completely different words with different grammatical functions. They are not interchangeable and phonetic similarity is not grounds for flagging.
- Do NOT flag "on" as a potential "an" error. These are different parts of speech. In particular, "on behalf of" is a fixed standard legal phrase meaning "representing" — it is always correct and must never be flagged.
- Do NOT infer that a question is incomplete based on the content of the following answer entry. Judge a question's completeness solely on its own grammatical structure. A question like "Who was your employer?" is complete even if the answer introduces new information.
- Do NOT flag "if I was [verb-ing]" constructions as grammar errors. Past progressive conditionals ("if I was taking", "if I was going") are grammatically acceptable in American English and appear routinely in spoken testimony.
- Your explanation field MUST only reference text that actually appears in the entry being annotated. NEVER invent, paraphrase, or quote a phrase that does not exist in the source transcript. If you cannot explain the error using the actual text, do not flag it.
- CROSS-ENTRY CONTAMINATION RULE: When evaluating any single entry, you may ONLY use text within that entry as justification. Do NOT borrow a subject, object, noun, or any other word from a different entry to justify a grammar or agreement flag in the current entry. If the subject causing a subject-verb agreement concern is in a different entry, do not flag the verb.
- STATEMENT vs QUESTION PUNCTUATION: An entry is only a question if its own text is grammatically structured as a question — meaning it contains an interrogative word (who, what, where, when, why, how) with inverted syntax, OR it is a short tag like "correct?" or "right?" A declarative sentence ending with a period is NEVER a question, regardless of what the surrounding entries say. Do NOT flag a period as a missing question mark unless the sentence within that same entry is unambiguously a question by its own grammar. The subject matter of a question in a nearby entry does NOT make a statement entry into a question.
- SEMICOLON BEFORE CONFIRMATION TAGS: Court reporters commonly use a semicolon before short confirmation tags such as "correct?", "right?", "is that right?", "fair?", "true?", "okay?", and similar. Example: "This is your signature; correct?" — this is correct court reporter style. Do NOT flag the semicolon in this construction as a punctuation error under any circumstances.
- PUNCTUATION + CAPITALIZATION RULE: When a punctuation correction turns a mid-sentence comma (or similar) into a sentence-ending period, the following word must also be capitalized. In this case, extend the "original" field to include the following word (e.g., "longer, we") and extend the "suggestion" to include the capitalized version (e.g., "longer. We"). Never flag the punctuation change alone if it creates a capitalization obligation — handle both in a single annotation.
- Flag proper nouns only if they are clearly misspelled (e.g., a witness name spelled two different ways in the same transcript).
- Skip entries with speaker labels: "CAPTION", "INDEX", "CERTIFICATE", "EXHIBITS", "HEADING" — proofread testimony only.
- For entries labeled "APPEARANCES": do NOT annotate anything within the appearances block itself. Instead, read it to extract all proper nouns — attorney names, party names, firm names. Then, if any of those names appear spelled inconsistently anywhere in the testimony entries, flag the testimony entry. Annotate on the testimony entry only, never on the appearances entry itself.
- Each annotation must reference the entry_id of the entry containing the error.
- Do NOT return an empty annotations array if there are errors. If you find zero errors, that is acceptable only if the transcript is genuinely clean.

OUTPUT — respond with ONLY a valid JSON object, no prose before or after:
{
  "annotations": [
    {
      "id": 1,
      "entry_id": 1,
      "type": "context",
      "severity": "critical",
      "original": "passed",
      "suggestion": "past",
      "explanation": "Steno homophone error. Reporter wrote 'passed' (a verb) but the intended word is 'past' (meaning 'after' or 'beyond').",
      "confidence": 0.98
    },
    {
      "id": 2,
      "entry_id": 4,
      "type": "context",
      "severity": "warning",
      "original": "thesis",
      "suggestion": "thesis [sic]",
      "explanation": "Speaker error. The witness said 'thesis' but likely meant 'dissertation.' The transcript is accurate; [sic] documents that the error belongs to the speaker.",
      "confidence": 0.91
    }
  ]
}

Here are the transcript entries to proofread:`

/**
 * Two-pass extraction + proofreading.
 * Pass 1: Extract entries only (no proofreading — eliminates duplication).
 * Pass 2: Send clean entries back to Gemini for proofreading only.
 */
export async function extractTranscriptWithGemini(fileOrText, mimeType) {
  let filePart = null
  let promptSuffix = ''

  if (mimeType === 'application/pdf' && fileOrText instanceof ArrayBuffer) {
    filePart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: arrayBufferToBase64(fileOrText),
      },
    }
    promptSuffix = '\n\n[PDF file attached above]'
  } else {
    promptSuffix = `\n\n${fileOrText}`
  }

  // ── PASS 1: Extract entries ──
  console.log('Gemini Pass 1: Extracting transcript entries...')
  const extractionResult = await callGemini(`${EXTRACTION_ONLY_PROMPT}${promptSuffix}`, filePart)

  if (!extractionResult.entries || !Array.isArray(extractionResult.entries)) {
    throw new Error('Gemini response missing "entries" array.')
  }

  let entries = extractionResult.entries.map((entry, i) => ({
    id: entry.id || i + 1,
    speaker: entry.speaker || 'UNKNOWN',
    text: entry.text || '',
    timestamp: entry.timestamp || null,
    line_number: entry.line_number || null,
  }))

  // Deduplicate entries from pass 1
  const { entries: cleanEntries } = deduplicateTranscript(entries, [])
  entries = cleanEntries

  console.log(`Pass 1 complete: ${entries.length} unique entries extracted.`)

  // ── PASS 2: Proofread entries ──
  console.log('Gemini Pass 2: Proofreading transcript...')
  const proofreadResult = await callGemini(
    `${PROOFREAD_ONLY_PROMPT}\n\n${JSON.stringify(entries, null, 2)}`
  )

  let annots = (proofreadResult.annotations || []).map((a, i) => ({
    id: a.id || i + 1,
    entry_id: a.entry_id,
    type: a.type || 'spelling',
    severity: a.severity || 'warning',
    original: a.original || '',
    suggestion: a.suggestion || '',
    explanation: a.explanation || '',
    confidence: a.confidence ?? 0.8,
    start: a.start ?? 0,
    end: a.end ?? 0,
    status: 'open',
  }))

  // Fix entry_ids by searching for original text across all entries BEFORE filtering
  annots = fixAnnotationPositions(entries, annots)

  // Now filter to valid entries and dedup annotations
  const entryIds = new Set(entries.map((e) => e.id))
  annots = annots.filter((a) => entryIds.has(a.entry_id))

  const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const seenAnnotations = new Set()
  annots = annots.filter((a) => {
    const key = `${a.entry_id}:${normalize(a.original)}:${a.type}`
    if (seenAnnotations.has(key)) return false
    seenAnnotations.add(key)
    return true
  })
  annots.forEach((a, i) => { a.id = i + 1 })

  console.log(`Pass 2 complete: ${annots.length} issues found.`)

  return {
    title: extractionResult.title || '',
    extracted_at: new Date().toISOString(),
    entries,
    annotations: annots,
  }
}

/**
 * Standalone proofreading: takes already-extracted entries and returns fresh annotations.
 * Use this from the editor when the user clicks "Re-analyze".
 */
export async function proofreadTranscript(entries) {
  const parsed = await callGemini(
    `${PROOFREAD_ONLY_PROMPT}\n\n${JSON.stringify(entries, null, 2)}`
  )

  let annots = (parsed.annotations || []).map((a, i) => ({
    id: a.id || i + 1,
    entry_id: a.entry_id,
    type: a.type || 'spelling',
    severity: a.severity || 'warning',
    original: a.original || '',
    suggestion: a.suggestion || '',
    explanation: a.explanation || '',
    confidence: a.confidence ?? 0.8,
    start: a.start ?? 0,
    end: a.end ?? 0,
    status: 'open',
  }))

  return fixAnnotationPositions(entries, annots)
}
