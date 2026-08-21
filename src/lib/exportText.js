/**
 * Export body formatting: optional strip of line-number column and/or
 * centered page-number headers (CAT re-import).
 */

/** Right-justified page header from court .txt exports (same signal as pageCount). */
export function isPageHeaderLine(line) {
  return /^\s{30,}\d{1,4}\s*$/.test((line || '').replace(/\r$/, ''))
}

/**
 * Columns where left-gutter line numbers (1–25) repeatedly start.
 * Only columns with ≥3 hits qualify — a one-off "12 Main Street" at a
 * nearby indent must not unlock blanking.
 * Returns [] when the file does not look like a numbered transcript.
 */
export function detectLineNumberDigitStarts(lines) {
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
  // Primary: column must appear ≥3 times. Secondary: ≥2 times and adjacent to a
  // primary column (real transcripts wobble by one space between 1-digit and
  // 2-digit line nums). A single "12 Main Street" at a nearby indent stays out.
  const primary = new Set()
  for (const [start, n] of counts) {
    if (n >= 3) primary.add(start)
  }
  const allowed = new Set(primary)
  for (const [start, n] of counts) {
    if (n >= 2 && (primary.has(start - 1) || primary.has(start + 1))) {
      allowed.add(start)
    }
  }
  return [...allowed].sort((a, b) => a - b)
}

/** @deprecated use detectLineNumberDigitStarts — kept for call sites needing one column */
export function detectLineNumberDigitStart(lines) {
  const starts = detectLineNumberDigitStarts(lines)
  return starts.length ? starts[0] : null
}

function leadInGutter(leadLen, allowedStarts) {
  return allowedStarts.includes(leadLen)
}

/** What numbering is actually present in the export body (for Export UI defaults). */
export function detectExportNumbering(text) {
  const lines = (text || '').split('\n')
  return {
    hasLineNumbers: detectLineNumberDigitStarts(lines).length > 0,
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
  const allowedStarts = detectLineNumberDigitStarts(lines)
  if (!allowedStarts.length) return text

  return lines
    .map((line) => {
      const l = line.replace(/\r$/, '')
      const cr = line.endsWith('\r') ? '\r' : ''
      if (isPageHeaderLine(l)) return line

      const bare = l.match(/^(\s*)(\d{1,2})\s*$/)
      if (bare && bare[1].length < 30) {
        const num = parseInt(bare[2], 10)
        if (num >= 1 && num <= 25 && leadInGutter(bare[1].length, allowedStarts)) {
          // Keep the row so PDF/TXT vertical layout does not shift when digits are blanked.
          return bare[1] + ' '.repeat(bare[2].length) + cr
        }
        return line
      }

      const m = l.match(/^(\s*)(\d{1,2})(\s+)(.*)$/)
      if (!m) return line
      const [, lead, digits, gap, rest] = m
      if (lead.length >= 30) return line
      const num = parseInt(digits, 10)
      if (num < 1 || num > 25) return line
      if (!leadInGutter(lead.length, allowedStarts)) return line

      const blanked = lead + ' '.repeat(digits.length) + gap + rest
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
  const allowedStarts = detectLineNumberDigitStarts(lines)
  if (!allowedStarts.length) return text

  let colWidth = Infinity
  for (const l of lines) {
    const raw = l.replace(/\r$/, '')
    if (isPageHeaderLine(raw)) continue
    const m = raw.match(/^(\s*\d{1,2}\s+)\S/)
    if (!m) continue
    const lead = (raw.match(/^(\s*)/) || ['', ''])[1].length
    if (!leadInGutter(lead, allowedStarts)) continue
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
        if (leadInGutter(lead, allowedStarts)) return ''
      }
      const isNumbered = /^\s*\d{1,2}\s/.test(l)
      const bandIsBlank = /^\s*$/.test(l.slice(0, colWidth))
      if (isNumbered) {
        const lead = (l.match(/^(\s*)/) || ['', ''])[1].length
        if (!leadInGutter(lead, allowedStarts)) return raw
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
