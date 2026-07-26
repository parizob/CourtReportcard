/**
 * Seed a Dev case that is already analyzed — no Gemini.
 *
 * Usage (from repo root, against whatever VITE_SUPABASE_* is in .env):
 *
 *   SEED_EMAIL='you@example.com' SEED_PASSWORD='your-password' \
 *     node scripts/seed-export-mock-case.mjs
 *
 * Then open Dashboard → "Export Integrity Mock" → Editor.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

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
    'Set SEED_EMAIL and SEED_PASSWORD (Dev login) then re-run.\n' +
      '  SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed-export-mock-case.mjs'
  )
  process.exit(1)
}

const extracted = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/export-mock-extracted.json'), 'utf8')
)
const transcriptBody = extracted.originalText

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
console.log('Signed in as', email, `(${userId})`)
console.log('Project', url)

const caseName = `Export Integrity Mock ${new Date().toISOString().slice(0, 16)}`
const { data: caseRow, error: caseErr } = await supabase
  .from('cases')
  .insert({
    user_id: userId,
    name: caseName,
    status: 'analyzed',
    tokens_charged: 1,
  })
  .select()
  .single()
if (caseErr) {
  console.error('Create case failed:', caseErr.message)
  process.exit(1)
}

const transcriptPath = `${userId}/${caseRow.id}/transcript/export-mock.txt`
const extractedPath = `${userId}/${caseRow.id}/extracted/export-mock.json`

const extractedJson = JSON.stringify(extracted, null, 2)

const { error: up1 } = await supabase.storage
  .from('case-files')
  .upload(transcriptPath, Buffer.from(transcriptBody, 'utf8'), {
    upsert: true,
    contentType: 'text/plain',
  })
if (up1) {
  console.error('Transcript upload failed:', up1.message)
  process.exit(1)
}

const { error: up2 } = await supabase.storage
  .from('case-files')
  .upload(extractedPath, Buffer.from(extractedJson, 'utf8'), {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '0',
  })
if (up2) {
  console.error('Extracted upload failed:', up2.message)
  process.exit(1)
}

const { error: filesErr } = await supabase.from('case_files').insert([
  {
    case_id: caseRow.id,
    file_type: 'transcript',
    file_name: 'export-mock.txt',
    file_size: transcriptBody.length,
    storage_path: transcriptPath,
    mime_type: 'text/plain',
  },
  {
    case_id: caseRow.id,
    file_type: 'extracted',
    file_name: 'export-mock.json',
    file_size: JSON.stringify(extracted).length,
    storage_path: extractedPath,
    mime_type: 'application/json',
  },
])
if (filesErr) {
  console.error('case_files insert failed:', filesErr.message)
  process.exit(1)
}

const open = extracted.annotations.length
const { error: metricsErr } = await supabase.from('case_metrics').upsert(
  {
    case_id: caseRow.id,
    total_entries: extracted.entries.length,
    total_issues: open,
    accepted: 0,
    ignored: 0,
    open,
    custom_changed: 0,
    annotations_by_type: { homophone: 2, spelling: 1, grammar: 2 },
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
console.log(`  open: ${open} mock suggestions (too/to, teh/the, your/you, thesis [sic], its/it's)`)
console.log('\nOpen local app → Dashboard → that case → Editor.')
console.log('Accept both line-1 fixes, export, confirm both landed. No Gemini involved.')
process.exit(0)
