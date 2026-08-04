/**
 * Editor display helpers for transcript panes.
 */

/** Line looks like a CAT/TXT numbered (or timestamp+numbered) gutter. */
function hasTranscriptLineNumber(line) {
  if (!line || !line.trim()) return false
  // Same gutters buildCleanContentMap strips (line nums / clock+line).
  if (/^\s*\d{1,4}\s{2,}/.test(line)) return true
  if (/^\s*\d{1,2}:\d{2}(?::\d{2})?\s+\d{1,4}\s{2,}/.test(line)) return true
  // Tabs after RTF \tab (same idea as pageCount).
  return /^\s*\d{1,2}(?:[ \t]{2,}|\t)/.test(line)
}

/**
 * Soft-wrap only naked RTF (long unnumbered dumps). Numbered RTF/TXT keep
 * hard lines so the left column stays one physical line per transcript line.
 *
 * @param {boolean} wasRtf
 * @param {string | null | undefined} originalText
 */
export function shouldSoftWrapTranscript(wasRtf, originalText) {
  if (!wasRtf || !originalText) return false

  const lines = originalText.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return false

  const numbered = lines.filter(hasTranscriptLineNumber).length
  // Enough structure that wrapping would fight the real line grid.
  if (numbered / lines.length >= 0.25) return false

  return true
}
