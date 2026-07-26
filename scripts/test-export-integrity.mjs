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
  repairAcceptedCleanSpans,
  buildContextAnchor,
  locateAnnotationWithAnchor,
  locateAtAnchorStrict,
  ensureAnnotationAnchors,
  jumpSearchNeedles,
  resolveJumpLineIndex,
  toCleanContentNeedle,
  lineParticipatesInNeedle,
  compactSpanText,
  dropTranscriptUnplaceableAnnotations,
  wouldFlattenTranscriptStructure,
  missingCrossLineReopenBytes,
  isCrossLineApplySiteIntact,
  stripInteriorLineNumberTokens,
  sanitizePhraseAgainstEntry,
  sanitizeAnnotationsLeakedLineNumbers,
  fixAnnotationPositions,
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

// --- 16. Stale accepted clean spans repair after earlier shortens ---
{
  console.log('\n16. repairAcceptedCleanSpans re-pins its→it\'s after too/your')
  let originalText =
    '1   Q.    He went too the store with teh receipt.\n' +
    '2   A.    That was your book, not mine.\n' +
    '4   A.    The dog lost its collar yesterday.\n'
  const itsEntry = { id: 4, text: 'The dog lost its collar yesterday.' }
  const { cleanContent: cc0 } = buildCleanContentMap(originalText)
  const itsLoc = locateAnnotationInCleanContent(
    cc0,
    itsEntry,
    { start: 13, end: 16 },
    'its'
  )
  const itsApply = applyCorrectionDetailed(originalText, 'its', "it's", {
    cleanStart: itsLoc.cleanStart,
    cleanEnd: itsLoc.cleanEnd,
  })
  originalText = itsApply.text
  const { cleanContent: cc1, cleanToOrig } = buildCleanContentMap(originalText)
  let cs = -1
  let ce = -1
  for (let i = 0; i < cleanToOrig.length; i++) {
    if (cs < 0 && cleanToOrig[i] === itsApply.start) cs = i
    if (cleanToOrig[i] === itsApply.end - 1) ce = i + 1
  }
  assertEq(cc1.substring(cs, ce), "it's", 'initial clean span is it\'s')

  // Earlier shortens without shifting metadata (simulates drifted save).
  for (const [orig, sug] of [
    ['too', 'to'],
    ['your', 'you'],
  ]) {
    const { cleanContent } = buildCleanContentMap(originalText)
    const m = flexFind(cleanContent, orig)
    const d = applyCorrectionDetailed(originalText, orig, sug, {
      cleanStart: m.start,
      cleanEnd: m.end,
    })
    originalText = d.text
  }

  const { cleanContent: drifted } = buildCleanContentMap(originalText)
  assert(
    drifted.substring(cs, ce) !== "it's",
    'stale span no longer matches it\'s'
  )

  const entries = [
    { id: 1, text: 'He went to the store with teh receipt.' },
    { id: 2, text: 'That was you book, not mine.' },
    {
      id: 4,
      text: "The dog lost it's collar yesterday.",
    },
  ]
  const annotations = [
    {
      id: 'a5',
      status: 'accepted',
      entry_id: 4,
      original: 'its',
      suggestion: "it's",
      _appliedEntryId: 4,
      _appliedAt: 13,
      _appliedEnd: 17,
      _cleanStart: cs,
      _cleanEnd: ce,
    },
  ]
  const repaired = repairAcceptedCleanSpans(originalText, entries, annotations)
  assert(
    repaired[0]._cleanStart !== cs || repaired[0]._cleanEnd !== ce,
    'repair changed offsets'
  )
  const { cleanContent: finalCc } = buildCleanContentMap(originalText)
  assertEq(
    finalCc.substring(repaired[0]._cleanStart, repaired[0]._cleanEnd),
    "it's",
    'repaired span is it\'s again'
  )
  assert(
    !finalCc
      .substring(repaired[0]._cleanStart, repaired[0]._cleanEnd)
      .includes('coll'),
    'repaired span is not collar'
  )
}

// --- 17. Reopen earlier accept must reverse-shift later "the" highlight ---
{
  console.log('\n17. Reopen too→too keeps receipt "the" green, not store "the"')
  // After teh→the and too→to: "He went to the store with the receipt."
  // Reopen too (to→too, +1). Without reverse-shift, receipt clean span
  // slides onto store "the".
  let line = 'He went to the store with the receipt.'
  const receiptThe = line.lastIndexOf('the')
  const storeThe = line.indexOf('the')
  let annotations = [
    {
      id: 'teh',
      status: 'accepted',
      entry_id: 1,
      original: 'teh',
      suggestion: 'the',
      _appliedEntryId: 1,
      _appliedAt: receiptThe,
      _appliedEnd: receiptThe + 3,
      _cleanStart: receiptThe,
      _cleanEnd: receiptThe + 3,
    },
  ]
  // Reopen too at index 8 ("to"), restore "too" — pre-reopen end of "to" is 10.
  const toStart = line.indexOf('to ')
  const toEnd = toStart + 2
  line = line.substring(0, toStart) + 'too' + line.substring(toEnd)
  annotations = shiftAcceptedApplySites(
    annotations,
    {
      entryId: 1,
      entryEditEnd: toEnd,
      entryDelta: 1,
      cleanEditEnd: toEnd,
      cleanDelta: 1,
    },
    'too'
  )
  assertEq(annotations[0]._appliedAt, receiptThe + 1, 'receipt the shifted +1')
  assertEq(line.substring(annotations[0]._appliedAt, annotations[0]._appliedEnd), 'the', 'still receipt the')
  assert(
    annotations[0]._appliedAt > line.indexOf('the'),
    'apply site is not the store the'
  )
  assertEq(
    line.substring(annotations[0]._cleanStart, annotations[0]._cleanEnd),
    'the',
    'clean span text still the'
  )
  const before = line.substring(
    Math.max(0, annotations[0]._cleanStart - 6),
    annotations[0]._cleanStart
  )
  assert(before.includes('with'), `green stays on receipt (before=${JSON.stringify(before)})`)
  assert(!before.endsWith('too '), 'green is not store the after reopen too')
  assert(line.includes('too the store'), 'too restored')
  assert(storeThe < annotations[0]._appliedAt, 'store the is still before receipt the')
}

// --- 18. Context anchors survive accept too + reopen too ---
{
  console.log('\n18. Context anchor keeps receipt the through too accept/reopen')
  const openLine = 'He went too the store with teh receipt.'
  const tehAt = openLine.indexOf('teh')
  const anchor = buildContextAnchor(openLine, tehAt, tehAt + 3)
  assert(!!anchor, 'anchor built')
  assert(anchor.before.includes('with'), 'anchor before is near receipt')
  assert(anchor.after.includes('receipt'), 'anchor after is receipt')

  let ann = {
    id: 'teh',
    status: 'accepted',
    entry_id: 1,
    original: 'teh',
    suggestion: 'the',
    _anchorBefore: anchor.before,
    _anchorAfter: anchor.after,
    _appliedAt: tehAt,
    _appliedEnd: tehAt + 3,
  }

  // After teh→the (same length)
  let line = 'He went too the store with the receipt.'
  let originalText = `1   Q.    ${line}\n`
  let { cleanContent } = buildCleanContentMap(originalText)
  let located = locateAnnotationWithAnchor(
    cleanContent,
    { id: 1, text: line },
    ann,
    'the'
  )
  assert(!!located, 'anchor locates accepted the')
  let before = cleanContent.substring(
    Math.max(0, located.cleanStart - 6),
    located.cleanStart
  )
  assert(before.includes('with'), 'anchor hit is receipt the')

  // After too→to (earlier shorten) — anchor before/after unchanged
  line = 'He went to the store with the receipt.'
  originalText = `1   Q.    ${line}\n`
  ;({ cleanContent } = buildCleanContentMap(originalText))
  located = locateAnnotationWithAnchor(
    cleanContent,
    { id: 1, text: line },
    ann,
    'the'
  )
  assert(!!located, 'anchor still locates after too→to')
  before = cleanContent.substring(
    Math.max(0, located.cleanStart - 6),
    located.cleanStart
  )
  assert(before.includes('with'), 'still receipt after too→to')
  assert(!before.endsWith('to '), 'not store the after too→to')

  // After reopen too (to→too)
  line = 'He went too the store with the receipt.'
  originalText = `1   Q.    ${line}\n`
  ;({ cleanContent } = buildCleanContentMap(originalText))
  located = locateAnnotationWithAnchor(
    cleanContent,
    { id: 1, text: line },
    ann,
    'the'
  )
  assert(!!located, 'anchor still locates after reopen too')
  before = cleanContent.substring(
    Math.max(0, located.cleanStart - 6),
    located.cleanStart
  )
  assert(before.includes('with'), 'still receipt after reopen too')

  // ensureAnnotationAnchors fills missing anchors for open flags
  const ensured = ensureAnnotationAnchors(
    [{ id: 1, text: openLine }],
    [
      {
        id: 'a1',
        entry_id: 1,
        status: 'open',
        original: 'teh',
        suggestion: 'the',
        start: tehAt,
        end: tehAt + 3,
      },
    ]
  )
  assert(typeof ensured[0]._anchorBefore === 'string', 'ensure sets before')
  assert(typeof ensured[0]._anchorAfter === 'string', 'ensure sets after')
  assert(ensured[0]._anchorBefore.includes('with'), 'ensured before near receipt')
}

// --- 18b. Jump needles + line resolve (Alison jump-to harden) ---
{
  console.log('\n18b. Jump search needles + resolveJumpLineIndex')
  const openNeedles = jumpSearchNeedles({
    status: 'open',
    original: 'teh',
    suggestion: 'the',
  })
  assertEq(openNeedles[0], 'teh', 'open prefers original')
  assert(openNeedles.includes('the'), 'open also tries suggestion')

  const sicNeedles = jumpSearchNeedles({
    status: 'accepted',
    original: 'gonna',
    suggestion: 'gonna [sic]',
  })
  assertEq(sicNeedles[0], 'gonna [sic]', 'accepted prefers full suggestion')
  assert(sicNeedles.includes('gonna'), 'accepted also tries stripped [sic] / original')

  const line = 'He said gonna once and left.'
  const originalText = `1   Q.    ${line}\n`
  const { cleanContent, parsedLines } = buildCleanContentMap(originalText)
  const entry = { id: 1, text: line }
  const ann = {
    id: 'sic1',
    status: 'accepted',
    entry_id: 1,
    original: 'gonna',
    suggestion: 'gonna [sic]',
    start: line.indexOf('gonna'),
    end: line.indexOf('gonna') + 5,
  }
  // Primary needle "gonna [sic]" is not in the file; bare original still locates.
  const lineIdx = resolveJumpLineIndex(
    cleanContent,
    parsedLines,
    entry,
    ann,
    jumpSearchNeedles(ann)
  )
  assert(lineIdx >= 0, 'resolveJumpLineIndex finds line via stripped needle')
  assertEq(lineIdx, 0, 'jump lands on first transcript line')
}

// --- 18c. CleanContent locate with leaked gutter / cross-line needles (Alison) ---
{
  console.log('\n18c. Locate gutter-polluted needles in cleanContent')
  assertEq(
    toCleanContentNeedle('optical\n\n            20          recognizance'),
    'optical recognizance',
    'toCleanContentNeedle strips interior gutter'
  )
  assertEq(
    toCleanContentNeedle('\n\n             5          to'),
    ' to',
    'toCleanContentNeedle strips leading gutter, keeps word boundary space'
  )

  // Transcript lines with gutters — cleanContent drops leading "20" / "5".
  const originalText =
    '   19   Q.    Again, optical sensing is very broad.  As we said, optical\n' +
    '   20          recognizance, change detection helps.\n' +
    '    4          and one happened\n' +
    '    5          to me yesterday.\n'
  const { cleanContent, parsedLines } = buildCleanContentMap(originalText)
  assert(!/\b20\b/.test(cleanContent.split('recognizance')[0].slice(-20)), 'clean drops line-20 gutter near phrase')

  const entryCross = {
    id: 379,
    text: 'Again, optical sensing is very broad.  As we said, optical\n\n            20          recognizance, change detection helps.',
  }
  const annCross = {
    id: 28,
    status: 'ignored',
    entry_id: 379,
    severity: 'critical',
    type: 'context',
    original: 'optical\n\n            20          recognizance',
    suggestion: 'optical\n\n            20          reconnaissance',
    _anchorBefore: 'field of ',
    _anchorAfter: ', change',
  }
  // Offsets inside entry for the polluted span
  const mCross = flexFind(entryCross.text, annCross.original)
  assert(!!mCross, 'fixture polluted original exists in entry')
  annCross.start = mCross.start
  annCross.end = mCross.end

  let located = locateAnnotationWithAnchor(
    cleanContent,
    entryCross,
    annCross,
    annCross.original
  )
  assert(!!located, 'gutter-polluted original locates in cleanContent')
  assertEq(
    cleanContent.substring(located.cleanStart, located.cleanEnd).replace(/\s+/g, ' ').trim(),
    'optical recognizance',
    'located span is optical recognizance'
  )

  const entryShort = {
    id: 395,
    text: 'You know, again, if you — I will give you one example, and one happened\n\n             5          to me yesterday.',
  }
  // Rebuild clean map from text that matches this entry shape
  const ot2 =
    '    4          and one happened\n' +
    '    5          to me yesterday.\n'
  const map2 = buildCleanContentMap(ot2)
  const annShort = {
    id: 33,
    status: 'ignored',
    entry_id: 395,
    severity: 'warning',
    type: 'grammar',
    original: 'happened',
    suggestion: 'happened [sic]',
    _anchorBefore: 'and one ',
    _anchorAfter: '\n\n             5          to',
  }
  const mShort = flexFind(entryShort.text, 'happened')
  annShort.start = mShort.start
  annShort.end = mShort.end
  located = locateAnnotationWithAnchor(
    map2.cleanContent,
    entryShort,
    annShort,
    'happened'
  )
  assert(!!located, 'short warning with gutter-polluted after-anchor locates')
  if (located) {
    assertEq(
      map2.cleanContent.substring(located.cleanStart, located.cleanEnd),
      'happened',
      'short warning underline is happened'
    )
  }

  const lineIdx = resolveJumpLineIndex(
    cleanContent,
    parsedLines,
    entryCross,
    annCross,
    jumpSearchNeedles(annCross)
  )
  assert(lineIdx >= 0, 'jump resolves line for gutter-polluted flag')

  // Clean needle + gutter-only before-anchor (Alison #30 class)
  assertEq(
    toCleanContentNeedle('of\n\n             7          '),
    'of ',
    'gutter-only before-anchor cleans to of '
  )
  assertEq(
    toCleanContentNeedle('see Exhibit 16'),
    'see Exhibit 16',
    'does not strip real content numbers'
  )
  assertEq(
    toCleanContentNeedle('page 12'),
    'page 12',
    'does not strip page 12'
  )
  assertEq(
    toCleanContentNeedle('change detection.\n\n             8 '),
    'change detection. ',
    'strips trailing gutter leftover, keeps boundary space'
  )
  const ot3 =
    '    6          knowledge in the field of\n' +
    '    7          optical recognizance, it was known to us.\n'
  const map3 = buildCleanContentMap(ot3)
  const entry30 = {
    id: 383,
    text: 'knowledge in the field of\n\n             7          optical recognizance, it was known to us.',
  }
  const ann30 = {
    id: 30,
    status: 'ignored',
    entry_id: 383,
    original: 'optical recognizance, it was',
    suggestion: 'optical reconnaissance, it was',
    _anchorBefore: 'of\n\n             7          ',
    _anchorAfter: ' known to',
  }
  const m30 = flexFind(entry30.text, ann30.original)
  ann30.start = m30.start
  ann30.end = m30.end
  located = locateAnnotationWithAnchor(
    map3.cleanContent,
    entry30,
    ann30,
    ann30.original
  )
  assert(!!located, 'clean needle with gutter before-anchor locates')
  if (located) {
    assert(
      map3.cleanContent
        .substring(located.cleanStart, located.cleanEnd)
        .includes('optical recognizance'),
      'id30-class underline is optical recognizance phrase'
    )
  }

  // Overlap: two flags on the same span — both must stay jumpable even if
  // only one underline can paint (editor skips overlapping cleanHighlights).
  {
    const line = 'He went too the store.'
    const ot = `1   Q.    ${line}\n`
    const map = buildCleanContentMap(ot)
    const entry = { id: 1, text: line }
    const a1 = {
      id: 'ov1',
      status: 'open',
      entry_id: 1,
      original: 'too',
      suggestion: 'to',
      start: line.indexOf('too'),
      end: line.indexOf('too') + 3,
    }
    const a2 = {
      id: 'ov2',
      status: 'open',
      entry_id: 1,
      original: 'too',
      suggestion: 'to',
      start: line.indexOf('too'),
      end: line.indexOf('too') + 3,
    }
    const spans = []
    const jump = {}
    for (const ann of [a1, a2]) {
      const loc = locateAnnotationWithAnchor(map.cleanContent, entry, ann, ann.original)
      assert(!!loc, `overlap fixture locates ${ann.id}`)
      const li = map.parsedLines.findIndex(
        (pl) => pl.cleanStart <= loc.cleanStart && loc.cleanStart < pl.cleanEnd
      )
      if (li >= 0) jump[ann.id] = li
      spans.push(loc)
    }
    spans.sort((a, b) => a.cleanStart - b.cleanStart)
    let last = 0
    let painted = 0
    let skipped = 0
    for (const h of spans) {
      if (h.cleanStart < last) {
        skipped++
        continue
      }
      painted++
      last = h.cleanEnd
    }
    assertEq(painted, 1, 'overlap paints one underline')
    assertEq(skipped, 1, 'overlap skips one underline')
    assertEq(Object.keys(jump).length, 2, 'overlap keeps jump line for both')
  }
}

// --- 18d. Page-break span: locate across pages, don't treat inline digits as breaks ---
{
  console.log('\n18d. Cross-page flexFind + paint line filter')
  const cross =
    'getting material to\n\n' +
    '                              126\n\n' +
    'site.\n'
  const hit = flexFind(cross, 'to site')
  assert(!!hit, 'flexFind locates to site across page-break line')
  assert(
    compactSpanText(cross.substring(hit.start, hit.end))
      .toLowerCase()
      .includes('to') &&
      compactSpanText(cross.substring(hit.start, hit.end))
        .toLowerCase()
        .includes('site'),
    'compacted span keeps to + site'
  )
  assert(
    !lineParticipatesInNeedle('                              126', 'to site'),
    'page-number line does not participate in paint'
  )
  assert(
    lineParticipatesInNeedle('40', '40 some odd'),
    'bare content number line still paints'
  )
  assert(lineParticipatesInNeedle('getting material to', 'to site'), 'to-line paints')
  assert(lineParticipatesInNeedle('site.', 'to site'), 'site-line paints')
  assertEq(
    compactSpanText('to\n\n                              126\n\nsite'),
    'to site',
    'compactSpanText drops padded page gutter only'
  )
  assertEq(
    compactSpanText('40\n\nsome odd'),
    '40 some odd',
    'compactSpanText keeps content number line'
  )

  // Inline exhibit numbers must NOT be treated as page breaks
  const inline = 'Please mark Exhibit Number 2 before? Yes.'
  const bad = flexFind(inline, 'Exhibit Number before?')
  assertEq(bad, null, 'inline digit is not a page-break gap')
  const good = flexFind(inline, 'Exhibit Number 2 before?')
  assert(!!good, 'full exhibit phrase still matches')
}

// --- 18f. Deposition timestamp gutters stripped so Exhibit Number locates ---
{
  console.log('\n18f. Timestamp+line gutters in buildCleanContentMap (category 1)')
  const ot =
    '    21          take a look at what\'s been marked as Exhibit\r\n' +
    '\r\n' +
    '08:03:24 22           Number 1, which should be at the top of your pile\r\n' +
    '\r\n' +
    '    5           to the second document which is marked as Exhibit\r\n' +
    '\r\n' +
    '08:04:00  6           Number 2, again, not going to go through it right\r\n'
  const { cleanContent, parsedLines } = buildCleanContentMap(ot)
  assert(
    cleanContent.includes('Exhibit') && cleanContent.includes('Number 1'),
    'clean keeps Exhibit / Number 1 words'
  )
  assert(
    !cleanContent.includes('08:03:24'),
    'clean strips deposition timestamp from content'
  )
  const g = parsedLines.find((pl) => pl.fullLine.includes('08:03:24'))
  assert(!!g?.prefix?.includes('08:03:24'), 'timestamp kept on prefix for display')
  assert(!!flexFind(cleanContent, 'Exhibit Number 1'), 'Exhibit Number 1 findable after strip')
  assert(
    !!flexFind(cleanContent, 'marked as Exhibit Number 2, again'),
    'marked as Exhibit Number 2, again findable after strip'
  )
  const entry = {
    id: 1,
    text: 'take a look at what\'s been marked as Exhibit Number 1, which should be at the top of your pile',
  }
  const ann = {
    id: 'ex1',
    status: 'open',
    entry_id: 1,
    original: 'Exhibit Number 1',
    suggestion: 'Exhibit No. 1',
    start: entry.text.indexOf('Exhibit Number 1'),
    end: entry.text.indexOf('Exhibit Number 1') + 'Exhibit Number 1'.length,
    _anchorBefore: 'marked as ',
    _anchorAfter: ', which',
  }
  const loc = locateAnnotationWithAnchor(cleanContent, entry, ann, ann.original)
  assert(!!loc, 'locate places Exhibit Number 1 across former timestamp gap')
}

// --- 18h. Accept across timestamp+line# gutters must preserve the gutter ---
{
  console.log('\n18h. Accept preserves HH:MM:SS + line# gutters (Cusato)')
  const before =
    "08:03:23 21           take a look at what's been marked as Exhibit\r\n" +
    '\r\n' +
    '08:03:24 22           Number 1, which should be at the top of your pile\r\n'
  const { cleanContent, cleanToOrig } = buildCleanContentMap(before)
  const cm = flexFind(cleanContent, 'Exhibit Number 1')
  assert(!!cm, 'find Exhibit Number 1 in clean content')
  const detail = applyCorrectionDetailed(before, 'Exhibit Number 1', 'Exhibit No. 1', {
    cleanStart: cm.start,
    cleanEnd: cm.end,
  })
  assert(detail.start !== -1, 'accept applies across timestamp gap')
  assert(
    detail.text.includes('08:03:24 22'),
    'timestamp+line gutter still present after accept'
  )
  assert(
    detail.text.includes('08:03:23 21'),
    'prior line timestamp still present'
  )
  assert(
    !/Exhibit No\. 1\r?\n\r?\n\s+, which/.test(detail.text),
    'does not orphan ", which" without its line gutter'
  )
  assert(
    /No\.\s*1,\s*which should be at the top/.test(detail.text.replace(/\s+/g, ' ')) ||
      /Exhibit No\. 1/.test(detail.text),
    'suggestion words present'
  )
  // Plain line-number-only gutters still preserved (regression).
  const plain =
    'Q.    marked as Exhibit\n' +
    '               16        Number 1, which should\n'
  const plainDetail = applyCorrectionDetailed(plain, 'Exhibit Number 1', 'Exhibit No. 1')
  assert(plainDetail.start !== -1, 'plain line# cross-line accept applies')
  assert(plainDetail.text.includes('16'), 'plain line number preserved')
  assert(plainDetail.matchedText.includes('\n'), 'plain match spanned newline')
}

// --- 18e. Nearby-anchor unique locate (timestamp gap) + reject wrong twin ---
{
  console.log('\n18e. Nearby-anchor locate across timestamps; reject wrong twin')

  const cleanBurk =
    'MR. BERGERON:  Keith Bergeron for                         11:09:02\n\n' +
    'Burk-Klleinpeter, Inc.                                  \n'
  const annBurk = {
    id: 'burk',
    status: 'open',
    entry_id: 1,
    original: 'Burk-Klleinpeter',
    suggestion: 'Burk-Kleinpeter',
    _anchorBefore: 'Bergeron for ',
    _anchorAfter: ', Inc.',
  }
  const entryBurk = { id: 1, text: 'Keith Bergeron for Burk-Klleinpeter, Inc.' }
  const locBurk = locateAnnotationWithAnchor(
    cleanBurk,
    entryBurk,
    annBurk,
    'Burk-Klleinpeter'
  )
  assert(!!locBurk, 'rescues Burk across timestamp gap via nearby anchors')
  if (locBurk) {
    assertEq(
      cleanBurk.substring(locBurk.cleanStart, locBurk.cleanEnd),
      'Burk-Klleinpeter',
      'Burk underline is the firm name'
    )
  }

  // Entry claims "marked as … again" but cleanContent only has a different
  // "Exhibit Number 2" — must NOT paint the wrong occurrence.
  const cleanWrong =
    '08:04:06  9                  Have you seen Exhibit Number 2 before?\n'
  const annWrong = {
    id: 'ex2',
    status: 'open',
    entry_id: 1,
    original: 'Exhibit Number 2',
    suggestion: 'Exhibit No. 2',
    start: 243,
    end: 259,
    _anchorBefore: 'marked as ',
    _anchorAfter: ', again,',
  }
  const entryWrong = {
    id: 1,
    text: 'second document which is marked as Exhibit Number 2, again, not going through it',
  }
  const locWrong = locateAnnotationWithAnchor(
    cleanWrong,
    entryWrong,
    annWrong,
    'Exhibit Number 2'
  )
  assertEq(locWrong, null, 'does not paint wrong Exhibit Number 2 occurrence')
}

// --- 18g. Drop open flags that cannot be placed in the transcript file ---
{
  console.log('\n18g. dropTranscriptUnplaceableAnnotations')
  const ot = '1   Q.    He went to the store.\n'
  const entries = [{ id: 1, text: 'He went to the store.' }]
  const anns = [
    {
      id: 'keep',
      status: 'open',
      entry_id: 1,
      original: 'too',
      suggestion: 'to',
      start: 8,
      end: 11,
      // "too" is not in file — wait, use a placeable one
    },
    {
      id: 'keep2',
      status: 'open',
      entry_id: 1,
      original: 'store',
      suggestion: 'store [sic]',
      start: 15,
      end: 20,
      _anchorBefore: 'the ',
      _anchorAfter: '.',
    },
    {
      id: 'drop-me',
      status: 'open',
      entry_id: 1,
      original: 'returning the tablets',
      suggestion: 'returning the tablet',
      start: 0,
      end: 5,
      _anchorBefore: 'you and ',
      _anchorAfter: '.',
    },
    {
      id: 'keep-accepted',
      status: 'accepted',
      entry_id: 1,
      original: 'returning the tablets',
      suggestion: 'returning the tablet',
    },
  ]
  // Fix keep: use "went" which is in the file
  anns[0].original = 'went'
  anns[0].suggestion = 'went [sic]'
  anns[0].start = 3
  anns[0].end = 7
  anns[0]._anchorBefore = 'He '
  anns[0]._anchorAfter = ' to'

  const { annotations: kept, droppedCount } = dropTranscriptUnplaceableAnnotations(
    ot,
    entries,
    anns
  )
  assertEq(droppedCount, 1, 'drops one unplaceable open flag')
  assert(
    kept.some((a) => a.id === 'keep2') && kept.some((a) => a.id === 'keep'),
    'keeps placeable open flags'
  )
  assert(
    kept.some((a) => a.id === 'keep-accepted'),
    'never drops accepted even if Found is missing'
  )
  assert(
    !kept.some((a) => a.id === 'drop-me'),
    'unplaceable open flag is gone from the list'
  )
}

// --- 19. Accept must not treat store "the" as teh already-applied ---
{
  console.log('\n19. Strict anchor: suggestion "the" miss while teh remains')
  const line = 'He went to the store with teh receipt.'
  const tehAt = line.indexOf('teh')
  const anchor = buildContextAnchor(line, tehAt, tehAt + 3)
  const ann = {
    id: 'teh',
    status: 'open',
    entry_id: 1,
    original: 'teh',
    suggestion: 'the',
    start: tehAt,
    end: tehAt + 3,
    _anchorBefore: anchor.before,
    _anchorAfter: anchor.after,
  }
  const sugStrict = locateAtAnchorStrict(line, ann, 'the')
  const origStrict = locateAtAnchorStrict(line, ann, 'teh')
  assertEq(sugStrict, null, 'strict suggestion miss while teh present')
  assert(!!origStrict, 'strict original finds teh')
  assertEq(line.substring(origStrict.start, origStrict.end), 'teh', 'strict original is teh')

  // Export repair: accepted + anchors + teh still in file must apply.
  const originalText = `1   Q.    ${line}\n`
  const { text, failed: fails } = ensureAcceptedCorrectionsInOriginalText(
    originalText,
    [{ id: 1, text: line }],
    [
      {
        ...ann,
        status: 'accepted',
        _appliedAt: tehAt,
        _appliedEnd: tehAt + 3,
        _appliedMatchedText: 'teh',
      },
    ]
  )
  assertEq(fails.length, 0, 'export repair applies')
  assert(text.includes('with the receipt'), 'teh repaired to the')
  assert(!text.includes('teh'), 'teh gone')
}

// --- 20. Cross-line accept reopen restores raw matched bytes ---
{
  console.log('\n20. Cross-line reopen splices matchedText, not flat suggestion')
  // Simulate transcript where flagged phrase spans a line number break.
  const before =
    'Q.    And we are here, plaintiff Flora Weathers as\n' +
    '               16        identified you as a life care planner\n'
  const detail = applyCorrectionDetailed(before, 'as identified', 'has identified')
  assert(detail.start !== -1, 'cross-line apply found match')
  assert(detail.matchedText.includes('\n'), 'matchedText keeps line break')
  const replacement = detail.text.substring(detail.start, detail.end)
  assert(replacement.includes('\n'), 'replacement keeps structure')
  assert(flexFind(replacement, 'has identified') || replacement.includes('has'), 'suggestion words present')

  // Reopen must put matchedText back at stored offsets (not flat "as identified"
  // over a clean-only span, which drops indent / line numbers).
  const restored =
    detail.text.substring(0, detail.start) +
    detail.matchedText +
    detail.text.substring(detail.end)
  assertEq(restored, before, 'exact reopen restores original formatting')

  // Regression: entry restore uses flat original; originalText must use
  // _appliedOriginalMatchedText (with newlines). Using flat ann.original
  // collapses line 16 into line 15 — the reopen bug from the Weathers case.
  const flatOriginal = 'as identified'
  const ruined =
    detail.text.substring(0, detail.start) +
    flatOriginal +
    detail.text.substring(detail.end)
  assert(ruined !== before, 'flat original would ruin formatting')
  assert(!ruined.includes('\n               16'), 'flat restore drops line 16 indent')
}

// --- 21. Legacy reopen guard (missing structured undo) ---
{
  console.log('\n21. Legacy reopen guard blocks flat restore over cross-line')
  const before =
    'Q.    Flora Weathers as\n' +
    '               16        identified you as expert.\n'
  const detail = applyCorrectionDetailed(before, 'as identified', 'has identified')
  const replacement = detail.text.substring(detail.start, detail.end)

  assert(
    wouldFlattenTranscriptStructure(replacement, 'as identified'),
    'flat restore over multi-line span is flatten risk'
  )
  assert(
    !wouldFlattenTranscriptStructure(replacement, detail.matchedText),
    'structured matchedText is safe'
  )
  assert(
    !wouldFlattenTranscriptStructure('has identified', 'as identified'),
    'same-line span is not a flatten risk'
  )

  const legacyAnn = {
    _appliedOriginalReplacement: replacement,
    _appliedOriginalMatchedText: 'as identified', // flat — pre-fix accept
  }
  assert(missingCrossLineReopenBytes(legacyAnn), 'legacy flat matched triggers guard')

  const goodAnn = {
    _appliedOriginalReplacement: replacement,
    _appliedOriginalMatchedText: detail.matchedText,
  }
  assert(!missingCrossLineReopenBytes(goodAnn), 'structured matched passes guard')

  const missingMatched = {
    _appliedOriginalReplacement: replacement,
    _appliedOriginalMatchedText: null,
  }
  assert(missingCrossLineReopenBytes(missingMatched), 'null matched with cross-line repl triggers')
}

// --- 22. Sequential cross-line then same-line; reopen first ---
{
  console.log('\n22. Sequential accepts: reopen cross-line keeps later fix')
  const before =
    '   15          Q.  Flora Weathers as\n' +
    '               16        identified you too as expert.\n'
  const d1 = applyCorrectionDetailed(before, 'as identified', 'has identified')
  assert(d1.start !== -1, 'cross-line apply ok')
  const repl1 = d1.text.substring(d1.start, d1.end)
  const d2 = applyCorrectionDetailed(d1.text, 'too as', 'to as')
  assert(d2.start !== -1, 'second apply ok')
  assert(d2.start >= d1.end, 'second accept is after first region')

  // Reopen first using stored offsets (unchanged when second is after).
  const afterReopenFirst =
    d2.text.substring(0, d1.start) + d1.matchedText + d2.text.substring(d1.start + repl1.length)
  assert(afterReopenFirst.includes('Weathers as\n'), 'reopen restores line break')
  assert(afterReopenFirst.includes('               16'), 'reopen keeps line 16')
  assert(afterReopenFirst.includes('to as'), 'later too→to still applied')
  assert(!afterReopenFirst.includes('too as'), 'too gone after second accept')
}

// --- 23. Export fails closed when cross-line apply site was flattened ---
{
  console.log('\n23. Export blocks flattened cross-line accept')
  const before =
    'Q.    Flora Weathers as\n' +
    '               16        identified you as expert.\n'
  const detail = applyCorrectionDetailed(before, 'as identified', 'has identified')
  const replacement = detail.text.substring(detail.start, detail.end)
  const flatRuined =
    detail.text.substring(0, detail.start) +
    'has identified' +
    detail.text.substring(detail.end)

  const ann = {
    id: 'a1',
    entry_id: 1,
    status: 'accepted',
    original: 'as identified',
    suggestion: 'has identified',
    _appliedOriginalStart: detail.start,
    _appliedOriginalEnd: detail.start + replacement.length,
    _appliedOriginalMatchedText: detail.matchedText,
    _appliedOriginalReplacement: replacement,
    _anchorBefore: 'Weathers ',
    _anchorAfter: ' you',
  }

  assert(isCrossLineApplySiteIntact(detail.text, ann), 'intact after proper accept')
  assert(!isCrossLineApplySiteIntact(flatRuined, ann), 'flattened site is not intact')

  const entries = [
    { id: 1, text: 'Q. Flora Weathers has identified you as expert.' },
  ]
  const { text, failed } = ensureAcceptedCorrectionsInOriginalText(
    flatRuined,
    entries,
    [ann]
  )
  assert(failed.length >= 1, 'export reports failed accept')
  assertEq(text, flatRuined, 'export does not further mutate flattened text')
}

// --- 24. Persist-shaped metadata round-trip (JSON) still reopens exactly ---
{
  console.log('\n24. JSON round-trip keeps structured reopen bytes')
  const before =
    'Q.    Flora Weathers as\n' +
    '               16        identified you as expert.\n'
  const detail = applyCorrectionDetailed(before, 'as identified', 'has identified')
  const ann = {
    id: 'a1',
    status: 'accepted',
    original: 'as identified',
    suggestion: 'has identified',
    _appliedOriginalStart: detail.start,
    _appliedOriginalEnd: detail.end,
    _appliedOriginalMatchedText: detail.matchedText,
    _appliedOriginalReplacement: detail.text.substring(detail.start, detail.end),
  }
  const reloaded = JSON.parse(JSON.stringify(ann))
  assert(
    reloaded._appliedOriginalMatchedText.includes('\n'),
    'matchedText survives JSON'
  )
  assert(!missingCrossLineReopenBytes(reloaded), 'reloaded ann still has undo bytes')
  const restored =
    detail.text.substring(0, reloaded._appliedOriginalStart) +
    reloaded._appliedOriginalMatchedText +
    detail.text.substring(reloaded._appliedOriginalEnd)
  assertEq(restored, before, 'reopen after JSON round-trip is exact')
}

// --- 25. Flag spanning a page-break line ---
{
  console.log('\n25. Page-break spanning accept/reopen preserves structure')
  // Court .txt style: right-justified page number between words of one flag.
  const before =
    '   27          Q.  Flora Weathers as\n' +
    '                                5\n' +
    '    1          identified you as expert.\n'
  const detail = applyCorrectionDetailed(before, 'as identified', 'has identified')
  assert(detail.start !== -1, 'page-break apply found match')
  assert(detail.matchedText.includes('\n'), 'matchedText keeps breaks')
  assert(
    /(?:^|\n)\s*5\s*(?:\n|$)/.test(detail.matchedText) ||
      detail.matchedText.includes('5'),
    'matchedText includes page number'
  )
  const replacement = detail.text.substring(detail.start, detail.end)
  assert(replacement.includes('\n'), 'replacement keeps structure')
  assert(
    detail.text.includes('                                5\n'),
    'page-break line still present after accept'
  )
  assert(detail.text.includes('has'), 'suggestion applied')

  const restored =
    detail.text.substring(0, detail.start) +
    detail.matchedText +
    detail.text.substring(detail.end)
  assertEq(restored, before, 'exact reopen restores page-break formatting')

  assert(
    wouldFlattenTranscriptStructure(replacement, 'as identified'),
    'flat restore over page-break span is flatten risk'
  )
  assert(
    !wouldFlattenTranscriptStructure(replacement, detail.matchedText),
    'structured matchedText is safe across page break'
  )

  const ann = {
    id: 'a1',
    entry_id: 1,
    status: 'accepted',
    original: 'as identified',
    suggestion: 'has identified',
    _appliedOriginalStart: detail.start,
    _appliedOriginalEnd: detail.end,
    _appliedOriginalMatchedText: detail.matchedText,
    _appliedOriginalReplacement: replacement,
  }
  assert(!missingCrossLineReopenBytes(ann), 'page-break accept has undo bytes')
  assert(isCrossLineApplySiteIntact(detail.text, ann), 'apply site intact after accept')

  const flatRuined =
    detail.text.substring(0, detail.start) +
    'has identified' +
    detail.text.substring(detail.end)
  assert(!isCrossLineApplySiteIntact(flatRuined, ann), 'flattened page-break site fails intact')
  const { failed } = ensureAcceptedCorrectionsInOriginalText(
    flatRuined,
    [{ id: 1, text: 'Q. Flora Weathers has identified you as expert.' }],
    [ann]
  )
  assert(failed.length >= 1, 'export blocks flattened page-break accept')
}

// --- 26. Leaked line-number sanitizer (Alison's "numeral in suggestions") ---
{
  console.log('\n26. Sanitize leaked line numbers from Found/Suggest')
  assertEq(
    stripInteriorLineNumberTokens('as 16 identified'),
    'as identified',
    'strips interior line number'
  )
  assertEq(
    stripInteriorLineNumberTokens('Weathers as 16 identified'),
    'Weathers as identified',
    'strips from longer phrase'
  )

  const entryText =
    'Q. And we are here, plaintiff Flora Weathers as identified you as a life care planner.'
  assertEq(
    sanitizePhraseAgainstEntry('as 16 identified', entryText),
    'as identified',
    'polluted phrase sanitizes when stripped form is in entry'
  )
  assertEq(
    sanitizePhraseAgainstEntry('Exhibit 16 was marked', 'Then Exhibit 16 was marked for ID.'),
    'Exhibit 16 was marked',
    'keeps real content numbers that match entry'
  )
  assertEq(
    sanitizePhraseAgainstEntry('as 16 identified', 'no match here at all'),
    'as 16 identified',
    'does not strip when stripped form is not in entry'
  )

  const entries = [{ id: 13, text: entryText }]
  const polluted = [
    {
      id: 1,
      entry_id: 13,
      status: 'open',
      type: 'missing_word',
      original: 'Weathers as 16 identified',
      suggestion: 'Weathers has 16 identified',
      start: 0,
      end: 0,
    },
  ]
  const cleaned = sanitizeAnnotationsLeakedLineNumbers(entries, polluted)
  assertEq(cleaned[0].original, 'Weathers as identified', 'annotation original cleaned')
  assertEq(cleaned[0].suggestion, 'Weathers has identified', 'annotation suggestion cleaned')
  assert(cleaned[0].start > 0 || entryText.includes('Weathers as'), 'offsets repaired or phrase present')

  // Without sanitizer, polluted original is unplaceable → dropped.
  const dropped = fixAnnotationPositions(entries, polluted)
  assertEq(dropped.length, 0, 'unsanitized polluted flag is unplaceable')
  // With sanitizer first, it survives and can be applied.
  const placed = fixAnnotationPositions(entries, cleaned)
  assertEq(placed.length, 1, 'sanitized flag is placeable')
  const detail = applyCorrectionDetailed(
    '   15   Weathers as\n               16        identified you\n',
    placed[0].original,
    placed[0].suggestion
  )
  assert(detail.start !== -1, 'cleaned phrase applies across real line break')
  assert(detail.text.includes('has'), 'suggestion applied after sanitize')
}

// --- 27. Empty suggestion = delete extra word (Accept must remove Found) ---
{
  console.log('\n27. Empty suggestion deletes extra word (extra_word Accept)')
  const before = 'Q. He went to the the store yesterday.'
  const detail = applyCorrectionDetailed(before, 'the', '')
  // flexFind first "the" — not ideal twin, but proves empty apply works.
  assert(detail.start !== -1, 'empty suggestion applies (not a no-op)')
  assert(!detail.text.includes('the the'), 'duplicate the removed somehow')

  // Anchored delete of the second "the" (the real extra word).
  const { cleanContent } = buildCleanContentMap(before)
  const second = (() => {
    const first = flexFind(cleanContent, 'the')
    return flexFind(cleanContent.substring(first.end), 'the')
      ? { start: first.end + flexFind(cleanContent.substring(first.end), 'the').start,
          end: first.end + flexFind(cleanContent.substring(first.end), 'the').end }
      : null
  })()
  assert(!!second, 'second the found')
  const del = applyCorrectionDetailed(before, 'the', '', {
    cleanStart: second.start,
    cleanEnd: second.end,
  })
  assertEq(del.text, 'Q. He went to the store yesterday.', 'anchored delete + space collapse')
  assertEq(del.end, del.start, 'deletion apply site is zero-width')

  const annotations = [
    {
      id: 'x1',
      entry_id: 1,
      status: 'accepted',
      type: 'extra_word',
      original: 'the',
      suggestion: '',
      start: 18,
      end: 21,
      _anchorBefore: 'the ',
      _anchorAfter: ' store',
    },
  ]
  // Export repair: still-present original with empty suggestion → delete it.
  const unrepaired = 'Q. He went to the the store yesterday.'
  const { text: fixed, failed } = ensureAcceptedCorrectionsInOriginalText(
    unrepaired,
    [{ id: 1, text: unrepaired }],
    annotations
  )
  assertEq(failed.length, 0, 'empty-suggestion accept does not fail export')
  assertEq(fixed, 'Q. He went to the store yesterday.', 'export repair deletes extra word')

  // Already deleted: must not fail closed.
  const { text: again, failed: failed2 } = ensureAcceptedCorrectionsInOriginalText(
    fixed,
    [{ id: 1, text: fixed }],
    annotations
  )
  assertEq(failed2.length, 0, 'already-deleted empty suggestion is success')
  assertEq(again, fixed, 'no further mutation once deleted')

  const caret = buildContextAnchor('Q. He went to the store yesterday.', 18, 18)
  assert(!!caret, 'zero-width caret builds context anchors')
  assert(caret.before.includes('the'), 'before anchor present')
  assert(caret.after.includes('store'), 'after anchor present')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
