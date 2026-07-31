/**
 * Offline highlight/jump coverage — no browser, no Gemini.
 *
 * Simulates the editor locate → paint → jump-line pipeline against
 * extracted JSON fixtures (same shape as case-files *_extracted.json).
 *
 * Usage:
 *   node scripts/test-highlight-jump-coverage.mjs [path/to/extracted.json ...]
 *   npm run test:highlight-jump
 *
 * Exit 1 if any fixture has locate misses or wrong-span paints.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildCleanContentMap,
  locateAnnotationWithAnchor,
  locateAtAnchorStrict,
  jumpSearchNeedles,
  ensureAnnotationAnchors,
  sanitizeAnnotationsLeakedLineNumbers,
  toCleanContentNeedle,
  compactSpanText,
  buildUniqueContextAnchor,
  isAnchorPhraseUnique,
  buildContextAnchor,
} from '../src/lib/gemini.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function normalize(s) {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function scoreFixture(filePath, { forceOpen = false } = {}) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const entries = data.entries || []
  let annotations = Array.isArray(data.annotations) ? data.annotations : []
  if (forceOpen) {
    annotations = annotations.map((a) => ({ ...a, status: 'open' }))
  }
  annotations = sanitizeAnnotationsLeakedLineNumbers(entries, annotations)

  const originalText = data.originalText
  if (!originalText) {
    return { filePath, error: 'missing originalText', total: annotations.length }
  }

  const { cleanContent, parsedLines } = buildCleanContentMap(originalText)
  annotations = ensureAnnotationAnchors(entries, annotations, cleanContent)
  const highlights = []
  const jumpLines = {}
  const misses = []
  const wrongSpans = []

  for (const ann of annotations) {
    if (!['open', 'accepted', 'ignored'].includes(ann.status)) continue
    const entry = entries.find((e) => e.id === (ann._appliedEntryId ?? ann.entry_id))
    let located = null
    let usedNeedle = null
    for (const needle of jumpSearchNeedles(ann)) {
      located = locateAnnotationWithAnchor(cleanContent, entry, ann, needle)
      if (located) {
        usedNeedle = needle
        break
      }
    }
    if (!located) {
      misses.push({
        id: ann.id,
        severity: ann.severity,
        status: ann.status,
        type: ann.type,
        original: ann.original,
      })
      continue
    }

    const paintedText = compactSpanText(
      cleanContent.substring(located.cleanStart, located.cleanEnd)
    )
    const stripSic = (s) => String(s).replace(/\s*\[sic\]\s*$/i, '').trim()
    // Raw needle vs gutter-cleaned needle. Locate may succeed via internal
    // clean while usedNeedle is still the polluted original — both OK.
    const expectRaw = compactSpanText(stripSic(usedNeedle))
    const expectClean = compactSpanText(stripSic(toCleanContentNeedle(usedNeedle)))
    const paintedNorm = normalize(paintedText)
    const matches = (expect) => {
      const e = normalize(expect)
      if (!e) return false
      if (paintedNorm === e || paintedNorm.includes(e)) return true
      const words = e.split(' ').filter(Boolean)
      let from = 0
      return words.every((w) => {
        const at = paintedNorm.indexOf(w, from)
        if (at === -1) return false
        from = at + w.length
        return true
      })
    }
    if (!matches(expectRaw) && !matches(expectClean)) {
      wrongSpans.push({
        id: ann.id,
        severity: ann.severity,
        expected: expectRaw,
        painted: paintedText.slice(0, 80),
      })
    }

    const lineIdx = parsedLines.findIndex(
      (pl) => pl.cleanStart <= located.cleanStart && located.cleanStart < pl.cleanEnd
    )
    if (lineIdx >= 0) jumpLines[ann.id] = lineIdx
    highlights.push({
      id: ann.id,
      severity: ann.severity,
      cleanStart: located.cleanStart,
      cleanEnd: located.cleanEnd,
    })
  }

  highlights.sort((a, b) => a.cleanStart - b.cleanStart)
  let painted = 0
  let overlapSkip = 0
  let lastEnd = 0
  const overlapIds = []
  for (const h of highlights) {
    if (h.cleanStart < lastEnd) {
      overlapSkip++
      overlapIds.push(h.id)
      continue
    }
    painted++
    lastEnd = h.cleanEnd
  }

  const total = annotations.filter((a) =>
    ['open', 'accepted', 'ignored'].includes(a.status)
  ).length
  const located = total - misses.length
  const jumpable = Object.keys(jumpLines).length

  return {
    filePath: path.basename(filePath),
    forceOpen,
    total,
    located,
    miss: misses.length,
    painted,
    overlapSkip,
    jumpable,
    wrongSpans: wrongSpans.length,
    misses,
    wrongSpanSamples: wrongSpans.slice(0, 5),
    overlapIds,
    // Unplaceable misses (phrase not in cleanContent / wrong-twin rejected)
    // are expected residual — fail only on wrong-span paints.
    ok: wrongSpans.length === 0 && jumpable === located,
  }
}

// --- Offline unit: repeated "Blvd" twins (no Gemini) ---
{
  let failedTwin = 0
  const assert = (cond, name) => {
    if (cond) console.log('PASS', name)
    else {
      console.log('FAIL', name)
      failedTwin++
    }
  }
  const hay = [
    'How often did you use Kingsley Blvd, ref 1055?',
    'How often did you use Kingsley Blvd, ref 1111?',
    'How often did you use Kingsley Blvd, ref 1200?',
  ].join('\n\n')
  const needle = 'Blvd'
  const start = hay.indexOf('Blvd, ref 1111')
  const short = buildContextAnchor(hay, start, start + needle.length, 2)
  assert(short != null, 'short anchor builds')
  assert(
    !isAnchorPhraseUnique(hay, short.before, needle, short.after),
    '2-word anchor is ambiguous across twin Blvd lines',
  )
  const unique = buildUniqueContextAnchor(hay, start, start + needle.length, {
    needle,
    uniqueIn: hay,
  })
  assert(unique != null, 'unique anchor builds')
  assert(
    isAnchorPhraseUnique(hay, unique.before, needle, unique.after),
    'grown anchor is unique (includes ref 1111)',
  )
  assert(
    String(unique.after).includes('1111'),
    'unique after-context includes the distinguishing ref number',
  )
  const ann = {
    original: 'Blvd',
    suggestion: 'Blvd.',
    status: 'open',
    _anchorBefore: unique.before,
    _anchorAfter: unique.after,
  }
  const hit = locateAtAnchorStrict(hay, ann, 'Blvd')
  assert(hit != null, 'strict locate finds the 1111 twin')
  assert(
    hay.substring(hit.cleanStart, hit.cleanEnd + 20).includes('1111'),
    'strict locate landed on ref 1111 line',
  )
  if (failedTwin) {
    console.error(`\n${failedTwin} twin-anchor unit failure(s)`)
    process.exit(1)
  }
  console.log('\nTwin-anchor units OK')
}

const defaultFixture = path.join(__dirname, '.repro/alison-islam-extracted.json')
const args = process.argv.slice(2)
const files = (args.length ? args : [defaultFixture]).filter((f) => fs.existsSync(f))

if (files.length === 0) {
  console.log('No highlight fixtures found (twin units already ran).')
  process.exit(0)
}

let failed = 0
for (const f of files) {
  for (const forceOpen of [false, true]) {
    const r = scoreFixture(f, { forceOpen })
    const tag = forceOpen ? 'open' : 'saved'
    console.log(
      `\n${r.filePath} [${tag}] total=${r.total} located=${r.located} painted=${r.painted} jumpable=${r.jumpable} miss=${r.miss} overlap=${r.overlapSkip} wrongSpan=${r.wrongSpans} ${r.ok ? 'OK' : 'FAIL'}`
    )
    if (r.misses?.length) console.log('  misses:', JSON.stringify(r.misses.slice(0, 5)))
    if (r.wrongSpanSamples?.length) {
      console.log('  wrongSpans:', JSON.stringify(r.wrongSpanSamples))
    }
    if (!r.ok) failed++
  }
}

console.log(`\n=== Coverage: ${files.length} file(s), ${failed} failing mode(s) ===`)
process.exit(failed ? 1 : 0)
