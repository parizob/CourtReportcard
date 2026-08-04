/**
 * Export body formatting: optional strip of line-number column and/or
 * centered page-number headers (CAT re-import).
 */

/** Right-justified page header from court .txt exports (same signal as pageCount). */
export function isPageHeaderLine(line) {
  return /^\s{30,}\d{1,4}\s*$/.test((line || '').replace(/\r$/, ''))
}

/**
 * Detect the column where left-gutter line numbers (1–25) start.
 * Returns null when the file does not look like a numbered transcript
 * (e.g. stripped RTF with no line column) so we never blank real content
 * that happens to start with a 1–2 digit number.
 */
export function detectLineNumberDigitStart(lines) {
  const counts = new Map()
  for (const line of lines) {
    const l = (line || '').replace(/\r$/, '')
    if (isPageHeaderLine(l)) continue
    let m = l.match(/^(\s*)(\d{1,2})(\s+)(?=\S)/)
    if (!m) {
      m = l.match(/^(\s*)(\d{1,2})\s*$/)
      if (!m || m[1].length >= 30) continue
    }
    const num = parseInt(m[2], 10)
    if (num < 1 || num > 25) continue
    const start = m[1].length
    counts.set(start, (counts.get(start) || 0) + 1)
  }
  let best = null
  let bestN = 0
  for (const [start, n] of counts) {
    if (n > bestN) {
      best = start
      bestN = n
    }
  }
  // Need repeated hits at the same column — a couple of "12 Main St" lines
  // must not unlock blanking for the whole file.
  if (bestN < 3) return null
  return best
}

function leadMatchesGutter(leadLen, digitStart) {
  return Math.abs(leadLen - digitStart) <= 1
}

/** What numbering is actually present in the export body (for Export UI defaults). */
export function detectExportNumbering(text) {
  const lines = (text || '').split('\n')
  return {
    hasLineNumbers: detectLineNumberDigitStart(lines) != null,
    hasPageNumbers: lines.some(isPageHeaderLine),
  }
}

/**
 * Erase left-column line numbers but keep every column in place (digits → spaces).
 * Page headers are untouched so right-justified page numbers stay put.
 * Only runs when a real 1–25 gutter column is detected.
 */
export function blankLineNumbers(text) {
  if (!text) return text
  const lines = text.split('\n')
  const digitStart = detectLineNumberDigitStart(lines)
  if (digitStart == null) return text

  return lines
    .map((line) => {
      const l = line.replace(/\r$/, '')
      const cr = line.endsWith('\r') ? '\r' : ''
      if (isPageHeaderLine(l)) return line

      const bare = l.match(/^(\s*)(\d{1,2})\s*$/)
      if (bare && bare[1].length < 30) {
        const num = parseInt(bare[2], 10)
        if (num >= 1 && num <= 25 && leadMatchesGutter(bare[1].length, digitStart)) {
          return ''
        }
        return line
      }

      const m = l.match(/^(\s*)(\d{1,2})(\s+)(.*)$/)
      if (!m) return line
      const [, lead, digits, gap, rest] = m
      if (lead.length >= 30) return line
      const num = parseInt(digits, 10)
      if (num < 1 || num > 25) return line
      if (!leadMatchesGutter(lead.length, digitStart)) return line

      const blanked = lead + ' '.repeat(digits.length) + gap + rest
      if (!blanked.trim()) return ''
      return blanked + cr
    })
    .join('\n')
}

/**
 * Removes the left line-number column while preserving content indentation
 * beyond that band. Page headers (far-right lone digits) are left alone.
 * Kept for tests / callers that want a hard column delete.
 */
export function stripLineNumberColumn(text) {
  if (!text) return text
  const lines = text.split('\n')
  const digitStart = detectLineNumberDigitStart(lines)
  if (digitStart == null) return text

  let colWidth = Infinity
  for (const l of lines) {
    const raw = l.replace(/\r$/, '')
    if (isPageHeaderLine(raw)) continue
    const m = raw.match(/^(\s*\d{1,2}\s+)\S/)
    if (!m) continue
    const lead = (raw.match(/^(\s*)/) || ['', ''])[1].length
    if (!leadMatchesGutter(lead, digitStart)) continue
    colWidth = Math.min(colWidth, m[1].length)
  }
  if (!isFinite(colWidth) || colWidth === 0) return text

  return lines
    .map((line) => {
      const raw = line
      const l = line.replace(/\r$/, '')
      const cr = line.endsWith('\r') ? '\r' : ''
      if (isPageHeaderLine(l)) return raw
      if (/^\s*\d{1,2}\s*$/.test(l) && l.search(/\d/) < colWidth) {
        const lead = (l.match(/^(\s*)/) || ['', ''])[1].length
        if (leadMatchesGutter(lead, digitStart)) return ''
      }
      const isNumbered = /^\s*\d{1,2}\s/.test(l)
      const bandIsBlank = /^\s*$/.test(l.slice(0, colWidth))
      if (isNumbered) {
        const lead = (l.match(/^(\s*)/) || ['', ''])[1].length
        if (!leadMatchesGutter(lead, digitStart)) return raw
        return l.slice(colWidth) + cr
      }
      if (bandIsBlank) return l.slice(colWidth) + cr
      return raw
    })
    .join('\n')
}

/** Drop centered/right-justified page-number-only lines. */
export function stripPageHeaderLines(text) {
  if (!text) return text
  return text
    .split('\n')
    .filter((line) => !isPageHeaderLine(line))
    .join('\n')
}

/**
 * @param {string} text
 * @param {{ includeLineNumbers?: boolean, includePageNumbers?: boolean }} opts
 */
export function formatExportText(text, opts = {}) {
  const includeLineNumbers = opts.includeLineNumbers !== false
  const includePageNumbers = opts.includePageNumbers !== false
  let out = text || ''
  // Lines off: blank digits in place (keeps caption/Q&A columns). Never slice the
  // left column — that flush-left shift looked broken next to page headers or alone.
  if (!includeLineNumbers) out = blankLineNumbers(out)
  if (!includePageNumbers) out = stripPageHeaderLines(out)
  return out
}
