/**
 * Counts pages in a transcript (plain text after any RTF strip).
 *
 * Order of signals (strongest first):
 * 1. Form-feed page breaks (`\f`) — stripRtf turns RTF `\page` into these.
 * 2. Centered page-number headers (30+ leading spaces + digits only).
 * 3. Numbered transcript lines (1–25 style, spaces or tabs) ÷ 25.
 * 4. All non-empty lines ÷ 25 (last resort — can overcount fat RTF leftovers).
 */
export function countPages(text) {
  if (!text) return 0

  // RTF `\page` becomes `\f` in stripRtf. Prefer segment count over line heuristics
  // so header/footer crumbs cannot inflate token charges (89 → ~240 class bug).
  if (text.includes('\f')) {
    const segments = text.split('\f').filter((part) => part.trim().length > 0)
    if (segments.length > 0) return segments.length
  }

  const lines = text.split(/\r?\n/)

  // Centered page-number headers from court reporter TXT exports.
  // Line numbers (1–25/page) use only ~16 spaces of padding; 30+ is a page header.
  const pageMarkers = lines.filter((l) => /^\s{30,}\d{1,4}\s*$/.test(l))
  if (pageMarkers.length > 0) return pageMarkers.length

  // Numbered content lines. Allow tabs (common after RTF `\tab`) and require
  // only 1–2 digit line nums so years like "2024  ..." are less likely to match.
  const numbered = lines.filter((l) => /^\s*\d{1,2}(?:[ \t]{2,}|\t)/.test(l)).length
  if (numbered > 0) return Math.max(1, Math.ceil(numbered / 25))

  const nonempty = lines.filter((l) => l.trim().length > 0).length
  return Math.max(1, Math.ceil(nonempty / 25))
}
