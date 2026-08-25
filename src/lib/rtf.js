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

import { isPageHeaderLine } from './exportText.js'

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

  // Normalize CRLF from CAT / our encoder before control stripping.
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Replace common whitespace control words with their text equivalents.
  s = s.replace(/\\par\b ?/g, '\n')
  s = s.replace(/\\line\b ?/g, '\n')
  s = s.replace(/\\tab\b ?/g, '\t')
  // Real page breaks → form feed so countPages can charge by page, not by
  // leftover nonempty lines from headers/footers/crumbs after strip.
  s = s.replace(/\\page\b ?/g, '\f')
  // CAT / our exports use \\li twips for left indent. Restore approximate
  // Courier 12pt spaces so re-upload keeps columns.
  s = s.replace(/\\li(-?\d+) ?/g, (_, n) => {
    const twips = parseInt(n, 10)
    if (!Number.isFinite(twips) || twips <= 0) return ''
    return ' '.repeat(Math.min(120, Math.round(twips / 144)))
  })

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

  // Significant control symbols — must become real characters, not get deleted.
  // StenoCAT uses \~ (nbsp) between "Ms." and surnames; deleting it forged
  // "Ms.Jackoboice" and false punctuation suggestions.
  // StenoCAT also writes compound hyphens as \_ (RTF escaped underscore), e.g.
  // long\_distance / Guillian\_Barre — those display as dashes in CAT, not _.
  s = s.replace(/\\~/g, ' ')
  s = s.replace(/\\_/g, '-')
  s = s.replace(/\\-/g, '-') // optional hyphen

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
 * Wrap plain text as CaseCATalyst-importable RTF/CRE.
 *
 * CaseCAT Import → RTF/CRE expects Court Reporting Extensions, not generic
 * Word RTF. Mirror Stenograph caseCATalyst4 export markers
 * (scripts/fixtures/casecat-rtf-structure-excerpt.rtf):
 *
 *   {\\rtf1\\ansi{\\*\\cxrev100}{\\*\\cxtranscript} …}
 *   fonttbl + colortbl + stylesheet
 *   paper/margins
 *   per line: \\pard\\s0\\…\\cxsingle\\fs…\\sl-…\\r\\n FULL LINE\\r\\n\\par
 *
 * Important: keep the full page-image line (leading spaces + gutter digits +
 * text). Converting spaces to \\li destroyed the monospace column grid so
 * line numbers sat alone above their text. Do not emit \\cxnoflines25 /
 * \\cxlinex — those draw a second line-number column and shrink the text
 * width until lines wrap ("COURT OF THE FIFTH", "a.m. EST").
 *
 * Leading blank lines (and blanks under an ASCII page header) are stripped per
 * page — in page-image TXT they pad the caption down the sheet; in CAT they
 * become empty paragraphs and shove content off the bottom (spill). Page-number
 * headers themselves are kept when the export toggle includes them.
 *
 * Form feeds → \\page.
 * Callers should pass formatExportText output (already normalizeExportPlainText).
 */
export function encodeRtf(plainText) {
  // Belt-and-suspenders: strip mid-line CR even if caller skipped normalize.
  let text = String(plainText ?? '').replace(/\r\n/g, '\n').replace(/\r/g, (match, offset, full) => {
    const prev = offset > 0 ? full[offset - 1] : ''
    const next = offset + 1 < full.length ? full[offset + 1] : ''
    if (prev === ' ' || prev === '\t' || prev === '\n') return ''
    if (next === ' ' || next === '\t' || next === '\n' || next === '') return ''
    return ' '
  })

  const escapeLine = (line) =>
    String(line)
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/[\u0080-\uffff]/g, (c) => {
        const code = c.charCodeAt(0)
        const signed = code > 32767 ? code - 65536 : code
        return `\\u${signed}?`
      })

  /**
   * Drop blank padding so CAT does not start content at ~6".
   * Keep a leading page-number header when present; drop blanks under it.
   */
  const trimPageLinesForCat = (page) => {
    const lines = page.split('\n')
    let start = 0
    while (start < lines.length && !/\S/.test(lines[start])) start++
    let end = lines.length - 1
    while (end >= start && !/\S/.test(lines[end])) end--
    const sliced = lines.slice(start, end + 1)
    if (sliced.length && isPageHeaderLine(sliced[0])) {
      let i = 1
      while (i < sliced.length && !/\S/.test(sliced[i])) i++
      return [sliced[0], ...sliced.slice(i)]
    }
    return sliced
  }

  // 10pt + exact spacing so ~80-column page-image lines fit US Letter.
  // Keep every leading space — that is the line-number / caption grid.
  const pard = '\\pard\\s0\\ql\\cxsingle\\f0\\fs20\\cf0\\li0\\fi0\\ri0\\sl-240\\slmult0'

  const pages = text.split('\f')
  const body = pages
    .map((page) => {
      const lines = trimPageLinesForCat(page)
      if (!lines.length) return `${pard}\r\n\r\n\\par`
      return lines.map((line) => `${pard}\r\n${escapeLine(line)}\r\n\\par`).join('\r\n')
    })
    .join('\r\n\\page\r\n')

  // CRE markers for Import; no \\cxnoflines (conflicts with embedded gutter nums).
  return (
    `{\\rtf1\\ansi{\\*\\cxrev100}{\\*\\cxtranscript}\r\n` +
    `{\\*\\cxsystem Court Reportcard}\r\n` +
    `{\\info{\\title Court Reportcard export}}\r\n` +
    `\\deffont0{\\fonttbl\r\n` +
    `{\\f0\\fcharset1 Courier New;}\r\n` +
    `{\\f2\\fswiss\\fcharset1 Courier New;}\r\n` +
    `}\r\n` +
    `{\\colortbl;}\r\n` +
    `{\\stylesheet\r\n` +
    `{\\s0\\snext0\\li0\\fi0 Normal 0;}\r\n` +
    `}\r\n` +
    `\\paperh15840\\paperw12240\\margt720\\margb720\\margl288\\margr288\r\n` +
    `${body}\r\n}`
  )
}
