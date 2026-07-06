#!/usr/bin/env node
/**
 * One-off calibration: compares gemini-2.5-flash (thinkingBudget:0, current
 * production extraction model) against gemini-3.1-flash-lite (thinkingLevel:
 * 'minimal') on identical chunk text, using the exact production
 * EXTRACTION_ONLY_PROMPT. Measures real timing + token usage + entry count
 * agreement, not vendor marketing claims.
 *
 * Usage: node scripts/calibrate-extraction-model.mjs
 */
import { readFileSync } from 'fs'
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

const { countPages } = await import('../src/lib/pageCount.js')
const { splitIntoChunks } = await import('../src/lib/chunkSplit.js')

async function runCase(label, text) {
  const pages = countPages(text)
  console.log(`\n=== ${label} (${pages} pages, ${text.length} chars) ===`)
  const prompt = `${EXTRACTION_ONLY_PROMPT}\n\n${text}`

  const flash = await callGemini(prompt, 'gemini-2.5-flash', { thinkingBudget: 0 })
  console.log(`  gemini-2.5-flash      : ${flash.durationS.toFixed(1)}s, ${flash.parsed.entries?.length ?? 0} entries, usage=${JSON.stringify(flash.usage)}`)

  const liteMinimal = await callGemini(prompt, 'gemini-3.1-flash-lite', { thinkingLevel: 'minimal' })
  console.log(`  gemini-3.1-flash-lite : ${liteMinimal.durationS.toFixed(1)}s, ${liteMinimal.parsed.entries?.length ?? 0} entries, usage=${JSON.stringify(liteMinimal.usage)}`)

  const speedup = ((flash.durationS - liteMinimal.durationS) / flash.durationS * 100).toFixed(0)
  console.log(`  -> flash-lite is ${speedup}% ${speedup >= 0 ? 'faster' : 'slower'} than flash for this chunk`)

  return { pages, flash, liteMinimal }
}

const fiftyPageText = readFileSync(join(TRANSCRIPT_DIR, 'large_synthetic_50pages.txt'), 'utf8')
const chunk15 = splitIntoChunks(fiftyPageText, 15)[0]
const twentyFivePageText = readFileSync(join(TRANSCRIPT_DIR, 'large_synthetic_25pages.txt'), 'utf8')

const results = []
results.push(await runCase('15-page chunk (production PAGES_PER_CHUNK)', chunk15))
results.push(await runCase('25-page full document', twentyFivePageText))

console.log('\n━━━ SUMMARY ━━━')
for (const r of results) {
  const flashSPerPage = r.flash.durationS / r.pages
  const liteSPerPage = r.liteMinimal.durationS / r.pages
  console.log(`${r.pages}pg: flash ${flashSPerPage.toFixed(2)}s/page vs flash-lite ${liteSPerPage.toFixed(2)}s/page | entries ${r.flash.parsed.entries?.length ?? 0} vs ${r.liteMinimal.parsed.entries?.length ?? 0}`)
}
