#!/usr/bin/env node
/**
 * One-off calibration: calls Gemini DIRECTLY with the exact same model,
 * thinkingBudget, and generationConfig that the PRODUCTION edge function
 * (supabase/functions/analyze-case/index.ts) uses — gemini-2.5-flash with
 * thinkingBudget:0 for extraction, gemini-2.5-pro with uncapped thinking for
 * proofreading. This deliberately bypasses api/gemini.js and src/lib/gemini.js,
 * both of which only support gemini-2.5-pro (no Flash, no thinkingBudget
 * control) and would otherwise measure the wrong model for extraction.
 *
 * Usage: node scripts/calibrate-chunk-size.mjs [filename]
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TRANSCRIPT_DIR = join(__dirname, 'test-transcripts')
const file = process.argv[2] || 'large_synthetic_25pages.txt'

const apiKey = process.env.GEMINI_API_KEY || readFileSync(join(__dirname, '..', '.env'), 'utf8')
  .split('\n').find((l) => l.startsWith('VITE_GEMINI_API_KEY='))?.split('=')[1]?.trim()
if (!apiKey) throw new Error('No GEMINI_API_KEY found (env or .env VITE_GEMINI_API_KEY)')

// Pulled directly from prompts.ts (Deno source of truth for index.ts) so this
// script exercises the exact production prompt text, not a hand-copied one.
const promptsSrc = readFileSync(join(__dirname, '..', 'supabase/functions/analyze-case/prompts.ts'), 'utf8')
function extractPrompt(name) {
  const m = promptsSrc.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`\\n`))
  if (!m) throw new Error(`Could not find ${name} in prompts.ts`)
  return m[1]
}
const EXTRACTION_ONLY_PROMPT = extractPrompt('EXTRACTION_ONLY_PROMPT')
const PROOFREAD_ONLY_PROMPT = extractPrompt('PROOFREAD_ONLY_PROMPT')

async function callGemini(prompt, model, thinkingBudget) {
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
        ...(thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget } } : {}),
      },
    }),
  })
  const durationS = (Date.now() - startedAt) / 1000
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`${model} error ${response.status}: ${JSON.stringify(err).slice(0, 300)}`)
  }
  const data = await response.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
  console.log(`  [${model}, thinkingBudget=${thinkingBudget}] ${durationS.toFixed(1)}s`, data.usageMetadata)
  if (!rawText) throw new Error('Gemini returned no content.')
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return { parsed: JSON.parse(cleaned), durationS }
}

const { countPages } = await import('../src/lib/pageCount.js')
const text = readFileSync(join(TRANSCRIPT_DIR, file), 'utf8')
const pages = countPages(text)
console.log(`\nCalibrating with ${file} (${pages} pages, ${text.length} chars) against PRODUCTION models...\n`)

console.log('Extraction (gemini-2.5-flash, thinkingBudget=0):')
const extractStart = Date.now()
const { parsed: extractResult, durationS: extractDuration } = await callGemini(
  `${EXTRACTION_ONLY_PROMPT}\n\n${text}`, 'gemini-2.5-flash', 0,
)
const entries = extractResult.entries || []
console.log(`  -> ${entries.length} entries extracted\n`)

console.log('Proofread (gemini-2.5-pro, uncapped thinking):')
const { parsed: proofResult, durationS: proofDuration } = await callGemini(
  `${PROOFREAD_ONLY_PROMPT}\n\n${JSON.stringify(entries, null, 2)}`, 'gemini-2.5-pro', undefined,
)
const annotations = proofResult.annotations || []
console.log(`  -> ${annotations.length} annotations found\n`)

const totalS = extractDuration + proofDuration
console.log(`━━━ SUMMARY for ${pages} pages ━━━`)
console.log(`Extraction: ${extractDuration.toFixed(1)}s (${(extractDuration / pages).toFixed(2)}s/page)`)
console.log(`Proofread:  ${proofDuration.toFixed(1)}s (${(proofDuration / pages).toFixed(2)}s/page)`)
console.log(`Total:      ${totalS.toFixed(1)}s (${(totalS / pages).toFixed(2)}s/page)`)
console.log(`135s budget allows ~${Math.floor(135 / (extractDuration / pages))} pages for extraction, ~${Math.floor(135 / (proofDuration / pages))} pages for proofread`)
