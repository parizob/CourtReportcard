/**
 * Smoke test: upload a tiny transcript whose file name contains `#`
 * (Eclipse-style JOB#…), invoke analyze-case, wait for analyzed/deleted.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/smoke-hash-filename.mjs
 *
 * Uses service role + internal:true so no user JWT is required.
 * Does not touch token_ledger (tokens_charged = 0).
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wyexjojoezttbzhcpkco.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OWNER_ID = process.env.SMOKE_USER_ID || 'c3c26379-c4bc-4e1a-8022-dcacbe018cf4'

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function safeStorageFileName(name) {
  const base = (name || '').split(/[/\\]/).pop() || 'transcript'
  const cleaned = base.replace(/[^\w.\-() +]/g, '_').replace(/_+/g, '_')
  return cleaned || 'transcript.txt'
}

const ORIGINAL_NAME = 'EH.TRAN.JOB#129107-SMOKE.txt'
const STORAGE_NAME = safeStorageFileName(ORIGINAL_NAME)

// Minimal caption-like transcript (~1 page markers) so extract+proofread stay cheap.
const BODY = `
                                                                           1

                1                            IN THE CIRCUIT COURT

                2                            CASE NO.: 99-SMOKE-1

                3  APPEARANCES

                4  JOHN SMITH, ESQUIRE

                5

                                                                           2

                1            Q.    What is your name?

                2            A.    My name is John Smith.

                3            Q.    Did council advise you of your rights?

                4            A.    Yes.
`

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const caseName = `SMOKE hash-filename ${new Date().toISOString().slice(0, 19)}`
console.log('Creating case:', caseName)
console.log('Original file_name:', ORIGINAL_NAME)
console.log('Storage key:', STORAGE_NAME)

const { data: caseRow, error: caseErr } = await admin
  .from('cases')
  .insert({
    user_id: OWNER_ID,
    name: caseName,
    status: 'processing',
    tokens_charged: 0,
  })
  .select()
  .single()
if (caseErr) throw caseErr

const caseId = caseRow.id
const storagePath = `${OWNER_ID}/${caseId}/transcript/${STORAGE_NAME}`

const bytes = new TextEncoder().encode(BODY)
const { error: upErr } = await admin.storage
  .from('case-files')
  .upload(storagePath, bytes, { contentType: 'text/plain', upsert: true })
if (upErr) throw upErr

const { error: fileErr } = await admin.from('case_files').insert({
  case_id: caseId,
  file_type: 'transcript',
  file_name: ORIGINAL_NAME,
  file_size: bytes.byteLength,
  storage_path: storagePath,
  mime_type: 'text/plain',
})
if (fileErr) throw fileErr

console.log('Invoking analyze-case (internal) for', caseId)
const resp = await fetch(`${SUPABASE_URL}/functions/v1/analyze-case`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    apikey: SERVICE_ROLE_KEY,
  },
  body: JSON.stringify({ case_id: caseId, pass: 'extract', internal: true }),
})
console.log('Handoff status:', resp.status, await resp.text())

const deadline = Date.now() + 5 * 60 * 1000
let final = null
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 5000))
  const { data } = await admin
    .from('cases')
    .select('id, status, last_error, updated_at')
    .eq('id', caseId)
    .single()
  console.log('…', data?.status, data?.last_error ? `last_error=${data.last_error.slice(0, 120)}` : '')
  if (data && data.status !== 'processing') {
    final = data
    break
  }
}

if (!final) {
  console.error('TIMEOUT still processing')
  process.exit(2)
}

if (final.status === 'deleted' || final.last_error) {
  console.error('FAILED', final)
  process.exit(1)
}

console.log('SUCCESS', final)
process.exit(0)
