/**
 * Export integrity harness — no Gemini, no network.
 *
 * Proves the product invariant: export only changes text for accepted
 * annotations, never doubles [sic]-style applies, never touches ignored/open.
 *
 * Run: node scripts/test-export-integrity.mjs
 */

import {
  ensureAcceptedCorrectionsInOriginalText,
  applyCorrectionDetailed,
  flexFind,
  isSuggestionAlreadyApplied,
} from '../src/lib/gemini.js'

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

function assertEq(actual, expected, msg) {
  assert(actual === expected, `${msg}\n       got: ${JSON.stringify(actual)}\n       exp: ${JSON.stringify(expected)}`)
}

console.log('\n=== Export integrity ===\n')

// --- 1. Double [sic] trap (the production bug) ---
{
  console.log('1. Already-applied [sic] must not double on export')
  const originalText =
    '18               Q.    What was the thesis [sic] of the argument?\n'
  const entries = [{ id: 1, text: 'What was the thesis [sic] of the argument?' }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'thesis',
      suggestion: 'thesis [sic]',
      start: 13,
      end: 19,
    },
  ]
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations
  )
  assertEq(fails.length, 0, 'no failed accepts')
  assert(!text.includes('[sic] [sic]'), 'no double [sic]')
  assertEq(
    (text.match(/\[sic\]/g) || []).length,
    1,
    'exactly one [sic]'
  )
  assert(text.includes('thesis [sic]'), 'suggestion present')
}

// --- 2. Missing accept must be applied once ---
{
  console.log('\n2. Accepted but missing in originalText gets applied once')
  // Mirror real accept metadata: _appliedEnd is after the suggestion in the
  // post-accept entry; _appliedMatchedText is the pre-accept original.
  const entryAfter = 'What was the thesis [sic] of the argument?'
  const appliedAt = entryAfter.indexOf('thesis [sic]')
  const suggestion = 'thesis [sic]'
  const originalText =
    '18               Q.    What was the thesis of the argument?\n'
  const entries = [{ id: 1, text: entryAfter }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'thesis',
      suggestion,
      _appliedAt: appliedAt,
      _appliedEnd: appliedAt + suggestion.length,
      _appliedMatchedText: 'thesis',
    },
  ]
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations
  )
  assertEq(fails.length, 0, 'no failed accepts')
  assertEq((text.match(/\[sic\]/g) || []).length, 1, 'exactly one [sic] after apply')
  assert(text.includes('thesis [sic]'), 'suggestion applied')
}

// --- 3. Ignored must not change export text ---
{
  console.log('\n3. Ignored annotations do not change export text')
  const originalText = 'He went too the store.\n'
  const entries = [{ id: 1, text: 'He went too the store.' }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'ignored',
      original: 'too',
      suggestion: 'to',
    },
  ]
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations
  )
  assertEq(fails.length, 0, 'no failures')
  assertEq(text, originalText, 'ignored leaves text unchanged')
}

// --- 4. Open must not change export text ---
{
  console.log('\n4. Open annotations do not change export text')
  const originalText = 'He went too the store.\n'
  const entries = [{ id: 1, text: 'He went too the store.' }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'open',
      original: 'too',
      suggestion: 'to',
    },
  ]
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations
  )
  assertEq(fails.length, 0, 'no failures')
  assertEq(text, originalText, 'open leaves text unchanged')
}

// --- 5. Normal accept (non-[sic]) applies once — including to⊂too prefix ---
{
  console.log('\n5. Homophone accept applies exactly once (to/too prefix trap)')
  const originalText = 'He went too the store on Main.\n'
  const entries = [{ id: 1, text: 'He went to the store on Main.' }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'too',
      suggestion: 'to',
      _appliedAt: 8,
      _appliedEnd: 10,
      _appliedMatchedText: 'too',
    },
  ]
  // Guard helper: "to" inside "too" is NOT already applied
  const too = 'He went too the store.'
  assert(
    !isSuggestionAlreadyApplied(
      too,
      flexFind(too, 'to'),
      flexFind(too, 'too'),
      'too',
      'to'
    ),
    'helper: to inside too is not already-applied'
  )
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations
  )
  assertEq(fails.length, 0, 'no failures')
  assert(text.includes('went to the'), 'accepted fix present')
  assert(!text.includes('went too the'), 'original error gone')
}

// --- 6. Re-running ensure on already-fixed text is idempotent ---
{
  console.log('\n6. ensureAccepted is idempotent')
  const originalText = 'He went to the store on Main.\n'
  const entries = [{ id: 1, text: 'He went to the store on Main.' }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'too',
      suggestion: 'to',
    },
  ]
  const once = ensureAcceptedCorrectionsInOriginalText(originalText, entries, annotations)
  const twice = ensureAcceptedCorrectionsInOriginalText(once.text, entries, annotations)
  assertEq(once.failed.length, 0, 'first pass ok')
  assertEq(twice.failed.length, 0, 'second pass ok')
  assertEq(twice.text, once.text, 'second pass identical')
}

// --- 7. Fail closed when accepted fix cannot be verified ---
{
  console.log('\n7. Fail closed when accepted text is missing and unrepairable')
  const originalText = 'Something completely different.\n'
  const entries = [{ id: 1, text: 'Something completely different.' }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'too',
      suggestion: 'to',
    },
  ]
  const { failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations
  )
  assert(fails.length >= 1, 'reports failed accept (export should block)')
}

// --- 8. Accept apply path: suggestion already present must not double ---
{
  console.log('\n8. applyCorrectionDetailed does not extend [sic] when already present')
  const text = 'the thesis [sic] of'
  // Wrong behavior would be matching "thesis" inside "thesis [sic]" and making
  // "thesis [sic] [sic]". With an anchor on the whole suggestion span we skip.
  const already = flexFind(text, 'thesis [sic]')
  assert(!!already, 'suggestion findable')
  const detail = applyCorrectionDetailed(text, 'thesis', 'thesis [sic]', {
    cleanStart: already.start,
    cleanEnd: already.end,
  })
  // Anchored on the full suggestion: replace would be no-op-ish or same length
  assert(!detail.text.includes('[sic] [sic]'), 'no double from detailed apply')
}

// --- 9. Mixed: accept + ignore + open in one file ---
{
  console.log('\n9. Mixed statuses: only accepted change the file')
  const originalText =
    'Line one has teh typo. Line two has too. Line three has their.\n'
  const entries = [
    { id: 1, text: 'Line one has the typo. Line two has too. Line three has their.' },
  ]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'teh',
      suggestion: 'the',
      _appliedAt: 13,
      _appliedEnd: 16,
      _appliedMatchedText: 'teh',
    },
    {
      id: 'a2',
      entry_id: 1,
      status: 'ignored',
      original: 'too',
      suggestion: 'to',
    },
    {
      id: 'a3',
      entry_id: 1,
      status: 'open',
      original: 'their',
      suggestion: 'there',
    },
  ]
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations
  )
  assertEq(fails.length, 0, 'no failures')
  assert(text.includes('has the typo'), 'accepted applied')
  assert(text.includes('has too'), 'ignored left alone')
  assert(text.includes('has their'), 'open left alone')
  assert(!text.includes('has teh'), 'accepted original gone')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
