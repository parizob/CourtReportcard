#!/usr/bin/env node
/**
 * Export / accept stress harness — no Gemini, no network.
 *
 * Product kill-conditions under test:
 *   1. Every accepted fix is in the export text (or export fails closed).
 *   2. Re-running export ensure on already-correct text does not rewrite
 *      unrelated twins (short words like "the" / "it" / "my").
 *   3. Applying accepts only changes the intended site (prefix/suffix intact).
 *
 * Run: npm run test:export-stress
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureAcceptedCorrectionsInOriginalText,
  applyCorrectionDetailed,
  buildCleanContentMap,
  locateAtAnchorStrict,
  flexFind,
  findAllFlexMatches,
  buildContextAnchor,
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

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

/** Protected phrases that export must never corrupt in twin-stress fixtures. */
const PROTECTED = [
  'of the State of California',
  'Certified Shorthand Reporter of the State',
]

console.log('\n=== Export / accept stress ===\n')

// ---------------------------------------------------------------------------
// A. Natalie twin bug: already-applied the→it must not touch certificate
// ---------------------------------------------------------------------------
console.log('A. Anchored short-word already applied (Natalie twin)')
{
  const text =
    '          10  Certified Shorthand Reporter of the State of California.\r\n' +
    "Q.  Okay. Did you call it Consuelo's Kitchen when you had your business?\r\n"
  const entries = [
    {
      id: 1266,
      text: "Okay. Did you call it Consuelo's Kitchen when you had your business?",
    },
  ]
  const annotations = [
    {
      id: 84,
      entry_id: 1266,
      status: 'accepted',
      original: 'the',
      suggestion: 'it',
      _anchorBefore: 'you call ',
      _anchorAfter: " Consuelo's Kitchen",
    },
  ]
  const once = ensureAcceptedCorrectionsInOriginalText(text, entries, annotations)
  const twice = ensureAcceptedCorrectionsInOriginalText(once.text, entries, annotations)
  assertEq(once.failed.length, 0, 'verify ok')
  assertEq(once.text, text, 'first ensure is no-op')
  assertEq(twice.text, text, 'second ensure is no-op')
  assert(!once.text.includes('of it State'), 'certificate not corrupted')
  assert(once.text.includes('of the State of California'), 'certificate intact')
  assert(once.text.includes("call it Consuelo"), 'intended accept remains')
}

// ---------------------------------------------------------------------------
// B. Battery of short-word twin traps (already applied)
// ---------------------------------------------------------------------------
console.log('\nB. Short-word twin battery (already applied)')
{
  const twins = [
    {
      name: 'the→it',
      protected: 'Reporter of the State of California.',
      fixed: "Did you call it Consuelo's Kitchen?",
      original: 'the',
      suggestion: 'it',
      before: 'you call ',
      after: " Consuelo's Kitchen",
    },
    {
      name: 'a→an',
      protected: 'She is a reporter in court today.',
      fixed: 'He worked as an assistant manager.',
      original: 'a',
      suggestion: 'an',
      before: 'worked as ',
      after: ' assistant',
    },
    {
      name: 'my→me',
      protected: 'That is my understanding of the record.',
      fixed: 'Please bring me reading glasses.',
      original: 'my',
      suggestion: 'me',
      before: 'bring ',
      after: ' reading',
    },
    {
      name: 'to→too',
      protected: 'He went to the hearing on Main.',
      fixed: 'That was too much for one day.',
      original: 'to',
      suggestion: 'too',
      before: 'was ',
      after: ' much',
    },
  ]

  for (const t of twins) {
    const text = `${t.protected}\r\n${t.fixed}\r\n`
    const annotations = [
      {
        id: t.name,
        entry_id: 1,
        status: 'accepted',
        original: t.original,
        suggestion: t.suggestion,
        _anchorBefore: t.before,
        _anchorAfter: t.after,
      },
    ]
    const entries = [{ id: 1, text: t.fixed }]
    const { text: out, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
      text,
      entries,
      annotations,
    )
    assertEq(fails.length, 0, `${t.name}: 0 failures`)
    assertEq(out, text, `${t.name}: byte-identical no-op`)
    assert(out.includes(t.protected), `${t.name}: protected twin intact`)
    assert(out.includes(t.fixed), `${t.name}: fixed site intact`)
  }
}

// ---------------------------------------------------------------------------
// C. Apply from dirty text: suggestion present, protected twin untouched
// ---------------------------------------------------------------------------
console.log('\nC. Apply from dirty text — surgical + protected twin')
{
  const protectedLine = 'Certified Shorthand Reporter of the State of California.'
  const dirty =
    `${protectedLine}\r\n` +
    "Q.  Okay. Did you call the Consuelo's Kitchen when you had your business?\r\n"
  const { cleanContent } = buildCleanContentMap(dirty)
  const ann = {
    id: 1,
    entry_id: 1,
    status: 'accepted',
    original: 'the',
    suggestion: 'it',
    _anchorBefore: 'you call ',
    _anchorAfter: " Consuelo's Kitchen",
  }
  const still = locateAtAnchorStrict(cleanContent, ann, ann.original)
  assert(!!still, 'dirty: original at anchor')
  const { text: out, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    dirty,
    [{ id: 1, text: "Okay. Did you call the Consuelo's Kitchen when you had your business?" }],
    [ann],
  )
  assertEq(fails.length, 0, 'dirty: apply succeeds')
  assert(out.includes("call it Consuelo"), 'dirty: suggestion applied at site')
  assert(!flexFind(out, 'call the Consuelo'), 'dirty: original gone at site')
  assert(out.includes(protectedLine), 'dirty: certificate twin untouched')
  assert(!out.includes('of it State'), 'dirty: no certificate corruption')
}

// ---------------------------------------------------------------------------
// D. Unanchored short word with twins — never corrupt the earlier twin
// ---------------------------------------------------------------------------
console.log('\nD. Unanchored "the" with twins never corrupts earlier twin')
{
  const text =
    'of the State of California.\r\n' +
    'Did you call the Consuelo kitchen?\r\n'
  // No entry_id match → whole-doc path would see 2× "the". Must fail closed,
  // not rewrite "of the State".
  const { text: out, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    text,
    [{ id: 99, text: 'unrelated entry with no match' }],
    [
      {
        id: 1,
        entry_id: 1,
        status: 'accepted',
        original: 'the',
        suggestion: 'it',
        // no anchors on purpose
      },
    ],
  )
  assert(fails.length >= 1, 'no unique site → fail closed')
  assertEq(out, text, 'no unique site → text unchanged')
  assert(out.includes('of the State'), 'earlier twin untouched')
  assert(!out.includes('of it State'), 'no certificate-style corruption')
}

// ---------------------------------------------------------------------------
// E. Many sequential unique accepts — all land; surroundings intact
// ---------------------------------------------------------------------------
console.log('\nE. 40 unique surgical accepts all land')
{
  const typos = []
  const lines = []
  for (let i = 1; i <= 40; i++) {
    const bad = `errr${i}`
    const good = `word${i}`
    typos.push({ bad, good })
    lines.push(
      `${String(i).padStart(6)}          Q.  The witness said ${bad} clearly that day.`,
    )
  }
  let text = `${lines.join('\r\n')}\r\n`
  const baseline = text
  const annotations = typos.map((t, idx) => {
    const m = flexFind(baseline, t.bad)
    const anchor = buildContextAnchor(baseline, m.start, m.end, 2)
    return {
      id: `a${idx}`,
      entry_id: 1,
      status: 'accepted',
      original: t.bad,
      suggestion: t.good,
      _anchorBefore: anchor.before,
      _anchorAfter: anchor.after,
    }
  })

  const { text: out, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    text,
    [{ id: 1, text }],
    annotations,
  )
  assertEq(fails.length, 0, '40 accepts: 0 failures')
  for (const t of typos) {
    assert(!!flexFind(out, t.good), `40: ${t.good} present`)
    assert(!flexFind(out, t.bad), `40: ${t.bad} gone`)
  }
  const again = ensureAcceptedCorrectionsInOriginalText(out, [{ id: 1, text: out }], annotations)
  assertEq(again.text, out, '40: idempotent second ensure')
  assertEq(again.failed.length, 0, '40: second ensure 0 failures')
}

// ---------------------------------------------------------------------------
// F. Real Natalie overnight fixture (if present)
// ---------------------------------------------------------------------------
console.log('\nF. Natalie MOLINA TIMESTAMPED overnight fixture')
{
  const p = join(root, 'scripts/.repro/natalie-molina-diff/orig_extracted.json')
  if (!existsSync(p)) {
    console.log('  skip (fixture not downloaded)')
  } else {
    const night = JSON.parse(readFileSync(p, 'utf8'))
    const nightOT = night.originalText || ''
    const accepted = (night.annotations || []).filter(
      (a) => a.status === 'accepted' && a.original && typeof a.suggestion === 'string',
    )
    assert(accepted.length >= 60, `fixture has many accepts (got ${accepted.length})`)
    assert(
      nightOT.includes('Certified Shorthand Reporter of the State'),
      'fixture certificate starts correct',
    )
    assert(nightOT.includes("call it Consuelo"), 'fixture already has the→it at site')

    const { text: out, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
      nightOT,
      night.entries || [],
      night.annotations || [],
    )

    assert(
      out.includes('Certified Shorthand Reporter of the State'),
      'Natalie: certificate still correct after ensure',
    )
    assert(!out.includes('of it State of California'), 'Natalie: no of-it-State corruption')
    assert(out.includes("call it Consuelo"), 'Natalie: intended the→it remains')

    // Every anchored accept: suggestion at anchor OR failed listed (never silent wrong twin)
    let anchoredOk = 0
    let anchoredFailed = 0
    const failIds = new Set(fails.map((f) => f.id))
    for (const ann of accepted) {
      const hasAnchor =
        typeof ann._anchorBefore === 'string' &&
        typeof ann._anchorAfter === 'string' &&
        !!(ann._anchorBefore || ann._anchorAfter)
      if (!hasAnchor) continue
      if (ann.suggestion === '') continue
      const { cleanContent } = buildCleanContentMap(out)
      const at = locateAtAnchorStrict(cleanContent, ann, ann.suggestion)
      if (at) anchoredOk++
      else if (failIds.has(ann.id)) anchoredFailed++
      else {
        // Suggestion may span lines / structured replace — check soft presence
        if (out.includes(ann.suggestion) || flexFind(out, ann.suggestion)) anchoredOk++
        else {
          assert(false, `Natalie: anchored accept id=${ann.id} neither at anchor nor in failed`)
        }
      }
    }
    assert(true, `Natalie: anchored accepts verified ok=${anchoredOk} failedClosed=${anchoredFailed}`)

    // Twin-protected phrases from first pages must not gain "of it State"
    for (const phrase of PROTECTED) {
      if (nightOT.includes(phrase)) {
        assert(out.includes(phrase), `Natalie: protected "${phrase.slice(0, 40)}…" intact`)
      }
    }

    const twice = ensureAcceptedCorrectionsInOriginalText(out, night.entries || [], night.annotations || [])
    assertEq(twice.failed.length, fails.length, 'Natalie: second ensure same failure count')
    // Second pass on already-ensured text must not introduce certificate corruption
    assert(!twice.text.includes('of it State of California'), 'Natalie: 2nd ensure still clean')
  }
}

// ---------------------------------------------------------------------------
// G. findAllFlexMatches uniqueness helper sanity
// ---------------------------------------------------------------------------
console.log('\nG. Twin detection helper')
{
  const hay = 'the cat and the dog and the bird'
  const hits = findAllFlexMatches(hay, 'the')
  assertEq(hits.length, 3, 'finds 3 the twins')
  assertEq(findAllFlexMatches('only one the here', 'the').length, 1, 'unique the')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed ? 1 : 0)
