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
  locateAnnotationInCleanContent,
  buildCleanContentMap,
  locateNeedleNear,
  shiftAcceptedApplySites,
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

// --- 10. your → you (you⊂your prefix trap) ---
{
  console.log('\n10. Prefix trap: your → you')
  const originalText = 'Is this your book on the table?\n'
  const entries = [{ id: 1, text: 'Is this you book on the table?' }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'your',
      suggestion: 'you',
      _appliedAt: 8,
      _appliedEnd: 11,
      _appliedMatchedText: 'your',
    },
  ]
  const sample = 'Is this your book?'
  assert(
    !isSuggestionAlreadyApplied(
      sample,
      flexFind(sample, 'you'),
      flexFind(sample, 'your'),
      'your',
      'you'
    ),
    'helper: you inside your is not already-applied'
  )
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations
  )
  assertEq(fails.length, 0, 'no failures')
  assert(text.includes('this you book'), 'accepted you present')
  assert(!text.includes('this your book'), 'your gone')
}

// --- 11. its → it's (longer suggestion, like [sic]) ---
{
  console.log('\n11. Longer suggestion: its → it\'s (apply once, no double)')
  const originalText = 'The dog lost its collar yesterday.\n'
  const entryAfter = "The dog lost it's collar yesterday."
  const appliedAt = entryAfter.indexOf("it's")
  const suggestion = "it's"
  const entries = [{ id: 1, text: entryAfter }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'its',
      suggestion,
      _appliedAt: appliedAt,
      _appliedEnd: appliedAt + suggestion.length,
      _appliedMatchedText: 'its',
    },
  ]
  const missing = ensureAcceptedCorrectionsInOriginalText(originalText, entries, annotations)
  assertEq(missing.failed.length, 0, 'applies when missing')
  assert(missing.text.includes("it's"), "it's applied")
  assertEq((missing.text.match(/it's/g) || []).length, 1, 'exactly one it\'s')

  const already = ensureAcceptedCorrectionsInOriginalText(missing.text, entries, annotations)
  assertEq(already.failed.length, 0, 'idempotent ok')
  assertEq(already.text, missing.text, 'no double apostrophe apply')
}

// --- 12. Two accepts on the same sentence ---
{
  console.log('\n12. Two accepts on the same sentence')
  // Both errors still in originalText (and matching entry text). Status is
  // accepted — export safety net must apply both. Avoid mixed
  // post-accept entry + pre-accept originalText fixtures; that breaks locate
  // context when a second error still differs between entry and file.
  const originalText = 'He went too the store with teh receipt.\n'
  const entries = [{ id: 1, text: 'He went too the store with teh receipt.' }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original: 'too',
      suggestion: 'to',
      start: 8,
      end: 11,
    },
    {
      id: 'a2',
      entry_id: 1,
      status: 'accepted',
      original: 'teh',
      suggestion: 'the',
      start: 27,
      end: 30,
    },
  ]
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    entries,
    annotations
  )
  assertEq(fails.length, 0, 'no failures')
  assert(text.includes('went to the store'), 'first accept applied')
  assert(text.includes('with the receipt'), 'second accept applied')
  assert(!text.includes('went too '), 'too gone')
  assert(!text.includes('teh receipt'), 'teh gone')
}

// --- 13. Added terminal punctuation (longer suggestion) ---
{
  console.log('\n13. Longer suggestion: add question mark once')
  const originalText = 'What time is the hearing\n'
  const entryAfter = 'What time is the hearing?'
  const appliedAt = 0
  const suggestion = 'What time is the hearing?'
  const original = 'What time is the hearing'
  const entries = [{ id: 1, text: entryAfter }]
  const annotations = [
    {
      id: 'a1',
      entry_id: 1,
      status: 'accepted',
      original,
      suggestion,
      _appliedAt: appliedAt,
      _appliedEnd: suggestion.length,
      _appliedMatchedText: original,
    },
  ]
  const once = ensureAcceptedCorrectionsInOriginalText(originalText, entries, annotations)
  assertEq(once.failed.length, 0, 'applies ?')
  assert(once.text.includes('hearing?'), 'question mark present')
  const twice = ensureAcceptedCorrectionsInOriginalText(once.text, entries, annotations)
  assertEq(twice.failed.length, 0, 'idempotent')
  assertEq((twice.text.match(/\?/g) || []).length, 1, 'exactly one ?')
}

// --- 14. Accepted highlight must not jump to an earlier "the" ---
{
  console.log('\n14. Locate after teh→the prefers applied offsets, not earlier "the"')
  const line = 'He went to the store with the receipt.'
  const originalText = `1               Q.    ${line}\n`
  const { cleanContent } = buildCleanContentMap(originalText)
  const receiptThe = line.lastIndexOf('the')
  const storeThe = line.indexOf('the')
  assert(storeThe >= 0 && receiptThe > storeThe, 'fixture has two "the"s')

  const located = locateAnnotationInCleanContent(
    cleanContent,
    { id: 1, text: line },
    { start: receiptThe, end: receiptThe + 3 },
    'the'
  )
  assert(!!located, 'locate returns a span')
  const painted = cleanContent.substring(located.cleanStart, located.cleanEnd)
  assertEq(painted, 'the', 'span text is the')
  // Must be the receipt "the", not "the store"
  const before = cleanContent.substring(
    Math.max(0, located.cleanStart - 12),
    located.cleanStart
  )
  assert(before.includes('with '), `highlight is receipt the (before=${JSON.stringify(before)})`)
  assert(!before.endsWith('to '), 'highlight is not store the')
}

// --- 15. Reopen after a later accept must not revert the wrong "the" ---
{
  console.log('\n15. Reopen teh after too→to still targets receipt "the"')
  // Fixture mirrors export-mock: store "the" is already correct; teh is receipt.
  let entry = 'He went too the store with teh receipt.'
  const tehAt = entry.indexOf('teh')
  entry = entry.substring(0, tehAt) + 'the' + entry.substring(tehAt + 3)
  let annotations = [
    {
      id: 'teh',
      status: 'accepted',
      entry_id: 1,
      original: 'teh',
      suggestion: 'the',
      _appliedEntryId: 1,
      _appliedAt: tehAt,
      _appliedEnd: tehAt + 3,
      _appliedMatchedText: 'teh',
    },
  ]

  // Later accept: too → to (shortens by 1 before the receipt "the").
  const tooAt = entry.indexOf('too')
  const tooOldLen = 3
  entry = entry.substring(0, tooAt) + 'to' + entry.substring(tooAt + tooOldLen)
  annotations = shiftAcceptedApplySites(
    annotations,
    {
      entryId: 1,
      entryEditEnd: tooAt + tooOldLen,
      entryDelta: -1,
    },
    'too'
  )

  assertEq(annotations[0]._appliedAt, tehAt - 1, 'teh apply site shifted left by 1')
  const spanExact = entry.substring(annotations[0]._appliedAt, annotations[0]._appliedEnd)
  assertEq(spanExact, 'the', 'shifted offsets still land on receipt the')

  // Simulate stale offsets (shift not applied) — near-search must still win.
  const staleAt = tehAt
  const near = locateNeedleNear(entry, 'the', staleAt)
  assert(!!near, 'near locate finds a the')
  const nearBefore = entry.substring(Math.max(0, near.start - 6), near.start)
  assert(nearBefore.includes('with'), `near locate is receipt the (before=${JSON.stringify(nearBefore)})`)
  assert(!entry.substring(0, near.start).endsWith('to '), 'near locate is not store the')

  const reverted =
    entry.substring(0, near.start) + 'teh' + entry.substring(near.end)
  assert(reverted.includes('with teh receipt'), 'reopen restores teh receipt')
  assert(!reverted.includes('teh store'), 'reopen did not create teh store')
  assert(reverted.includes('went to the store'), 'store the left intact')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
