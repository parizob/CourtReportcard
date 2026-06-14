#!/usr/bin/env node
/**
 * Proofreader test harness.
 *
 * Runs seeded test transcripts through the REAL production pipeline
 * (extractTranscriptWithGemini from src/lib/gemini.js) and scores the
 * returned annotations against each transcript's answer-key manifest.
 *
 * It does NOT modify the prompt. It only measures recall (seeded errors
 * caught), severity/type accuracy, and false positives.
 *
 * Prereq: the dev server must be running so /api/gemini is available:
 *     npm run dev        (serves http://localhost:3000)
 *
 * Usage:
 *     node scripts/run-proofread-test.mjs
 *     node scripts/run-proofread-test.mjs transcript_01.txt   # single file
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TRANSCRIPT_DIR = join(__dirname, 'test-transcripts')
const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000'

// ── Make the production code's relative fetch('/api/gemini') work in Node ──
const _origFetch = globalThis.fetch
globalThis.fetch = (url, opts) => {
  if (typeof url === 'string' && url.startsWith('/')) url = API_BASE + url
  return _origFetch(url, opts)
}

// Import the REAL pipeline after patching fetch.
const { extractTranscriptWithGemini, flexFind, applyCorrectionDetailed } = await import('../src/lib/gemini.js')

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()

// A seeded error is "caught" if some annotation's `original` overlaps it
// (whitespace/case-insensitive). The strong signal is the annotation's
// `original` containing the seeded phrase; we only allow the reverse direction
// (seed phrase containing the annotation original) when the annotation original
// is long enough (>=4 chars) to avoid a stray "I"/"a" matching everything.
// Among candidates we pick the longest annotation original, and an annotation
// already claimed by an earlier seed can't be reused.
function findMatch(annotations, seed, used) {
  const targets = [seed.match_loose, seed.match].filter(Boolean).map(norm)
  let best = null
  let bestLen = -1
  annotations.forEach((a, i) => {
    if (used.has(i)) return
    const o = norm(a.original)
    const hit = targets.some((t) => o.includes(t) || (o.length >= 4 && t.includes(o)))
    if (hit && o.length > bestLen) {
      best = { a, i }
      bestLen = o.length
    }
  })
  return best
}

function scoreTranscript(manifest, result) {
  const annotations = result.annotations || []
  const matchedAnnotationIdx = new Set()
  const rows = []

  for (const seed of manifest.seeded_errors) {
    const m = findMatch(annotations, seed, matchedAnnotationIdx)
    const hit = m?.a
    if (m) matchedAnnotationIdx.add(m.i)
    const typeOk = hit && hit.type === seed.type
    const sevOk = hit && hit.severity === seed.expected_severity
    const suggOk =
      hit &&
      seed.expected_suggestion_contains &&
      norm(hit.suggestion).includes(norm(seed.expected_suggestion_contains))
    rows.push({
      id: seed.id,
      match: seed.match_loose || seed.match,
      expected_type: seed.type,
      expected_severity: seed.expected_severity,
      caught: !!hit,
      got_type: hit?.type ?? null,
      got_severity: hit?.severity ?? null,
      got_suggestion: hit?.suggestion ?? null,
      type_ok: !!typeOk,
      severity_ok: !!sevOk,
      suggestion_ok: !!suggOk,
    })
  }

  // Everything the model flagged that did NOT map to a seeded error.
  const falsePositives = annotations
    .map((a, i) => ({ a, i }))
    .filter(({ i }) => !matchedAnnotationIdx.has(i))
    .map(({ a }) => ({
      entry_id: a.entry_id,
      type: a.type,
      severity: a.severity,
      original: a.original,
      suggestion: a.suggestion,
      explanation: a.explanation,
    }))

  const caught = rows.filter((r) => r.caught).length
  return {
    transcript: manifest.transcript,
    seeded: rows.length,
    caught,
    missed: rows.length - caught,
    recall: rows.length ? +(caught / rows.length).toFixed(3) : null,
    type_correct: rows.filter((r) => r.type_ok).length,
    severity_correct: rows.filter((r) => r.severity_ok).length,
    suggestion_correct: rows.filter((r) => r.suggestion_ok).length,
    false_positives: falsePositives,
    rows,
    total_annotations: annotations.length,
  }
}

// ── UI integrity checks ─────────────────────────────────────────────
// For each annotation, simulate what the editor does on accept/revert:
//   - flexFind must locate `original` in the entry text (highlighting)
//   - applying/reverting the entry text by stored position must round-trip
//     exactly (mirrors acceptAnnotation/reopenAnnotation for `entries`)
//   - applying/reverting the raw transcript text via applyCorrectionDetailed
//     must round-trip exactly (mirrors acceptAnnotation/reopenAnnotation for
//     `originalText`)
//   - applying to the raw text must not change the line count (no reflow
//     exists yet, so a line-count change means formatting would break)
function checkAnnotationIntegrity(ann, entries, rawText) {
  const issues = []
  const entry = entries.find((e) => e.id === ann.entry_id)
  if (!entry) {
    return { id: ann.id, original: ann.original, suggestion: ann.suggestion, issues: ['no matching entry for entry_id'] }
  }

  const entryMatch = flexFind(entry.text, ann.original)
  if (!entryMatch) issues.push('original not locatable in entry text (highlight would fail)')

  if (ann.original !== ann.suggestion) {
    // Mirrors acceptAnnotation/reopenAnnotation: replace at the matched span,
    // then revert by splicing the actual matched text (not `ann.original`,
    // which may differ in case/whitespace from what flexFind matched) back
    // into that same span — no re-searching for `suggestion`.
    if (entryMatch) {
      const matchedText = entry.text.substring(entryMatch.start, entryMatch.end)
      const correctedEntry = entry.text.substring(0, entryMatch.start) + ann.suggestion + entry.text.substring(entryMatch.end)
      if (correctedEntry === entry.text) issues.push('entry text accept was a no-op')
      const appliedEnd = entryMatch.start + ann.suggestion.length
      const revertedEntry = correctedEntry.substring(0, entryMatch.start) + matchedText + correctedEntry.substring(appliedEnd)
      if (revertedEntry !== entry.text) issues.push('positional apply+revert on entry text did not round-trip')
    }

    // Mirrors DashboardEditor: accept stores the exact matched span/text via
    // applyCorrectionDetailed, and reopenAnnotation reverts by splicing that
    // span back in directly (no re-searching for `suggestion`).
    const detail = applyCorrectionDetailed(rawText, ann.original, ann.suggestion)
    if (detail.start === -1) {
      issues.push('original not locatable in raw transcript text (export correction would fail)')
    } else {
      const correctedRaw = detail.text
      if (correctedRaw === rawText) issues.push('applyCorrection on raw text was a no-op')

      const beforeLines = rawText.split('\n').length
      const afterLines = correctedRaw.split('\n').length
      if (beforeLines !== afterLines) issues.push(`line count changed after apply: ${beforeLines} -> ${afterLines}`)

      const revertedRaw = correctedRaw.substring(0, detail.start) + detail.matchedText + correctedRaw.substring(detail.end)
      if (revertedRaw !== rawText) issues.push('positional apply+revert on raw text did not round-trip')
    }
  }

  return { id: ann.id, original: ann.original, suggestion: ann.suggestion, issues }
}

function printIntegrityReport(results) {
  const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', reset: '\x1b[0m' }
  const withIssues = results.filter((r) => r.issues.length)
  if (!withIssues.length) {
    console.log(`  ${C.green}✓ All ${results.length} annotations pass apply/highlight/round-trip checks${C.reset}`)
    return
  }
  console.log(`  ${C.red}✗ ${withIssues.length}/${results.length} annotations have apply/highlight issues:${C.reset}`)
  for (const r of withIssues) {
    console.log(`    [${r.id}] "${r.original}" → "${r.suggestion}"`)
    for (const issue of r.issues) console.log(`        ${C.yellow}- ${issue}${C.reset}`)
  }
}

function printReport(score) {
  const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', reset: '\x1b[0m', bold: '\x1b[1m' }
  console.log(`\n${C.bold}━━━ ${score.transcript} ━━━${C.reset}`)
  console.log(`Recall: ${score.caught}/${score.seeded} seeded errors caught (${(score.recall * 100).toFixed(0)}%)`)
  console.log(`Type correct: ${score.type_correct}/${score.seeded}   Severity correct: ${score.severity_correct}/${score.seeded}   Suggestion correct: ${score.suggestion_correct}/${score.seeded}`)
  console.log(`Total annotations returned: ${score.total_annotations}   Unmatched (possible false positives): ${score.false_positives.length}\n`)

  for (const r of score.rows) {
    const mark = r.caught ? `${C.green}✓${C.reset}` : `${C.red}✗ MISSED${C.reset}`
    const flags = []
    if (r.caught && !r.type_ok) flags.push(`${C.yellow}type=${r.got_type} (want ${r.expected_type})${C.reset}`)
    if (r.caught && !r.severity_ok) flags.push(`${C.yellow}sev=${r.got_severity} (want ${r.expected_severity})${C.reset}`)
    if (r.caught && !r.suggestion_ok) flags.push(`${C.yellow}suggestion off${C.reset}`)
    console.log(`  ${mark}  [${r.id}] "${r.match}"  ${flags.join('  ')}`)
    if (r.caught && r.got_suggestion) console.log(`       ${C.dim}→ ${JSON.stringify(r.got_suggestion)}${C.reset}`)
  }

  if (score.false_positives.length) {
    console.log(`\n  ${C.yellow}Possible false positives:${C.reset}`)
    for (const fp of score.false_positives) {
      console.log(`    ${C.dim}[${fp.type}/${fp.severity}] "${fp.original}" → "${fp.suggestion}"${C.reset}`)
    }
  }
}

async function main() {
  const only = process.argv[2]
  const manifests = readdirSync(TRANSCRIPT_DIR)
    .filter((f) => f.endsWith('.manifest.json'))
    .map((f) => JSON.parse(readFileSync(join(TRANSCRIPT_DIR, f), 'utf8')))
    .filter((m) => !only || m.transcript === only)

  if (!manifests.length) {
    console.error('No manifests found' + (only ? ` matching ${only}` : '') + '.')
    process.exit(1)
  }

  const allScores = []
  for (const manifest of manifests) {
    const text = readFileSync(join(TRANSCRIPT_DIR, manifest.transcript), 'utf8')
    process.stdout.write(`Running ${manifest.transcript} through pipeline... `)
    let result
    try {
      result = await extractTranscriptWithGemini(text, 'text/plain')
    } catch (err) {
      console.error(`\nFAILED: ${err.message}`)
      console.error('Is the dev server running? (npm run dev → http://localhost:3000)')
      process.exit(1)
    }
    console.log('done.')
    const score = scoreTranscript(manifest, result)
    printReport(score)

    const integrity = (result.annotations || []).map((a) => checkAnnotationIntegrity(a, result.entries, text))
    console.log(`\n  UI apply/highlight integrity:`)
    printIntegrityReport(integrity)
    score.integrity = integrity

    allScores.push(score)
  }

  // Aggregate
  const totSeeded = allScores.reduce((s, x) => s + x.seeded, 0)
  const totCaught = allScores.reduce((s, x) => s + x.caught, 0)
  const totFP = allScores.reduce((s, x) => s + x.false_positives.length, 0)
  const totAnnotations = allScores.reduce((s, x) => s + x.integrity.length, 0)
  const totIntegrityIssues = allScores.reduce((s, x) => s + x.integrity.filter((r) => r.issues.length).length, 0)
  console.log(`\n\x1b[1m━━━ AGGREGATE ━━━\x1b[0m`)
  console.log(`Overall recall: ${totCaught}/${totSeeded} (${((totCaught / totSeeded) * 100).toFixed(0)}%)`)
  console.log(`Total possible false positives: ${totFP}`)
  console.log(`UI apply/highlight integrity: ${totAnnotations - totIntegrityIssues}/${totAnnotations} annotations clean`)

  const outPath = join(TRANSCRIPT_DIR, `results_${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), scores: allScores }, null, 2))
  console.log(`\nFull results written to ${outPath}`)
}

main()
