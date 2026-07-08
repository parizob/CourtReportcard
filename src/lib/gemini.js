const MODEL = 'gemini-2.5-pro'

async function callGemini(prompt, filePart, timeoutMs = 300000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

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

  // Logged (not returned, to avoid changing this function's contract) so
  // real duration/token usage is visible in the console during test runs —
  // used to calibrate chunk sizing against actual Gemini behavior.
  if (data.usageMetadata) {
    console.log(`Gemini call: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`, data.usageMetadata)
  }

  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(extractFirstJsonValue(cleaned))
}

// Even with JSON-only responses requested, Gemini has been observed
// (production case: chunk-boundary content landing right at a closing
// certificate/signature page) to emit a complete, valid JSON value and then
// append extra non-whitespace content after it — which a bare JSON.parse
// rejects outright ("Unexpected non-whitespace character after JSON").
// Scans for the first balanced top-level object/array and discards anything
// trailing it, so a well-formed response isn't thrown away over a model-side
// formatting slip. Leaves genuinely malformed/truncated JSON to fail
// JSON.parse normally — this only trims trailing garbage, never repairs the
// value itself. Mirrored in supabase/functions/analyze-case/index.ts.
function extractFirstJsonValue(text) {
  const start = text.search(/[{[]/)
  if (start === -1) return text
  const openChar = text[start]
  const closeChar = openChar === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === openChar) depth++
    else if (c === closeChar) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return text.slice(start)
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
  • "alot" → "a lot" (always two words; flag as spelling error, severity critical)
  • "alright" → "all right" (nonstandard; always two words; severity critical)
  • Words ending in the suffix "-ful" take only one L, never two: "hopeful," "careful," "grateful" — not "hopefull," "carefull," "gratefull." Severity critical.
  • A word ending in a hard "c" sound inserts a "k" before "-ed"/"-ing" to preserve that hard sound: "picnicked," "trafficking" — not "picnicced," "trafficing." Severity warning.

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
  • corroborate / collaborate     • deposition / disposition       • allude / elude
  • adverse / averse              • ensure / insure / assure       • precede / proceed
  • personal / personnel          • prescribe / proscribe          • canvas / canvass
  • conscious / conscience         • complementary / complimentary  • further / farther
  • accede / exceed                • moral / morale
  • who's / whose                  • altogether / all together      • awhile / a while
  • into / in to                   • onto / on to                   • sometime / some time
  • guaranty / guarantee (legal noun for a pledge/collateral undertaking, not the general "guarantee")
  Nonstandard words — flag as "context" (not "grammar"), severity "warning", suggestion "<word> [sic]":
  • irregardless (nonstandard; speaker likely meant "regardless" — speaker error, not reporter error)
  Common eggcorns — these are idiom-level speaker errors; flag as "context", severity "warning", suggestion "<eggcorn phrase> [sic]":
  • "for all intensive purposes" (correct: "for all intents and purposes")
  • "case and point" (correct: "case in point")
  • "deep-seeded" (correct: "deep-seated")
  • "escape goat" (correct: "scapegoat")
  • "wet your appetite" (correct: "whet your appetite")
  • "could care less" (correct: "couldn't care less")

"grammar" — Subject-verb agreement, tense shift, double negative, fragment, pronoun case error, dangling modifier.
  Pronoun case example: "between you and I" — the correct form is "between you and me" (object of preposition). This is a grammar error. IMPORTANT: the "original" field MUST be the full phrase containing the error ("you and I"), never a bare standalone pronoun ("I") — a bare pronoun is impossible to locate in context and will break the UI.
  Dictation contraction errors — the speaker said a contraction but it was written as two words with "of". Flag as reporter error, severity "critical":
  • "would of" → "would have"    • "could of" → "could have"    • "should of" → "should have"
  • "must of" → "must have"      • "might of" → "might have"
  Irregular past-participle errors in spoken testimony — these are speaker errors; flag as "grammar", severity "warning", suggestion "<phrase> [sic]":
  • "had went" (correct: "had gone")     • "had saw" (correct: "had seen")
  • "had ran" (correct: "had run")       • "had did" (correct: "had done")
  • "should have took" (correct: "should have taken") — and equivalent constructions with other irregular verbs
  The "original" field for these must be the full auxiliary + past participle phrase (e.g., "had went"), never just the participle alone.

"legal_term" — Misspelled or incorrect legal term, wrong statute number, wrong citation format, incorrect case name formatting, or an impossible motion name.
  Examples: "habeous" (habeas), "voir dire" misspellings, statute numbers that don't match context.
  Motion name check: Standard legal motion names include Motion to Dismiss, Motion to Set Aside, Motion for Summary Judgment, Emergency Motion, Amended Motion, Motion to Strike, Motion in Limine, Motion for Default Judgment. If you see a motion described with a word that has no recognized legal meaning in that position (e.g., "Eminent Motion", "Imminent Motion"), flag it as a likely steno substitution for "Emergency Motion" or "Amended Motion".
  Citation format — severity warning for each item below:
  • No spaces around a colon in a legal or literary citation (volume:page, chapter:verse). Correct: "Section 4:12". Incorrect: "Section 4 : 12".
  • A numbered reference to a paragraph, line, exhibit, question, or article is a figure and capitalized ("Question No. 8", "Exhibit 3", "Article II"); an informal, non-official use of "number" is spelled out and lowercase ("she's my number one fan").
  • Page, line, stanza, verse, size, and vitamin references stay lowercase even before a figure ("page 4", "size 8", "vitamin b12") — unlike Article/Section/Question/Exhibit/Figure, which are capitalized before a figure.
  • Only "v." is correct for "versus" inside an actual case citation ("Smith v. Jones"); spell out "versus" when it simply means "opposes" outside a citation ("It's her word versus his").
  • "et al." is the only correct form — "et als." is a common but incorrect pluralization.
  Latin/foreign legal term spellings — watch for steno/phonetic misspellings of these (curated for frequency and phonetic-error risk, not completeness):
  voir dire, habeas corpus, certiorari (writ of certiorari — watch for "certiori," "certiorary"), res ipsa loquitur, res judicata, amicus curiae (not "amicus curae"), subpoena duces tecum, subpoena ad testificandum, corpus delicti (not "corpus delecti"), nolo contendere (not "nolo contender"), nolle prosequi (accepted short forms "nol-pros," "nol-prossed," "nol-prossing" are NOT errors), mens rea (not "men's rea"), prima facie, sui generis (not "sue generis"), guardian ad litem, pendente lite, per curiam, de novo, de facto, de jure, ex parte, in camera, in personam, in rem, in loco parentis, caveat emptor, quid pro quo, mea culpa, ipso facto, sine qua non, sine die, arguendo, gravamen, jurat, non compos mentis

"punctuation" — Missing or wrong punctuation that changes meaning or readability.
  Examples: missing question mark on a question, missing comma creating ambiguity, wrong apostrophe.
  Severity is "warning" for every rule below unless a rule explicitly says "critical".
  GUARDRAIL: Do NOT flag single-space vs. double-space after a sentence-ending period, or any other inter-word/inter-sentence spacing, as a punctuation error. Spacing is a typesetting convention, not a content error, and is not reliable signal in extracted plain text.

  PERIODS:
  • An indirect question (a reporting statement whose main clause reports rather than asks) wrongly ends in "?" instead of "." — except when the main clause itself is phrased as an inverted question. "He asked what time it was." is correct; "He asked what time it was?" is wrong unless the main clause itself inverts ("Did he ask what time it was?").
  • A sentence ending in an abbreviation takes only one period, never two.
  • A period belongs inside a closing quotation mark, never outside.

  EXCLAMATION POINTS:
  • A verbatim transcript conventionally avoids exclamation points. Flag every exclamation point that appears and suggest a period in its place, so the reporter can confirm whether it was intended. Severity warning — this flags the mark for reconsideration because it departs from convention, not because the mark is necessarily wrong; only the reporter, who was present for the testimony, can judge whether it belongs. Example: "Get away from me!" → flag the "!" and suggest "Get away from me."

  QUESTION MARKS:
  • A same-clause tag question ("isn't it," "don't you think") is missing its "?".
  • A standalone confirmation-tag sentence ("Right?", "Correct?") is missing its "?".
  • A question ending in an abbreviation needs BOTH the abbreviation's period AND the "?" ("Did you graduate from U.S.C.?").
  • A question mark goes inside a closing quotation mark only when the quoted material itself is the question; otherwise it goes outside.
  • An "if you recall," "if you remember," or "if you know" tag question is missing its comma or its "?".

  SEMICOLONS:
  • A comma splice/run-on: two independent clauses joined by only a comma, or by nothing at all, with no coordinating conjunction present.
  • A missing semicolon before a transitional word (however, therefore, consequently, moreover, nevertheless) that begins a genuinely new independent clause — not when the transitional word merely interrupts a single clause.
  • A missing semicolon before an explanatory word (namely, that is, for example) introducing a substantial list.
  • A missing semicolon separating series items that themselves contain commas (addresses, names with titles).
  • A missing semicolon before a coordinating conjunction when the clause it joins already has internal commas.
  • A missing semicolon after each item in a numbered, lettered, or word-based enumeration ("First, ... Second, ...").
  • A semicolon always goes outside a closing quotation mark.

  COLONS:
  • A missing colon before a list introduced by a signal phrase (as follows, the following, thus) — not required for an ordinary list with no signal phrase.
  • A colon (not a comma or nothing) is mandatory when a demonstrative sits between "to be" and a question ("My question is this: Where were you at 9 p.m.?").
  • A colon should never immediately follow a preposition (of, in, at, on) or the word "that."
  • A colon always goes outside a closing quotation mark.
  • No colon after a noun of direct address — use a comma instead ("Doctor, please continue." not "Doctor: please continue.").

  COMMAS:
  1. Missing comma before a coordinating conjunction (and, but, or, nor) joining two independent clauses — not required when either clause is about five words or fewer.
  2. Missing serial (Oxford) comma in a series of three or more items.
  3. Missing comma(s) around a noun of direct address, wherever it falls in the sentence.
  4. Missing or misplaced comma with a direct quotation — a comma belongs before/around the quoted material and always inside the closing quotation mark.
  5. Missing comma(s) in a date or address after every item following the day or street name — the commonly missed one is the closing comma ("June 17, 1993, and the following week...").
  6. Missing comma(s) around a title or degree following a name (Esq., Ph.D., CEO).
  7. Missing commas around "etc." mid-sentence.
  8. Missing comma(s) separating numbered citation references (section, page, line).
  9. Missing comma after an introductory adverb from a fixed common list (actually, accordingly, however, nonetheless, furthermore) — except "hence," "thus," "so," and "yet."
  10. "Okay" or "All right" used as a standalone acknowledgment should be its own period-terminated sentence, not comma-spliced into the sentence that follows.
  11. Missing comma after "yes" or "no" when a short phrase or clause follows that elaborates on or qualifies that same answer (e.g., "Yes, with minor variation."); use a period instead only when what follows is a separate, independent clause introducing genuinely new information unrelated to the yes/no answer itself (e.g., "No. I never received the letter.").
  12. Missing comma after a long (four words or more) introductory prepositional phrase.
  13. Missing comma after an introductory participial phrase, infinitive phrase, or adverbial dependent clause.
  14. Missing comma before a nonessential clause introduced by a fixed list: although, even though, though, whereas, no matter what/who, some/none of which/whom, at which time, or "for" meaning "because."
  15. A "which" clause is set off with commas; a "that" clause never is.
  16. Missing comma(s) around an appositive introduced by "especially," "or," or "particularly."
  17. Missing comma(s) around an "accompanied by," "along with," "as well as," "besides," "in addition to," "plus," or "together with" phrase specifically when it falls between the subject and the verb.
  18. Missing comma after a mild command word (Remember, Look, Mind you, See) followed by a complete clause — no comma when "that" immediately follows.
  19. Missing comma before a contrasting expression (even though, never, rather, though, though not) — except when "rather than" ends the sentence.

  DASHES:
  • A comma, colon, or semicolon should never sit directly adjacent to a dash — the one exception is a period belonging to an abbreviation.
  • Missing dash before a summarizing main clause that follows an introductory list ("Rain, wind, hail — the storm brought all three.").
  • A dash interrupting a speaker's own quoted material generally goes outside the closing quotation mark.

  QUOTATION MARKS:
  • When an attribution phrase ("she said") splits a direct quote: use a comma and a lowercase fragment if the same sentence continues; use a period and a capital letter if the two quoted parts are separate independent clauses.
  • No comma and no capital letter on a quoted fragment embedded mid-sentence.
  • "Quote... unquote" (or variants) should never appear alongside actual quotation marks for the same passage — use one or the other, never both.
  • A nested quotation uses a single quotation mark for the inner quote.
  • Only one mark of end punctuation when an inner and outer quotation end at the same point.
  • Capitalize the first word of a complete unspoken thought or wondering ("I thought, If only I had left earlier.") — no quotation marks are required.
  • Quotation marks belong around a bare single letter referring to itself (spelling something out, a variable) — except when the letter is part of a real word like "nth."
  • A translation or definition of a foreign or technical term should be quoted.

  PARENTHESES:
  • End punctuation on a reporter's parenthetical sentence goes inside the closing parenthesis.
  • Avoid filler openers ("whereupon," "at this point in time," "at this time") inside a parenthetical notation.
  • Avoid the words "interrupting," "continuing," or "reading" inside a parenthetical notation — a dash or quotation marks already signal these.
  • Parentheses should not be used to set off a spoken aside within testimony — use dashes or commas instead.
  • CRITICAL, not warning: a reporter's parenthetical notation describing a witness's non-verbal action must state only the bare fact — no interpretive, descriptive, or qualifying detail about manner, distance, or characterization. "(Witness nods.)" is correct; "(Witness nods slowly, seeming reluctant.)" is not — a reporter editorializing on the record is a real accuracy and liability issue.

  APOSTROPHES:
  1. Missing possessive apostrophe on a singular noun.
  2. A malformed plural possessive — the apostrophe sits somewhere that is neither valid singular nor valid plural placement.
  3. A compound-word possessive takes the apostrophe on the last word only ("my mother-in-law's car").
  4. A multi-word name or title possessive takes no comma before the apostrophe ("Baker, Inc.'s policy").
  5. Missing possessive apostrophe on an inanimate time or value expression ("two weeks' notice") — not when the following word is an adjective ("three months pregnant").
  6. Missing apostrophe on an abbreviated decade or year ("the late '80s").
  7. "'til" is nonstandard — always use "till" or "until."
  8. Missing apostrophe pluralizing a bare lowercase letter or a lowercase abbreviation with periods ("mind your p's and q's", "several a.m.'s").
  9. An apostrophe belongs before a suffix when a letter, number, or abbreviation functions as a verb rather than a noun ("star-69'd", "OK's it" as a verb) — distinguish this from the plural noun form, which takes no apostrophe ("a dozen OKs").
  10. Missing possessive apostrophe on an indefinite pronoun ("someone else's coat").
  11. Joint vs. separate ownership possessive should match the number of the noun that follows: a singular noun after two names joined by "and" signals joint ownership with only the last name possessive ("Mark and Linda's house"); a plural noun signals separate ownership with each name possessive ("Mark's and Linda's houses"). Flag only when the pattern doesn't match the noun's number.

  HYPHENS:
  1. Hyphens belong between letters when spelling a name or word out for the record ("that's R-a-m-i-r-e-z").
  2. A hyphen is used for exhibit labels, aircraft designations, and military rank/pay-grade designations ("Exhibit 4-A," "an F/A-18," "a Sergeant E-5").
  3. No hyphen between an "-ly" adverb and the participle or adjective it modifies ("newly discovered evidence," not "newly-discovered evidence") — except when the "-ly" word is itself an adjective rather than an adverb ("a worldly-minded man").
  4. No hyphen between "more," "most," "less," or "least" and the adjective they modify ("a more reasonable approach," not "a more-reasonable approach").
  5. Never hyphenate a percent expression before a noun ("a 10 percent reduction," not "a 10-percent reduction").
  6. Hyphenate a prefix attached directly to a capitalized word or a numeral ("anti-American," "post-2020") — this is not a general rule for every prefix-plus-word combination.

  NUMBERS:
  1. A numeral should not begin a sentence — spell it out or restructure the sentence; a figure is acceptable only if the number is too long or unwieldy to spell out.
  2. A complete date uses figures for the day and year with no ordinal suffix in standard month-day-year order ("March 4, 2023"); an ordinal suffix is used when the day is separated from or precedes the month ("the 4th of March").
  3. An address house number uses figures, except "One" ("One Main Street," "14 Main Street").
  4. A numbered street name from one to ten is spelled out; above ten it uses figures ("Fifth Avenue," "42nd Street").
  5. A number before "o'clock" is spelled out ("three o'clock"); a number before a.m./p.m. is a figure ("3 a.m."); "a.m."/"p.m." are never capitalized except for the first letter at the start of a sentence.
  6. An even hour does not take ":00" in running text ("3 p.m.," not "3:00 p.m.").
  7. An even dollar amount uses a dollar sign plus a figure with no decimal or trailing zeros ("$40," not "$40.00").
  8. Cents alone use a figure plus the word "cents" at 10 or above; below 10, spell it out ("nine cents," "25 cents").
  9. Dollars and cents together always use figures with a decimal ("$4.25").
  10. Million, billion, and trillion amounts use a dollar sign, a figure, and the spelled-out word ("$4 million").
  11. Never combine a bare number with "hundred" or "thousand" to form a compound figure ("2,200," not "22 hundred").
  12. Ordinals are spelled out through "tenth"; above that, use a figure plus suffix ("11th"); a mixed-range series uses figures and ordinals throughout for consistency.
  13. Dimensions use figures but always spell out the unit, and avoid "x" in place of "by" or "times" ("10 feet by 12 feet," not "10' x 12'").
  14. Percentages in running text use a figure plus the spelled-out word "percent," not the % symbol; the symbol is acceptable only within an enumerated series.
  15. A decimal takes a leading zero when there is no whole number ("0.5 inches") — except gun calibers and gauges, which never take a leading zero (".38-caliber").
  16. A medical measurement with bodily significance always uses figures; "Fahrenheit" and "Celsius" are capitalized, "centigrade" is not.
  17. When two numbers sit adjacent to each other, spell out one and use a figure for the other to avoid visual confusion ("three 4-inch pipes," not "3 4-inch pipes").
  18. A phone number written with an area code in parentheses takes parentheses around the area code only when a local number follows it ("(609) 221-6565" is correct); a bare area code with no local number is not parenthesized ("area code 609").
  CRITICAL GUARDRAIL governing all NUMBERS rules above: never suggest a "corrected," completed, or rounded numeral for any dollar amount, quantity, or range the speaker left incomplete, ambiguous, or rounded — the ambiguous/incomplete form exactly as spoken is correct, even when the intended full number seems obvious from context. The same principle extends to a shortened spoken measurement form ("five-four" for height) — preserve it as spoken; do not reconstruct it into a standard format.

  ABBREVIATIONS:
  • "Dr." is abbreviated only when a name immediately follows it; otherwise spell out "doctor."
  • A title of dignity or respect (Reverend, Honorable, Father, Sister) is spelled out, never abbreviated.
  • A period follows a letter that stands in for someone's real name or initial; no period when the letter is an arbitrary placeholder ("Mr. X," "Motorist A").
  • Don't abbreviate "okay" to "OK" as a spoken response or acknowledgment (distinct from the verb form "OK's," which is a correct abbreviation — see APOSTROPHES above).
  • When a normally lowercase abbreviation begins a sentence, capitalize only its first letter, never the whole abbreviation ("A.m. or p.m., either is fine," not "A.M. or p.m.").
  • VERBATIM-PRIORITY GUARDRAIL: write an abbreviation exactly as spoken — don't expand it ("TV" to "television") or contract it based on which reads more naturally.
  • GUARDRAIL: don't insert or remove an ampersand based on preference — use it only when it's part of a specific firm's actual established name.
  • GUARDRAIL: a time-zone abbreviation (EST, PST) is used only when the speaker actually said it as an abbreviation; otherwise spell it out with only the location word capitalized.

  ELLIPSIS POINTS:
  • An ellipsis ("...") inside quoted material marks an intentional, correct omission — never flag it as an error, an incomplete sentence, a missing word, or a punctuation problem.
  • GUARDRAIL, distinct from the DASH FOR INTERRUPTION rule below, do not conflate the two: an ellipsis marks a speaker's own voice trailing off inconclusively, often with unspoken body language completing the thought — a different phenomenon from a dash's external interruption or cutoff. Don't flag a trailing ellipsis as an incomplete sentence or a missing word.

  SLANTS:
  • Missing slash in a fixed alternative-word expression (and/or, if/when, unless/until, either/or).
  • GUARDRAIL: don't flag the choice between a slash, a spoken "per," or a literally-spoken "slash" in a ratio notation as wrong — it depends on whether the text verbatim-copies a written exhibit notation or transcribes what was actually said.

"capitalization" — Improper capitalization of proper nouns, party names, court names, judicial titles, legal terms that require capitals.
  Unifying principle: a specific, formally-named entity is capitalized on full reference, but a shortened or generic reference to that same entity later is lowercase (e.g., "the State of Ohio" → "the state"; "the Superior Court of California" → "in court"; "the National Mediation Board" → "the board").
  The numbered rules below are severity warning (they are stylistic/contextual conventions, not steno substitutions) — this does NOT change the severity of an ordinary uncapitalized proper noun (person, place, or institution name), which remains critical like any other reporter error:
  1. "Court" is capitalized only for the presiding judge or as a short form of a specific court already named — never for a generic reference to courts in general.
  2. "Judge" is lowercase unless it immediately precedes a name or is used as direct address ("Judge Hernandez", "Yes, Judge").
  3. "State" and "City" are capitalized only in the formal corporate/legal-party sense ("the State moved to dismiss"), never in ordinary geographic reference ("she moved to the state of Texas"). Handle with care — do not guess when the sense is ambiguous.
  4. An occupational title is capitalized only immediately before a name with no comma between them ("Detective Ramos") — not generically, not after the name, and not set off in apposition ("the detective, Maria Ramos,").
  5. A direct-address professional title is capitalized ("Doctor", "Sergeant", "Counselor", "Your Honor"); a generic term of address is not ("sir", "madam", "officer", "miss", "counsel" — "counsel" is a generic collective noun, not a title, and stays lowercase even in direct address, unlike "Counselor").
  6. Generic legal-document words (deposition, interrogatories, motion, petition, stipulation, will, contract, deed, lease) stay lowercase in running text unless preceded by "marked," "labeled," or "entitled."
  7. A family-relation title is capitalized when it substitutes for a name with no possessive pronoun before it ("Ask Mother"); it stays lowercase with a possessive pronoun ("Ask my mother").
  8. An abbreviated professional title after a name is always capitalized (R.N., Esq., C.S.R., Ph.D.).
  9. "federal," "government," "nation," and "republic" are lowercase by default; capitalize only as part of a formal organization name.
  10. "black" and "white" as racial descriptors stay lowercase even though other ethnicity terms are capitalized.

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
- STATEMENT vs QUESTION PUNCTUATION: An entry is only a question if its own text is grammatically structured as a question — meaning it contains an interrogative word (who, what, where, when, why, how) with inverted syntax, OR it is a short tag like "correct?" or "right?" A declarative sentence ending with a period is NEVER a question, regardless of what the surrounding entries say. Do NOT flag a period as a missing question mark unless the sentence within that same entry is unambiguously a question by its own grammar. The subject matter of a question in a nearby entry does NOT make a statement entry into a question. Identical or near-identical short phrases can correctly be punctuated as either a statement or a question depending on what was actually said (e.g., "That's all." vs. "That's all?") — the reporter's rendering is authoritative absent an internal grammatical contradiction within that same entry.
- SEMICOLON BEFORE CONFIRMATION TAGS: Court reporters commonly use a semicolon before short confirmation tags such as "correct?", "right?", "is that right?", "fair?", "true?", "okay?", and similar. Example: "This is your signature; correct?" — this is correct court reporter style. Do NOT flag the semicolon in this construction as a punctuation error under any circumstances.
- DASH FOR INTERRUPTION: A double dash (--) at the end of an utterance marks a cut-off or interrupted speech. This is correct court reporter style. Do NOT flag -- as a punctuation error, an incomplete sentence, or a missing word. It is never an error. This also covers a mid-sentence self-correction dash (the speaker restarts a thought) and a leading dash at the start of an entry marking resumption after an interruption — do NOT try to verify cross-entry continuity for a leading or trailing dash; never flag either as an error. Do NOT flag a capitalization error on text resuming after a dash unless the resuming word is "I" or a proper noun.
- GRAMMAR FRAGMENT EXEMPTION: The "grammar" category's fragment/incompleteness judgment does NOT apply to a short courtroom answer, objection, or follow-up clarification that stands alone as a complete response (e.g., "A: Not sure.", "MR. HALE: Objection. Leading."). Do NOT flag these as fragments or second-guess their terminal punctuation (period or "?" — both are acceptable). This exemption covers fragment/completeness judgment ONLY — spelling, apostrophes, homophones, and capitalization within the fragment are still checked normally (e.g., still flag "A: Dont recall." for the missing apostrophe).
- EXTRA_WORD DOUBLED-WORD EXEMPTION: A doubled word where each instance is a grammatically distinct token (e.g., "that that," "had had," "is, is") must NEVER be flagged as "extra_word" duplication.
- FIXED-LIST HYPHENATION: The following terms are always hyphenated regardless of their position in a sentence. Flag any unhyphenated occurrence as a spelling error, severity critical: cross-examine, cross-examination, cross-examined, cross-examining, attorney-client (as in "attorney-client privilege"), work-product (as in "work-product doctrine"), well-being, X-ray (verb/adjective form only, e.g., "X-rayed," "an X-ray technician"). Do not apply general compound-modifier hyphenation rules beyond this fixed list.
- PUNCTUATION + CAPITALIZATION RULE: When a punctuation correction turns a mid-sentence comma (or similar) into a sentence-ending period, the following word must also be capitalized. In this case, extend the "original" field to include the following word (e.g., "longer, we") and extend the "suggestion" to include the capitalized version (e.g., "longer. We"). Never flag the punctuation change alone if it creates a capitalization obligation — handle both in a single annotation.
- Do NOT flag/correct the period-vs-"?" choice on a polite request ("Will you please state your name.", "May I approach the witness."). Whether it was voiced as a request or a genuine question depends on courtroom role and real-time inflection the text can't supply.
- Do NOT move a mid-sentence question mark placed before an add-on tag ("Are you willing to help? because that would save time."). Where the question mark falls is meaning-dependent and only the reporter who heard it can judge it correctly.
- Do NOT flag whether a colon or a comma follows a "Just so I'm clear" or "So I have a complete picture" lead-in — this is an audio-inflection judgment call, not a mechanical rule.
- Do NOT force a serial (Oxford) comma into a series where a conjunction already appears between every item (e.g., "red and white and blue").
- Do NOT second-guess comma placement around a short direct-address phrase where inflection determines meaning.
- Do NOT flag "now" or "then" comma placement at the start of a sentence — meaning-dependent (conversational filler vs. literal reference to time).
- "As," "because," "if," "since," "so," and "unless" do not take a comma by default when introducing an essential clause; this distinction is genuinely vague, so do NOT actively check it.
- Do NOT require quotation marks around indirect (reported) speech.
- Do NOT apply context/homophone corrections to a witness's own quoted account of past speech — that is their sworn testimony, not a transcription artifact.
- Do NOT require quotation marks around an exhibit designation following "marked" or "labeled."
- Quoted material from an external document should never be silently corrected for spelling or wording — this extends the transcript's general verbatim-preservation principle.
- Do NOT add an apostrophe to a former-contraction word that is now standard (phone, bus, plane, cello, possum).
- Do NOT require an apostrophe+s for a plural number or a plural capitalized abbreviation (the 1990s, two IOUs).
- Do NOT add apostrophes to common everyday word plurals (ifs, ands, buts, ins, outs, ups, downs, pros, cons).
- Do NOT flag either form of a singular possessive on an s/z-ending name as wrong (Reynolds' or Reynolds's — both are valid and audio-dependent). The same applies to a ce/ss-ending "sake" idiom (for goodness' sake or for goodness's sake).
- Do NOT apply general possessive-apostrophe rules to an organization or publication name.
- HIGH-STAKES: a singular vs. plural possessive on a party or witness name can change the substance of the case (the plaintiff's vs. the plaintiffs') — only suggest a correction when that entry's own text clearly establishes which is meant; never guess.
- Do NOT require a possessive apostrophe on a proper noun used descriptively/adjectivally rather than to show ownership (the Morgan farm, as opposed to Morgan's farm).
- Do NOT hyphenate a foreign expression or a proper noun used as a modifier (ad hoc committee, Bay Area restaurant).
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
