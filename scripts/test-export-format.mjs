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

if (failed) {
  console.error(`\n${failed} failure(s), ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed, 0 failed`)
