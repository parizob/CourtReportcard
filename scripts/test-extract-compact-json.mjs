#!/usr/bin/env node
/**
 * A/B extract test for the compact-JSON extraction rule.
 *
 * - Trap file: caption with a huge blank-line gap (Gloria-class spiral).
 * - Regression: sample_transcript.txt must still parse cleanly.
 *
 * Usage: node scripts/test-extract-compact-json.mjs
 * Optional: RUNS=5 COMPARE_BASELINE=1 node scripts/test-extract-compact-json.mjs
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { parseGeminiJsonResponse } from '../src/lib/parseGeminiJson.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TRANSCRIPT_DIR = join(__dirname, 'test-transcripts')
const MODEL = 'gemini-3.1-flash-lite'
const RUNS = Math.max(1, Number(process.env.RUNS || 3))
const COMPARE_BASELINE = process.env.COMPARE_BASELINE === '1'

const apiKey =
  process.env.GEMINI_API_KEY ||
  readFileSync(join(ROOT, '.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith('VITE_GEMINI_API_KEY='))
    ?.split('=')[1]
    ?.trim()
if (!apiKey) throw new Error('No GEMINI_API_KEY / VITE_GEMINI_API_KEY')

const promptsSrc = readFileSync(join(ROOT, 'supabase/functions/analyze-case/prompts.ts'), 'utf8')
const geminiSrc = readFileSync(join(ROOT, 'src/lib/gemini.js'), 'utf8')

function extractConst(src, name, exportPrefix) {
  const re = new RegExp(
    `${exportPrefix ? 'export const' : 'const'} ${name} = \`([\\s\\S]*?)\`\\n`,
  )
  const m = src.match(re)
  if (!m) throw new Error(`Could not find ${name}`)
  return m[1]
}

const CURRENT = extractConst(promptsSrc, 'EXTRACTION_ONLY_PROMPT', true)
const MIRROR = extractConst(geminiSrc, 'EXTRACTION_ONLY_PROMPT', false)
if (CURRENT !== MIRROR) {
  console.error('FAIL: EXTRACTION_ONLY_PROMPT drift between prompts.ts and gemini.js')
  process.exit(1)
}
if (!CURRENT.includes('COMPACT JSON')) {
  console.error('FAIL: compact JSON rule missing from EXTRACTION_ONLY_PROMPT')
  process.exit(1)
}

/** Pre-change prompt (no compact rule) for optional A/B. */
const BASELINE = CURRENT.replace(
  /\nCRITICAL RULE — COMPACT JSON[\s\S]*?OUTPUT — respond with ONLY valid minified JSON matching this schema:\n\{"title":"<case title if found>","entries":\[\{"id":1,"speaker":"SPEAKER NAME","text":"The original text exactly as written\.\.\."\}\]\}\n/,
  `\nOUTPUT — respond with ONLY valid JSON:
{
  "title": "<case title if found>",
  "entries": [
    { "id": 1, "speaker": "SPEAKER NAME", "text": "The original text exactly as written..." }
  ]
}
`,
)
if (COMPARE_BASELINE && BASELINE === CURRENT) {
  throw new Error('Failed to strip compact rule for baseline comparison')
}

function maxRunOfEscapedNewlines(raw) {
  let max = 0
  let cur = 0
  for (let i = 0; i < raw.length - 1; i++) {
    if (raw[i] === '\\' && raw[i + 1] === 'n') {
      cur++
      i++
      if (cur > max) max = cur
    } else {
      cur = 0
    }
  }
  return max
}

async function callExtract(promptBody, label) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
  const startedAt = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptBody }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 131072,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    }),
  })
  const durationS = (Date.now() - startedAt) / 1000
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      label,
      durationS,
      error: `HTTP ${response.status}: ${JSON.stringify(data).slice(0, 300)}`,
    }
  }
  const rawText =
    data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') || ''
  const finishReason = data?.candidates?.[0]?.finishReason || null
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const maxNlRun = maxRunOfEscapedNewlines(cleaned)
  let parsed = null
  let parseError = null
  try {
    // Match production extract parsing (first JSON value; tolerate trailing junk).
    parsed = parseGeminiJsonResponse(rawText)
  } catch (err) {
    parseError = err?.message || String(err)
  }
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : null
  let maxTextBlankRun = 0
  if (entries) {
    for (const e of entries) {
      const t = String(e?.text || '')
      let cur = 0
      for (let i = 0; i < t.length; i++) {
        if (t[i] === '\n') {
          cur++
          if (cur > maxTextBlankRun) maxTextBlankRun = cur
        } else {
          cur = 0
        }
      }
    }
  }
  return {
    ok: Boolean(entries && entries.length > 0 && !parseError),
    label,
    durationS,
    bytes: cleaned.length,
    maxNlRun,
    maxTextBlankRun,
    finishReason,
    entryCount: entries?.length ?? 0,
    parseError,
    usage: data.usageMetadata || null,
    hasTestimonyHint: entries
      ? entries.some((e) => /Gloria Brown|Bridgeport|You're welcome|state your name/i.test(e?.text || ''))
      : false,
  }
}

async function runSuite(name, prompt, text, opts = {}) {
  const { requireTestimony = false, maxNlRunLimit = 8, minEntries = 1 } = opts
  console.log(`\n━━━ ${name} (${RUNS} runs) ━━━`)
  const results = []
  for (let i = 0; i < RUNS; i++) {
    const r = await callExtract(`${prompt}\n\n${text}`, `${name}#${i + 1}`)
    results.push(r)
    const status = r.ok ? 'OK' : 'FAIL'
    console.log(
      `  ${status} run ${i + 1}: entries=${r.entryCount} bytes=${r.bytes} max\\n_run=${r.maxNlRun} ` +
        `text_blank_run=${r.maxTextBlankRun} finish=${r.finishReason} ${r.durationS.toFixed(1)}s` +
        (r.parseError ? ` parse=${r.parseError.slice(0, 80)}` : ''),
    )
  }
  const okCount = results.filter((r) => r.ok).length
  const runaway = results.filter((r) => r.maxNlRun > maxNlRunLimit || r.maxTextBlankRun > maxNlRunLimit)
  const thin = results.filter((r) => r.ok && r.entryCount < minEntries)
  const missedTestimony = requireTestimony
    ? results.filter((r) => r.ok && !r.hasTestimonyHint)
    : []

  let failed = false
  if (okCount < RUNS) {
    console.error(`  FAIL: parse success ${okCount}/${RUNS}`)
    failed = true
  }
  if (runaway.length) {
    console.error(`  FAIL: ${runaway.length}/${RUNS} runs had max\\n_run > ${maxNlRunLimit}`)
    failed = true
  }
  if (thin.length) {
    console.error(`  FAIL: ${thin.length}/${RUNS} runs below minEntries=${minEntries}`)
    failed = true
  }
  if (missedTestimony.length) {
    console.error(`  FAIL: ${missedTestimony.length}/${RUNS} runs missing post-gap testimony text`)
    failed = true
  }
  if (!failed) console.log(`  PASS ${okCount}/${RUNS}`)
  return { failed, results, okCount }
}

const trapSeed = readFileSync(join(TRANSCRIPT_DIR, 'extract_whitespace_trap.txt'), 'utf8')
// Amplify the mid-caption blank gap so a model that copies blank lines into
// JSON as \\n runs will bloat toward Gloria-class truncation. The on-disk
// seed stays reviewable; the live stress input is built here.
const trap = trapSeed.replace(
  /(DOCKET NO\.[^\n]*\n)([\s\S]*?)(\n\s+WILLIE McCULLOUGH)/,
  (_m, head, _gap, tail) => `${head}${'\n'.repeat(12000)}${tail}`,
)
if (!trap.includes('\n'.repeat(1000))) {
  throw new Error('Failed to amplify whitespace trap gap')
}
const sample = readFileSync(join(TRANSCRIPT_DIR, 'sample_transcript.txt'), 'utf8')

let anyFail = false

if (COMPARE_BASELINE) {
  const baseTrap = await runSuite('BASELINE amplified trap', BASELINE, trap, {
    requireTestimony: true,
    minEntries: 3,
    maxNlRunLimit: 8,
  })
  // Baseline is expected to be worse; do not fail the script on baseline fails.
  console.log(
    `  (baseline trap ok ${baseTrap.okCount}/${RUNS} — informational only)`,
  )
}

const curTrap = await runSuite('CURRENT amplified trap', CURRENT, trap, {
  requireTestimony: true,
  minEntries: 3,
  maxNlRunLimit: 8,
})
if (curTrap.failed) anyFail = true

const curSample = await runSuite('CURRENT sample_transcript regression', CURRENT, sample, {
  requireTestimony: false,
  minEntries: 5,
  maxNlRunLimit: 12,
})
if (curSample.failed) anyFail = true

console.log('\n━━━ SUMMARY ━━━')
if (anyFail) {
  console.error('FAILED — compact extract guard did not meet pass criteria')
  process.exit(1)
}
console.log('PASSED — trap + sample extract look healthy under compact JSON rule')
