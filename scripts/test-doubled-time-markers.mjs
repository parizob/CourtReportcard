/**
 * Unit tests for deterministic doubled a.m./p.m. detection (no Gemini).
 */
import assert from 'assert'
import {
  detectDoubledTimeMarkers,
  mergeDoubledTimeMarkerAnnotations,
} from '../src/lib/gemini.js'

const entries = [
  { id: 1, speaker: 'THE COURT', text: 'We will reconvene at 12:45 p.m.' },
  { id: 2, speaker: 'THE CLERK', text: 'The clerk wrote p.m. p.m. on the stamp.' },
  { id: 3, speaker: 'Q', text: 'Was that a.m. a.m. or something else?' },
  { id: 4, speaker: 'A', text: 'No doubled marker here, just 9 a.m. sharp.' },
  { id: 5, speaker: 'A', text: 'Stamp says pm pm by mistake.' },
  { id: 6, speaker: 'A', text: 'Also a.m a.m without final periods.' },
  { id: 7, speaker: 'A', text: 'And am. am. with trailing-only periods.' },
]

const detected = detectDoubledTimeMarkers(entries)
assert.strictEqual(detected.length, 5, `expected 5 doubles, got ${detected.length}: ${JSON.stringify(detected.map((d) => d.original))}`)

const byId = Object.fromEntries(detected.map((d) => [d.entry_id, d]))
assert.strictEqual(byId[2].original, 'p.m. p.m.')
assert.strictEqual(byId[2].suggestion, 'p.m.')
assert.strictEqual(byId[2].type, 'extra_word')
assert.strictEqual(byId[2].severity, 'critical')
assert.strictEqual(byId[3].original, 'a.m. a.m.')
assert.strictEqual(byId[3].suggestion, 'a.m.')
assert.strictEqual(byId[5].original, 'pm pm')
assert.strictEqual(byId[5].suggestion, 'pm')
assert.strictEqual(byId[6].original, 'a.m a.m')
assert.strictEqual(byId[6].suggestion, 'a.m')
assert.strictEqual(byId[7].original, 'am. am.')
assert.strictEqual(byId[7].suggestion, 'am.')

// Single marker must not flag.
assert.strictEqual(
  detectDoubledTimeMarkers([{ id: 1, text: '12:45 p.m. next to an exhibit.' }]).length,
  0,
)
assert.strictEqual(
  detectDoubledTimeMarkers([{ id: 1, text: 'Arrive at 9 am sharp.' }]).length,
  0,
)
// Different markers side by side are not a double of the same token.
assert.strictEqual(
  detectDoubledTimeMarkers([{ id: 1, text: 'Was it a.m. p.m. unclear.' }]).length,
  0,
)

const merged = mergeDoubledTimeMarkerAnnotations(entries, [])
assert.strictEqual(merged.length, 5)

const already = [
  {
    id: 1,
    entry_id: 2,
    type: 'extra_word',
    original: 'p.m. p.m.',
    suggestion: 'p.m.',
    start: 16,
    end: 25,
  },
]
const deduped = mergeDoubledTimeMarkerAnnotations(entries, already)
assert.strictEqual(deduped.length, 5, 'keep existing p.m. double + add the other four')
assert.ok(deduped.some((a) => a.original === 'a.m. a.m.'))
assert.strictEqual(
  deduped.filter((a) => /p\.m\.\s+p\.m\./i.test(a.original)).length,
  1,
  'must not duplicate p.m. p.m.',
)

console.log('test-doubled-time-markers: ok')
