/**
 * Counts pages in a transcript TXT.
 *
 * Primary: detects the centered page-number headers that court reporter software
 * places far to the right of the page (30+ leading spaces, a 1–4 digit number,
 * nothing else). These are the actual page breaks and give the exact count.
 *
 * Fallback: if no page-break markers are found, counts numbered transcript lines
 * (e.g. " 1  text", " 12  text") and divides by 25 (industry standard lines/page).
 * A final fallback counts all non-empty lines.
 */
export function countPages(text) {
  if (!text) return 0

  const lines = text.split('\n')

  // Primary: look for lines that are only a page number with heavy left-padding.
  // These appear as e.g. "                                                       3"
  // Line numbers (1–25 per page) use only ~16 spaces of padding, so 30 is a safe threshold.
  const pageMarkers = lines.filter((l) => /^\s{30,}\d{1,4}\s*$/.test(l))
  if (pageMarkers.length > 0) return pageMarkers.length

  // Fallback: count numbered content lines and divide by 25.
  const numbered = lines.filter((l) => /^\s*\d{1,4}\s{2,}/.test(l)).length
  const lineCount = numbered > 0 ? numbered : lines.filter((l) => l.trim().length > 0).length
  return Math.max(1, Math.ceil(lineCount / 25))
}
