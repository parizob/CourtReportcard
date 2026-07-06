#!/usr/bin/env node
/**
 * One-off generator for a large synthetic transcript used to calibrate
 * chunking (real Gemini timing/token data on a big document) and, later,
 * as the base for the cross-chunk-seeded-error large-doc test.
 *
 * Matches sample_transcript_30pages.txt's format (pure Q&A testimony,
 * no caption/header page): a continuous Q/A alternation that flows across
 * page breaks exactly like a real transcript (a question at the bottom of
 * one page is answered at the top of the next — nothing is ever dropped),
 * and lines short enough (<=100 chars, matching the real sample's max of
 * 102) that they don't soft-wrap in a normal viewer.
 *
 * Generates from a pool of varied Q&A pairs so content isn't literally
 * repeated (which would be unrealistic and could make extraction dedup
 * collapse things in a way real transcripts never do).
 *
 * Usage: node scripts/generate-large-transcript.mjs [targetPages]
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, 'test-transcripts')
const targetPages = parseInt(process.argv[2] || '180', 10)
const LINES_PER_PAGE = 25

// Combinatorial Q&A generator — real transcripts have almost no verbatim
// repeated lines, so a small fixed pool would get collapsed by the
// extraction pipeline's (correct, existing) exact-duplicate dedup and
// understate real token/timing cost. Templates + varying fill-ins produce
// thousands of text-unique lines instead. Kept short (see file header) so
// rendered lines stay within the real sample transcript's line-length range.
const NAMES = ['Whitfield', 'Alvarez', 'Nakamura', 'O\u2019Brien', 'Reyes', 'Kowalski', 'Douglas', 'Petrov', 'Singh', 'Bianchi', 'Okafor', 'Lindqvist', 'Delgado', 'Farris', 'Novak']
const PLACES = ['Springfield Ortho', 'Riverside Rehab', 'Mercy General', 'Lakeview Medical', 'Northside Urgent Care', 'Bayshore PT', 'Crestwood Imaging']
const STREETS = ['Oakwood Drive', 'Maple Street', 'Route 9', 'Harrison Avenue', 'Cedar Lane', 'Kingsley Blvd', 'Birchwood Court']
const TOPICS = ['the incident', 'your treatment', 'your job history', 'the vehicle damage', 'your medical history', 'the witness statements', 'your daily routine', 'your recovery']

function pick(arr, seed) {
  return arr[seed % arr.length]
}

// `ref` is derived directly from the running index (not modulo'd down), and
// every template includes it, so rendered text is guaranteed unique across
// the whole document regardless of how the smaller pools cycle.
function makeQA(n) {
  const name = pick(NAMES, n)
  const place = pick(PLACES, n * 7 + 3)
  const street = pick(STREETS, n * 5 + 1)
  const topic = pick(TOPICS, n * 3 + 2)
  const num = 2 + (n % 97)
  const ref = n + 1001
  const templates = [
    [`How many times did you visit ${place}, item ${ref}?`, `About ${num} times, with Dr. ${name}.`],
    [`Did you discuss ${topic} with anyone at ${place}?`, `Yes, briefly with a ${name}, ref ${ref}.`],
    [`How long have you lived on ${street}, entry ${ref}?`, `About ${num} years now.`],
    [`Were there follow-ups about ${topic}, item ${ref}?`, `Yes, ${num} follow-ups at ${place}.`],
    [`Who else discussed ${topic} with you, occasion ${ref}?`, `${name} was there too, ${num} minutes in.`],
    [`Did records from ${place} look accurate, item ${ref}?`, `Mostly, flagged one date with ${name}.`],
    [`How often did you use ${street}, ref ${ref}?`, `About ${num} times, give or take.`],
    [`Did anyone from ${place} follow up, item ${ref}?`, `Yes, ${name} called ${num} days later.`],
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

function pushPageMarker(bodyLines, pageNum) {
  bodyLines.push('')
  bodyLines.push(pageMarkerLine(pageNum))
  bodyLines.push('')
  bodyLines.push('')
}

const bodyLines = []
let pageNum = 1
pushPageMarker(bodyLines, pageNum)

// Continuous Q/A alternation across the whole document — a question landing
// on the last line of a page is answered on the first line of the next,
// exactly like sample_transcript_30pages.txt. Nothing is ever dropped.
const totalLines = targetPages * LINES_PER_PAGE
let qaIdx = 0
let pendingAnswer = null
let pageLineNum = 0

for (let i = 0; i < totalLines; i++) {
  if (pageLineNum === LINES_PER_PAGE) {
    pageNum++
    pushPageMarker(bodyLines, pageNum)
    pageLineNum = 0
  }
  pageLineNum++

  if (pendingAnswer === null) {
    const [q, a] = makeQA(qaIdx)
    qaIdx++
    pendingAnswer = a
    bodyLines.push(contentLine(pageLineNum, 'Q.  ', q))
  } else {
    bodyLines.push(contentLine(pageLineNum, 'A.  ', pendingAnswer))
    pendingAnswer = null
  }
  bodyLines.push('')
}

// Closing/certificate-style page, matching real transcript structure so the
// extraction prompt's "certificate only on last chunk" expectation has
// something real to key off during later chunk-aware prompt testing.
pageNum++
pushPageMarker(bodyLines, pageNum)
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
const maxLineLen = Math.max(...output.split('\n').map((l) => l.length))
console.log(`Wrote ${outPath} (${output.split('\n').length} lines, ${pageNum} pages, max line length ${maxLineLen})`)
