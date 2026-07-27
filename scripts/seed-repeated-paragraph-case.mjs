/**
 * Seed: CAT Repeated Paragraph Type (consecutive A./A. or Q./Q.).
 *
 * Checklist after seed:
 *   1. Open case → two open cards: Repeated Paragraph on A./A. (line 3) and Q./Q. (line 10)
 *   2. No flag on Q. after THE COURT REPORTER (line 7 = Q/colloquy/Q control)
 *   3. Card shows note: Court Reportcard will not change Q/A markers
 *   4. Jump → lands on the repeated marker line
 *   5. Mark as reviewed → Resolved; transcript text unchanged
 *   6. Export → same Q/A markers (no instructional text inserted)
 *   7. Reopen → card returns to open list
 *
 * Usage:
 *   SEED_EMAIL='you@example.com' SEED_PASSWORD='…' npm run seed:repeated-paragraph
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  detectRepeatedParagraphTypes,
  mergeRepeatedParagraphAnnotations,
  ensureAcceptedCorrectionsInOriginalText,
  locateAnnotationWithAnchor,
  buildCleanContentMap,
  REPEATED_PARAGRAPH_TYPE,
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
    'Set SEED_EMAIL and SEED_PASSWORD then re-run.\n' +
      '  SEED_EMAIL=... SEED_PASSWORD=... npm run seed:repeated-paragraph'
  )
  process.exit(1)
}

const extracted = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/repeated-paragraph-seed.json'), 'utf8')
)

const detected = detectRepeatedParagraphTypes(
  extracted.originalText,
  extracted.entries
)
extracted.annotations = mergeRepeatedParagraphAnnotations(
  extracted.originalText,
  extracted.entries,
  extracted.annotations || []
)

const { cleanContent } = buildCleanContentMap(extracted.originalText)
console.log(`Preflight: detected ${detected.length} repeated-paragraph flag(s)`)
let ok = true
for (const ann of extracted.annotations) {
  if (ann.type !== REPEATED_PARAGRAPH_TYPE) continue
  const entry = extracted.entries.find((e) => e.id === ann.entry_id)
  const loc = locateAnnotationWithAnchor(cleanContent, entry, ann, ann.original)
  const line = loc
    ? cleanContent.slice(0, loc.cleanStart).split('\n').length
    : '?'
  console.log(
    `  ${loc ? 'OK  ' : 'MISS'} id=${ann.id} Found=${JSON.stringify(ann.original)} ~line ${line} anchors before=${JSON.stringify(ann._anchorBefore)} after=${JSON.stringify(ann._anchorAfter)}`
  )
  if (!loc) ok = false
}

const acceptedProbe = extracted.annotations.map((a) => ({ ...a, status: 'accepted' }))
const { text: exportText, failed } = ensureAcceptedCorrectionsInOriginalText(
  extracted.originalText,
  extracted.entries,
  acceptedProbe
)
if (exportText !== extracted.originalText || failed.length) {
  console.error('FAIL: review-only export must leave originalText unchanged')
  ok = false
} else {
  console.log('  OK   export with all accepted leaves text unchanged')
}

if (!ok || detected.length !== 2) {
  console.error(
    `Preflight failed (expected 2 flags, got ${detected.length}). Not seeding.`
  )
  process.exit(1)
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

const caseName = `Repeated Paragraph Seed ${new Date().toISOString().slice(0, 16)}`
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

const transcriptPath = `${userId}/${caseRow.id}/transcript/repeated_paragraph_seed.txt`
const extractedPath = `${userId}/${caseRow.id}/extracted/repeated_paragraph_seed.json`
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
    file_name: 'repeated_paragraph_seed.txt',
    file_size: transcriptBody.length,
    storage_path: transcriptPath,
    mime_type: 'text/plain',
  },
  {
    case_id: caseRow.id,
    file_type: 'extracted',
    file_name: 'repeated_paragraph_seed.json',
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
console.log('\nChecklist:')
console.log('  [ ] Flags only line 3 A. and line 10 Q. (not line 7 Q. after colloquy)')
console.log('  [ ] Card note: Court Reportcard will not change Q/A markers')
console.log('  [ ] Mark as reviewed → text unchanged; export unchanged')
console.log('  [ ] Reopen returns card to open list')
process.exit(0)
