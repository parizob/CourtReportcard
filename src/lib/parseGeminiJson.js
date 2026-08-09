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
