#!/usr/bin/env node
/**
 * Fast, no-API unit tests for src/lib/chunkSplit.js — the split-point finder,
 * chunk boundary snapping, and trailing-context-carry logic. Pure functions,
 * no Gemini/network calls, no live Supabase project needed.
 *
 * Usage: node scripts/test-chunk-split.mjs
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { splitIntoChunks, findSpeakerTurnBoundaries, extractTrailingContext } from '../src/lib/chunkSplit.js'
import { countPages } from '../src/lib/pageCount.js'
import { deduplicateTranscript } from '../src/lib/gemini.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TRANSCRIPT_DIR = join(__dirname, 'test-transcripts')

let pass = 0
let fail = 0
function check(name, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  \x1b[32m\u2713\x1b[0m ${name}`)
  } else {
    fail++
    console.log(`  \x1b[31m\u2717 ${name}\x1b[0m ${detail}`)
  }
}

console.log('\n\x1b[1m\u2500\u2500\u2500 chunkSplit unit tests \u2500\u2500\u2500\x1b[0m\n')

// ── Small doc stays as a single chunk ──
{
  const text = readFileSync(join(TRANSCRIPT_DIR, 'sample_transcript.txt'), 'utf8')
  const pages = countPages(text)
  const chunks = splitIntoChunks(text, 15)
  check(`small doc (${pages}p, under 15) returns 1 chunk unchanged`, chunks.length === 1 && chunks[0] === text)
}

// ── Large doc splits into the expected number of chunks ──
{
  const text = readFileSync(join(TRANSCRIPT_DIR, 'large_synthetic_180pages.txt'), 'utf8')
  const pages = countPages(text)
  const pagesPerChunk = 15
  const expectedChunks = Math.ceil(pages / pagesPerChunk)
  const chunks = splitIntoChunks(text, pagesPerChunk)
  check(`181p doc splits into ~${expectedChunks} chunks at 15/chunk`, chunks.length === expectedChunks, `got ${chunks.length}`)

  // ── No data loss / no duplication: chunks concatenate back exactly ──
  const rejoined = chunks.join('')
  check('chunks concatenate back to the exact original text', rejoined === text, `length ${rejoined.length} vs ${text.length}`)

  // ── Every split boundary (chunk start, except the first) lands on a turn ──
  let offset = 0
  let allSnapped = true
  const badBoundaries = []
  for (let i = 0; i < chunks.length - 1; i++) {
    offset += chunks[i].length
    // The next chunk must start exactly at a speaker-turn boundary within itself.
    const nextChunkBoundaries = findSpeakerTurnBoundaries(chunks[i + 1])
    if (!nextChunkBoundaries.includes(0)) {
      allSnapped = false
      badBoundaries.push(i + 1)
    }
  }
  check('every chunk (after the first) starts exactly on a speaker-turn boundary', allSnapped, `bad: ${badBoundaries.join(',')}`)

  // ── No chunk is empty ──
  check('no chunk is empty', chunks.every((c) => c.length > 0))

  // ── Chunk sizes are all roughly the target size (sanity, not exact) ──
  const chunkPageCounts = chunks.map((c) => countPages(c))
  const withinRange = chunkPageCounts.every((p) => p >= 1 && p <= pagesPerChunk * 2)
  check('chunk page counts are all reasonable (not wildly oversized)', withinRange, JSON.stringify(chunkPageCounts))
}

// ── Trailing context carry ──
{
  const text = readFileSync(join(TRANSCRIPT_DIR, 'large_synthetic_25pages.txt'), 'utf8')
  const chunks = splitIntoChunks(text, 10)
  check('25p doc splits into multiple chunks at 10/chunk', chunks.length > 1, `got ${chunks.length}`)

  const context = extractTrailingContext(chunks[0], 2)
  check('trailing context is non-empty and shorter than the source chunk', context.length > 0 && context.length < chunks[0].length)
  check('trailing context appears verbatim at the end of the chunk', chunks[0].trim().endsWith(context))

  const contextBoundaries = findSpeakerTurnBoundaries(context)
  check('trailing context starts exactly on a speaker-turn boundary', contextBoundaries.includes(0))
}

// ── Cross-chunk merge + dedup: simulates a model that disobeys the
// "don't re-extract <PREVIOUS_CONTEXT>" instruction and re-emits the carried
// trailing-context turns as if they were new entries in the next chunk —
// mirrors mergeExtractionChunks in supabase/functions/analyze-case/index.ts
// (renumber ids globally, then deduplicateTranscript) without needing a live
// Gemini call or Supabase project. Uses hand-built, guaranteed-unique turns
// (rather than the shared synthetic fixture, which has ~29% incidental
// template repetition — see scripts/generate-large-transcript.mjs) so the
// only duplication in play is the one this test deliberately injects.
{
  const QA_LINE_RE = /^\s*\d+\s+(Q\.|A\.)\s+(.*)$/
  const fakeExtractTurns = (text) =>
    text.split('\n').reduce((acc, line) => {
      const m = line.match(QA_LINE_RE)
      if (m) acc.push({ speaker: m[1] === 'Q.' ? 'Q' : 'A', text: m[2].trim() })
      return acc
    }, [])

  const makeChunkText = (startTurn, count) => {
    const lines = []
    for (let i = 0; i < count; i++) {
      const n = startTurn + i
      lines.push(`     ${n * 2 - 1}   Q.     Unique question number ${n} about topic ${n}?`, '')
      lines.push(`     ${n * 2}   A.     Unique answer number ${n} with detail ${n}.`, '')
    }
    return lines.join('\n')
  }

  const chunk0Text = makeChunkText(1, 7) // turns 1-7
  const chunk1RealText = makeChunkText(8, 5) // turns 8-12, genuinely new

  const chunk0Turns = fakeExtractTurns(chunk0Text)
  const trailingContext = extractTrailingContext(chunk0Text, 2)
  const trailingTurns = fakeExtractTurns(trailingContext)
  check('trailing context extracted from hand-built chunk 0 is non-empty', trailingTurns.length > 0)

  // Non-compliant model: chunk 1's output starts with the same trailing-context
  // turns re-extracted as "new" entries, followed by its own genuinely new turns.
  const chunk1Turns = [...trailingTurns, ...fakeExtractTurns(chunk1RealText)]

  const naiveTotal = chunk0Turns.length + chunk1Turns.length
  const expectedUniqueTotal = naiveTotal - trailingTurns.length

  // Mirrors mergeExtractionChunks: give every entry a globally-unique id
  // across chunks (each chunk's ids restart at 1) before deduping.
  const allEntries = [...chunk0Turns, ...chunk1Turns].map((t, i) => ({ id: i + 1, speaker: t.speaker, text: t.text }))
  const { entries: merged } = deduplicateTranscript(allEntries, [])

  check(
    'merge removes exactly the re-extracted trailing-context duplicates',
    merged.length === expectedUniqueTotal,
    `got ${merged.length}, expected ${expectedUniqueTotal} (naive ${naiveTotal}, trailing turns ${trailingTurns.length})`,
  )

  const seen = new Set()
  const hasDuplicates = merged.some((e) => {
    const key = `${e.speaker}|||${e.text.trim().toLowerCase()}`
    if (seen.has(key)) return true
    seen.add(key)
    return false
  })
  check('merged entries contain zero duplicate speaker+text pairs', !hasDuplicates)

  const mergedTexts = merged.map((e) => e.text)
  const chunk0Texts = chunk0Turns.map((t) => t.text)
  const preservesChunk0Order = chunk0Texts.every((t, i) => mergedTexts[i] === t)
  check('chunk 0 entries retain their original order at the head of the merge', preservesChunk0Order)
}

// ── Idempotent chunk size (chunk size <= pagesPerChunk boundary case) ──
{
  const text = readFileSync(join(TRANSCRIPT_DIR, 'large_synthetic_25pages.txt'), 'utf8')
  const pages = countPages(text)
  const chunks = splitIntoChunks(text, pages) // exactly at threshold
  check('doc exactly at chunk-size threshold returns 1 chunk', chunks.length === 1)
}

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`)
process.exit(fail > 0 ? 1 : 0)
