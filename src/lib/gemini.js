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
export function fixAnnotationPositions(entries, annotations) {
  return annotations.map((a) => {
    if (!a.original) return a

    const entry = entries.find((e) => e.id === a.entry_id)
    if (!entry) return a

    const text = entry.text
    const orig = a.original

    // Try exact match first
    let idx = text.indexOf(orig)
    if (idx === -1) {
      // Try case-insensitive
      idx = text.toLowerCase().indexOf(orig.toLowerCase())
    }

    if (idx !== -1) {
      return { ...a, start: idx, end: idx + orig.length }
    }

    return a
  })
}

const EXTRACT_AND_PROOFREAD_PROMPT = `You are a world-class legal transcript proofreader and extraction engine. You will receive the content of a court transcript file (RTF, CRE, or PDF format). You must perform TWO tasks in a single pass:

TASK 1 — EXTRACTION:
- Extract every spoken line in order.
- Identify speakers (e.g. "MR. HENDERSON", "MS. MILLER", "THE COURT", "Q", "A", etc.). Use "UNKNOWN" if unclear.
- Preserve the original text EXACTLY as written, including all errors. Do NOT correct anything in the entries.
- If timestamps or line numbers exist, include them.
- Group consecutive lines under the same speaker into one entry.
- Strip all RTF formatting codes, PDF layout artifacts, headers, footers, page numbers, and metadata.

TASK 2 — PROOFREADING:
You are a meticulous court transcript proofreader. For every entry you extract, carefully analyze the text for ALL of the following issues. Report each as a separate annotation.

Error types to find:
- "spelling": Any misspelled word (e.g. "legitatcy" → "legitimacy", "pincipal" → "principal", "iregularities" → "irregularities", "recieve" → "receive", "occured" → "occurred")
- "context": Wrong word used in context — homophones and commonly confused words (e.g. "to/too/two", "their/there/they're", "affect/effect", "then/than", "your/you're", "its/it's", "who's/whose", "accept/except", "loose/lose", "compliment/complement", "principal/principle", "stationary/stationery", "council/counsel", "proceed/precede")
- "grammar": Grammar mistakes including subject-verb agreement, tense consistency, sentence fragments, run-on sentences, double negatives, incorrect pronoun usage, dangling modifiers
- "legal_term": Incorrect legal terminology, misspelled legal terms, incorrect case citations, wrong statute references (e.g. "Statute of Limitats" → "Statute of Limitations", "habeus corpus" → "habeas corpus")
- "punctuation": Missing periods, commas, question marks, or semicolons that affect meaning or readability. Missing possessive apostrophes. Incorrect comma placement in legal citations. Run-on sentences that need punctuation.
- "capitalization": Improper capitalization of proper nouns, legal terms, or titles that should be capitalized (e.g. "supreme court" → "Supreme Court", "judge smith" → "Judge Smith")
- "missing_word": Clearly missing words that make a sentence incomplete or grammatically broken (e.g. "I went the store" → "I went to the store")
- "extra_word": Duplicated or extraneous words (e.g. "I went to to the store")

Severity levels:
- "critical": Definite error — the word is clearly wrong or missing.
- "warning": Likely error — context strongly suggests a different word or punctuation.
- "suggestion": Possible improvement — stylistic, readability, or minor.

IMPORTANT: The "original" field MUST contain the EXACT text as it appears in the entry, character for character. This is used to locate the error in the UI.

OUTPUT — respond with ONLY valid JSON:
{
  "title": "<case title if found, otherwise empty string>",
  "extracted_at": "<current ISO timestamp>",
  "entries": [
    {
      "id": 1,
      "speaker": "SPEAKER NAME",
      "text": "The original text exactly as written...",
      "timestamp": "00:00:00 or null"
    }
  ],
  "annotations": [
    {
      "id": 1,
      "entry_id": 1,
      "type": "spelling",
      "severity": "critical",
      "original": "pincipal",
      "suggestion": "principal",
      "explanation": "Missing letter 'r' — misspelling of 'principal'.",
      "confidence": 0.99,
      "start": 4,
      "end": 12,
      "status": "open"
    }
  ]
}

Now extract and proofread the following file content:`

/**
 * Single-pass: extracts structured text AND proofreads for errors.
 * Accepts either a text string (RTF/CRE) or a File object (PDF).
 * Returns { title, extracted_at, entries[], annotations[] }.
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

  const parsed = await callGemini(`${EXTRACT_AND_PROOFREAD_PROMPT}${promptSuffix}`, filePart)

  if (!parsed.entries || !Array.isArray(parsed.entries)) {
    throw new Error('Gemini response missing "entries" array.')
  }

  parsed.entries = parsed.entries.map((entry, i) => ({
    id: entry.id || i + 1,
    speaker: entry.speaker || 'UNKNOWN',
    text: entry.text || '',
    timestamp: entry.timestamp || null,
    line_number: entry.line_number || null,
  }))

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

  parsed.annotations = fixAnnotationPositions(parsed.entries, annots)

  if (!parsed.extracted_at) {
    parsed.extracted_at = new Date().toISOString()
  }

  return parsed
}

const PROOFREAD_ONLY_PROMPT = `You are a world-class legal transcript proofreader. You will receive a JSON array of transcript entries that have already been extracted. Your ONLY job is to proofread them for ALL errors.

Find ALL errors of these types:
- "spelling": Any misspelled word
- "context": Wrong word used in context — homophones and commonly confused words (to/too/two, their/there/they're, affect/effect, then/than, your/you're, its/it's, who's/whose, accept/except, loose/lose, compliment/complement, principal/principle, council/counsel, proceed/precede, etc.)
- "grammar": Grammar mistakes (subject-verb agreement, tense consistency, sentence fragments, run-on sentences, double negatives, incorrect pronoun usage, dangling modifiers)
- "legal_term": Incorrect legal terminology, misspelled legal terms, or case citation formatting
- "punctuation": Missing or incorrect punctuation that affects meaning or readability (periods, commas, question marks, apostrophes, semicolons)
- "capitalization": Improper capitalization of proper nouns, legal terms, or titles
- "missing_word": Clearly missing words that break the sentence
- "extra_word": Duplicated or extraneous words

Severity levels:
- "critical": Definite error — the word is clearly wrong or missing.
- "warning": Likely error — context strongly suggests a different word or punctuation.
- "suggestion": Possible improvement — stylistic, readability, or minor.

IMPORTANT: The "original" field MUST contain the EXACT text as it appears in the entry, character for character.

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
      "confidence": 0.99,
      "start": 4,
      "end": 12,
      "status": "open"
    }
  ]
}

Here are the transcript entries to proofread:`

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
