const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = 'gemini-2.5-flash'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

function assertApiKey() {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_KEY_HERE') {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.')
  }
}

async function callGemini(prompt) {
  assertApiKey()

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: 'application/json',
      },
    }),
  })

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

const EXTRACT_AND_PROOFREAD_PROMPT = `You are a world-class legal transcript proofreader and extraction engine. You will receive the raw content of a court transcript file (RTF or CRE format). You must perform TWO tasks in a single pass:

TASK 1 — EXTRACTION:
- Extract every spoken line in order.
- Identify speakers (e.g. "MR. HENDERSON", "MS. MILLER", "THE COURT", "Q", "A", etc.). Use "UNKNOWN" if unclear.
- Preserve the original text EXACTLY as written, including all errors. Do NOT correct anything in the entries.
- If timestamps or line numbers exist, include them.
- Group consecutive lines under the same speaker into one entry.
- Strip all RTF formatting codes, headers, footers, page numbers, and metadata.

TASK 2 — PROOFREADING:
For every entry you extract, analyze the text for errors. Report each error as a separate annotation. Types of errors to find:
- "spelling": Misspelled words (e.g. "pincipal" → "principal", "iregularities" → "irregularities")
- "context": Wrong word in context (e.g. "to" vs "too" vs "two", "their" vs "there" vs "they're", "affect" vs "effect", "then" vs "than", "your" vs "you're")
- "grammar": Grammar mistakes (e.g. subject-verb agreement, tense errors, double negatives)
- "legal_term": Incorrect legal terminology (e.g. "Statute of Limitats" → "Statute of Limitations", case citation formatting)
- "punctuation": Missing or incorrect punctuation that changes meaning

Severity levels:
- "critical": Definite error — the word is clearly wrong.
- "warning": Likely error — context strongly suggests a different word.
- "suggestion": Possible improvement — stylistic or minor.

For each annotation, provide the exact character position (start/end) within the entry text where the error occurs. Count from 0.

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
 * Returns { title, extracted_at, entries[], annotations[] }.
 */
export async function extractTranscriptWithGemini(fileContent) {
  const parsed = await callGemini(`${EXTRACT_AND_PROOFREAD_PROMPT}\n\n${fileContent}`)

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

  parsed.annotations = (parsed.annotations || []).map((a, i) => ({
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

  if (!parsed.extracted_at) {
    parsed.extracted_at = new Date().toISOString()
  }

  return parsed
}

const PROOFREAD_ONLY_PROMPT = `You are a world-class legal transcript proofreader. You will receive a JSON array of transcript entries that have already been extracted. Your ONLY job is to proofread them for errors.

Find ALL errors of these types:
- "spelling": Misspelled words
- "context": Wrong word in context (to/too/two, their/there/they're, affect/effect, then/than, your/you're, etc.)
- "grammar": Grammar mistakes (subject-verb agreement, tense errors, double negatives)
- "legal_term": Incorrect legal terminology or case citation formatting
- "punctuation": Missing or incorrect punctuation that changes meaning

Severity levels:
- "critical": Definite error — the word is clearly wrong.
- "warning": Likely error — context strongly suggests a different word.
- "suggestion": Possible improvement — stylistic or minor.

For each annotation, provide the exact character position (start/end) within the entry text. Count from 0.

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

  return (parsed.annotations || []).map((a, i) => ({
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
}
