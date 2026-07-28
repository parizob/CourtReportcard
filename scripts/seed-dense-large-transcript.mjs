#!/usr/bin/env node
/**
 * Build a densely seeded 50-page transcript for chunk + proofread-batch stress.
 *
 * Discovers unique answer/question lines in large_synthetic_50pages.txt and
 * applies controlled mutations so we hit ~100 seeded errors (including near
 * mid-document chunk seams).
 *
 * Usage: node scripts/seed-dense-large-transcript.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, 'test-transcripts')
const SRC = join(DIR, 'large_synthetic_50pages.txt')
const OUT_TXT = join(DIR, 'transcript_07_dense_50pages.txt')
const OUT_MANIFEST = join(DIR, 'transcript_07_dense_50pages.manifest.json')

const TARGET = 100
let text = readFileSync(SRC, 'utf8')

/** @type {any[]} */
const seeded = []
let nextId = 1

function applyOnce(from, to, meta) {
  const idx = text.indexOf(from)
  if (idx === -1) return false
  if (text.indexOf(from, idx + 1) !== -1) return false
  text = text.slice(0, idx) + to + text.slice(idx + from.length)
  seeded.push({
    id: nextId++,
    match: to,
    type: meta.type,
    expected_severity: meta.severity || 'critical',
    expected_suggestion_contains: meta.suggest,
    note: meta.note || '',
  })
  return true
}

/** Collect unique occurrences of a regex; each match[0] must be unique in file. */
function uniqueMatches(re) {
  const found = []
  const seen = new Set()
  for (const m of text.matchAll(re)) {
    const s = m[0]
    if (seen.has(s)) continue
    // verify uniqueness in full text
    if (text.indexOf(s) !== text.lastIndexOf(s)) continue
    seen.add(s)
    found.push(s)
  }
  return found
}

function takeEvery(arr, n, start = 0) {
  const out = []
  for (let i = start; i < arr.length && out.length < n; i++) out.push(arr[i])
  return out
}

// ── Mutation families ────────────────────────────────────────────────────────

// 1) was there too → was their too
{
  const sites = uniqueMatches(/[A-Za-z\u2019']+ was there too, \d+ minutes in\./g)
  for (const s of takeEvery(sites, 20)) {
    applyOnce(s, s.replace(' was there too,', ' was their too,'), {
      type: 'homophone',
      suggest: 'there',
      note: 'their/there',
    })
  }
}

// 2) give or take → give or too
{
  const sites = uniqueMatches(/About \d+ times, give or take\./g)
  for (const s of takeEvery(sites, 16)) {
    applyOnce(s, s.replace('give or take.', 'give or too.'), {
      type: 'homophone',
      suggest: 'take',
      note: 'too/take',
    })
  }
}

// 3) years now → years know
{
  const sites = uniqueMatches(/About \d+ years now\./g)
  for (const s of takeEvery(sites, 16)) {
    applyOnce(s, s.replace('years now.', 'years know.'), {
      type: 'homophone',
      suggest: 'now',
      note: 'know/now',
    })
  }
}

// 4) called N days later → call N days later
{
  const sites = uniqueMatches(/Yes, [A-Za-z\u2019']+ called \d+ days later\./g)
  for (const s of takeEvery(sites, 16)) {
    applyOnce(s, s.replace(' called ', ' call '), {
      type: 'grammar',
      suggest: 'called',
      note: 'call→called',
    })
  }
}

// 5) flagged one date → flagged won date
{
  const sites = uniqueMatches(/Mostly, flagged one date with [A-Za-z\u2019']+\./g)
  for (const s of takeEvery(sites, 16)) {
    applyOnce(s, s.replace('flagged one date', 'flagged won date'), {
      type: 'homophone',
      suggest: 'one',
      note: 'won/one',
    })
  }
}

// 6) vehicle damage → vehical damage (questions, unique by item #)
{
  const sites = uniqueMatches(/the vehicle damage, item \d+\?/g)
  for (const s of takeEvery(sites, 16)) {
    applyOnce(s, s.replace('vehicle', 'vehical'), {
      type: 'spelling',
      suggest: 'vehicle',
      note: 'vehical',
    })
  }
}

// 7) Yes, N follow-ups → follows-ups
{
  const sites = uniqueMatches(/Yes, \d+ follow-ups at [A-Za-z ]+\./g)
  for (const s of takeEvery(sites, 16)) {
    applyOnce(s, s.replace('follow-ups', 'follows-ups'), {
      type: 'spelling',
      suggest: 'follow-ups',
      note: 'follows-ups',
    })
  }
}

// 8) briefly → briefley
{
  const sites = uniqueMatches(/Yes, briefly with a [A-Za-z\u2019']+, ref \d+\./g)
  for (const s of takeEvery(sites, 16)) {
    applyOnce(s, s.replace('briefly', 'briefley'), {
      type: 'spelling',
      suggest: 'briefly',
      note: 'briefley',
    })
  }
}

// 9) with Dr. Name → misspellings on a sample of unique Dr. lines
{
  const sites = uniqueMatches(/About \d+ times, with Dr\. [A-Za-z\u2019']+\./g)
  const misspell = (name) => {
    if (name.length < 5) return null
    // drop a middle character
    const i = Math.floor(name.length / 2)
    return name.slice(0, i) + name.slice(i + 1)
  }
  let n = 0
  for (const s of sites) {
    if (n >= 12) break
    const m = s.match(/with Dr\. ([A-Za-z\u2019']+)\./)
    if (!m) continue
    const bad = misspell(m[1])
    if (!bad || bad === m[1]) continue
    if (applyOnce(s, s.replace(`Dr. ${m[1]}.`, `Dr. ${bad}.`), {
      type: 'spelling',
      suggest: m[1].replace(/\u2019/g, "'").slice(0, 6),
      note: `Dr. ${m[1]}→${bad}`,
    })) n++
  }
}

// Top up if under target: effect/affect style on "Did you discuss TOPIC"
if (seeded.length < TARGET) {
  const sites = uniqueMatches(/Did you discuss [a-z ]+ with anyone at [A-Za-z ]+\?/g)
  for (const s of takeEvery(sites, TARGET - seeded.length)) {
    // insert a wrong "effect" for "discuss" context: "Did you discus "
    applyOnce(s, s.replace('Did you discuss ', 'Did you discus '), {
      type: 'spelling',
      suggest: 'discuss',
      note: 'discus→discuss',
    })
  }
}

const manifest = {
  transcript: 'transcript_07_dense_50pages.txt',
  description:
    'DENSE 50-page stress fixture. Built from large_synthetic_50pages with ~100 controlled substitutions. Designed to exercise extract chunking (threshold 20 / 15-page chunks) and multiple proofread batches (250 entries).',
  pages: 50,
  target_seeded: TARGET,
  seeded_errors: seeded,
  false_positive_traps: [
    { text: 'Lakeview Medical', note: 'Proper facility name' },
    { text: 'give or take', note: 'Correct idiom where not mutated' },
    { text: 'follow-ups', note: 'Correct hyphenation where not mutated' },
    { text: 'was there too', note: 'Correct there where not mutated' },
  ],
}

writeFileSync(OUT_TXT, text)
writeFileSync(OUT_MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Applied ${seeded.length} seeded errors`)
console.log(`Wrote ${OUT_TXT}`)
console.log(`Wrote ${OUT_MANIFEST}`)
if (seeded.length < 80) {
  console.warn(`WARNING: only ${seeded.length} errors (wanted 80–100)`)
  process.exitCode = 1
}
