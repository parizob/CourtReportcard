#!/usr/bin/env node
/**
 * One-off generator for a large synthetic transcript used to calibrate
 * chunking (real Gemini timing/token data on a big document) and, later,
 * as the base for the cross-chunk-seeded-error large-doc test.
 *
 * Matches sample_transcript_30pages.txt's format (pure Q&A testimony,
 * no caption/header page) but generates a much longer body from a pool of
 * varied Q&A pairs so content isn't literally repeated (which would be
 * unrealistic and could make extraction dedup collapse things in a way
 * real transcripts never do).
 *
 * Usage: node scripts/generate-large-transcript.mjs [targetPages]
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, 'test-transcripts')
const targetPages = parseInt(process.argv[2] || '180', 10)

// Combinatorial Q&A generator — real transcripts have almost no verbatim
// repeated lines, so a small fixed pool would get collapsed by the
// extraction pipeline's (correct, existing) exact-duplicate dedup and
// understate real token/timing cost. Templates + varying fill-ins produce
// thousands of text-unique lines instead.
const NAMES = ['Whitfield', 'Alvarez', 'Nakamura', 'O\u2019Brien', 'Reyes', 'Kowalski', 'Douglas', 'Petrov', 'Singh', 'Bianchi', 'Okafor', 'Lindqvist', 'Delgado', 'Farris', 'Novak']
const PLACES = ['Springfield Orthopedics', 'Riverside Rehab', 'Mercy General', 'Lakeview Medical Group', 'Northside Urgent Care', 'Bayshore Physical Therapy', 'Crestwood Imaging Center']
const STREETS = ['Oakwood Drive', 'Maple Street', 'Route 9', 'Harrison Avenue', 'Cedar Lane', 'Kingsley Boulevard', 'Birchwood Court']
const TOPICS = ['the incident', 'your treatment', 'your employment history', 'the vehicle damage', 'your medical history', 'the witness statements', 'your daily routine', 'your recovery']

function pick(arr, seed) {
  return arr[seed % arr.length]
}

// `num` is derived directly from the running index (not modulo'd down), and
// every template includes it, so rendered text is guaranteed unique across
// the whole document regardless of how the smaller pools cycle.
function makeQA(n) {
  const name = pick(NAMES, n)
  const place = pick(PLACES, n * 7 + 3)
  const street = pick(STREETS, n * 5 + 1)
  const topic = pick(TOPICS, n * 3 + 2)
  const num = 2 + (n % 97)
  const ref = n + 1001 // guarantees uniqueness even if other fields align
  const templates = [
    [`Can you tell me about your visits to ${place} regarding ${topic}?`, `I saw Dr. ${name} there about ${num} times, item ${ref} on my list.`],
    [`Did you discuss ${topic} with anyone at ${place} around exhibit ${ref}?`, `Yes, briefly with a staff member whose last name was ${name}.`],
    [`How long have you lived on ${street}, as of entry ${ref}?`, `I believe it's been about ${num} years now.`],
    [`Were there any follow-up appointments related to ${topic}, entry ${ref}?`, `Yes, ${num} follow-ups were scheduled at ${place}.`],
    [`Who else was present when you discussed ${topic} on occasion ${ref}?`, `A colleague named ${name} was there as well, about ${num} minutes in.`],
    [`Did the records from ${place} reflect ${topic} accurately, referencing item ${ref}?`, `For the most part, though I flagged one date with Dr. ${name}.`],
    [`Approximately how many times did you travel down ${street} that month (ref. ${ref})?`, `Somewhere around ${num} times, give or take.`],
    [`Did anyone from ${place} ever follow up with you about ${topic}, item ${ref}?`, `Yes, someone named ${name} called about a week later, roughly ${num} days after.`],
  ]
  return pick(templates, n)
}

function pad(n, width) {
  return String(n).padStart(width, ' ')
}

// Matches pageCount.js's page-marker regex: 30+ leading spaces, 1-4 digit
// number, nothing else on the line.
function pageMarkerLine(pageNum) {
  return ' '.repeat(75) + pageNum
}

function contentLine(lineNum, speaker, text) {
  const numCol = pad(lineNum, 15 - 1) // matches source's right-justified line-number column
  return `${numCol}   ${speaker}   ${text}`
}

const bodyLines = []
let qaIdx = 0
let pageNum = 1

for (; pageNum <= targetPages; pageNum++) {
  bodyLines.push('')
  bodyLines.push(pageMarkerLine(pageNum))
  bodyLines.push('')
  bodyLines.push('')
  for (let lineNum = 1; lineNum <= 25; ) {
    const [q, a] = makeQA(qaIdx)
    qaIdx++
    bodyLines.push(contentLine(lineNum, 'Q.  ', q))
    bodyLines.push('')
    lineNum++
    if (lineNum > 25) break
    bodyLines.push(contentLine(lineNum, 'A.  ', a))
    bodyLines.push('')
    lineNum++
  }
}

// Closing/certificate-style page, matching real transcript structure so the
// extraction prompt's "certificate only on last chunk" expectation has
// something real to key off during later chunk-aware prompt testing.
bodyLines.push('')
bodyLines.push(pageMarkerLine(pageNum))
bodyLines.push('')
bodyLines.push('')
bodyLines.push(contentLine(1, 'MR. PARKER:  ', 'Nothing further. Thank you, Dr. Frain.'))
bodyLines.push('')
bodyLines.push(contentLine(2, 'THE WITNESS: ', "You're welcome."))
bodyLines.push('')
bodyLines.push(contentLine(4, '     ', '(Deposition concluded at 11:32 a.m.)'))
bodyLines.push('')
bodyLines.push(contentLine(6, '     ', 'CERTIFICATE OF REPORTER'))
bodyLines.push('')
bodyLines.push(contentLine(8, '     ', 'I, Zoe F. Zimmerman, FPR, certify that the foregoing is a'))
bodyLines.push(contentLine(9, '     ', 'true and accurate transcript of the proceedings.'))

const output = bodyLines.join('\n')
const outPath = join(DIR, `large_synthetic_${targetPages}pages.txt`)
writeFileSync(outPath, output)
console.log(`Wrote ${outPath} (${output.split('\n').length} lines, ${pageNum} pages)`)
