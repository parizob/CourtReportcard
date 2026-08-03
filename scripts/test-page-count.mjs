/**
 * Page-count / token-charge correctness — especially RTF from CAT software.
 *   node scripts/test-page-count.mjs
 */
import { readFileSync } from 'fs'
import { countPages } from '../src/lib/pageCount.js'
import { prepareTranscriptUpload } from '../src/lib/prepareTranscriptUpload.js'

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

/** Eclipse-ish RTF: truePageCount pages, each ends with \\page, tab line nums + junk lines. */
function buildCatStyleRtf(truePageCount, { extraNonemptyPerPage = 42 } = {}) {
  let body = ''
  for (let p = 1; p <= truePageCount; p++) {
    body += `\\pard\\qr ${p}\\par\n`
    for (let ln = 1; ln <= 25; ln++) {
      body += `\\pard ${ln}\\tab Q. Line ${ln} on page ${p}.\\par\n`
    }
    for (let e = 0; e < extraNonemptyPerPage; e++) {
      body += `\\pard\\qc Extra crumb ${e} page ${p}\\par\n`
    }
    body += `\\page\n`
  }
  return `{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0\\fmodern Courier New;}}\n\\f0\\fs20\n${body}}`
}

console.log('plain TXT markers')
{
  const plain = [
    `${' '.repeat(55)}1`,
    ' 1  Q. Hello?',
    ' 2  A. Hi.',
    `${' '.repeat(55)}2`,
    ' 1  Q. Next?',
    ' 2  A. Yes.',
  ].join('\n')
  assert(countPages(plain) === 2, `marker count (got ${countPages(plain)})`)
}

console.log('plain TXT numbered-line fallback (25 lines/page)')
{
  const lines = []
  for (let p = 1; p <= 4; p++) {
    for (let ln = 1; ln <= 25; ln++) {
      lines.push(`${String(ln).padStart(2, ' ')}  Q. Text page ${p}`)
    }
  }
  assert(countPages(lines.join('\n')) === 4, `4 pages via numbered lines (got ${countPages(lines.join('\n'))})`)
}

console.log('tab-separated line numbers (common after RTF \\tab)')
{
  const lines = []
  for (let p = 1; p <= 3; p++) {
    for (let ln = 1; ln <= 25; ln++) {
      lines.push(`${ln}\tQ. Tab style page ${p}`)
    }
  }
  assert(countPages(lines.join('\n')) === 3, `3 pages via tab line nums (got ${countPages(lines.join('\n'))})`)
}

console.log('RTF with \\page — must not overcharge (89 → ~240 bug)')
{
  const rtf = buildCatStyleRtf(89, { extraNonemptyPerPage: 42 })
  const prep = prepareTranscriptUpload('deposition.rtf', rtf)
  assert(prep.wasRtf === true, 'detected as RTF')
  assert(
    prep.pages === 89,
    `89-page CAT-style RTF charges 89 tokens (got ${prep.pages})`,
  )
}

console.log('RTF with \\page — smaller sizes')
{
  for (const n of [1, 5, 10, 25, 50]) {
    const prep = prepareTranscriptUpload(`${n}p.rtf`, buildCatStyleRtf(n, { extraNonemptyPerPage: 20 }))
    assert(prep.pages === n, `${n}-page RTF → ${n} (got ${prep.pages})`)
  }
}

console.log('RTF page breaks between pages (no trailing \\page)')
{
  let body = ''
  for (let p = 1; p <= 10; p++) {
    if (p > 1) body += `\\page\n`
    for (let ln = 1; ln <= 25; ln++) {
      body += `\\pard ${ln}\\tab Q. Page ${p} line ${ln}\\par\n`
    }
  }
  const rtf = `{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0 Courier;}}\n\\f0\\fs20\n${body}}`
  const prep = prepareTranscriptUpload('between.rtf', rtf)
  assert(prep.pages === 10, `breaks-between style → 10 (got ${prep.pages})`)
}

console.log('real Wells RTF fixture (known ~9 pages)')
{
  const raw = readFileSync('scripts/.repro/WellsDR042926.rtf', 'utf8')
  const prep = prepareTranscriptUpload('WellsDR042926.rtf', raw)
  assert(prep.pages === 9, `Wells RTF → 9 (got ${prep.pages})`)
}

console.log('known synthetic TXT unchanged')
{
  const syn = readFileSync('scripts/test-transcripts/large_synthetic_50pages.txt', 'utf8')
  const n = countPages(syn)
  assert(n >= 50 && n <= 52, `synthetic 50p stays ~50 (got ${n})`)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
