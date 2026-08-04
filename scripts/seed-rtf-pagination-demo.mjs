/**
 * Seed a Dev case from the Wells RTF after stripRtf — what the editor sees
 * for a typical RTF upload (often weak page-break markers).
 *
 *   SEED_EMAIL=... SEED_PASSWORD=... npm run seed:rtf-pagination
 *
 * Or with Dev service role (no password):
 *   SEED_USER_EMAIL=you@example.com node scripts/seed-rtf-pagination-demo.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { prepareTranscriptUpload } from '../src/lib/prepareTranscriptUpload.js'

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
if (!url || !url.includes('jotklhjskmewzfsgzkvp')) {
  console.error('Refusing to seed: VITE_SUPABASE_URL must be Dev (jotklhjskmewzfsgzkvp).')
  process.exit(1)
}

const rtfPath = join(__dirname, '.repro/WellsDR042926.rtf')
const rtf = readFileSync(rtfPath, 'utf8')
const prep = prepareTranscriptUpload('WellsDR042926.rtf', rtf)
const plain = prep.plainText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

// Lightweight entries so the editor can open (no Gemini).
const lines = plain.split('\n').filter((l) => l.trim().length > 0)
const entries = []
let buf = []
let speaker = 'CAPTION'
for (const line of lines.slice(0, 80)) {
  const q = line.match(/^\s*\d{0,2}\s*Q[\t. ]/i)
  const a = line.match(/^\s*\d{0,2}\s*A[\t. ]/i)
  if (q || a) {
    if (buf.length) {
      entries.push({
        id: entries.length + 1,
        speaker,
        text: buf.join('\n'),
        timestamp: null,
        line_number: null,
      })
      buf = []
    }
    speaker = q ? 'Q' : 'A'
  }
  buf.push(line)
}
if (buf.length) {
  entries.push({
    id: entries.length + 1,
    speaker,
    text: buf.join('\n'),
    timestamp: null,
    line_number: null,
  })
}
if (entries.length === 0) {
  entries.push({
    id: 1,
    speaker: 'CAPTION',
    text: plain.slice(0, 2000),
    timestamp: null,
    line_number: null,
  })
}

const extracted = {
  title: 'Wells RTF pagination demo',
  entries,
  annotations: [],
  originalText: plain,
  wasRtf: true,
}

const email =
  process.env.SEED_EMAIL ||
  process.env.SEED_USER_EMAIL ||
  process.env.VITE_BILLING_TEST_USER_EMAIL
const password = process.env.SEED_PASSWORD

let supabase
let userId

if (password && email) {
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  supabase = createClient(url, anon)
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (authErr) {
    console.error('Sign-in failed:', authErr.message)
    process.exit(1)
  }
  userId = auth.user.id
  console.log('Signed in as', email)
} else if (email) {
  // Service role: Dev only (already gated by URL check).
  let service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!service) {
    const ref = 'jotklhjskmewzfsgzkvp'
    const keys = JSON.parse(
      execSync(`supabase projects api-keys --project-ref ${ref} -o json`, {
        encoding: 'utf8',
      }),
    )
    service = keys.find((k) => k.name === 'service_role')?.api_key
  }
  if (!service) {
    console.error('Could not load Dev service_role key')
    process.exit(1)
  }
  supabase = createClient(url, service)
  const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listErr) {
    console.error('listUsers failed:', listErr.message)
    process.exit(1)
  }
  const user = (listed?.users || []).find(
    (u) => (u.email || '').toLowerCase() === email.toLowerCase(),
  )
  if (!user) {
    console.error(`No Dev user with email ${email}. Set SEED_EMAIL/SEED_PASSWORD instead.`)
    process.exit(1)
  }
  userId = user.id
  console.log('Using service role for', email)
} else {
  console.error('Set SEED_EMAIL (+ SEED_PASSWORD) or SEED_USER_EMAIL')
  process.exit(1)
}

console.log('Project', url)
console.log('Pages (current counter):', prep.pages)

const caseName = `RTF pagination demo (Wells) ${new Date().toISOString().slice(0, 16)}`
const { data: caseRow, error: caseErr } = await supabase
  .from('cases')
  .insert({
    user_id: userId,
    name: caseName,
    status: 'analyzed',
    analysis_stage: 'analyzed',
    tokens_charged: prep.pages,
  })
  .select()
  .single()
if (caseErr) {
  console.error('Create case failed:', caseErr.message)
  process.exit(1)
}

const transcriptPath = `${userId}/${caseRow.id}/transcript/WellsDR042926.txt`
const extractedPath = `${userId}/${caseRow.id}/extracted/WellsDR042926_extracted.json`
const extractedJson = JSON.stringify(extracted, null, 2)

const { error: up1 } = await supabase.storage
  .from('case-files')
  .upload(transcriptPath, Buffer.from(plain, 'utf8'), {
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
    // Keep .rtf in the display name so the editor soft-wraps RTF uploads.
    file_name: 'WellsDR042926.rtf',
    file_size: Buffer.byteLength(plain, 'utf8'),
    storage_path: transcriptPath,
    mime_type: 'text/plain',
  },
  {
    case_id: caseRow.id,
    file_type: 'extracted',
    file_name: 'WellsDR042926_extracted.json',
    file_size: Buffer.byteLength(extractedJson, 'utf8'),
    storage_path: extractedPath,
    mime_type: 'application/json',
  },
])
if (filesErr) {
  console.error('case_files insert failed:', filesErr.message)
  process.exit(1)
}

await supabase.from('case_metrics').upsert(
  {
    case_id: caseRow.id,
    total_entries: entries.length,
    total_issues: 0,
    accepted: 0,
    ignored: 0,
    open: 0,
    custom_changed: 0,
    annotations_by_type: {},
    last_reviewed_at: new Date().toISOString(),
  },
  { onConflict: 'case_id' },
)

console.log('\nSeeded Dev case (RTF → stripped text, like a real upload):')
console.log('  name:', caseName)
console.log('  id:  ', caseRow.id)
console.log(`  editor: http://localhost:3000/dashboard/editor?case=${caseRow.id}`)
console.log('Open that URL while logged into Dev. Compare page breaks to a normal .txt case.')
process.exit(0)
