/**
 * RTF (Rich Text Format) helpers.
 *
 * Used to:
 * 1. Strip RTF markup on upload so Gemini sees clean text.
 * 2. Encode plain text into RTF on export.
 *
 * Designed for the relatively simple RTF that steno software (Eclipse,
 * CaseCATalyst, etc.) produces. Not a general-purpose RTF parser.
 */

export function isRtf(text) {
  return typeof text === 'string' && text.trimStart().startsWith('{\\rtf')
}

// Header groups whose entire contents we throw away.
const HEADER_GROUPS = [
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer',
  'object', 'themedata', 'datastore', 'latentstyles', 'rsidtbl', 'mmathPr',
  'wgrffmtfilter', 'listtable', 'listoverridetable', 'revtbl',
]

// Find the index of the matching closing `}` for an opening `{` at `start`.
// Returns the index AFTER the closing brace, or -1 if unmatched.
function matchGroup(text, start) {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '\\' && i + 1 < text.length) { i++; continue } // skip escaped char
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}

export function stripRtf(rtf) {
  if (!isRtf(rtf)) return rtf

  let s = rtf

  // Remove all special groups `{\* ... }` (comments, picture data, etc.).
  let prev
  do {
    prev = s
    const idx = s.search(/\{\\\*/)
    if (idx !== -1) {
      const end = matchGroup(s, idx)
      if (end !== -1) s = s.substring(0, idx) + s.substring(end)
    }
  } while (s !== prev && s.includes('{\\*'))

  // Remove header groups (fonttbl, colortbl, stylesheet, info, etc.).
  for (const grp of HEADER_GROUPS) {
    const re = new RegExp(`\\{\\\\${grp}\\b`)
    let idx
    while ((idx = s.search(re)) !== -1) {
      const end = matchGroup(s, idx)
      if (end === -1) break
      s = s.substring(0, idx) + s.substring(end)
    }
  }

  // Replace common whitespace control words with their text equivalents.
  s = s.replace(/\\par\b ?/g, '\n')
  s = s.replace(/\\line\b ?/g, '\n')
  s = s.replace(/\\tab\b ?/g, '\t')
  s = s.replace(/\\page\b ?/g, '\n\n')

  // Decode \'XX hex sequences (e.g. \'93 → fancy quote). Treats as Latin-1.
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))

  // Decode \uNNNN unicode escapes (RTF uses signed 16-bit; negative = > 32767).
  s = s.replace(/\\u(-?\d+)\??/g, (_, n) => {
    let code = parseInt(n, 10)
    if (code < 0) code += 65536
    return String.fromCharCode(code)
  })

  // Preserve literal escapes (\\ → \, \{ → {, \} → }) before stripping other backslashes.
  s = s.replace(/\\\\/g, '\u0001')
  s = s.replace(/\\\{/g, '\u0002')
  s = s.replace(/\\\}/g, '\u0003')

  // Strip remaining control words: \word, \word123, \word-123, optional trailing space.
  s = s.replace(/\\[a-zA-Z]+-?\d* ?/g, '')

  // Strip remaining control symbols (single non-letter after backslash).
  s = s.replace(/\\[^a-zA-Z]/g, '')

  // Strip group braces.
  s = s.replace(/[{}]/g, '')

  // Restore literal escapes.
  s = s.replace(/\u0001/g, '\\').replace(/\u0002/g, '{').replace(/\u0003/g, '}')

  // Collapse 3+ consecutive newlines.
  s = s.replace(/\n{3,}/g, '\n\n')

  return s.trim()
}

/**
 * Wrap plain text in a minimal RTF 1.0 document. Uses Courier New so transcripts
 * render with monospaced alignment matching the editor view.
 */
export function encodeRtf(plainText) {
  const escaped = plainText
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    // Encode non-ASCII characters as \uNNNN escapes per RTF spec.
    .replace(/[\u0080-\uffff]/g, (c) => {
      const code = c.charCodeAt(0)
      // RTF uses signed 16-bit; values > 32767 must be expressed as negative.
      const signed = code > 32767 ? code - 65536 : code
      return `\\u${signed}?`
    })
    // Convert newlines to \par paragraph breaks.
    .replace(/\r?\n/g, '\\par\n')

  return `{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0\\fmodern Courier New;}}\n\\f0\\fs20\n${escaped}\n}`
}
