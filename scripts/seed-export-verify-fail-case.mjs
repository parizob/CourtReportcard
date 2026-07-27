/**
 * Seed: forces the export "Needs re-accept" UI (2 unverifiable accepted fixes).
 *
 * Checklist:
 *   1. Open case → Export → download TXT
 *   2. See error + "Needs re-accept (2)" list with Found → Suggest
 *   3. Click "Open editor to fix these"
 *   4. Banner lists the same 2 with Jump; cards highlighted in Resolved
 *
 * Usage:
 *   SEED_EMAIL='you@example.com' SEED_PASSWORD='…' npm run seed:export-verify-fail
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { ensureAcceptedCorrectionsInOriginalText } from '../src/lib/gemini.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!m) continue
      if (process.env[m[1]] != null) continue
      let v = m[2]
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      process.env[m[1]] = v
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(join(__dirname, '../.env'))

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.SEED_EMAIL || process.env.VITE_BILLING_TEST_USER_EMAIL
const password = process.env.SEED_PASSWORD

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}
if (!email || !password) {
  console.error(
    'Set SEED_EMAIL and SEED_PASSWORD then re-run.\n' +
      '  SEED_EMAIL=... SEED_PASSWORD=... npm run seed:export-verify-fail'
  )
  process.exit(1)
}

const extracted = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/export-verify-fail-seed.json'), 'utf8')
)

const { failed } = ensureAcceptedCorrectionsInOriginalText(
  extracted.originalText,
  extracted.entries,
  extracted.annotations
)
console.log(`Preflight: export would block on ${failed.length} accept(s)`)
if (failed.length < 2) {
  console.error('Expected at least 2 failing accepts. Not seeding.')
  process.exit(1)
}
for (const a of failed) {
  console.log(`  id=${a.id} ${JSON.stringify(a.original)} → ${JSON.stringify(a.suggestion)}`)
}

const supabase = createClient(url, anon)
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email,
  password,
})
if (authErr) {
  console.error('Sign-in failed:', authErr.message)
  process.exit(1)
}
const userId = auth.user.id

const caseName = `Export Verify Fail Seed ${new Date().toISOString().slice(0, 16)}`
const { data: caseRow, error: caseErr } = await supabase
  .from('cases')
  .insert({
    user_id: userId,
    name: caseName,
    status: 'reviewed',
    tokens_charged: 1,
  })
  .select()
  .single()
if (caseErr) {
  console.error('Create case failed:', caseErr.message)
  process.exit(1)
}

const transcriptPath = `${userId}/${caseRow.id}/transcript/export_verify_fail_seed.txt`
const extractedPath = `${userId}/${caseRow.id}/extracted/export_verify_fail_seed.json`
const transcriptBody = extracted.originalText
const extractedJson = JSON.stringify(extracted, null, 2)

for (const [path, body, type] of [
  [transcriptPath, transcriptBody, 'text/plain'],
  [extractedPath, extractedJson, 'application/json'],
]) {
  const { error } = await supabase.storage
    .from('case-files')
    .upload(path, Buffer.from(body, 'utf8'), {
      upsert: true,
      contentType: type,
      cacheControl: type.includes('json') ? '0' : undefined,
    })
  if (error) {
    console.error('Upload failed:', error.message)
    process.exit(1)
  }
}

const { error: filesErr } = await supabase.from('case_files').insert([
  {
    case_id: caseRow.id,
    file_type: 'transcript',
    file_name: 'export_verify_fail_seed.txt',
    file_size: transcriptBody.length,
    storage_path: transcriptPath,
    mime_type: 'text/plain',
  },
  {
    case_id: caseRow.id,
    file_type: 'extracted',
    file_name: 'export_verify_fail_seed.json',
    file_size: extractedJson.length,
    storage_path: extractedPath,
    mime_type: 'application/json',
  },
])
if (filesErr) {
  console.error('case_files insert failed:', filesErr.message)
  process.exit(1)
}

const counts = { accepted: 0, ignored: 0, open: 0 }
const byType = {}
for (const a of extracted.annotations) {
  counts[a.status] = (counts[a.status] || 0) + 1
  byType[a.type] = (byType[a.type] || 0) + 1
}
const { error: metricsErr } = await supabase.from('case_metrics').upsert(
  {
    case_id: caseRow.id,
    total_entries: extracted.entries.length,
    total_issues: extracted.annotations.length,
    accepted: counts.accepted || 0,
    ignored: counts.ignored || 0,
    open: counts.open || 0,
    custom_changed: 0,
    annotations_by_type: byType,
    last_reviewed_at: new Date().toISOString(),
  },
  { onConflict: 'case_id' }
)
if (metricsErr) {
  console.error('case_metrics failed:', metricsErr.message)
  process.exit(1)
}

console.log('\nSeeded case:')
console.log('  name:', caseName)
console.log('  id:  ', caseRow.id)
console.log('\nOpen Export on this case and try download TXT.')
process.exit(0)
