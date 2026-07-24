#!/usr/bin/env node
/**
 * One-off repro: Natalie's empty-proofread rough.
 * Prereq: GEMINI_API_KEY set, vite serving /api/gemini (TEST_API_BASE).
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_BASE = process.env.TEST_API_BASE || 'http://localhost:5173'
const path = join(__dirname, 'natalie-rough.txt')

const _origFetch = globalThis.fetch
globalThis.fetch = (url, opts) => {
  if (typeof url === 'string' && url.startsWith('/')) url = API_BASE + url
  return _origFetch(url, opts)
}

const { extractTranscriptWithGemini } = await import('../../src/lib/gemini.js')

const text = readFileSync(path, 'utf8')
console.log(`Running extract+proofread on ${path} (${text.length} chars)...`)
const t0 = Date.now()
const result = await extractTranscriptWithGemini(text, 'text/plain')
const ms = Date.now() - t0

const anns = result.annotations || []
const known = ['refering', 'trigged', 'thier', 'the was']
const texts = (result.entries || []).map((e) => e.text || '').join('\n')
const knownHits = known.map((k) => ({
  word: k,
  inTranscript: texts.toLowerCase().includes(k),
  flagged: anns.some((a) => (a.original || '').toLowerCase().includes(k)),
}))

const out = {
  ms,
  entries: (result.entries || []).length,
  annotations: anns.length,
  dropped: result.dropped_annotations_count ?? null,
  knownHits,
  sampleAnns: anns.slice(0, 15).map((a) => ({
    original: a.original,
    suggestion: a.suggestion,
    type: a.type,
    severity: a.severity,
  })),
}
const outPath = join(__dirname, `natalie-result-${Date.now()}.json`)
writeFileSync(outPath, JSON.stringify({ ...out, annotations: anns }, null, 2))
console.log(JSON.stringify(out, null, 2))
console.log(`Full result: ${outPath}`)
