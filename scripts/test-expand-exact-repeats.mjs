/**
 * Exact same-entry repeat expansion (Page 3 / Page 3).
 *   npm run test:expand-repeats
 */
import {
  buildUniqueContextAnchor,
  expandExactRepeatAnnotations,
  locateAtAnchorStrict,
} from '../src/lib/gemini.js'

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

console.log('expand two Page 3s in one entry')
{
  const entry = {
    id: 541,
    speaker: 'Q',
    text:
      'Looking at Page 3, according to the numbers. At the heading at the top of Page 3, the first one says hi.',
  }
  const first = entry.text.indexOf('Page 3')
  const anns = [
    {
      id: 1,
      entry_id: 541,
      type: 'capitalization',
      severity: 'warning',
      original: 'Page 3',
      suggestion: 'page 3',
      explanation: 'page should be lowercase',
      status: 'open',
      start: first,
      end: first + 'Page 3'.length,
      confidence: 0.9,
    },
  ]
  const out = expandExactRepeatAnnotations([entry], anns)
  assert(out.length === 2, `expands to 2 (got ${out.length})`)
  const starts = out.map((a) => a.start).sort((a, b) => a - b)
  assert(starts[0] === first, 'keeps first hit')
  assert(starts[1] === entry.text.indexOf('Page 3', first + 1), 'adds second hit')
  assert(out.every((a) => a.original === 'Page 3' && a.suggestion === 'page 3'), 'same fix')
  assert(out[0].id !== out[1].id, 'distinct ids')

  // Unique anchors so locate does not flip-flop
  const withAnchors = out.map((a) => {
    const anchor = buildUniqueContextAnchor(entry.text, a.start, a.end, {
      needle: 'Page 3',
      uniqueIn: entry.text,
    })
    return { ...a, _anchorBefore: anchor.before, _anchorAfter: anchor.after }
  })
  const h0 = locateAtAnchorStrict(entry.text, withAnchors[0], 'Page 3')
  const h1 = locateAtAnchorStrict(entry.text, withAnchors[1], 'Page 3')
  assert(!!h0 && !!h1, 'both anchors locate')
  assert(h0.start === withAnchors[0].start, 'anchor 0 pins first Page 3')
  assert(h1.start === withAnchors[1].start, 'anchor 1 pins second Page 3')
  assert(h0.start !== h1.start, 'anchors do not collapse to one span')
}

console.log('no expand when only one occurrence')
{
  const entry = { id: 1, text: 'Look at Page 4 please.' }
  const anns = [
    {
      id: 1,
      entry_id: 1,
      type: 'capitalization',
      original: 'Page 4',
      suggestion: 'page 4',
      status: 'open',
      start: entry.text.indexOf('Page 4'),
      end: entry.text.indexOf('Page 4') + 6,
    },
  ]
  const out = expandExactRepeatAnnotations([entry], anns)
  assert(out.length === 1, 'single occurrence unchanged')
  assert(out === anns || out[0].start === anns[0].start, 'same or equivalent')
}

console.log('two entries each already flagged — no duplicate clones')
{
  const entries = [
    { id: 1, text: 'Can you look at Page 4, according to the page' },
    { id: 2, text: 'Exactly the last sentence on Page 4. Right there,' },
  ]
  const anns = [
    {
      id: 1,
      entry_id: 1,
      type: 'capitalization',
      original: 'Page 4',
      suggestion: 'page 4',
      status: 'open',
      start: entries[0].text.indexOf('Page 4'),
      end: entries[0].text.indexOf('Page 4') + 6,
    },
    {
      id: 2,
      entry_id: 2,
      type: 'capitalization',
      original: 'Page 4',
      suggestion: 'page 4',
      status: 'open',
      start: entries[1].text.indexOf('Page 4'),
      end: entries[1].text.indexOf('Page 4') + 6,
    },
  ]
  const out = expandExactRepeatAnnotations(entries, anns)
  assert(out.length === 2, 'still two anns (one per entry, already covered)')
}

console.log('document-wide: one Louis Hospital seed → clone on later entry')
{
  const entries = [
    { id: 10, text: 'I was treated at Louis Hospital in May.' },
    { id: 20, text: 'Records from Louis Hospital arrived late.' },
    { id: 30, text: 'No further visits to Louis Hospital after that.' },
  ]
  const anns = [
    {
      id: 1,
      entry_id: 10,
      type: 'spelling',
      original: 'Louis Hospital',
      suggestion: 'Louise Hospital',
      status: 'open',
      start: entries[0].text.indexOf('Louis Hospital'),
      end: entries[0].text.indexOf('Louis Hospital') + 'Louis Hospital'.length,
      explanation: 'Hospital name is Louise, not Louis.',
    },
  ]
  const out = expandExactRepeatAnnotations(entries, anns)
  assert(out.length === 3, `expands across entries (got ${out.length})`)
  const byEntry = new Map(out.map((a) => [a.entry_id, a]))
  assert(byEntry.has(10) && byEntry.has(20) && byEntry.has(30), 'one card per entry')
  assert(
    out.every((a) => a.original === 'Louis Hospital' && a.suggestion === 'Louise Hospital' && a.status === 'open'),
    'same fix, all open',
  )
  assert(new Set(out.map((a) => a.id)).size === 3, 'distinct ids')
}

console.log('guards')
{
  const entry = {
    id: 1,
    text: 'the cat and the dog and the bird.',
  }
  const anns = [
    {
      id: 1,
      entry_id: 1,
      type: 'context',
      original: 'the',
      suggestion: 'a',
      status: 'open',
      start: 0,
      end: 3,
    },
  ]
  assert(
    expandExactRepeatAnnotations([entry], anns).length === 1,
    'does not expand context/short the',
  )

  const spellEntry = {
    id: 2,
    text: 'travelling now and travelling later.',
  }
  const spellAnns = [
    {
      id: 1,
      entry_id: 2,
      type: 'spelling',
      original: 'travelling',
      suggestion: 'traveling',
      status: 'open',
      start: 0,
      end: 10,
    },
  ]
  assert(
    expandExactRepeatAnnotations([spellEntry], spellAnns).length === 2,
    'expands spelling repeats',
  )

  const accepted = [
    {
      id: 1,
      entry_id: 2,
      type: 'spelling',
      original: 'travelling',
      suggestion: 'traveling',
      status: 'accepted',
      start: 0,
      end: 10,
    },
  ]
  assert(
    expandExactRepeatAnnotations([spellEntry], accepted).length === 1,
    'does not expand accepted',
  )
}

console.log('bourque-shaped Page 3 fixture')
{
  const entry = {
    id: 541,
    text:
      'Looking at Page 3, according to the numbers on the bottom of the page.  At the heading at the top of Page 3, the first one there says, "Supplemental Answer to Interrogatory No. 3."',
  }
  const first = entry.text.indexOf('Page 3')
  const anns = [
    {
      id: 1,
      entry_id: 541,
      type: 'capitalization',
      original: 'Page 3',
      suggestion: 'page 3',
      status: 'open',
      start: first,
      end: first + 6,
      explanation: 'The word "page" should be lowercase when it precedes a number in a reference.',
    },
  ]
  const out = expandExactRepeatAnnotations([entry], anns)
  assert(out.length === 2, 'bourque Page 3 expands')
  const seconds = [...entry.text.matchAll(/Page 3/g)].map((m) => m.index)
  assert(
    out.map((a) => a.start).sort((a, b) => a - b).join(',') === seconds.join(','),
    'covers both Page 3 offsets',
  )
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
