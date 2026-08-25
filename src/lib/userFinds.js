/**
 * Personal "My finds" punch list — reporter highlights, not software annotations.
 * Persisted on extracted JSON as `userFinds`; never applied to transcript export.
 */

/** @typedef {{
 *   id: number,
 *   page: string | null,
 *   line: string | null,
 *   text: string,
 *   note: string,
 *   created_at: string,
 *   lineIdx?: number,
 *   cleanStart?: number,
 *   cleanEnd?: number,
 * }} UserFind */

export function nextUserFindId(finds) {
  let max = 0
  for (const f of finds || []) {
    const n = Number(f?.id)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

export function normalizeUserFinds(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((f) => f && typeof f.text === 'string' && f.text.trim())
    .map((f) => ({
      id: Number(f.id) || 0,
      page: f.page != null && String(f.page).trim() !== '' ? String(f.page).trim() : null,
      line: f.line != null && String(f.line).trim() !== '' ? String(f.line).trim() : null,
      text: String(f.text).trim(),
      note: typeof f.note === 'string' ? f.note.trim() : '',
      created_at: f.created_at || new Date().toISOString(),
      lineIdx: Number.isFinite(Number(f.lineIdx)) ? Number(f.lineIdx) : undefined,
      cleanStart: Number.isFinite(Number(f.cleanStart)) ? Number(f.cleanStart) : undefined,
      cleanEnd: Number.isFinite(Number(f.cleanEnd)) ? Number(f.cleanEnd) : undefined,
    }))
    .filter((f) => f.id > 0)
}

/**
 * Format a downloadable punch list for CAT / side notes.
 * @param {UserFind[]} finds
 */
export function formatUserFindsDownload(finds) {
  const list = sortUserFinds(finds)
  if (!list.length) return ''
  return list
    .map((f) => {
      const loc = [
        f.page != null ? `Page ${f.page}` : null,
        f.line != null ? `Line ${f.line}` : null,
      ]
        .filter(Boolean)
        .join(', ')
      const lines = []
      if (loc) lines.push(loc)
      lines.push(`"${f.text}"`)
      if (f.note) lines.push(`Note: ${f.note}`)
      return lines.join('\n')
    })
    .join('\n\n---\n\n')
}

/**
 * Best-effort line number from a parsed line's gutter prefix (e.g. "    12  ").
 */
export function lineNumberFromPrefix(prefix) {
  const m = String(prefix || '').match(/(\d{1,2})\s*$/)
  return m ? m[1] : null
}

function locSortKey(value) {
  if (value == null || String(value).trim() === '') return Number.POSITIVE_INFINITY
  const n = Number(String(value).trim())
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

/** Page ascending, then line ascending; missing page/line sort last within that key. */
export function sortUserFinds(finds) {
  return [...normalizeUserFinds(finds)].sort((a, b) => {
    const pageDiff = locSortKey(a.page) - locSortKey(b.page)
    if (pageDiff !== 0) return pageDiff
    const lineDiff = locSortKey(a.line) - locSortKey(b.line)
    if (lineDiff !== 0) return lineDiff
    return (a.id || 0) - (b.id || 0)
  })
}

/**
 * Attach lineIdx + pageNum to parsedLines (same page-break rules as the editor).
 * @param {Array<{ fullLine: string, prefix?: string, content?: string, cleanStart?: number, cleanEnd?: number }>} parsedLines
 */
export function attachPageNumbersToLines(parsedLines) {
  const list = Array.isArray(parsedLines) ? parsedLines : []
  const pageBreakPattern = /^\s{30,}\d{1,4}\s*$/
  const pageBreakIndices = list.reduce((acc, pl, i) => {
    if (pageBreakPattern.test(pl.fullLine || '')) acc.push(i)
    return acc
  }, [])

  if (pageBreakIndices.length > 1) {
    return list.map((pl, i) => {
      let pageNum = null
      for (let p = pageBreakIndices.length - 1; p >= 0; p--) {
        if (pageBreakIndices[p] <= i) {
          pageNum = String(list[pageBreakIndices[p]].fullLine || '').trim() || null
          break
        }
      }
      return { ...pl, lineIdx: i, pageNum }
    })
  }

  const LINES_PER_PAGE = 28
  return list.map((pl, i) => ({
    ...pl,
    lineIdx: i,
    pageNum: String(Math.floor(i / LINES_PER_PAGE) + 1),
  }))
}

/**
 * Resolve page/line/offsets for a selection anchored to a transcript line element.
 * @param {import('./gemini.js').parsed line shape} pl — parsedLines[lineIdx] (+ optional pageNum)
 * @param {string} selectedText
 * @param {number} [offsetInLine] — start offset within pl.content when known
 */
export function buildUserFindFromLine(pl, selectedText, offsetInLine, id) {
  const text = String(selectedText || '').replace(/\s+/g, ' ').trim()
  if (!text || !pl) return null
  const content = pl.content || ''
  let rel = Number.isFinite(offsetInLine) ? offsetInLine : content.indexOf(text)
  if (rel < 0) {
    const flex = content.toLowerCase().indexOf(text.toLowerCase())
    rel = flex >= 0 ? flex : 0
  }
  const cleanStart = (pl.cleanStart ?? 0) + rel
  const cleanEnd = cleanStart + text.length
  return {
    id,
    page: pl.pageNum != null && String(pl.pageNum).trim() !== '' ? String(pl.pageNum).trim() : null,
    line: lineNumberFromPrefix(pl.prefix),
    text,
    note: '',
    created_at: new Date().toISOString(),
    lineIdx: pl.lineIdx,
    cleanStart,
    cleanEnd,
  }
}

export function triggerTextDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
