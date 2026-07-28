#!/usr/bin/env node
/**
 * Cross-chunk seam fixture.
 *
 * Places setup|error so production findNearestSplitPoint lands on error Q.
 * Uses non-turn whitespace padding (no new Q/A boundaries) to nudge the
 * target onto the error turn without creating competing split candidates.
 *
 * Usage: node scripts/seed-chunk-seam-transcript.mjs
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  splitIntoChunks,
  extractTrailingContext,
  findNearestSplitPoint,
  findSpeakerTurnBoundaries,
} from '../src/lib/chunkSplit.js'
import { countPages } from '../src/lib/pageCount.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, 'test-transcripts')
const OUT_TXT = join(DIR, 'transcript_08_chunk_seams.txt')
const OUT_MANIFEST = join(DIR, 'transcript_08_chunk_seams.manifest.json')

const PAGES_PER_CHUNK = 15
const LINES_PER_PAGE = 25
const TOTAL_PAGES = 32

const SEAMS = [
  {
    id: 'vargas',
    setupQ: 'Who was the only nurse on the floor that night, for the record?',
    setupA: 'Mrs. Elena Vargas. She was the charge nurse.',
    errorQ: 'And did their check on Mr. Whitfield after midnight?',
    errorA: 'Yes, there checked twice.',
    errorQ2: 'What time did their first check happen?',
    errorA2: 'Around twelve fifteen.',
    setupMarker: 'Elena Vargas',
    seeds: [
      { match: 'did their check', type: 'homophone', suggest: 'she', note: 'Vargas — their→she' },
      { match: 'there checked twice', type: 'homophone', suggest: 'she', note: 'Vargas — there→she' },
      { match: 'did their first check', type: 'homophone', suggest: 'she', note: 'Vargas — their→she' },
    ],
  },
  {
    id: 'envelope',
    setupQ: 'Where exactly did you leave the exhibit envelope?',
    setupA: 'Over there on counsel table, next to the water pitcher.',
    errorQ: "So the envelope was still they're when you returned?",
    errorA: "Yes, they're on the table.",
    errorQ2: "Did anyone move they're envelope overnight?",
    errorA2: 'No, it stayed put.',
    setupMarker: 'counsel table',
    seeds: [
      { match: "still they're when", type: 'homophone', suggest: 'there', note: '"over there" — they\'re→there' },
      { match: "they're on the table", type: 'homophone', suggest: 'there', note: 'location antecedent' },
      { match: "move they're envelope", type: 'homophone', suggest: 'their', note: 'possessive their' },
    ],
  },
]

function pageHeader(n) {
  return `\n\n${' '.repeat(75)}${n}\n\n\n`
}
function turn(lineNo, speaker, body) {
  return `${String(lineNo).padStart(14, ' ')}   ${speaker}     ${body}\n\n`
}
function makeBlock(seam) {
  return (
    turn(1, 'Q.', seam.setupQ) +
    turn(2, 'A.', seam.setupA) +
    turn(3, 'Q.', seam.errorQ) +
    turn(4, 'A.', seam.errorA) +
    turn(5, 'Q.', seam.errorQ2) +
    turn(6, 'A.', seam.errorA2)
  )
}
function errMarker(seam) {
  return `Q.     ${seam.errorQ}`
}

function buildBase() {
  let out = ''
  let n = 0
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    out += pageHeader(p)
    let line = 1
    while (line <= LINES_PER_PAGE) {
      n++
      out += turn(line++, 'Q.', `On page ${p} line ${line}, item ${1000 + n}, what happened next?`)
      if (line > LINES_PER_PAGE) break
      out += turn(
        line++,
        'A.',
        `Nothing unusual on page ${p}, ref ${1000 + n}, about ${(p + n) % 17} minutes.`,
      )
    }
  }
  return out
}

function productionTarget(text, seamIndex) {
  const pages = countPages(text)
  return Math.round(seamIndex * PAGES_PER_CHUNK * (text.length / pages))
}

function stripSeam(text, seam) {
  if (!text.includes(seam.setupQ)) return text
  const i = text.indexOf(seam.setupQ)
  const j = text.indexOf(seam.errorA2, i)
  if (i < 0 || j < 0) return text
  const b = findSpeakerTurnBoundaries(text)
  let setupTurn = b.filter((x) => x <= i).pop()
  const endTurn = b.find((x) => x > j) ?? j + seam.errorA2.length + 10
  // Also drop non-turn newline pad immediately before the setup turn
  while (setupTurn > 0 && text[setupTurn - 1] === '\n') setupTurn--
  return text.slice(0, setupTurn) + text.slice(endTurn)
}

function assemble(text, insertAt, windowEnd, block, padChars) {
  // Non-turn pad: blank lines only (no Q./A.), so they never win findNearestSplitPoint
  const pad = padChars > 0 ? '\n'.repeat(padChars) : ''
  return text.slice(0, insertAt) + pad + block + text.slice(windowEnd)
}

/** Line-start offset of the error Q turn (what findNearestSplitPoint uses). */
function errorTurnStart(text, seam) {
  const qAt = text.indexOf(errMarker(seam))
  if (qAt < 0) return -1
  const bounds = findSpeakerTurnBoundaries(text)
  const start = bounds.filter((b) => b <= qAt).pop()
  return start ?? -1
}

function lockSeam(baseText, seamIndex, seam) {
  const block = makeBlock(seam)
  const marker = errMarker(seam)
  // Error Q is the 3rd turn in the block (setup Q, setup A, error Q)
  const errInBlock = findSpeakerTurnBoundaries(block)[2] ?? block.indexOf(marker)
  let text = stripSeam(baseText, seam)

  const bounds = findSpeakerTurnBoundaries(text)
  const t0 = productionTarget(text, seamIndex)
  const idealInsert = t0 - errInBlock
  let insertAt = bounds.reduce((best, b) =>
    Math.abs(b - idealInsert) < Math.abs(best - idealInsert) ? b : best,
  )

  let best = null
  for (let shift = 0; shift < 40; shift++) {
    const candidates = bounds.filter((b) => Math.abs(b - insertAt) < 2500)
    if (!candidates.includes(insertAt)) candidates.push(insertAt)

    for (const at of candidates) {
      const win =
        bounds.filter((b) => b > at)[5] ?? Math.min(text.length, at + block.length)

      const probe0 = assemble(text, at, win, block, 0)
      const err0 = errorTurnStart(probe0, seam)
      const pages = countPages(probe0)
      const alpha = (seamIndex * PAGES_PER_CHUNK) / pages
      const tProbe = productionTarget(probe0, seamIndex)
      let pad = Math.round((tProbe - err0) / (1 - alpha))
      pad = Math.max(0, Math.min(8000, pad))

      for (let p = Math.max(0, pad - 80); p <= pad + 80; p += 1) {
        const assembled = assemble(text, at, win, block, p)
        const errAt = errorTurnStart(assembled, seam)
        const t = productionTarget(assembled, seamIndex)
        const split = findNearestSplitPoint(assembled, t)
        const dist = Math.abs(split - errAt)
        if (dist === 0) {
          console.log(`Seam ${seamIndex} (${seam.id}): locked (pad=${p}, at=${at})`)
          return assembled
        }
        if (!best || dist < best.dist) best = { dist, t, errAt, split, p, at }
      }
    }

    const earlier = bounds.filter((b) => b < insertAt)
    if (!earlier.length) break
    insertAt = earlier[Math.max(0, earlier.length - 1 - shift)]
  }

  console.error('Best near-miss', best)
  throw new Error(`Could not lock seam ${seamIndex}`)
}

let text = buildBase()
// Higher-index first: later pads change total length (and earlier targets).
for (let i = SEAMS.length - 1; i >= 0; i--) {
  text = lockSeam(text, i + 1, SEAMS[i])
}

function seamOk(text, i) {
  const chunks = splitIntoChunks(text, PAGES_PER_CHUNK)
  if (chunks.length <= i + 1) return false
  const trail = extractTrailingContext(chunks[i], 2)
  const head = chunks[i + 1].slice(0, 800)
  return (
    trail.includes(SEAMS[i].setupMarker) &&
    !trail.includes(SEAMS[i].errorQ.slice(0, 18)) &&
    head.includes(SEAMS[i].errorQ.slice(0, 22))
  )
}

for (let round = 0; round < 6; round++) {
  let all = true
  for (let i = 0; i < SEAMS.length; i++) {
    if (!seamOk(text, i)) {
      all = false
      console.log(`Round ${round}: re-lock seam ${i + 1}`)
      text = lockSeam(text, i + 1, SEAMS[i])
    }
  }
  if (all) break
  if (round === 5) {
    console.error('Could not converge all seams')
    process.exit(1)
  }
}

const pages = countPages(text)
const chunks = splitIntoChunks(text, PAGES_PER_CHUNK)
console.log(`pages=${pages} chunks=${chunks.length}`)

let ok = true
for (let i = 0; i < Math.min(chunks.length - 1, SEAMS.length); i++) {
  const seam = SEAMS[i]
  const trail = extractTrailingContext(chunks[i], 2)
  const head = chunks[i + 1].slice(0, 800)
  const setupOk = trail.includes(seam.setupMarker) && !trail.includes(seam.errorQ.slice(0, 18))
  const errorOk = head.includes(seam.errorQ.slice(0, 22))
  console.log(`--- seam ${i + 1} ---`)
  console.log('TRAIL:', trail.replace(/\s+/g, ' ').slice(0, 240))
  console.log('HEAD:', head.replace(/\s+/g, ' ').slice(0, 240))
  console.log('setup_only_in_trail=', setupOk, 'error_in_head=', errorOk)
  if (!setupOk || !errorOk) ok = false
}

if (!ok) {
  console.error('FAILED verification')
  process.exit(1)
}

const seeds = []
for (let i = 0; i < SEAMS.length; i++) {
  for (const s of SEAMS[i].seeds) {
    seeds.push({
      id: seeds.length + 1,
      match: s.match,
      type: s.type,
      expected_severity: 'critical',
      expected_suggestion_contains: s.suggest,
      note: `seam ${i + 1}: ${s.note}`,
      requires_previous_context: true,
      setup_in_previous_chunk: `${SEAMS[i].setupQ} / ${SEAMS[i].setupA}`,
    })
  }
}

writeFileSync(OUT_TXT, text)
writeFileSync(
  OUT_MANIFEST,
  JSON.stringify(
    {
      transcript: 'transcript_08_chunk_seams.txt',
      description:
        'Cross-chunk seam stress. Production split lands on error Q; prior-chunk trailing context (2 turns) holds the antecedent.',
      pages,
      pages_per_chunk: PAGES_PER_CHUNK,
      num_chunks: chunks.length,
      seeded_errors: seeds,
      false_positive_traps: [
        { text: 'Mrs. Elena Vargas', note: 'Correct setup name' },
        { text: 'counsel table', note: 'Correct setup phrase' },
      ],
    },
    null,
    2,
  ) + '\n',
)
console.log('Wrote', OUT_TXT, 'seeds=', seeds.length)
