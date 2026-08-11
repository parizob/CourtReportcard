/**
 * Parse Gemini JSON text responses that are *almost* valid but include
 * formatting slips. Used by the harness (`src/lib/gemini.js`) and mirrored
 * in `supabase/functions/analyze-case/index.ts` — keep both in sync.
 *
 * Happy path: JSON.parse only (no rewrite). Repair only runs when parse fails
 * with an illegal-control-character error (seen in prod extraction, 2026-07-27).
 *
 * Structural errors ("Expected ',' or '}' after property value", etc.) are
 * NOT surgically repaired — guessing quotes can invent wrong transcript text.
 * Callers should re-ask the model once instead (see extractContent recovery).
 */

/**
 * First balanced top-level `{...}` / `[...]`, dropping trailing junk Gemini
 * sometimes appends after a complete value.
 */
export function extractFirstJsonValue(text) {
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

/**
 * Escape raw U+0000–U+001F characters that appear inside JSON string literals
 * without being escaped. Leaves already-valid escapes and non-string content alone.
 */
export function escapeRawControlCharsInJsonStrings(text) {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const code = c.charCodeAt(0)
    if (inString) {
      if (escaped) {
        out += c
        escaped = false
        continue
      }
      if (c === '\\') {
        out += c
        escaped = true
        continue
      }
      if (c === '"') {
        out += c
        inString = false
        continue
      }
      if (code < 0x20) {
        if (c === '\n') out += '\\n'
        else if (c === '\r') out += '\\r'
        else if (c === '\t') out += '\\t'
        else out += `\\u${code.toString(16).padStart(4, '0')}`
        continue
      }
      out += c
      continue
    }
    if (c === '"') inString = true
    out += c
  }
  return out
}

export function isControlCharParseError(err) {
  const msg = String(err?.message || err || '')
  return /Bad control character|control character in string/i.test(msg)
}

/** Malformed JSON structure — do not invent repairs; re-call the model instead. */
export function isStructuralJsonParseError(err) {
  const msg = String(err?.message || err || '')
  return (
    /Expected ',' or '}'|Expected property name|Unexpected token|Unexpected end of JSON|Unterminated string|JSON at position/i.test(
      msg,
    ) && !isControlCharParseError(err)
  )
}

/** Any JSON.parse failure worth a one-shot model re-call on extract. */
export function isGeminiJsonParseError(err) {
  return isControlCharParseError(err) || isStructuralJsonParseError(err) || /JSON/i.test(String(err?.message || err || ''))
}

/**
 * Prod 2026-08-11 (Childress): extract sometimes omits the `"text":` key and
 * leaves the spoken line as a bare quoted property name:
 *   { "id": 76, "speaker": "A", "\"Talk to Josh about it.\"" }
 * → { "id": 76, "speaker": "A", "text": "Talk to Josh about it." }
 *
 * Does not invent wording — only inserts `"text":` when a non-key quoted
 * token follows `"speaker": "…"`. Known field names (text/id/…) are left alone.
 * Mirrored in supabase/functions/analyze-case/index.ts — keep in sync.
 *
 * @param {string} text
 * @returns {{ text: string, repairedCount: number }}
 */
export function repairMissingEntryTextKeys(text) {
  let repairedCount = 0
  const knownKeys = /^(text|id|speaker|timestamp|line_number)$/
  const out = String(text || '').replace(
    /("speaker"\s*:\s*"(?:\\.|[^"\\])*"\s*,\s*)"((?:\\.|[^"\\])*)"(\s*[,}])/g,
    (match, prefix, bare, suffix) => {
      let keyOrValue
      try {
        keyOrValue = JSON.parse(`"${bare}"`)
      } catch {
        return match
      }
      if (typeof keyOrValue !== 'string' || knownKeys.test(keyOrValue)) {
        return match
      }
      let value = keyOrValue
      // Model sometimes wraps the line in extra quotes inside the bare token.
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      repairedCount++
      return `${prefix}"text": ${JSON.stringify(value)}${suffix}`
    },
  )
  return { text: out, repairedCount }
}

/**
 * Try normal parse; on JSON failure, apply missing-text-key repair once.
 * @param {string} rawText
 * @returns {{ value: any, repairedCount: number }}
 */
export function parseExtractJsonWithRepairs(rawText) {
  try {
    return { value: parseGeminiJsonResponse(rawText), repairedCount: 0 }
  } catch (err) {
    if (!isGeminiJsonParseError(err)) throw err
    const cleaned = String(rawText || '')
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const { text, repairedCount } = repairMissingEntryTextKeys(cleaned)
    if (repairedCount === 0) throw err
    try {
      return { value: parseGeminiJsonResponse(text), repairedCount }
    } catch {
      throw err
    }
  }
}

/**
 * @param {string} rawText - model response text (may include ```json fences)
 * @returns {any}
 */
export function parseGeminiJsonResponse(rawText) {
  const cleaned = String(rawText || '')
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  const extracted = extractFirstJsonValue(cleaned)
  try {
    return JSON.parse(extracted)
  } catch (err) {
    if (!isControlCharParseError(err)) throw err
    return JSON.parse(escapeRawControlCharsInJsonStrings(extracted))
  }
}

/**
 * Join text from every part on the first candidate. Gemini sometimes puts
 * thought/metadata in parts[0] and the JSON body in a later part — reading
 * only parts[0].text falsely looks like "no content" (Prod 2026-08-11 Zoey
 * McDuffie extract chunk 3). Also builds a PII-safe diagnostic for logs /
 * last_error when text is still empty.
 *
 * Mirrored in supabase/functions/analyze-case/index.ts — keep in sync.
 *
 * @param {any} data - raw generateContent JSON body
 * @returns {{ rawText: string, diag: Record<string, unknown> }}
 */
export function extractGeminiResponseText(data) {
  const candidate = data?.candidates?.[0]
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
  const texts = []
  const partSummaries = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    const text = typeof p?.text === 'string' ? p.text : ''
    const thought = p?.thought === true
    // Never join thought summaries into the parseable body — that would
    // corrupt JSON when includeThoughts is on or a later model starts
    // returning thought text alongside the answer.
    if (text && !thought) texts.push(text)
    partSummaries.push({
      i,
      keys: p && typeof p === 'object' ? Object.keys(p) : [typeof p],
      textLen: text.length,
      thought,
    })
  }
  const safety = Array.isArray(candidate?.safetyRatings)
    ? candidate.safetyRatings.map((r) => ({
      category: r?.category,
      probability: r?.probability,
      blocked: r?.blocked,
    }))
    : null
  const diag = {
    finishReason: candidate?.finishReason ?? null,
    finishMessage: candidate?.finishMessage ?? null,
    blockReason: data?.promptFeedback?.blockReason ?? null,
    blockReasonMessage: data?.promptFeedback?.blockReasonMessage ?? null,
    candidateCount: Array.isArray(data?.candidates) ? data.candidates.length : 0,
    partCount: parts.length,
    partSummaries,
    safetyRatings: safety,
    usageMetadata: data?.usageMetadata ?? null,
  }
  return { rawText: texts.join(''), diag }
}

/**
 * Proofread prompts ask for `{ "annotations": [...] }`, but gemini-2.5-pro
 * sometimes returns a bare annotation array instead (Prod 2026-08-09 Johnston
 * batch 0). Reading `.annotations` on an array yields undefined → [] and we
 * soft-fail / accept empty while throwing away real flags.
 *
 * @param {unknown} result - parsed Gemini JSON
 * @returns {{ annotations: any[], shape: 'object' | 'array' | 'empty' | 'other' }}
 */
export function normalizeProofreadGeminiResult(result) {
  if (Array.isArray(result)) {
    return { annotations: result, shape: 'array' }
  }
  if (result && typeof result === 'object' && Array.isArray(result.annotations)) {
    return { annotations: result.annotations, shape: 'object' }
  }
  if (result == null) {
    return { annotations: [], shape: 'empty' }
  }
  return { annotations: [], shape: 'other' }
}
