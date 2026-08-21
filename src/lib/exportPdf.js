/**
 * Client-side PDF for side-by-side editing. Same corrected plain text as
 * .txt/.rtf — monospace, one transcript page per PDF page when breaks exist.
 *
 * Never wraps lines. Never splits a transcript page across PDF pages.
 * Font size fits the longest line and the densest page.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { isPageHeaderLine } from './exportText.js'

const PAGE_WIDTH = 612 // US Letter
const PAGE_HEIGHT = 792
/** Equal left/right inset. */
export const PDF_MARGIN_X = 36
/** Equal top/bottom inset (leftover page space is then split by centering). */
export const PDF_MARGIN_Y = 36
export const PDF_FONT_SIZE_MAX = 14
/** Line height as a multiple of font size. */
const LINE_HEIGHT_RATIO = 1.35

/**
 * StandardFonts.Courier is WinAnsi. Keep form-feed (`\f`) for page breaks;
 * drop other unsupported controls instead of turning them into "?".
 */
export function sanitizePdfText(text) {
  return String(text || '')
    .replace(/\u2018|\u2019|\u2032/g, "'")
    .replace(/\u201C|\u201D|\u2033/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\u0009\u000A\u000C\u000D\u0020-\u007E\u00A0-\u00FF]/g, '')
}

function trimTrailingBlankLines(lines) {
  let end = lines.length
  while (end > 0 && !lines[end - 1]) end--
  return lines.slice(0, end)
}

/**
 * Split export text into PDF pages: form-feeds and centered page-number headers.
 * Lines are never wrapped. Leading blanks kept so layout matches line-number-on exports.
 * @returns {string[][]}
 */
export function splitPdfPages(plainText) {
  const safe = sanitizePdfText(plainText).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const segments = safe.split('\f').filter((seg) => /[^\s]/.test(seg))
  const pages = []
  let current = []

  const flush = () => {
    const trimmed = trimTrailingBlankLines(current)
    if (trimmed.some((l) => /[^\s]/.test(l))) pages.push(trimmed)
    current = []
  }

  for (const segment of segments) {
    if (current.length) flush()
    for (const raw of segment.split('\n')) {
      if (isPageHeaderLine(raw) && current.some((l) => /[^\s]/.test(l) && !isPageHeaderLine(l))) {
        flush()
      }
      current.push(raw)
    }
  }
  flush()
  return pages
}

/**
 * Single font size for the whole PDF: as large as possible without wrapping
 * any line, and without splitting any transcript page across PDF pages.
 */
export function fitPdfFontSize(font, lines, maxWidth, usableHeight, maxLinesOnPage = 26) {
  const sample = (lines || []).length ? lines : ['']
  let maxUnitWidth = 0
  for (const line of sample) {
    const w = font.widthOfTextAtSize(line || ' ', 1)
    if (w > maxUnitWidth) maxUnitWidth = w
  }
  const byWidth = maxUnitWidth > 0 ? maxWidth / maxUnitWidth : PDF_FONT_SIZE_MAX
  const linesNeeded = Math.max(1, maxLinesOnPage)
  const byHeight = usableHeight / (linesNeeded * LINE_HEIGHT_RATIO)
  return Math.min(PDF_FONT_SIZE_MAX, byWidth, byHeight)
}

function drawLinesOnPage(page, font, lines, startY, fontSize, lineHeight) {
  let y = startY
  for (const line of lines) {
    if (line) {
      page.drawText(line, {
        x: PDF_MARGIN_X,
        y: y - fontSize,
        size: fontSize,
        font,
        color: rgb(0.12, 0.12, 0.12),
      })
    }
    y -= lineHeight
  }
}

/**
 * @param {string} plainText - already through formatExportText / verify path
 * @returns {Promise<Uint8Array>}
 */
export async function encodePdf(plainText) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Courier)
  const maxWidth = PAGE_WIDTH - PDF_MARGIN_X * 2
  const usable = PAGE_HEIGHT - 2 * PDF_MARGIN_Y

  const logicalPages = splitPdfPages(plainText)
  if (!logicalPages.length) {
    doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    return doc.save()
  }

  const allLines = logicalPages.flat()
  const maxLinesOnPage = Math.max(...logicalPages.map((p) => p.length), 1)
  const fontSize = fitPdfFontSize(font, allLines, maxWidth, usable, maxLinesOnPage)
  const lineHeight = fontSize * LINE_HEIGHT_RATIO

  for (const logical of logicalPages) {
    // Same vertical frame on every page (densest page), so blanking line numbers
    // does not re-center and shift the body.
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    const frameHeight = maxLinesOnPage * lineHeight
    const topPad =
      frameHeight <= usable ? Math.max(0, (usable - frameHeight) / 2) : 0
    const startY = PAGE_HEIGHT - PDF_MARGIN_Y - topPad
    drawLinesOnPage(page, font, logical, startY, fontSize, lineHeight)
  }

  return doc.save()
}
