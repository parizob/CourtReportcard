/**
 * Entry-text CAT line-number gutter cleanup + LN-only annotation drop.
 *   npm run test:entry-gutter
 *
 * Guards Natalie Bourque-class leaks ("\\n10  depending") without mangling
 * sample_transcript / exhibit indexes / real numbers.
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  dropLineNumberOnlyAnnotations,
  isLineNumberOnlyAnnotation,
  sanitizeAnnotationsLeakedLineNumbers,
  stripEntriesLineNumberGutters,
  stripEntryTextLineNumberGutters,
} from '../src/lib/gemini.js'

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

console.log('stripEntryTextLineNumberGutters — bourque wrap leak')
{
  const dirty =
    "Three to four weeks.  But it's different for -- \n10  depending on the scheduling manager at the time."
  const clean = stripEntryTextLineNumberGutters(dirty)
  assert(!/\n\s*\d{1,2}\s{2,}/.test(clean), 'removes wrap-line gutter 10')
  assert(clean.includes('depending on the scheduling manager'), 'keeps continuation words')
  assert(clean.includes("for --"), 'keeps first-line text')

  const high =
    'anything that you said to counsel is privileged.  And \n26  you should not talk about anything that you discussed \n27  with counsel.'
  const highClean = stripEntryTextLineNumberGutters(high)
  assert(!/\n\s*2[6-9]\s{2,}/.test(highClean), 'strips lines 26–27 (above classic 25)')
  assert(highClean.includes('with counsel'), 'keeps words after high gutters')
}

console.log('stripEntryTextLineNumberGutters — preserves real content')
{
  assert(
    stripEntryTextLineNumberGutters('16 Yale Circle') === '16 Yale Circle',
    'address with single space after 16 untouched',
  )
  assert(
    stripEntryTextLineNumberGutters('5th grade') === '5th grade',
    'ordinal 5th untouched',
  )
  assert(
    stripEntryTextLineNumberGutters('She was 12 years old.') === 'She was 12 years old.',
    'inline age untouched',
  )
  assert(
    stripEntryTextLineNumberGutters('No. 3:24-cv-06994-EMC-LJC') === 'No. 3:24-cv-06994-EMC-LJC',
    'case number untouched',
  )
}

console.log('stripEntryTextLineNumberGutters — INDEX/EXHIBITS skipped via speaker')
{
  const exhibit =
    'EXHIBIT INDEX\nMAR \n1      Class Action Complaint                           40\n2      Amended Class Action Complaint                   44'
  assert(
    stripEntryTextLineNumberGutters(exhibit, { speaker: 'EXHIBITS' }) === exhibit,
    'EXHIBITS speaker keeps exhibit numbers',
  )
  assert(
    stripEntryTextLineNumberGutters(exhibit, { speaker: 'INDEX' }) === exhibit,
    'INDEX speaker keeps TOC numbers',
  )
  // Without skip, exhibit "1      " would look like a CAT gutter — speaker skip is required
  const strippedAsTestimony = stripEntryTextLineNumberGutters(exhibit, { speaker: 'A' })
  assert(
    !strippedAsTestimony.includes('1      Class'),
    'non-INDEX speaker would strip leading 1–25 gutters (documents risk)',
  )
}

console.log('stripEntryTextLineNumberGutters — timestamp gutters')
{
  const dirty = 'Exhibit\n08:03:24 22          Number 1 was marked.'
  const clean = stripEntryTextLineNumberGutters(dirty)
  assert(clean.includes('Number 1 was marked'), 'keeps words after timestamp gutter')
  assert(!/08:03:24/.test(clean), 'strips timestamp+line gutter')
}

console.log('stripEntriesLineNumberGutters')
{
  const entries = [
    { id: 1, speaker: 'A', text: 'Hello.\n12  world' },
    { id: 2, speaker: 'EXHIBITS', text: '1      Complaint' },
    { id: 3, speaker: 'Q', text: 'How long?\n19  long was it?' },
  ]
  const out = stripEntriesLineNumberGutters(entries)
  assert(out[0].text === 'Hello.\nworld', 'strips A entry gutter')
  assert(out[1].text === '1      Complaint', 'preserves EXHIBITS')
  assert(out[2].text === 'How long?\nlong was it?', 'strips Q entry gutter')
  assert(entries[0].text.includes('12'), 'does not mutate input entries')
}

console.log('isLineNumberOnlyAnnotation / dropLineNumberOnlyAnnotations')
{
  assert(
    isLineNumberOnlyAnnotation({
      original: 'was \n12  when',
      suggestion: 'was \nwhen',
      type: 'extra_word',
      status: 'open',
    }),
    'classic bourque LN delete is LN-only',
  )
  assert(
    !isLineNumberOnlyAnnotation({
      original: 'go just going',
      suggestion: 'just going',
      type: 'extra_word',
      status: 'open',
    }),
    'real extra_word is not LN-only',
  )
  assert(
    !isLineNumberOnlyAnnotation({
      original: 'was \n12  when',
      suggestion: 'was \nwhen',
      type: 'extra_word',
      status: 'accepted',
    }),
    'accepted LN-only is left alone',
  )
  assert(
    !isLineNumberOnlyAnnotation({
      original: 'travelling',
      suggestion: 'traveling',
      type: 'spelling',
      status: 'open',
    }),
    'spelling fix is not LN-only',
  )
  assert(
    isLineNumberOnlyAnnotation({
      original: 'weeks in',
      suggestion: 'weeks \nin',
      type: 'extra_word',
      status: 'open',
      explanation:
        "The line number '17' has been erroneously included in the transcript text.",
    }),
    'post-sanitize residue (weeks in) still detected via explanation',
  )
  assert(
    !isLineNumberOnlyAnnotation({
      original: 'weeks in',
      suggestion: 'weeks out',
      type: 'extra_word',
      status: 'open',
      explanation:
        "The line number '17' has been erroneously included in the transcript text.",
    }),
    'explanation alone does not drop a real word change',
  )

  const anns = [
    { id: 1, original: 'was \n12  when', suggestion: 'was \nwhen', type: 'extra_word', status: 'open' },
    { id: 2, original: 'travelling', suggestion: 'traveling', type: 'spelling', status: 'open' },
    { id: 3, original: '-- \n10  depending', suggestion: '-- \ndepending', type: 'extra_word', status: 'accepted' },
  ]
  const kept = dropLineNumberOnlyAnnotations(anns)
  assert(kept.length === 2, 'drops one open LN-only, keeps spelling + accepted')
  assert(kept.every((a) => a.id !== 1), 'dropped id 1')
  assert(kept.some((a) => a.id === 3), 'keeps accepted LN-only')
}

console.log('bourque fixture (if present)')
{
  const path = join(__dirname, '.repro/natalie-722/extracted.json')
  if (!existsSync(path)) {
    console.log('  skip  (no scripts/.repro/natalie-722/extracted.json)')
  } else {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    const cleaned = stripEntriesLineNumberGutters(data.entries || [])
    const leakBefore = (data.entries || []).filter((e) =>
      /\n\s*\d{1,2}\s{2,}[A-Za-z]/.test(e.text || ''),
    ).length
    const leakAfter = cleaned.filter((e) =>
      /\n\s*\d{1,2}\s{2,}[A-Za-z]/.test(e.text || ''),
    ).length
    // INDEX/EXHIBITS may still match the regex (skipped on purpose)
    const testimonyLeakAfter = cleaned.filter((e) => {
      const sp = (e.speaker || '').toUpperCase()
      if (sp === 'INDEX' || sp === 'EXHIBITS') return false
      return /\n\s*\d{1,2}\s{2,}[A-Za-z]/.test(e.text || '')
    }).length
    assert(leakBefore > 40, `fixture has many leaks before (${leakBefore})`)
    assert(testimonyLeakAfter === 0, `testimony/caption leaks cleared (${testimonyLeakAfter})`)

    const classic = (data.annotations || []).filter(
      (a) => a.type === 'extra_word' && /\n\s*\d{1,2}\s+/.test(a.original || ''),
    )
    const classicOpen = classic.filter((a) => a.status !== 'accepted' && a.status !== 'ignored')
    const afterDrop = dropLineNumberOnlyAnnotations(data.annotations || [])
    const classicOpenLeft = afterDrop.filter(
      (a) =>
        a.type === 'extra_word' &&
        /\n\s*\d{1,2}\s+/.test(a.original || '') &&
        a.status !== 'accepted' &&
        a.status !== 'ignored',
    )
    assert(classic.length >= 40, `fixture has classic LN anns (${classic.length})`)
    assert(classicOpen.length >= 1, `fixture has open LN anns (${classicOpen.length})`)
    assert(classicOpenLeft.length === 0, 'all classic open LN anns dropped')
    assert(
      afterDrop.length === (data.annotations || []).length - classicOpen.length,
      'only open LN-only anns removed (ignored/accepted kept)',
    )
    assert(
      (data.originalText || '').includes('10  depending'),
      'originalText left unchanged on fixture object',
    )

    // Residue after sanitize: Found becomes "weeks in" but explanation still
    // admits it was a line-number flag — must still drop.
    const weeks = (data.annotations || []).find(
      (a) => a.status === 'open' && /weeks/.test(a.original || '') && /\n\s*\d{1,2}\s+in/.test(a.original || ''),
    )
    if (weeks) {
      const entries = stripEntriesLineNumberGutters(data.entries || [])
      const afterSanitizeFirst = dropLineNumberOnlyAnnotations(
        sanitizeAnnotationsLeakedLineNumbers(entries, [weeks]),
      )
      assert(afterSanitizeFirst.length === 0, 'sanitize-then-drop still removes weeks/in via residue rule')
      const dropFirst = sanitizeAnnotationsLeakedLineNumbers(
        entries,
        dropLineNumberOnlyAnnotations([weeks]),
      )
      assert(dropFirst.length === 0, 'drop-then-sanitize removes weeks/in LN flag')
    }
  }
}

console.log('sample_transcript.txt — gutter strip on raw lines is safe for content words')
{
  const samplePath = join(__dirname, 'test-transcripts/sample_transcript.txt')
  const sample = readFileSync(samplePath, 'utf8')
  // Simulate a poorly extracted wrap (content + leaked gutter), not full-file extract
  const fakeEntry =
    'Q. What is your name?\n' +
    '12  A. My name is Julianne Frain.'
  // Our strip removes leading gutter on line 2 but keeps "A. My name..."
  const cleaned = stripEntryTextLineNumberGutters(fakeEntry)
  assert(cleaned.includes('Julianne Frain'), 'sample-style name preserved')
  assert(!cleaned.includes('\n12  '), 'sample-style wrap gutter removed')

  // Full sample as a single fake entry with speaker HEADING must not erase
  // case numbers / times when they are not CAT gutters on their own lines.
  const asHeading = stripEntryTextLineNumberGutters(
    'CASE NO.: 24-CA-681\nDATE TAKEN:    Monday, March 30, 2026\nTIME:          10:08 a.m.',
    { speaker: 'HEADING' },
  )
  assert(asHeading.includes('24-CA-681'), 'case no preserved')
  assert(asHeading.includes('10:08 a.m.'), 'clock time preserved')

  // Spot-check: stripping every raw sample line via the same helper should not
  // delete known proper nouns from content after a real gutter.
  const lines = sample.split(/\n/)
  let contentLines = 0
  for (const line of lines) {
    const stripped = stripEntryTextLineNumberGutters(line)
    if (/FRAIN|WEATHERS|ROOFLINE|MARION/i.test(line)) {
      contentLines++
      assert(
        /FRAIN|WEATHERS|ROOFLINE|MARION/i.test(stripped),
        `proper noun survives strip on: ${JSON.stringify(line.slice(0, 60))}`,
      )
    }
  }
  assert(contentLines >= 3, `checked proper-noun lines (${contentLines})`)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
