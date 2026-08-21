/**
 * Export format toggles: line numbers / page headers.
 *   npm run test:export-format
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  blankLineNumbers,
  detectExportNumbering,
  formatExportText,
  isPageHeaderLine,
  stripLineNumberColumn,
  stripPageHeaderLines,
} from '../src/lib/exportText.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed++
    console.log(`  ok  ${msg}`)
  } else {
    failed++
    console.error(`  FAIL  ${msg}`)
  }
}

const fixture = [
  `${' '.repeat(64)}1`,
  '',
  '       1     Q. What is your name?',
  '       2     A. Jane Doe.',
  '',
  `${' '.repeat(64)}2`,
  '',
  '       1     Q. Next question?',
  '       2     A. Yes.',
].join('\n')

console.log('page header detection')
assert(isPageHeaderLine(`${' '.repeat(64)}1`), '64-space page header')
assert(isPageHeaderLine(`${' '.repeat(30)}12`), '30-space page header')
assert(!isPageHeaderLine('       1     Q. Hello'), 'line-number content is not page header')
assert(!isPageHeaderLine('40'), 'bare content number is not page header')

console.log('strip combinations')
{
  const both = formatExportText(fixture, { includeLineNumbers: true, includePageNumbers: true })
  assert(both.includes('Q. What is your name'), 'both on keeps content')
  assert(/\n\s*1\s+Q\./.test(`\n${both}`) || both.includes('1     Q.'), 'both on keeps line numbers')
  assert(both.split('\n').some(isPageHeaderLine), 'both on keeps page headers')
}

{
  const noPages = formatExportText(fixture, { includeLineNumbers: true, includePageNumbers: false })
  assert(noPages.includes('Q. What is your name'), 'lines on / pages off keeps content')
  assert(noPages.includes('1     Q.') || /1\s+Q\./.test(noPages), 'keeps line numbers')
  assert(!noPages.split('\n').some(isPageHeaderLine), 'drops page headers')
}

{
  const noLines = formatExportText(fixture, { includeLineNumbers: false, includePageNumbers: true })
  assert(noLines.includes('Q. What is your name'), 'lines off / pages on keeps content')
  // Digits blanked; Q stays in the same column (not shifted left)
  assert(!/^\s*\d{1,2}[ \t]+Q\./m.test(noLines), 'blanks line-number digits')
  assert(noLines.includes(`${' '.repeat(13)}Q. What is your name`), 'keeps Q column position')
  const header = noLines.split('\n').find(isPageHeaderLine)
  assert(!!header && header.length === 65, 'page header stays right-justified (unshifted)')
}

console.log('layout: lines off + pages on (no column shift)')
{
  const caption = [
    `${' '.repeat(75)}1`,
    '',
    '                1                            IN THE CIRCUIT COURT',
    '                                             JUDICIAL CIRCUIT',
    '                2                            MARION COUNTY',
    '                4',
    '                   FLORA NELL WEATHERS, an Individual,',
    '                         Plaintiff,',
    '               10        Q.   Good morning.',
    '               11   full name for the record?',
  ].join('\n')
  const out = formatExportText(caption, { includeLineNumbers: false, includePageNumbers: true })
  const lines = out.split('\n')
  assert(lines[0] === `${' '.repeat(75)}1`, 'page 1 unshifted')
  assert(lines[2] === '                                             IN THE CIRCUIT COURT', 'caption court column kept')
  assert(lines[3] === '                                             JUDICIAL CIRCUIT', 'continuation unshifted')
  assert(lines[6] === '                   FLORA NELL WEATHERS, an Individual,', 'party indent kept')
  assert(lines[8] === '                         Q.   Good morning.', 'Q column kept (digits blanked)')
  assert(lines[9] === '                    full name for the record?', 'wrap column kept')
  assert(!blankLineNumbers(caption).split('\n').some((l) => /^\s*\d{1,2}\s+Q\./.test(l)), 'no line nums before Q')
}

{
  const neither = formatExportText(fixture, { includeLineNumbers: false, includePageNumbers: false })
  assert(neither.includes('Q. What is your name'), 'both off keeps content')
  assert(neither.includes('A. Jane Doe'), 'keeps answers')
  assert(!neither.split('\n').some(isPageHeaderLine), 'drops page headers')
  assert(!/^\s*\d{1,2}[ \t]+Q\./m.test(neither), 'blanks line numbers')
  assert(neither.includes(`${' '.repeat(13)}Q. What is your name`), 'both off keeps Q column')
}

console.log('Kristie-style mid-sentence page header')
{
  // Include enough gutter lines for column detection (≥3).
  const mid = [
    '       24    of the heat of the process as it heated the',
    '',
    `${' '.repeat(64)}25`,
    '',
    '       1     process, it recovered some of the heat and made',
    '       2     steam again.',
  ].join('\n')
  const out = formatExportText(mid, { includeLineNumbers: false, includePageNumbers: false })
  assert(!out.split('\n').some(isPageHeaderLine), 'removes mid-body page 25')
  assert(out.includes('heated the'), 'keeps prior line')
  assert(out.includes('process, it recovered'), 'keeps following content')
  assert(!/^\s*1\s+process/m.test(out), 'line num blanked on following')
  assert(out.includes(`${' '.repeat(13)}process, it recovered`), 'following line keeps column')
}

// Optional: real Beaver OT if present from investigation
const kristieOt = '/tmp/kristie_ot.txt'
if (existsSync(kristieOt)) {
  console.log('Beaver case fixture (/tmp/kristie_ot.txt)')
  const ot = readFileSync(kristieOt, 'utf8')
  const clean = formatExportText(ot, { includeLineNumbers: false, includePageNumbers: false })
  const headersIn = ot.split('\n').filter(isPageHeaderLine).length
  const headersOut = clean.split('\n').filter(isPageHeaderLine).length
  assert(headersIn >= 90, `source has many page headers (got ${headersIn})`)
  assert(headersOut === 0, `clean has zero page headers (got ${headersOut})`)
  assert(clean.includes('process'), 'Beaver content preserved')
}

console.log('detectExportNumbering (Export UI defaults)')
{
  const numbered = detectExportNumbering(fixture)
  assert(numbered.hasLineNumbers === true, 'fixture has line numbers')
  assert(numbered.hasPageNumbers === true, 'fixture has page numbers')
  const naked = detectExportNumbering('IN THE DISTRICT COURT\n\nQ. Hello?\nA. Yes.\n')
  assert(naked.hasLineNumbers === false, 'naked body has no line numbers')
  assert(naked.hasPageNumbers === false, 'naked body has no page numbers')
}

console.log('no false blanks on content numbers')
{
  const rtfish = '\t\t1508 SW Topeka Blvd.\n\t\t4520 Main Street, Suite 700\n\t\t12 Main Street\n'
  const out = formatExportText(rtfish, { includeLineNumbers: false, includePageNumbers: false })
  assert(out.includes('1508 SW Topeka'), 'keeps street number 1508')
  assert(out.includes('4520 Main Street'), 'keeps street number 4520')
  assert(out.includes('12 Main Street'), 'keeps 2-digit street without gutter')
}

{
  // Scattered 1–2 digit starts, not a repeated gutter column
  const prose = [
    '12 years old, she said.',
    '3 witnesses testified.',
    'On May 5, 2024, the parties met.',
    'I paid $9 for parking.',
  ].join('\n')
  const out = formatExportText(prose, { includeLineNumbers: false, includePageNumbers: false })
  assert(out === prose, 'leaves prose numbers alone without a line gutter')
}

{
  // Real gutter at col 7 — blank only those; a wrong-column "12" stays
  const mixed = [
    '       1     Q. How old were you?',
    '       2     A. I was 12 years old.',
    '12 years old, she said.',
    '       3     Q. Thank you.',
  ].join('\n')
  const out = formatExportText(mixed, { includeLineNumbers: false, includePageNumbers: false })
  assert(out.includes('Q. How old were you'), 'gutter blank keeps Q')
  assert(!/^\s*1\s+Q\./m.test(out), 'gutter line nums blanked')
  assert(out.includes('I was 12 years old'), 'mid-line age kept')
  assert(out.split('\n').some((l) => l === '12 years old, she said.'), 'wrong-column 12 kept')
}

{
  // One-off near the gutter must not be blanked (old ±1 on mode would catch it)
  const near = [
    '       1     Q. Where do you live?',
    '       2     A. Nearby.',
    '       3     Q. Thanks.',
    '      12 Main Street',
  ].join('\n')
  const out = formatExportText(near, { includeLineNumbers: false, includePageNumbers: false })
  assert(out.includes('12 Main Street'), 'near-gutter address kept')
}

console.log('helpers')
assert(stripPageHeaderLines(fixture).split('\n').filter(isPageHeaderLine).length === 0, 'stripPageHeaderLines')
assert(stripLineNumberColumn(fixture).includes('Q. What'), 'stripLineNumberColumn keeps Q')

{
  console.log('pdf')
  const {
    encodePdf,
    sanitizePdfText,
    fitPdfFontSize,
    splitPdfPages,
    PDF_FONT_SIZE_MAX,
  } = await import('../src/lib/exportPdf.js')
  const { StandardFonts, PDFDocument } = await import('pdf-lib')
  assert(sanitizePdfText('smart \u201Cquotes\u201D and \u2014 dash') === 'smart "quotes" and - dash', 'sanitize smart punctuation')
  assert(!sanitizePdfText('before\fafter').includes('?'), 'form-feed does not become ?')
  assert(sanitizePdfText('before\fafter').includes('\f'), 'form-feed preserved for breaks')

  const pages = splitPdfPages('short\n' + 'x'.repeat(120))
  assert(pages.length === 1, 'splitPdfPages does not wrap long lines')
  assert(pages[0].some((l) => l.length === 120), 'long line kept intact')

  const body = formatExportText(fixture, { includeLineNumbers: true, includePageNumbers: true })
  const bytes = await encodePdf(body)
  assert(bytes instanceof Uint8Array && bytes.length > 100, 'encodePdf returns bytes')
  const head = String.fromCharCode(...bytes.slice(0, 5))
  assert(head === '%PDF-', 'PDF magic header')
  const loaded = await PDFDocument.load(bytes)
  assert(loaded.getPageCount() >= 1, 'PDF has at least one page')

  const twoPages = [
    '       1     Q. First page only.',
    '       2     A. Yes.',
    '\f',
    '       1     Q. Second page only.',
    '       2     A. Also yes.',
  ].join('\n')
  const twoLoaded = await PDFDocument.load(await encodePdf(twoPages))
  assert(twoLoaded.getPageCount() === 2, 'form-feed → one PDF page each')

  const bothBreaks = [
    '       1     Q. First page.',
    '       2     A. Yes.',
    '\f',
    '',
    `${' '.repeat(64)}2`,
    '',
    '       1     Q. Second page.',
  ].join('\n')
  const bothLoaded = await PDFDocument.load(await encodePdf(bothBreaks))
  assert(bothLoaded.getPageCount() === 2, 'form-feed + header → no blank between')

  const leadingFf = `\f\n${' '.repeat(64)}1\n       1     Q. Only page.\n`
  const leadLoaded = await PDFDocument.load(await encodePdf(leadingFf))
  assert(leadLoaded.getPageCount() === 1, 'leading form-feed → no blank first page')

  const headerPages = [
    `${' '.repeat(64)}1`,
    '       1     Q. Page one.',
    `${' '.repeat(64)}2`,
    '       1     Q. Page two.',
  ].join('\n')
  const headerLoaded = await PDFDocument.load(await encodePdf(headerPages))
  assert(headerLoaded.getPageCount() === 2, 'page-number headers → one PDF page each')

  const docFont = await PDFDocument.create()
  const courier = await docFont.embedFont(StandardFonts.Courier)
  const long = ' '.repeat(10) + 'Q. ' + 'word '.repeat(30)
  const size = fitPdfFontSize(courier, [long], 612 - 72, 792 - 72, 25)
  assert(size > 0, 'fit font positive')
  assert(size <= PDF_FONT_SIZE_MAX, 'font capped')
  assert(courier.widthOfTextAtSize(long, size) <= 612 - 72 + 0.5, 'fitted size keeps line on page')

  const dense = [
    `${' '.repeat(64)}1`,
    ...Array.from({ length: 33 }, (_, i) => `       ${(i % 25) + 1}     Line ${i} of dense page content here.`),
  ].join('\n')
  assert(splitPdfPages(dense).length === 1, 'dense content is one logical page')
  const denseLoaded = await PDFDocument.load(await encodePdf(dense))
  assert(denseLoaded.getPageCount() === 1, 'dense page does not spill to a second PDF page')

  const short = `${' '.repeat(64)}1\n       1     Q. Only a few lines.\n       2     A. Yes.\n`
  const shortRaw = Buffer.from(await encodePdf(short)).toString('latin1')
  const inflated = []
  const { inflateSync } = await import('zlib')
  for (const m of shortRaw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let chunk = m[1]
    if (chunk.endsWith('\r\n')) chunk = chunk.slice(0, -2)
    else if (chunk.endsWith('\n')) chunk = chunk.slice(0, -1)
    try {
      inflated.push(inflateSync(Buffer.from(chunk, 'latin1')).toString('latin1'))
    } catch {
      /* not flate */
    }
  }
  const ys = []
  for (const text of inflated) {
    for (const t of text.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)) ys.push(+t[2])
  }
  assert(ys.length >= 2, 'short page has drawn lines')
  const topY = Math.max(...ys)
  const botY = Math.min(...ys)
  const topMargin = 792 - topY
  const bottomMargin = botY
  assert(Math.abs(topMargin - bottomMargin) < 25, `centered short page top≈bottom (top=${topMargin.toFixed(1)} bot=${bottomMargin.toFixed(1)})`)

  // Blanking line numbers must not shift the vertical frame vs line-numbers-on
  async function firstBaseline(plain) {
    const raw = Buffer.from(await encodePdf(plain)).toString('latin1')
    const { inflateSync } = await import('zlib')
    const ys = []
    for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
      let chunk = m[1]
      if (chunk.endsWith('\r\n')) chunk = chunk.slice(0, -2)
      else if (chunk.endsWith('\n')) chunk = chunk.slice(0, -1)
      let text
      try {
        text = inflateSync(Buffer.from(chunk, 'latin1')).toString('latin1')
      } catch {
        continue
      }
      for (const t of text.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)) ys.push(+t[2])
      if (ys.length) break // first page only
    }
    return Math.max(...ys)
  }
  const multi = [
    `${' '.repeat(64)}1`,
    '',
    '       1     Q. Page one line.',
    '       2     A. Answer one.',
    '',
    `${' '.repeat(64)}2`,
    '',
    '       1     Q. Page two line.',
    '       2     A. Answer two.',
    '',
    '       3     Q. More on page two.',
  ].join('\n')
  const withNums = formatExportText(multi, { includeLineNumbers: true, includePageNumbers: true })
  const noNums = formatExportText(multi, { includeLineNumbers: false, includePageNumbers: true })
  const topWith = await firstBaseline(withNums)
  const topWithout = await firstBaseline(noNums)
  assert(Math.abs(topWith - topWithout) < 0.5, `line-num toggle keeps first-page top (with=${topWith} without=${topWithout})`)
}

if (failed) {
  console.error(`\n${failed} failure(s), ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed, 0 failed`)
