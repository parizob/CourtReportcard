const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = 'gemini-2.5-flash'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

function assertApiKey() {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_KEY_HERE') {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.')
  }
}

async function callGemini(prompt, filePart, timeoutMs = 300000) {
  assertApiKey()

  const parts = []
  if (filePart) parts.push(filePart)
  parts.push({ text: prompt })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: 'application/json',
        },
      }),
    })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new Error('Gemini API request timed out. The transcript may be too large — try splitting it into smaller files.')
    }
    throw err
  }
  clearTimeout(timer)

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gemini API error: ${response.status}`)
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
export function flexFind(text, search) {
  if (!text || !search) return null
  // First try exact match (fast path)
  let idx = text.indexOf(search)
  if (idx !== -1) return { start: idx, end: idx + search.length }
  // Case-insensitive exact match
  idx = text.toLowerCase().indexOf(search.toLowerCase())
  if (idx !== -1) return { start: idx, end: idx + search.length }
  // Whitespace-flexible match: treat any whitespace in `search` as matching
  // any whitespace in `text` (handles \n vs space mismatches)
  try {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/\s+/g, '\\s+')
    const regex = new RegExp(pattern, 'i')
    const match = text.match(regex)
    if (match) return { start: match.index, end: match.index + match[0].length }
  } catch (_) { /* regex safety */ }
  return null
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

const PROOFREAD_ONLY_PROMPT = `You are a seasoned, meticulous court transcript proofreader with decades of experience. You will receive a JSON array of transcript entries that have already been extracted. Your ONLY job is to proofread them for errors.

Read the transcript the way a professional scopist or proofreader would — line by line, word by word. Understand the MEANING and CONTEXT of what is being said.

Your proofreading approach:
1. READ FOR MEANING FIRST. Understand what the speaker is trying to say. Does each sentence make logical sense?
2. CHECK EVERY WORD IN CONTEXT. A word can be spelled correctly but be the WRONG word. "He went too the store" — "too" is wrong. "The injuries were do to the accident" — "do" should be "due". These contextual errors are the MOST IMPORTANT to catch.
3. CHECK FLOW AND COHERENCE. Does the sentence read naturally? Are words missing? Are there repeated/doubled words?
4. VERIFY LEGAL ACCURACY. Are legal terms, statutes, and citations correct?
5. CHECK PUNCTUATION CAREFULLY. Missing commas, question marks, apostrophes that change meaning.

Error types to flag:
- "spelling": Misspelled words
- "context": WRONG word used — spelled correctly but wrong based on meaning. Homophones (to/too/two, their/there/they're, hear/here, affect/effect, its/it's, your/you're, council/counsel, principal/principle, do/due, are/our, where/were/we're, lose/loose, passed/past, brake/break, bare/bear, cite/site/sight, peace/piece, etc.), near-homophones, and phonetic mistranscriptions.
- "grammar": Subject-verb agreement, tense consistency, fragments, run-ons, double negatives, pronoun errors, dangling modifiers
- "legal_term": Misspelled legal terms, incorrect citations, wrong statute references
- "punctuation": Missing or incorrect punctuation affecting meaning or readability
- "capitalization": Improper capitalization of proper nouns, titles, court names, legal terms
- "missing_word": Clearly missing words that make a sentence incomplete
- "extra_word": Duplicated or extraneous words

Severity levels:
- "critical": Definite error — clearly wrong, misspelled, or missing.
- "warning": Likely error — context strongly suggests a different word or punctuation.
- "suggestion": Possible improvement — stylistic, readability, or minor.

IMPORTANT RULES:
- The "original" field MUST contain the EXACT text as it appears in the entry, character for character. This is used to locate the error in the UI.
- Do NOT flag proper nouns or technical terms that are simply unfamiliar — only flag if clearly misspelled.
- Skip entries with speaker labels like "CAPTION", "APPEARANCES", "INDEX", "CERTIFICATE", "EXHIBITS" — only proofread actual testimony.
- Each annotation must reference the entry_id of the entry that contains the error.

OUTPUT — respond with ONLY a valid JSON object:
{
  "annotations": [
    {
      "id": 1,
      "entry_id": 1,
      "type": "spelling",
      "severity": "critical",
      "original": "pincipal",
      "suggestion": "principal",
      "explanation": "Missing letter 'r' — misspelling of 'principal'.",
      "confidence": 0.99
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
