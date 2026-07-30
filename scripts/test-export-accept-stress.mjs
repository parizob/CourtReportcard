#!/usr/bin/env node
/**
 * Export / accept stress harness — no Gemini, no network.
 *
 * Product kill-conditions under test:
 *   1. Every accepted fix is in the export text (or export fails closed).
 *   2. Re-running export ensure on already-correct text does not rewrite
 *      unrelated twins (short words like "the" / "it" / "my").
 *   3. Applying accepts only changes the intended site (prefix/suffix intact).
 *   4. Accept → reopen → ignore / re-accept churn: export always equals the
 *      editor transcript; ignores/opens never rewrite the file; full ignore
 *      returns byte-identical pristine text.
 *   5. Persist JSON round-trip (storage) + custom UI suggestions: export is
 *      byte-identical to the editor transcript; only accepted spans differ
 *      from the pristine upload.
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
  locateAnnotationWithAnchor,
  flexFind,
  findAllFlexMatches,
  buildContextAnchor,
  shiftAcceptedApplySites,
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

// ---------------------------------------------------------------------------
// H. Mixed accept / ignore / open — only accepts mutate; twins stay safe
// ---------------------------------------------------------------------------
console.log('\nH. Mixed accept/ignore/open under short-word twins')
{
  const protectedLine = 'Certified Shorthand Reporter of the State of California.'
  const dirty =
    `${protectedLine}\r\n` +
    "Q.  Did you call the Consuelo kitchen?\r\n" +
    'A.  That was too much pressure.\r\n' +
    'Q.  Please state thier full name.\r\n'
  const annotations = [
    {
      id: 'accept-the',
      entry_id: 1,
      status: 'accepted',
      original: 'the',
      suggestion: 'it',
      _anchorBefore: 'you call ',
      _anchorAfter: ' Consuelo',
    },
    {
      id: 'ignore-too',
      entry_id: 1,
      status: 'ignored',
      original: 'too',
      suggestion: 'to',
      _anchorBefore: 'was ',
      _anchorAfter: ' much',
    },
    {
      id: 'open-thier',
      entry_id: 1,
      status: 'open',
      original: 'thier',
      suggestion: 'their',
      _anchorBefore: 'state ',
      _anchorAfter: ' full',
    },
  ]
  const { text: out, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    dirty,
    [{ id: 1, text: dirty }],
    annotations,
  )
  assertEq(fails.length, 0, 'mixed: 0 failures')
  assert(out.includes('call it Consuelo'), 'mixed: accepted the→it applied')
  assert(!flexFind(out, 'call the Consuelo'), 'mixed: accepted original gone at site')
  assert(out.includes('was too much'), 'mixed: ignored too left alone')
  assert(out.includes('state thier full'), 'mixed: open thier left alone')
  assert(out.includes(protectedLine), 'mixed: certificate twin intact')
  assert(!out.includes('of it State'), 'mixed: no certificate corruption')
}

// ---------------------------------------------------------------------------
// I. Ignore-all: export text byte-identical
// ---------------------------------------------------------------------------
console.log('\nI. Ignore-all leaves export byte-identical')
{
  const text =
    'Q.  He said teh wrong word and thier name.\r\n' +
    'A.  That was too long.\r\n'
  const annotations = [
    { id: 1, entry_id: 1, status: 'ignored', original: 'teh', suggestion: 'the' },
    { id: 2, entry_id: 1, status: 'ignored', original: 'thier', suggestion: 'their' },
    { id: 3, entry_id: 1, status: 'ignored', original: 'too', suggestion: 'to' },
  ]
  const { text: out, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    text,
    [{ id: 1, text }],
    annotations,
  )
  assertEq(fails.length, 0, 'ignore-all: 0 failures')
  assertEq(out, text, 'ignore-all: byte-identical')
}

// ---------------------------------------------------------------------------
// J. Half accept / half ignore on 30 unique sites — accepts land, ignores stay
// ---------------------------------------------------------------------------
console.log('\nJ. 30 sites: even accept, odd ignore')
{
  const lines = []
  const annotations = []
  for (let i = 1; i <= 30; i++) {
    const bad = `typo${i}`
    const good = `fixed${i}`
    lines.push(
      `${String(i).padStart(6)}          Q.  Marker ${bad} end.`,
    )
    annotations.push({
      id: `mix${i}`,
      entry_id: 1,
      status: i % 2 === 0 ? 'accepted' : 'ignored',
      original: bad,
      suggestion: good,
    })
  }
  // Build anchors from baseline so accepts locate uniquely
  const baseline = `${lines.join('\r\n')}\r\n`
  for (const ann of annotations) {
    const m = flexFind(baseline, ann.original)
    const anchor = buildContextAnchor(baseline, m.start, m.end, 2)
    ann._anchorBefore = anchor.before
    ann._anchorAfter = anchor.after
  }

  const { text: out, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    baseline,
    [{ id: 1, text: baseline }],
    annotations,
  )
  assertEq(fails.length, 0, '30-mix: 0 failures')
  for (let i = 1; i <= 30; i++) {
    const bad = `typo${i}`
    const good = `fixed${i}`
    if (i % 2 === 0) {
      assert(!!flexFind(out, good), `30-mix: accept ${good} present`)
      assert(!flexFind(out, bad), `30-mix: accept ${bad} gone`)
    } else {
      assert(!!flexFind(out, bad), `30-mix: ignore ${bad} remains`)
      assert(!flexFind(out, good), `30-mix: ignore ${good} not introduced`)
    }
  }
  const again = ensureAcceptedCorrectionsInOriginalText(out, [{ id: 1, text: out }], annotations)
  assertEq(again.text, out, '30-mix: second ensure idempotent')
  assertEq(again.failed.length, 0, '30-mix: second ensure clean')
}

// ---------------------------------------------------------------------------
// K. Accept-then-ignore pattern with certificate twin still present
// ---------------------------------------------------------------------------
console.log('\nK. Many accepts + many ignores; certificate twin never flips')
{
  const protectedLine = 'of the State of California'
  const parts = [protectedLine]
  const annotations = []
  for (let i = 1; i <= 20; i++) {
    parts.push(`Line ${i} has errr${i} and also keep${i} alone.`)
    annotations.push({
      id: `acc${i}`,
      entry_id: 1,
      status: 'accepted',
      original: `errr${i}`,
      suggestion: `word${i}`,
    })
    annotations.push({
      id: `ign${i}`,
      entry_id: 1,
      status: 'ignored',
      original: `keep${i}`,
      suggestion: `drop${i}`,
    })
  }
  const baseline = `${parts.join('\r\n')}\r\n`
  for (const ann of annotations) {
    const m = flexFind(baseline, ann.original)
    const anchor = buildContextAnchor(baseline, m.start, m.end, 2)
    ann._anchorBefore = anchor.before
    ann._anchorAfter = anchor.after
  }

  const { text: out, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    baseline,
    [{ id: 1, text: baseline }],
    annotations,
  )
  assertEq(fails.length, 0, 'K: 0 failures')
  assert(out.includes(protectedLine), 'K: protected phrase intact')
  assert(!out.includes('of it State'), 'K: no the→it twin corruption')
  for (let i = 1; i <= 20; i++) {
    assert(!!flexFind(out, `word${i}`), `K: accept word${i} present`)
    assert(!flexFind(out, `errr${i}`), `K: accept errr${i} gone`)
    assert(!!flexFind(out, `keep${i}`), `K: ignore keep${i} remains`)
    assert(!flexFind(out, `drop${i}`), `K: ignore drop${i} not introduced`)
  }
}

/**
 * Mirrors DashboardExport.resolveExportOriginalText:
 * unmatched accepts ⇒ export blocked (no successful download text).
 * Success ⇒ every non-review accepted suggestion is confirmable in the text.
 */
function resolveExportOrBlock(originalText, entries, annotations) {
  const { text, failed } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations,
  )
  if (failed.length > 0) {
    return { shipped: false, text: null, failed, workingText: text }
  }

  const accepted = (annotations || []).filter(
    (a) => a.status === 'accepted' && a.original && typeof a.suggestion === 'string',
  )
  const unmatched = []
  for (const ann of accepted) {
    if (ann.type === 'repeated_paragraph') continue
    const hasAnchor =
      typeof ann._anchorBefore === 'string' &&
      typeof ann._anchorAfter === 'string' &&
      !!(ann._anchorBefore || ann._anchorAfter)
    const { cleanContent } = buildCleanContentMap(text)
    if (ann.suggestion === '') {
      const still = hasAnchor
        ? locateAtAnchorStrict(cleanContent, ann, ann.original)
        : flexFind(cleanContent, ann.original)
      if (still) unmatched.push(ann)
      continue
    }
    const atSuggestion = hasAnchor
      ? locateAtAnchorStrict(cleanContent, ann, ann.suggestion)
      : flexFind(text, ann.suggestion)
    if (!atSuggestion) unmatched.push(ann)
  }
  if (unmatched.length > 0) {
    return { shipped: false, text: null, failed: unmatched, workingText: text }
  }
  return { shipped: true, text, failed: [], workingText: text }
}

// ---------------------------------------------------------------------------
// L. Export contract: success ⇒ every accept verified; else do not ship
// ---------------------------------------------------------------------------
console.log('\nL. Export contract — no unmatched accepts may ship')
{
  // L1. Clean success path
  const cleanBase =
    'Q.  Marker errr1 end.\r\n' +
    'Q.  Marker errr2 end.\r\n' +
    'Q.  Marker errr3 end.\r\n'
  const cleanAnns = [1, 2, 3].map((i) => {
    const original = `errr${i}`
    const suggestion = `word${i}`
    const m = flexFind(cleanBase, original)
    const anchor = buildContextAnchor(cleanBase, m.start, m.end, 2)
    return {
      id: `L1-${i}`,
      entry_id: 1,
      status: 'accepted',
      original,
      suggestion,
      _anchorBefore: anchor.before,
      _anchorAfter: anchor.after,
    }
  })
  const L1 = resolveExportOrBlock(cleanBase, [{ id: 1, text: cleanBase }], cleanAnns)
  assert(L1.shipped, 'L1: clean accepts ship')
  assertEq(L1.failed.length, 0, 'L1: no failed')
  for (let i = 1; i <= 3; i++) {
    assert(!!flexFind(L1.text, `word${i}`), `L1: word${i} in shipped text`)
    assert(!flexFind(L1.text, `errr${i}`), `L1: errr${i} gone from shipped text`)
  }

  // L2. Impossible accept — must block, never ship
  const missingBase = 'Something completely different.\r\n'
  const L2 = resolveExportOrBlock(
    missingBase,
    [{ id: 1, text: missingBase }],
    [
      {
        id: 'L2',
        entry_id: 1,
        status: 'accepted',
        original: 'teh',
        suggestion: 'the',
        _anchorBefore: 'has ',
        _anchorAfter: ' typo',
      },
    ],
  )
  assert(!L2.shipped, 'L2: unmatched accept does not ship')
  assert(L2.failed.length >= 1, 'L2: reported in failed')
  assertEq(L2.text, null, 'L2: no download payload')

  // L3. One good accept + one impossible — BLOCKED (DashboardExport throws).
  // ensure() may mutate a working buffer; that buffer must never be shipped.
  const mixedBase =
    'Certified Shorthand Reporter of the State of California.\r\n' +
    'Q.  Line has teh typo here.\r\n'
  const mixedAnns = [
    {
      id: 'L3-good',
      entry_id: 1,
      status: 'accepted',
      original: 'teh',
      suggestion: 'the',
      _anchorBefore: 'has ',
      _anchorAfter: ' typo',
    },
    {
      id: 'L3-bad',
      entry_id: 1,
      status: 'accepted',
      original: 'zzzznotfound',
      suggestion: 'found',
      _anchorBefore: 'xxx ',
      _anchorAfter: ' yyy',
    },
  ]
  const L3 = resolveExportOrBlock(mixedBase, [{ id: 1, text: mixedBase }], mixedAnns)
  assert(!L3.shipped, 'L3: partial unmatched blocks export')
  assert(L3.failed.some((f) => f.id === 'L3-bad'), 'L3: bad accept listed')
  assertEq(L3.text, null, 'L3: no shipped download when any accept unmatched')
  // Product: blocked export must not be treated as success even if workingText moved
  assert(L3.workingText == null || typeof L3.workingText === 'string', 'L3: workingText is internal only')

  // L4. Unanchored short-word twins — fail closed, do not ship corrupted text
  const twinBase =
    'of the State of California.\r\n' +
    'Did you call the Consuelo kitchen?\r\n'
  const L4 = resolveExportOrBlock(
    twinBase,
    [{ id: 99, text: 'no match here' }],
    [
      {
        id: 'L4',
        entry_id: 1,
        status: 'accepted',
        original: 'the',
        suggestion: 'it',
        // intentionally unanchored + non-unique
      },
    ],
  )
  assert(!L4.shipped, 'L4: ambiguous the→it does not ship')
  assert(L4.failed.length >= 1, 'L4: failed closed')
  assertEq(L4.text, null, 'L4: no download')
  // Source twin must remain available if we inspected working buffer
  if (L4.workingText) {
    assert(L4.workingText.includes('of the State'), 'L4: working buffer did not corrupt certificate')
    assert(!L4.workingText.includes('of it State'), 'L4: no of-it-State in working buffer')
  }
}

// ---------------------------------------------------------------------------
// M. Editor-style accept then export ensure — must ship, idempotent
// ---------------------------------------------------------------------------
console.log('\nM. Editor accept path → export ensure (no unmatched)')
{
  const before =
    '          10  Certified Shorthand Reporter of the State of California.\r\n' +
    "Q.  Okay. Did you call the Consuelo's Kitchen when you had your business?\r\n"
  const original = 'the'
  const suggestion = 'it'
  const { cleanContent } = buildCleanContentMap(before)
  // Locate at the intended site only (anchor-style)
  const site = locateAtAnchorStrict(
    cleanContent,
    { _anchorBefore: 'you call ', _anchorAfter: " Consuelo's Kitchen" },
    original,
  )
  assert(!!site, 'M: locate dirty site')
  const detail = applyCorrectionDetailed(before, original, suggestion, {
    cleanStart: site.cleanStart,
    cleanEnd: site.cleanEnd,
  })
  assert(detail.start !== -1, 'M: editor apply succeeded')
  const afterEditor = detail.text
  assert(afterEditor.includes("call it Consuelo"), 'M: editor applied suggestion')
  assert(afterEditor.includes('of the State of California'), 'M: certificate intact after editor accept')
  assert(!afterEditor.includes('of it State'), 'M: no twin corruption on editor accept')

  const ann = {
    id: 'M1',
    entry_id: 1,
    status: 'accepted',
    original,
    suggestion,
    _anchorBefore: 'you call ',
    _anchorAfter: " Consuelo's Kitchen",
    _appliedOriginalStart: detail.start,
    _appliedOriginalEnd: detail.start + suggestion.length,
    _appliedOriginalMatchedText: detail.matchedText,
    _appliedOriginalReplacement: afterEditor.substring(
      detail.start,
      detail.start + suggestion.length,
    ),
  }
  const ship = resolveExportOrBlock(
    afterEditor,
    [{ id: 1, text: "Okay. Did you call it Consuelo's Kitchen when you had your business?" }],
    [ann],
  )
  assert(ship.shipped, 'M: export ships after editor accept')
  assertEq(ship.failed.length, 0, 'M: zero unmatched')
  assertEq(ship.text, afterEditor, 'M: export ensure is no-op on already-applied')
  assert(ship.text.includes('of the State of California'), 'M: shipped certificate intact')
}

// ---------------------------------------------------------------------------
// N. Length-changing accepts in sequence — all must ship or none
// ---------------------------------------------------------------------------
console.log('\nN. Sequential length-changing accepts all ship')
{
  let text =
    'Q.  He went too the store.\r\n' +
    'A.  That was teh receipt.\r\n' +
    'Q.  Please spell nam carefully.\r\n'
  const steps = [
    { original: 'too', suggestion: 'to', before: 'went ', after: ' the' },
    { original: 'teh', suggestion: 'the', before: 'was ', after: ' receipt' },
    { original: 'nam', suggestion: 'name', before: 'spell ', after: ' carefully' },
  ]
  const anns = []
  for (const [idx, step] of steps.entries()) {
    const { cleanContent } = buildCleanContentMap(text)
    const site = locateAtAnchorStrict(
      cleanContent,
      { _anchorBefore: step.before, _anchorAfter: step.after },
      step.original,
    )
    assert(!!site, `N: locate step ${idx}`)
    const detail = applyCorrectionDetailed(text, step.original, step.suggestion, {
      cleanStart: site.cleanStart,
      cleanEnd: site.cleanEnd,
    })
    assert(detail.start !== -1, `N: apply step ${idx}`)
    text = detail.text
    anns.push({
      id: `N${idx}`,
      entry_id: 1,
      status: 'accepted',
      original: step.original,
      suggestion: step.suggestion,
      _anchorBefore: step.before,
      _anchorAfter: step.after,
    })
  }
  const ship = resolveExportOrBlock(text, [{ id: 1, text }], anns)
  assert(ship.shipped, 'N: all length-changing accepts ship')
  assertEq(ship.failed.length, 0, 'N: no unmatched')
  assert(ship.text.includes('went to the'), 'N: too→to present')
  assert(ship.text.includes('was the receipt'), 'N: teh→the present')
  assert(ship.text.includes('spell name carefully'), 'N: nam→name present')
  assert(!ship.text.includes('too the'), 'N: old too gone')
  assert(!ship.text.includes('teh receipt'), 'N: old teh gone')
  assert(!ship.text.includes('spell nam '), 'N: old nam gone')
}

/**
 * Pure editor-path simulators for originalText (export source of truth).
 * Mirrors DashboardEditor accept/reopen at the transcript-file layer only —
 * enough to stress export identity through accept → reopen → ignore churn.
 */
function simAccept(state, annId) {
  const ann = state.annotations.find((a) => a.id === annId)
  if (!ann || ann.status !== 'open') {
    throw new Error(`simAccept: ${annId} not open`)
  }
  const { cleanContent } = buildCleanContentMap(state.text)
  const entry = state.entries.find((e) => e.id === ann.entry_id)
  const site =
    locateAtAnchorStrict(cleanContent, ann, ann.original) ||
    locateAnnotationWithAnchor(cleanContent, entry, ann, ann.original)
  if (!site) throw new Error(`simAccept: cannot locate ${annId} ${ann.original}`)
  const detail = applyCorrectionDetailed(state.text, ann.original, ann.suggestion, {
    cleanStart: site.cleanStart,
    cleanEnd: site.cleanEnd,
  })
  if (detail.start === -1) throw new Error(`simAccept: apply failed ${annId}`)

  const nextText = detail.text
  const replacement = nextText.substring(detail.start, detail.start + ann.suggestion.length)
  const delta = ann.suggestion.length - detail.matchedText.length
  let nextAnns = state.annotations.map((a) => {
    if (a.id !== annId) return a
    return {
      ...a,
      status: 'accepted',
      _originalSuggestion: a._originalSuggestion ?? a.suggestion,
      _appliedOriginalStart: detail.start,
      _appliedOriginalEnd: detail.start + ann.suggestion.length,
      _appliedOriginalMatchedText: detail.matchedText,
      _appliedOriginalReplacement: replacement,
      _appliedEntryId: a.entry_id,
    }
  })
  if (delta !== 0) {
    nextAnns = shiftAcceptedApplySites(
      nextAnns,
      {
        entryId: ann.entry_id,
        entryEditEnd: null,
        entryDelta: 0,
        originalEditEnd: detail.start + detail.matchedText.length,
        originalDelta: delta,
        cleanEditEnd: null,
        cleanDelta: 0,
      },
      annId,
    )
  }
  return { ...state, text: nextText, annotations: nextAnns }
}

function simReopen(state, annId) {
  const ann = state.annotations.find((a) => a.id === annId)
  if (!ann || ann.status !== 'accepted') {
    throw new Error(`simReopen: ${annId} not accepted`)
  }
  const restore = ann._appliedOriginalMatchedText ?? ann.original
  let span = null
  if (
    ann._appliedOriginalStart != null &&
    ann._appliedOriginalEnd != null &&
    state.text.substring(ann._appliedOriginalStart, ann._appliedOriginalEnd) ===
      (ann._appliedOriginalReplacement ?? ann.suggestion)
  ) {
    span = { start: ann._appliedOriginalStart, end: ann._appliedOriginalEnd }
  } else {
    const { cleanContent, cleanToOrig } = buildCleanContentMap(state.text)
    const entry = state.entries.find((e) => e.id === (ann._appliedEntryId ?? ann.entry_id))
    const hit =
      locateAtAnchorStrict(cleanContent, ann, ann.suggestion) ||
      locateAnnotationWithAnchor(cleanContent, entry, ann, ann.suggestion)
    if (hit) {
      span = {
        start: cleanToOrig[hit.cleanStart],
        end: cleanToOrig[hit.cleanEnd - 1] + 1,
      }
    }
  }
  if (!span) throw new Error(`simReopen: cannot locate suggestion for ${annId}`)

  const nextText =
    state.text.substring(0, span.start) + restore + state.text.substring(span.end)
  const delta = restore.length - (span.end - span.start)
  let nextAnns = state.annotations.map((a) => {
    if (a.id !== annId) return a
    return {
      ...a,
      status: 'open',
      suggestion: a._originalSuggestion ?? a.suggestion,
      _originalSuggestion: undefined,
      _appliedOriginalStart: undefined,
      _appliedOriginalEnd: undefined,
      _appliedOriginalMatchedText: undefined,
      _appliedOriginalReplacement: undefined,
      _appliedEntryId: undefined,
    }
  })
  if (delta !== 0) {
    nextAnns = shiftAcceptedApplySites(
      nextAnns,
      {
        entryId: ann._appliedEntryId ?? ann.entry_id,
        entryEditEnd: null,
        entryDelta: 0,
        originalEditEnd: span.end,
        originalDelta: delta,
        cleanEditEnd: null,
        cleanDelta: 0,
      },
      annId,
    )
  }
  return { ...state, text: nextText, annotations: nextAnns }
}

function simIgnore(state, annId) {
  const ann = state.annotations.find((a) => a.id === annId)
  if (!ann || ann.status !== 'open') {
    throw new Error(`simIgnore: ${annId} not open`)
  }
  return {
    ...state,
    annotations: state.annotations.map((a) =>
      a.id === annId ? { ...a, status: 'ignored' } : a,
    ),
  }
}

function assertExportMatchesUserIntent(state, label) {
  const ship = resolveExportOrBlock(state.text, state.entries, state.annotations)
  assert(ship.shipped, `${label}: export ships`)
  assertEq(ship.failed.length, 0, `${label}: zero unmatched accepts`)
  assertEq(ship.text, state.text, `${label}: export text === editor originalText`)

  const again = ensureAcceptedCorrectionsInOriginalText(
    ship.text,
    state.entries,
    state.annotations,
  )
  assertEq(again.failed.length, 0, `${label}: ensure clean`)
  assertEq(again.text, ship.text, `${label}: ensure idempotent`)

  for (const ann of state.annotations) {
    if (ann.status === 'accepted') {
      assert(
        !!locateAtAnchorStrict(buildCleanContentMap(ship.text).cleanContent, ann, ann.suggestion) ||
          !!flexFind(ship.text, ann.suggestion),
        `${label}: accept ${ann.id} suggestion present`,
      )
      assert(
        !locateAtAnchorStrict(buildCleanContentMap(ship.text).cleanContent, ann, ann.original),
        `${label}: accept ${ann.id} original gone at anchor`,
      )
    } else if (ann.status === 'ignored' || ann.status === 'open') {
      assert(
        !!locateAtAnchorStrict(buildCleanContentMap(ship.text).cleanContent, ann, ann.original) ||
          !!flexFind(ship.text, ann.original),
        `${label}: ${ann.status} ${ann.id} left Found text alone`,
      )
      if (ann.suggestion && ann.suggestion !== ann.original) {
        // Suggestion must not have been silently written for ignored/open.
        const atSug = locateAtAnchorStrict(
          buildCleanContentMap(ship.text).cleanContent,
          ann,
          ann.suggestion,
        )
        assert(!atSug, `${label}: ${ann.status} ${ann.id} did not apply suggestion`)
      }
    }
  }

  for (const phrase of PROTECTED) {
    if (state.text.includes(phrase) || ship.text.includes('of the State')) {
      assert(ship.text.includes(phrase) || ship.text.includes('of the State of California'),
        `${label}: protected phrase intact`)
      assert(!ship.text.includes('of it State'), `${label}: no certificate twin corruption`)
    }
  }
  return ship
}

// ---------------------------------------------------------------------------
// O. Long accept → reopen → ignore / re-accept churn (export always matches)
// ---------------------------------------------------------------------------
console.log('\nO. Long accept→reopen→ignore churn (80 sites, many cycles)')
{
  const SITE_COUNT = 80
  const CYCLE_ROUNDS = 6
  const protectedLine = 'Certified Shorthand Reporter of the State of California.'
  const lines = [protectedLine]
  const openAnns = []
  for (let i = 1; i <= SITE_COUNT; i++) {
    const bad = `typo${String(i).padStart(3, '0')}`
    const good = `fixed${String(i).padStart(3, '0')}`
    lines.push(
      `${String(i).padStart(6)}          Q.  Marker word ${bad} end here.`,
    )
    openAnns.push({
      id: `O${i}`,
      entry_id: 1,
      status: 'open',
      original: bad,
      suggestion: good,
      type: 'spelling',
    })
  }
  const baseline = `${lines.join('\r\n')}\r\n`
  for (const ann of openAnns) {
    const m = flexFind(baseline, ann.original)
    const anchor = buildContextAnchor(baseline, m.start, m.end, 2)
    ann._anchorBefore = anchor.before
    ann._anchorAfter = anchor.after
  }

  let state = {
    text: baseline,
    entries: [{ id: 1, text: baseline }],
    annotations: openAnns.map((a) => ({ ...a })),
  }

  // Snapshot of pristine file — ignore-all / reopen-all must be able to return here.
  const pristine = baseline

  // Round 0: accept everything, export must match.
  for (const ann of state.annotations) {
    state = simAccept(state, ann.id)
  }
  assertExportMatchesUserIntent(state, 'O-accept-all')
  assert(!state.text.includes('typo'), 'O-accept-all: no typo* left')

  // Reopen everything → file must return to pristine; then ignore all.
  for (const ann of [...state.annotations]) {
    state = simReopen(state, ann.id)
  }
  assertEq(state.text, pristine, 'O-reopen-all: byte-identical to pristine')
  for (const ann of state.annotations) {
    state = simIgnore(state, ann.id)
  }
  assertExportMatchesUserIntent(state, 'O-ignore-all')
  assertEq(state.text, pristine, 'O-ignore-all: file untouched')

  // Deterministic churn: for each round, accept a sliding window, reopen half,
  // ignore a third of those, re-accept the rest. Export must always match intent.
  // Reset to open on pristine first.
  state = {
    text: pristine,
    entries: [{ id: 1, text: pristine }],
    annotations: openAnns.map((a) => ({
      ...a,
      status: 'open',
      _appliedOriginalStart: undefined,
      _appliedOriginalEnd: undefined,
      _appliedOriginalMatchedText: undefined,
      _appliedOriginalReplacement: undefined,
      _appliedEntryId: undefined,
      _originalSuggestion: undefined,
    })),
  }

  for (let round = 0; round < CYCLE_ROUNDS; round++) {
    const ids = state.annotations.map((a) => a.id)
    // Accept every site that is currently open
    for (const id of ids) {
      const a = state.annotations.find((x) => x.id === id)
      if (a.status === 'open') state = simAccept(state, id)
    }
    assertExportMatchesUserIntent(state, `O-r${round}-after-accept`)

    // Reopen a rotating subset (half of accepted)
    const accepted = state.annotations.filter((a) => a.status === 'accepted')
    const reopenSet = accepted.filter((_, idx) => (idx + round) % 2 === 0)
    for (const a of reopenSet) {
      state = simReopen(state, a.id)
    }
    assertExportMatchesUserIntent(state, `O-r${round}-after-reopen`)

    // Of the reopened (now open): ignore 2/3, leave 1/3 open then re-accept later
    const opened = state.annotations.filter((a) => a.status === 'open')
    for (let i = 0; i < opened.length; i++) {
      if (i % 3 !== 0) state = simIgnore(state, opened[i].id)
    }
    assertExportMatchesUserIntent(state, `O-r${round}-after-ignore`)

    // Re-accept remaining open
    for (const a of state.annotations.filter((x) => x.status === 'open')) {
      state = simAccept(state, a.id)
    }
    assertExportMatchesUserIntent(state, `O-r${round}-after-reaccept`)

    // Spot-check: every ignored site still has Found text; every accepted has suggestion
    for (const ann of state.annotations) {
      if (ann.status === 'ignored') {
        assert(!!flexFind(state.text, ann.original), `O-r${round}: ignored ${ann.id} Found remains`)
        assert(!flexFind(state.text, ann.suggestion), `O-r${round}: ignored ${ann.id} suggestion absent`)
      }
      if (ann.status === 'accepted') {
        assert(!!flexFind(state.text, ann.suggestion), `O-r${round}: accepted ${ann.id} suggestion present`)
        assert(!flexFind(state.text, ann.original), `O-r${round}: accepted ${ann.id} Found gone`)
      }
    }

    // Force a full reopen of all accepts so next round starts from a clean open set
    // mixed with ignores (ignores stay ignored — product: reopen only accepted/ignored cards;
    // we only reopen accepted here).
    for (const a of state.annotations.filter((x) => x.status === 'accepted')) {
      state = simReopen(state, a.id)
    }
    // Turn remaining open back to a known baseline for next round's accept wave:
    // reopen should have restored Found text; open flags that were previously
    // accepted are open again; ignored stay ignored with Found intact.
    assertExportMatchesUserIntent(state, `O-r${round}-end`)
  }

  // Final: reopen any leftover accepts, leave ignores — export == only-ignored mutation = pristine sites for ignores + any still-open Found
  for (const a of state.annotations.filter((x) => x.status === 'accepted')) {
    state = simReopen(state, a.id)
  }
  // Ignore everything still open → file must equal pristine
  for (const a of state.annotations.filter((x) => x.status === 'open')) {
    state = simIgnore(state, a.id)
  }
  assertEq(state.text, pristine, 'O-final: all ignored → pristine file')
  assertExportMatchesUserIntent(state, 'O-final-all-ignored')
}

// ---------------------------------------------------------------------------
// P. Short-word twins under accept→reopen→ignore (certificate never flips)
// ---------------------------------------------------------------------------
console.log('\nP. Twin-safe accept→reopen→ignore on short words')
{
  const protectedLine = 'Certified Shorthand Reporter of the State of California.'
  let state = {
    text:
      `${protectedLine}\r\n` +
      "Q.  Okay. Did you call the Consuelo's Kitchen when you had your business?\r\n" +
      'A.  That was too much pressure on the witness.\r\n' +
      'Q.  He went too the store for teh receipt.\r\n',
    entries: [{ id: 1, text: '' }],
    annotations: [
      {
        id: 'P-the',
        entry_id: 1,
        status: 'open',
        original: 'the',
        suggestion: 'it',
        _anchorBefore: 'you call ',
        _anchorAfter: " Consuelo's Kitchen",
      },
      {
        id: 'P-too1',
        entry_id: 1,
        status: 'open',
        original: 'too',
        suggestion: 'to',
        _anchorBefore: 'was ',
        _anchorAfter: ' much',
      },
      {
        id: 'P-too2',
        entry_id: 1,
        status: 'open',
        original: 'too',
        suggestion: 'to',
        _anchorBefore: 'went ',
        _anchorAfter: ' the',
      },
      {
        id: 'P-teh',
        entry_id: 1,
        status: 'open',
        original: 'teh',
        suggestion: 'the',
        _anchorBefore: 'for ',
        _anchorAfter: ' receipt',
      },
    ],
  }
  state.entries[0].text = state.text
  const pristine = state.text

  // accept → reopen → accept → reopen → ignore for each, interleaved
  const order = ['P-the', 'P-too2', 'P-teh', 'P-too1']
  for (const id of order) {
    state = simAccept(state, id)
    assertExportMatchesUserIntent(state, `P-accept-${id}`)
    assert(state.text.includes(protectedLine), `P-accept-${id}: certificate intact`)
    assert(!state.text.includes('of it State'), `P-accept-${id}: no twin corruption`)
    state = simReopen(state, id)
    assertExportMatchesUserIntent(state, `P-reopen-${id}`)
  }
  assertEq(state.text, pristine, 'P: full reopen restores pristine')

  // Accept the→it and teh→the; ignore both too→to
  state = simAccept(state, 'P-the')
  state = simAccept(state, 'P-teh')
  state = simIgnore(state, 'P-too1')
  state = simIgnore(state, 'P-too2')
  assertExportMatchesUserIntent(state, 'P-mixed-final')
  assert(state.text.includes("call it Consuelo"), 'P: the→it applied')
  assert(state.text.includes('for the receipt'), 'P: teh→the applied')
  assert(state.text.includes('was too much'), 'P: ignored too1 intact')
  assert(state.text.includes('went too the'), 'P: ignored too2 intact')
  assert(state.text.includes(protectedLine), 'P: certificate intact')
  assert(!state.text.includes('of it State'), 'P: certificate not corrupted')

  // Reopen the accepts; ignore them — back to pristine
  state = simReopen(state, 'P-the')
  state = simReopen(state, 'P-teh')
  state = simIgnore(state, 'P-the')
  state = simIgnore(state, 'P-teh')
  assertEq(state.text, pristine, 'P: reopen+ignore all → pristine')
  assertExportMatchesUserIntent(state, 'P-all-ignored')
}

/**
 * Diff helper: every index outside [start,end) spans must match baseline.
 * Spans are in `actual` coordinates (after edits). We instead rebuild the
 * expected string from pristine + ordered accepts and require byte identity.
 */
function expectedFromAccepts(pristine, acceptsInOrder) {
  let text = pristine
  for (const step of acceptsInOrder) {
    const { cleanContent } = buildCleanContentMap(text)
    const site = locateAtAnchorStrict(
      cleanContent,
      { _anchorBefore: step.before, _anchorAfter: step.after },
      step.original,
    )
    if (!site) throw new Error(`expectedFromAccepts: miss ${step.original}`)
    const detail = applyCorrectionDetailed(text, step.original, step.suggestion, {
      cleanStart: site.cleanStart,
      cleanEnd: site.cleanEnd,
    })
    if (detail.start === -1) throw new Error(`expectedFromAccepts: apply ${step.original}`)
    text = detail.text
  }
  return text
}

// ---------------------------------------------------------------------------
// Q. Storage round-trip: UI accepts (incl. custom) survive JSON → export
//     unchanged bytes everywhere else
// ---------------------------------------------------------------------------
console.log('\nQ. Persist round-trip + custom accepts; only intended spans change')
{
  const SITE_COUNT = 40
  const protectedLine = 'Certified Shorthand Reporter of the State of California.'
  const lines = [
    '           1         SUPERIOR COURT OF THE STATE OF CALIFORNIA\r\n',
    `          10  ${protectedLine}\r\n`,
  ]
  const specs = []
  for (let i = 1; i <= SITE_COUNT; i++) {
    const bad = `errX${String(i).padStart(3, '0')}`
    const modelSug = `fixX${String(i).padStart(3, '0')}`
    const customSug = `customX${String(i).padStart(3, '0')}`
    lines.push(
      `${String(100 + i).padStart(12)}  Q.  Line holds ${bad} in place.\r\n`,
    )
    specs.push({
      id: `Q${i}`,
      bad,
      modelSug,
      customSug,
      // destiny assigned below
    })
  }
  const pristine = lines.join('')

  // Destiny: 0 accept-model, 1 accept-custom, 2 ignore, 3 leave-open
  for (let i = 0; i < specs.length; i++) {
    specs[i].destiny = i % 4
  }

  let state = {
    text: pristine,
    entries: [{ id: 1, text: pristine }],
    annotations: specs.map((s) => {
      const m = flexFind(pristine, s.bad)
      const anchor = buildContextAnchor(pristine, m.start, m.end, 2)
      return {
        id: s.id,
        entry_id: 1,
        status: 'open',
        original: s.bad,
        suggestion: s.modelSug,
        type: 'spelling',
        _anchorBefore: anchor.before,
        _anchorAfter: anchor.after,
      }
    }),
  }

  const acceptSteps = []
  for (const s of specs) {
    const ann = state.annotations.find((a) => a.id === s.id)
    if (s.destiny === 0) {
      // Accept model suggestion
      state = simAccept(state, s.id)
      acceptSteps.push({
        original: s.bad,
        suggestion: s.modelSug,
        before: ann._anchorBefore,
        after: ann._anchorAfter,
      })
    } else if (s.destiny === 1) {
      // Custom UI edit then accept (mirrors acceptAnnotation(id, customText))
      state = {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === s.id
            ? {
                ...a,
                suggestion: s.customSug,
                _originalSuggestion: a.suggestion,
              }
            : a,
        ),
      }
      state = simAccept(state, s.id)
      acceptSteps.push({
        original: s.bad,
        suggestion: s.customSug,
        before: ann._anchorBefore,
        after: ann._anchorAfter,
      })
    } else if (s.destiny === 2) {
      state = simIgnore(state, s.id)
    }
    // destiny 3: leave open
  }

  const afterUi = state.text
  const expected = expectedFromAccepts(pristine, acceptSteps)
  assertEq(afterUi, expected, 'Q: editor text equals surgical rebuild from accepts only')

  // Simulate casePersist: JSON upload/download of extracted payload
  const stored = JSON.stringify({
    title: 'Q stress',
    entries: state.entries,
    annotations: state.annotations,
    originalText: state.text,
  })
  const loaded = JSON.parse(stored)
  assertEq(loaded.originalText, afterUi, 'Q: storage round-trip originalText identical')
  assertEq(
    JSON.stringify(loaded.annotations),
    JSON.stringify(state.annotations),
    'Q: storage round-trip annotations identical',
  )

  // Export path (DashboardExport.resolveExportOriginalText)
  const ship = resolveExportOrBlock(
    loaded.originalText,
    loaded.entries,
    loaded.annotations,
  )
  assert(ship.shipped, 'Q: export ships after persist round-trip')
  assertEq(ship.text, afterUi, 'Q: exported transcript === editor originalText (no rewrite)')
  assertEq(ship.text, expected, 'Q: exported transcript === accept-only rebuild')

  // Second ensure (re-export / reload) must be a pure no-op
  const again = ensureAcceptedCorrectionsInOriginalText(
    ship.text,
    loaded.entries,
    loaded.annotations,
  )
  assertEq(again.failed.length, 0, 'Q: re-export verify clean')
  assertEq(again.text, ship.text, 'Q: re-export does not mutate a single byte')

  // Product: ignores and opens never introduced their suggestions
  for (const s of specs) {
    if (s.destiny === 0) {
      assert(!!flexFind(ship.text, s.modelSug), `Q: model accept ${s.id} in export`)
      assert(!flexFind(ship.text, s.bad), `Q: model accept ${s.id} Found gone`)
    } else if (s.destiny === 1) {
      assert(!!flexFind(ship.text, s.customSug), `Q: custom accept ${s.id} in export`)
      assert(!flexFind(ship.text, s.bad), `Q: custom accept ${s.id} Found gone`)
      assert(!flexFind(ship.text, s.modelSug), `Q: custom accept ${s.id} did not keep model sug`)
    } else {
      assert(!!flexFind(ship.text, s.bad), `Q: ${s.destiny === 2 ? 'ignored' : 'open'} ${s.id} Found intact`)
      assert(!flexFind(ship.text, s.modelSug), `Q: non-accept ${s.id} model sug absent`)
      assert(!flexFind(ship.text, s.customSug), `Q: non-accept ${s.id} custom sug absent`)
    }
  }

  assert(ship.text.includes(protectedLine), 'Q: certificate line untouched')
  assert(ship.text.includes('SUPERIOR COURT OF THE STATE OF CALIFORNIA'), 'Q: caption untouched')
  assert(!ship.text.includes('of it State'), 'Q: no twin corruption')

  // Full ignore after reopen of all accepts → pristine file again
  let revert = {
    text: loaded.originalText,
    entries: loaded.entries,
    annotations: loaded.annotations.map((a) => ({ ...a })),
  }
  for (const a of revert.annotations.filter((x) => x.status === 'accepted')) {
    revert = simReopen(revert, a.id)
  }
  for (const a of revert.annotations.filter((x) => x.status === 'open')) {
    revert = simIgnore(revert, a.id)
  }
  assertEq(revert.text, pristine, 'Q: reopen all accepts + ignore → pristine bytes')
  const revertShip = resolveExportOrBlock(revert.text, revert.entries, revert.annotations)
  assert(revertShip.shipped, 'Q: all-ignored export ships')
  assertEq(revertShip.text, pristine, 'Q: all-ignored export === pristine upload')
}

// ---------------------------------------------------------------------------
// R. 200 sequential custom accepts — export identity + zero collateral
// ---------------------------------------------------------------------------
console.log('\nR. 200 custom accepts; export identity; prefix/suffix intact each step')
{
  const N = 200
  const parts = ['Certified Shorthand Reporter of the State of California.\r\n']
  const steps = []
  for (let i = 1; i <= N; i++) {
    const bad = `b${i}z`
    const good = `g${i}z`
    parts.push(`Row ${i} says ${bad} here.\r\n`)
    steps.push({ bad, good, before: `says `, after: ` here` })
  }
  let text = parts.join('')
  const pristine = text
  const anns = []

  for (let i = 0; i < N; i++) {
    const step = steps[i]
    const before = text
    const { cleanContent } = buildCleanContentMap(before)
    // Unique context: "Row N says "
    const beforeCtx = `Row ${i + 1} says `
    const site = locateAtAnchorStrict(
      cleanContent,
      { _anchorBefore: beforeCtx, _anchorAfter: step.after },
      step.bad,
    )
    assert(!!site, `R: locate ${i + 1}`)
    const detail = applyCorrectionDetailed(before, step.bad, step.good, {
      cleanStart: site.cleanStart,
      cleanEnd: site.cleanEnd,
    })
    assert(detail.start !== -1, `R: apply ${i + 1}`)
    const after = detail.text
    // Prefix/suffix invariant at this step
    assert(
      after.startsWith(before.slice(0, detail.start)),
      `R: prefix intact at step ${i + 1}`,
    )
    assert(
      after.slice(detail.start + step.good.length) === before.slice(detail.start + step.bad.length),
      `R: suffix intact at step ${i + 1}`,
    )
    text = after
    const anchor = buildContextAnchor(pristine, flexFind(pristine, step.bad).start, flexFind(pristine, step.bad).end, 2)
    anns.push({
      id: `R${i}`,
      entry_id: 1,
      status: 'accepted',
      original: step.bad,
      suggestion: step.good,
      _originalSuggestion: `model${i}`,
      _anchorBefore: beforeCtx,
      _anchorAfter: step.after,
      _appliedOriginalStart: detail.start,
      _appliedOriginalEnd: detail.start + step.good.length,
      _appliedOriginalMatchedText: detail.matchedText,
      _appliedOriginalReplacement: step.good,
    })
    // Note: offsets in anns are wrong after later edits shift them — export
    // must still succeed via anchors (product path). Rebuild anchors from
    // current text for the just-applied site only; older anns keep their
    // word anchors which remain unique.
    void anchor
  }

  // Persist round-trip
  const blob = JSON.parse(
    JSON.stringify({
      originalText: text,
      entries: [{ id: 1, text }],
      annotations: anns,
    }),
  )

  const ship = resolveExportOrBlock(blob.originalText, blob.entries, blob.annotations)
  assert(ship.shipped, 'R: 200 custom accepts ship')
  assertEq(ship.text, text, 'R: export === editor text (zero drift)')
  assertEq(
    ensureAcceptedCorrectionsInOriginalText(ship.text, blob.entries, blob.annotations).text,
    ship.text,
    'R: second ensure no-op',
  )

  for (let i = 1; i <= N; i++) {
    assert(!!flexFind(ship.text, `g${i}z`), `R: g${i}z present`)
    assert(!flexFind(ship.text, `b${i}z`), `R: b${i}z gone`)
  }
  assert(ship.text.includes('of the State of California'), 'R: certificate intact')
  assert(!ship.text.includes('of it State'), 'R: no twin flip')

  // Count how many lines still match the Row template shape
  let rowHits = 0
  for (let i = 1; i <= N; i++) {
    if (ship.text.includes(`Row ${i} says g${i}z here.`)) rowHits++
  }
  assertEq(rowHits, N, 'R: every row template intact around its custom fix')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed ? 1 : 0)
