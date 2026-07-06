#!/usr/bin/env node
/**
 * One-off calibration: builds a large real entry pool (via production
 * gemini-2.5-flash extraction, chunked) and then times gemini-2.5-pro
 * proofreading (uncapped thinking, exact production PROOFREAD_ONLY_PROMPT)
 * at increasing batch sizes, to find a safe higher ENTRIES_PER_PROOFREAD_BATCH
 * than the current 300 — the goal is fewer sequential batches (each batch
 * pays Pro's "thinking" latency again) without blowing the 135s per-invocation
 * deadline or degrading proofread quality.
 *
 * Usage: node scripts/calibrate-proofread-batch.mjs
 */
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TRANSCRIPT_DIR = join(__dirname, 'test-transcripts')

const apiKey = process.env.GEMINI_API_KEY || readFileSync(join(__dirname, '..', '.env'), 'utf8')
  .split('\n').find((l) => l.startsWith('VITE_GEMINI_API_KEY='))?.split('=')[1]?.trim()
if (!apiKey) throw new Error('No GEMINI_API_KEY found (env or .env VITE_GEMINI_API_KEY)')

const promptsSrc = readFileSync(join(__dirname, '..', 'supabase/functions/analyze-case/prompts.ts'), 'utf8')
function extractPrompt(name) {
  const m = promptsSrc.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`\\n`))
  if (!m) throw new Error(`Could not find ${name} in prompts.ts`)
  return m[1]
}
const EXTRACTION_ONLY_PROMPT = extractPrompt('EXTRACTION_ONLY_PROMPT')
const PROOFREAD_ONLY_PROMPT = extractPrompt('PROOFREAD_ONLY_PROMPT')

async function callGemini(prompt, model, thinkingConfig) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const startedAt = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 131072,
        responseMimeType: 'application/json',
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    }),
  })
  const durationS = (Date.now() - startedAt) / 1000
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`${model} error ${response.status}: ${JSON.stringify(err).slice(0, 500)}`)
  }
  const data = await response.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) throw new Error(`${model} returned no content: ${JSON.stringify(data).slice(0, 500)}`)
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return { parsed: JSON.parse(cleaned), durationS, usage: data.usageMetadata }
}

const { splitIntoChunks } = await import('../src/lib/chunkSplit.js')

const POOL_CACHE = join(__dirname, '.proofread-pool-cache.json')
let pool
if (existsSync(POOL_CACHE)) {
  console.log(`Step 1: reusing cached entry pool at ${POOL_CACHE}\n`)
  pool = JSON.parse(readFileSync(POOL_CACHE, 'utf8'))
} else {
  console.log('Step 1: building a real entry pool from the 180-page synthetic transcript')
  console.log('(chunked gemini-2.5-flash extraction, run in parallel — for entry-pool')
  console.log('volume only, not testing extraction chunking itself here)...\n')

  const bigText = readFileSync(join(TRANSCRIPT_DIR, 'large_synthetic_180pages.txt'), 'utf8')
  const chunks = splitIntoChunks(bigText, 15)
  console.log(`  split into ${chunks.length} chunks of ~15 pages each`)

  const extractStart = Date.now()
  const chunkResults = await Promise.all(chunks.map((chunkText, i) =>
    callGemini(`${EXTRACTION_ONLY_PROMPT}\n\n${chunkText}`, 'gemini-2.5-flash', { thinkingBudget: 0 })
      .then((r) => { console.log(`  chunk ${i + 1}/${chunks.length}: ${r.durationS.toFixed(1)}s, ${r.parsed.entries?.length ?? 0} entries`); return r })
  ))
  console.log(`  extraction pool built in ${((Date.now() - extractStart) / 1000).toFixed(1)}s wall time\n`)

  let nextId = 1
  pool = []
  for (const r of chunkResults) {
    for (const e of r.parsed.entries || []) {
      pool.push({ id: nextId++, speaker: e.speaker, text: e.text })
    }
  }
  writeFileSync(POOL_CACHE, JSON.stringify(pool))
}
console.log(`Entry pool size: ${pool.length} entries\n`)

const BATCH_SIZES = [300, 450, 600, 900, 1200].filter((n) => n <= pool.length)

// IMPORTANT: batches must be DISJOINT (non-overlapping) slices, not nested
// prefixes. Gemini's implicit prompt caching makes a batch that's a superset
// of an already-sent batch return much faster/cheaper (lower "thinking"
// tokens too) purely from the cache hit — that doesn't reflect production,
// where every batch is a different, disjoint slice of the document.
console.log('Step 2: timing gemini-2.5-pro proofread at increasing (disjoint) batch sizes\n')
const results = []
let cursor = 0
for (const size of BATCH_SIZES) {
  const batch = pool.slice(cursor, cursor + size)
  cursor += size
  const prompt = `${PROOFREAD_ONLY_PROMPT}\n\n${JSON.stringify(batch, null, 2)}`
  const { parsed, durationS, usage } = await callGemini(prompt, 'gemini-2.5-pro', undefined)
  const annotations = parsed.annotations || []
  console.log(`  ${size} entries: ${durationS.toFixed(1)}s, ${annotations.length} annotations, usage=${JSON.stringify(usage)}`)
  results.push({ size, durationS, annotations: annotations.length })
}

console.log('\n━━━ SUMMARY ━━━')
console.log('batch size | duration | s/entry | within 135s deadline?')
for (const r of results) {
  console.log(`${String(r.size).padStart(10)} | ${r.durationS.toFixed(1).padStart(7)}s | ${(r.durationS / r.size).toFixed(3)}s | ${r.durationS < 135 ? 'yes' : 'NO — over deadline'}`)
}
