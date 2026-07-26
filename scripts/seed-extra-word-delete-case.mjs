/**
 * Seed a Dev case for empty-suggestion Extra Word Accept — no Gemini.
 *
 * What to verify in the Editor after seeding:
 *   1. Cards show Accept: (remove) for empty suggestions (not blank quotes)
 *   2. Accept on first "the" (the the store) → transcript becomes "the store"
 *      and the other "the" stays
 *   3. Accept on middle "that" / second "already" removes that word
 *   4. Accept on Exhibit Number 1 → Exhibit No. 1 still works (control)
 *   5. Reopen a remove → word comes back
 *
 * Usage:
 *
 *   SEED_EMAIL='you@example.com' SEED_PASSWORD='your-password' \
 *     npm run seed:extra-word-delete
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  ensureAnnotationAnchors,
  locateAnnotationWithAnchor,
  buildCleanContentMap,
  applyCorrectionDetailed,
} from '../src/lib/gemini.js'

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
      '  SEED_EMAIL=... SEED_PASSWORD=... npm run seed:extra-word-delete'
  )
  process.exit(1)
}

const extracted = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/extra-word-delete-seed.json'), 'utf8')
)
extracted.annotations = ensureAnnotationAnchors(
  extracted.entries,
  extracted.annotations
)

const { cleanContent } = buildCleanContentMap(extracted.originalText)
console.log('Preflight (each Accept on a fresh copy of the transcript):')
for (const ann of extracted.annotations) {
  const entry = extracted.entries.find((e) => e.id === ann.entry_id)
  const loc = locateAnnotationWithAnchor(cleanContent, entry, ann, ann.original)
  if (!loc) {
    console.log(`  MISS id=${ann.id} ${JSON.stringify(ann.original)}`)
    continue
  }
  const detail = applyCorrectionDetailed(
    extracted.originalText,
    ann.original,
    ann.suggestion,
    { cleanStart: loc.cleanStart, cleanEnd: loc.cleanEnd }
  )
  const label = ann.suggestion === '' ? '(remove)' : ann.suggestion
  console.log(
    `  ${detail.start === -1 ? 'FAIL' : 'OK  '} id=${ann.id} ${JSON.stringify(ann.original)} → ${label}` +
      (detail.start === -1 ? '' : `  matched=${JSON.stringify(detail.matchedText)}`)
  )
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
console.log('\nSigned in as', email, `(${userId})`)
console.log('Project', url)

const caseName = `Extra Word Delete Seed ${new Date().toISOString().slice(0, 16)}`
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

const transcriptPath = `${userId}/${caseRow.id}/transcript/extra_word_delete_seed.txt`
const extractedPath = `${userId}/${caseRow.id}/extracted/extra_word_delete_seed.json`
const transcriptBody = extracted.originalText
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
    file_name: 'extra_word_delete_seed.txt',
    file_size: transcriptBody.length,
    storage_path: transcriptPath,
    mime_type: 'text/plain',
  },
  {
    case_id: caseRow.id,
    file_type: 'extracted',
    file_name: 'extra_word_delete_seed.json',
    file_size: extractedJson.length,
    storage_path: extractedPath,
    mime_type: 'application/json',
  },
])
if (filesErr) {
  console.error('case_files insert failed:', filesErr.message)
  process.exit(1)
}

const open = extracted.annotations.length
const byType = {}
for (const a of extracted.annotations) {
  byType[a.type] = (byType[a.type] || 0) + 1
}
const { error: metricsErr } = await supabase.from('case_metrics').upsert(
  {
    case_id: caseRow.id,
    total_entries: extracted.entries.length,
    total_issues: open,
    accepted: 0,
    ignored: 0,
    open,
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
console.log(
  '  editor:',
  `${url.includes('localhost') ? 'local app' : 'app'} → /dashboard/editor?case=${caseRow.id}`
)
console.log('\nChecklist:')
console.log('  [ ] Accept: (remove) on extra "the" → "the store" (one the left)')
console.log('  [ ] Accept: (remove) on middle "that" / second "already"')
console.log('  [ ] Accept Exhibit Number 1 still works')
console.log('  [ ] Reopen a remove restores the word')
console.log('\nNo Gemini involved.')
process.exit(0)
