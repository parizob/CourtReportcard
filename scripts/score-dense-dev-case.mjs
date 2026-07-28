#!/usr/bin/env node
/**
 * Score a finished Dev case against a seeded-error manifest.
 *
 * Usage: node scripts/score-dense-dev-case.mjs <case_id> [manifest.json]
 * Default manifest: transcript_07_dense_50pages.manifest.json
 * Uses service role (Dev) to download extracted JSON.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const caseId = process.argv[2]
const manifestName = process.argv[3] || 'transcript_07_dense_50pages.manifest.json'
if (!caseId) {
  console.error('Usage: node scripts/score-dense-dev-case.mjs <case_id> [manifest.json]')
  process.exit(1)
}

const REF = 'jotklhjskmewzfsgzkvp'
const keys = JSON.parse(
  execSync(`supabase projects api-keys --project-ref ${REF} -o json`, { encoding: 'utf8' }),
)
const sr = keys.find((k) => k.name === 'service_role').api_key
const admin = createClient(`https://${REF}.supabase.co`, sr)

const manifest = JSON.parse(
  readFileSync(join(__dirname, 'test-transcripts', manifestName), 'utf8'),
)

const { data: files, error: fErr } = await admin
  .from('case_files')
  .select('file_type, file_name, storage_path')
  .eq('case_id', caseId)
if (fErr) throw fErr
const extracted = files.find((f) => f.file_type === 'extracted')
if (!extracted) {
  console.error('No extracted file yet. Case files:', files)
  process.exit(1)
}

const { data: blob, error: dlErr } = await admin.storage.from('case-files').download(extracted.storage_path)
if (dlErr) throw dlErr
const json = JSON.parse(await blob.text())
const anns = json.annotations || []

function norm(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

let caught = 0
const misses = []
for (const seed of manifest.seeded_errors) {
  const needle = norm(seed.match)
  const hit = anns.some((a) => {
    const o = norm(a.original)
    const sug = norm(a.suggestion)
    if (o.includes(needle) || needle.includes(o)) return true
    // loose: suggestion contains expected fragment and original shares a token
    const want = norm(seed.expected_suggestion_contains)
    if (want && sug.includes(want) && o.split(' ').some((t) => needle.includes(t) && t.length > 3)) {
      return true
    }
    return false
  })
  if (hit) caught++
  else misses.push({ id: seed.id, match: seed.match, type: seed.type, note: seed.note })
}

console.log(`Case ${caseId}`)
console.log(`Annotations returned: ${anns.length}`)
console.log(`Seeded errors: ${manifest.seeded_errors.length}`)
console.log(`Recall: ${caught}/${manifest.seeded_errors.length} (${((100 * caught) / manifest.seeded_errors.length).toFixed(1)}%)`)
console.log(`Misses: ${misses.length}`)
if (misses.length && misses.length <= 40) {
  for (const m of misses) console.log(`  miss #${m.id} [${m.type}] ${JSON.stringify(m.match).slice(0, 70)}`)
} else if (misses.length > 40) {
  for (const m of misses.slice(0, 25)) console.log(`  miss #${m.id} [${m.type}] ${JSON.stringify(m.match).slice(0, 70)}`)
  console.log(`  … +${misses.length - 25} more`)
}

const { data: c } = await admin
  .from('cases')
  .select('status, name, tokens_charged, analysis_stage, last_error')
  .eq('id', caseId)
  .single()
console.log('Case row:', c)
