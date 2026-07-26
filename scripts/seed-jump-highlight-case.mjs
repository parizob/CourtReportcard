/**
 * Seed a Dev case that exercises jump / underline / drop fixes — no Gemini.
 *
 * What to verify in the Editor after seeding:
 *   1. Two full pages (6–7) with right-aligned page numbers + HH:MM:SS gutters
 *   2. Exhibit Number 1  — Jump works; Accept keeps 08:03:24 22 gutter
 *   3. Exhibit Number 2  — Jump lands on "marked as…again", NOT "before?"
 *   4. Exhibit Number 3  — Jump across line wrap on page 7
 *   5. Jonelle Blaze / stage name — Jump + underline
 *   6. "returning the moon rocks" — MUST NOT appear (dropped on load)
 *
 * Usage (from repo root, against VITE_SUPABASE_* in .env):
 *
 *   SEED_EMAIL='you@example.com' SEED_PASSWORD='your-password' \
 *     npm run seed:jump-highlight
 *
 * Then: local app → Dashboard → "Cusato Jump Seed …" → Editor.
 * Transcript is exact pages 6–7 from Melanie's Cusato .txt (plus page-8 header).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  dropTranscriptUnplaceableAnnotations,
  ensureAnnotationAnchors,
  locateAnnotationWithAnchor,
  buildCleanContentMap,
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
      '  SEED_EMAIL=... SEED_PASSWORD=... npm run seed:jump-highlight'
  )
  process.exit(1)
}

const extracted = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/jump-highlight-seed.json'), 'utf8')
)
extracted.annotations = ensureAnnotationAnchors(
  extracted.entries,
  extracted.annotations
)

// Preview what the editor will do on load
const { cleanContent } = buildCleanContentMap(extracted.originalText)
console.log('Preflight (same logic as editor load — Found/original must place):')
for (const ann of extracted.annotations) {
  const entry = extracted.entries.find((e) => e.id === ann.entry_id)
  const ok = !!locateAnnotationWithAnchor(
    cleanContent,
    entry,
    ann,
    ann.original
  )
  console.log(`  ${ok ? 'KEEP ' : 'DROP '} id=${ann.id} ${JSON.stringify(ann.original)}`)
}
const { droppedCount } = dropTranscriptUnplaceableAnnotations(
  extracted.originalText,
  extracted.entries,
  extracted.annotations
)
console.log(`  → dropTranscriptUnplaceable would remove ${droppedCount} on open\n`)

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

const caseName = `Cusato Jump Seed ${new Date().toISOString().slice(0, 16)}`
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

const transcriptPath = `${userId}/${caseRow.id}/transcript/jump_highlight_seed.txt`
const extractedPath = `${userId}/${caseRow.id}/extracted/jump_highlight_seed.json`
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
    file_name: 'jump_highlight_seed.txt',
    file_size: transcriptBody.length,
    storage_path: transcriptPath,
    mime_type: 'text/plain',
  },
  {
    case_id: caseRow.id,
    file_type: 'extracted',
    file_name: 'jump_highlight_seed.json',
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
console.log('  editor:', `${url.includes('localhost') ? 'local app' : 'app'} → /dashboard/editor?case=${caseRow.id}`)
console.log('\nChecklist:')
console.log('  [ ] Pages 6–7 show with right-aligned page numbers (not half-page)')
console.log('  [ ] Jump + Accept on Exhibit Number 1 keeps timestamp gutter')
console.log('  [ ] Jump on Exhibit Number 2 lands on "marked as…again"')
console.log('  [ ] Jump on Exhibit Number 3 / Jonelle Blaze / stage name works')
console.log('  [ ] "returning the moon rocks" card is NOT in the list')
console.log('\nNo Gemini involved.')
process.exit(0)
