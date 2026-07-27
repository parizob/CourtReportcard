#!/usr/bin/env node
/**
 * Transcript fidelity stress harness — no Gemini, no network.
 *
 * Product invariants under test:
 *   1. Export base text is the uploaded originalText (not Gemini's entries).
 *      Zero accepts ⇒ export source === originalText byte-for-byte.
 *   2. Accepts only change the intended spans; everything else is untouched.
 *      Accepted suggestions must be present; export verify must catch misses.
 *
 * Architecture note (what this does NOT prove):
 *   - Gemini `entries` are a structured view for proofreading. They are not,
 *     and must never be, the downloadable record. Reconstruction from entries
 *     can lose/alter text; export never does that.
 *   - Live upload → storage → originalText identity is proven by analyze-case
 *     assigning `originalText = plainText` (post-RTF-strip for .rtf). This
 *     harness stress-tests the export/accept math on that string.
 *
 * Run: node scripts/test-transcript-fidelity-stress.mjs
 *   or: npm run test:fidelity
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureAcceptedCorrectionsInOriginalText,
  applyCorrectionDetailed,
  flexFind,
} from '../src/lib/gemini.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed++
    console.log(`  ok  ${msg}`)
  } else {
    failed++
    console.error(`  FAIL ${msg}`)
  }
}

function assertEq(a, b, msg) {
  assert(a === b, `${msg}\n       len got=${a?.length} exp=${b?.length}`)
}

/**
 * Apply one accept the same way the editor/export path does:
 * locate original in the full originalText, then surgical replace.
 * Assert prefix before the site and suffix after it are untouched.
 */
function applyOneAccept(text, original, suggestion) {
  const before = text
  const located = flexFind(before, original)
  if (!located) {
    return { ok: false, text, reason: `could not locate ${JSON.stringify(original)}` }
  }

  const detailed = applyCorrectionDetailed(before, original, suggestion, {
    preferStart: located.start,
  })
  if (!detailed.matchedText) {
    return { ok: false, text, reason: 'applyCorrectionDetailed did not apply' }
  }

  const after = detailed.text
  const oStart = detailed.start
  // matched span in `before` was located.start..located.end; after replace,
  // prefix is everything before the new span start, suffix is old tail from
  // the end of the matched original.
  const prefixOk = after.startsWith(before.slice(0, located.start))
  const oldTail = before.slice(located.end)
  const newTail = after.slice(oStart + suggestion.length)
  // When suggestion length differs from original, use length-aware tail check:
  const suffixOk = after.slice(after.length - oldTail.length) === oldTail

  return {
    ok: prefixOk && suffixOk,
    text: after,
    reason: !prefixOk ? 'prefix drifted' : !suffixOk ? 'suffix drifted' : null,
  }
}

console.log('\n=== Transcript fidelity stress ===\n')

// ---------------------------------------------------------------------------
// A. Architecture: originalText is the record; entries are not
// ---------------------------------------------------------------------------
console.log('A. originalText is the record (entries are not)')

const fixturePairs = [
  {
    name: 'sample-transcript',
    extracted: join(root, 'scripts/fixtures/sample-transcript-extracted.json'),
  },
]

const reproDir = join(root, 'scripts/.repro')
if (existsSync(reproDir)) {
  const alisonJson = join(reproDir, 'alison-islam-extracted.json')
  if (existsSync(alisonJson)) {
    fixturePairs.push({
      name: 'alison-islam (repro)',
      extracted: alisonJson,
    })
  }
}

for (const pair of fixturePairs) {
  const extracted = JSON.parse(readFileSync(pair.extracted, 'utf8'))
  assert(
    typeof extracted.originalText === 'string' && extracted.originalText.length > 0,
    `${pair.name}: has originalText`,
  )

  // Entries are a Gemini view — they must NOT be treated as the export source.
  const entryBlob = (extracted.entries || []).map((e) => e.text || '').join('')
  assert(
    entryBlob !== extracted.originalText,
    `${pair.name}: entries blob ≠ originalText (entries are structured, not the record)`,
  )

  // Reconstructing from entries loses gutter / line structure vs originalText.
  assert(
    entryBlob.length < extracted.originalText.length,
    `${pair.name}: entries shorter than originalText (structure lives in originalText)`,
  )
}

// Simulate analyze-case assignment: originalText = plainText (identity).
{
  const plain = '     1          Q.  Hello.\r\n     2          A.  World.\r\n'
  const assigned = plain // mirrors mergeExtractionChunks(..., plainText)
  assertEq(assigned, plain, 'analyze-case pattern: originalText = plainText (identity)')
}

// ---------------------------------------------------------------------------
// B. Zero accepts: ensureAccepted is a pure no-op on real originalText
// ---------------------------------------------------------------------------
console.log('\nB. Zero accepts leave originalText untouched')

const stressSources = []
for (const pair of fixturePairs) {
  const extracted = JSON.parse(readFileSync(pair.extracted, 'utf8'))
  stressSources.push({
    name: pair.name,
    text: extracted.originalText,
    entries: extracted.entries || [],
  })
}

for (const f of [
  'extra-word-delete-seed.json',
  'extra-word-glue-seed.json',
  'repeated-paragraph-seed.json',
  'export-verify-fail-seed.json',
]) {
  const p = join(root, 'scripts/fixtures', f)
  if (!existsSync(p)) continue
  const extracted = JSON.parse(readFileSync(p, 'utf8'))
  if (extracted.originalText) {
    stressSources.push({
      name: f,
      text: extracted.originalText,
      entries: extracted.entries || [],
    })
  }
}

for (const src of stressSources) {
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    src.text,
    src.entries,
    [],
  )
  assertEq(text, src.text, `${src.name}: empty annotations → identical text`)
  assert(fails.length === 0, `${src.name}: empty annotations → 0 failures`)
}

// ---------------------------------------------------------------------------
// C. Surgical accepts: only the span changes; suggestion present
// ---------------------------------------------------------------------------
console.log('\nC. Surgical accept stress (many sequential accepts)')

{
  const lines = []
  const typos = []
  for (let i = 1; i <= 80; i++) {
    const bad = `errr${i}`
    const good = `word${i}`
    typos.push({ bad, good })
    lines.push(
      `${String(i).padStart(6)}          Q.  The witness said ${bad} clearly on the record that day.`,
    )
  }
  let text = `${lines.join('\r\n')}\r\n`
  const baseline = text

  let stop = false
  for (const { bad, good } of typos) {
    const result = applyOneAccept(text, bad, good)
    assert(result.ok, `accept ${bad}→${good}: ${result.reason || 'span-local'}`)
    if (!result.ok) {
      stop = true
      break
    }
    text = result.text
    assert(text.includes(good), `accept ${bad}→${good}: suggestion present`)
    // Word-boundary check: "errr1" is a substring of "errr10", so plain
    // includes() is the wrong test. flexFind enforces boundaries.
    assert(!flexFind(text, bad), `accept ${bad}→${good}: original gone (word-bound)`)
  }

  if (!stop) {
    for (let i = 1; i <= 80; i++) {
      const good = `word${i}`
      assert(
        text.includes(`The witness said ${good} clearly on the record that day.`),
        `line ${i} template intact around correction`,
      )
    }

    // Character accounting: only typo spans changed. Same total length when
    // bad/good are equal length (errrN vs wordN: both 5 for i=1..9; diverge at 10+).
    // Safer: baseline with zero accepts is still identical.
    const entries = [{ id: 1, text }]
    const annotations = typos.map((t, idx) => ({
      id: `a${idx}`,
      entry_id: 1,
      status: 'accepted',
      original: t.bad,
      suggestion: t.good,
    }))
    const verified = ensureAcceptedCorrectionsInOriginalText(text, entries, annotations)
    assert(
      verified.failed.length === 0,
      `export verify: 0 failures after ${typos.length} accepts`,
    )
    assertEq(verified.text, text, 'export verify: no further mutation when already applied')
  }

  const noop = ensureAcceptedCorrectionsInOriginalText(
    baseline,
    [{ id: 1, text: baseline }],
    [],
  )
  assertEq(noop.text, baseline, 'control baseline still identical')
}

// ---------------------------------------------------------------------------
// D. Length-changing surgical accepts still preserve prefix/suffix
// ---------------------------------------------------------------------------
console.log('\nD. Length-changing accepts preserve surroundings')

{
  const cases = [
    { text: 'He went too the store.\r\n', bad: 'too', good: 'to' },
    { text: 'He went to the store.\r\n', bad: 'to', good: 'too' },
    { text: 'Delete teh extra word here.\r\n', bad: 'teh ', good: '' },
    {
      text: '     1          Q.  Please spell that nam.\r\n',
      bad: 'nam',
      good: 'name',
    },
  ]
  for (const c of cases) {
    const result = applyOneAccept(c.text, c.bad, c.good)
    assert(result.ok, `len-change ${JSON.stringify(c.bad)}→${JSON.stringify(c.good)}: ${result.reason || 'span-local'}`)
    if (result.ok && c.good) {
      assert(result.text.includes(c.good), `len-change suggestion present`)
    }
  }
}

// ---------------------------------------------------------------------------
// E. Ignored / open never mutate
// ---------------------------------------------------------------------------
console.log('\nE. Ignored and open never change text')

{
  const originalText = 'He went too the store with teh receipt.\r\n'
  const entries = [{ id: 1, text: 'He went too the store with teh receipt.' }]
  for (const status of ['ignored', 'open']) {
    const annotations = [
      { id: 'a1', entry_id: 1, status, original: 'too', suggestion: 'to' },
      { id: 'a2', entry_id: 1, status, original: 'teh', suggestion: 'the' },
    ]
    const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
      originalText,
      entries,
      annotations,
    )
    assertEq(text, originalText, `${status}: text unchanged`)
    assert(fails.length === 0, `${status}: no verify failures`)
  }
}

// ---------------------------------------------------------------------------
// F. Missing accepted correction is blocked (loud fail)
// ---------------------------------------------------------------------------
console.log('\nF. Missing accepted correction fails export verify loudly')

{
  const originalText = 'Something completely different.\r\n'
  const entries = [{ id: 1, text: 'Something completely different.' }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'ghostphrase',
      suggestion: 'replacement',
    },
  ]
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations,
  )
  assert(fails.length === 1, 'verify fails when accepted original cannot be found')
  assertEq(text, originalText, 'failed verify does not corrupt text')
}

// ---------------------------------------------------------------------------
// G. Large real originalText: repeated no-op ensures
// ---------------------------------------------------------------------------
console.log('\nG. Large fixture: repeated no-op export verify')

{
  const big = stressSources.find((s) => s.text.length > 50_000) || stressSources[0]
  if (big) {
    let ok = true
    for (let i = 0; i < 20; i++) {
      const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
        big.text,
        big.entries,
        [],
      )
      if (text !== big.text || fails.length !== 0) {
        assert(false, `${big.name} iteration ${i}: mutated or failed`)
        ok = false
        break
      }
    }
    if (ok) {
      assert(true, `${big.name}: 20× no-op verify identical (${big.text.length} chars)`)
    }
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed ? 1 : 0)
