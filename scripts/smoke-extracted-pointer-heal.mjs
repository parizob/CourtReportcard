#!/usr/bin/env node
/**
 * Dev smoke: KUNECKI-class orphan heal.
 *
 * Plants extracted JSON in storage WITHOUT a case_files extracted row, then
 * invokes analyze-case proofread (storage-already-exists skip path). Asserts
 * the DB pointer is created and the case reaches analyzed.
 *
 * Also asserts a client-style heal (list storage → insert case_files) works
 * as a fallback matching DashboardEditor loadCase.
 *
 * Usage: node scripts/smoke-extracted-pointer-heal.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'

const DEV_REF = 'jotklhjskmewzfsgzkvp'

function fail(msg) {
  console.error('FAIL:', msg)
  process.exit(1)
}

function ok(msg) {
  console.log('  ok ', msg)
}

console.log(`This will hit Dev (${DEV_REF})`)

const keys = JSON.parse(
  execSync(`supabase projects api-keys --project-ref ${DEV_REF} -o json`, { encoding: 'utf8' }),
)
const sr = keys.find((k) => k.name === 'service_role')?.api_key
if (!sr) fail('no Dev service_role key')
const url = `https://${DEV_REF}.supabase.co`
const admin = createClient(url, sr, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let userId
{
  const { data: listed, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
  if (error) fail(`listUsers: ${error.message}`)
  const users = listed?.users || []
  const prefer = users.find((u) => /parizob1@gmail\.com/i.test(u.email || ''))
  userId = (prefer || users[0])?.id
  if (!userId) fail('no Dev auth users')
  console.log('  using user', prefer?.email || users[0]?.email)
}

const stamp = Date.now()
const base = `heal_pointer_${stamp}`
const originalText = 'Q. Who was present?\nA. Only counsel for the plaintiff.\n'
const extracted = {
  title: 'Heal pointer smoke',
  extracted_at: new Date().toISOString(),
  entries: [
    { id: 1, speaker: 'Q', text: 'Who was present?' },
    { id: 2, speaker: 'A', text: 'Only counsel for the plaintiff.' },
  ],
  annotations: [
    {
      id: 1,
      entry_id: 2,
      type: 'spelling',
      severity: 'critical',
      original: 'counsel',
      suggestion: 'counsel',
      status: 'open',
      start: 5,
      end: 12,
      explanation: 'smoke fixture',
    },
  ],
  dropped_annotations_count: 0,
  originalText,
}
const extractedBytes = JSON.stringify(extracted, null, 2)

async function plantOrphanCase(label) {
  const { data: caseRow, error: caseErr } = await admin
    .from('cases')
    .insert({
      user_id: userId,
      name: `${label} ${stamp}`,
      status: 'processing',
      tokens_charged: 0,
      analysis_stage: 'proofread',
    })
    .select('id')
    .single()
  if (caseErr) fail(`cases insert (${label}): ${caseErr.message}`)
  const caseId = caseRow.id

  const transcriptPath = `${userId}/${caseId}/transcript/${base}.txt`
  const finalPath = `${userId}/${caseId}/extracted/${base}_extracted.json`

  const { error: upT } = await admin.storage
    .from('case-files')
    .upload(transcriptPath, originalText, { contentType: 'text/plain', upsert: true })
  if (upT) fail(`transcript upload (${label}): ${upT.message}`)

  const { error: upE } = await admin.storage
    .from('case-files')
    .upload(finalPath, extractedBytes, { contentType: 'application/json', upsert: true })
  if (upE) fail(`extracted upload (${label}): ${upE.message}`)

  const { error: filesErr } = await admin.from('case_files').insert({
    case_id: caseId,
    file_type: 'transcript',
    file_name: `${base}.txt`,
    file_size: originalText.length,
    storage_path: transcriptPath,
    mime_type: 'text/plain',
  })
  if (filesErr) fail(`case_files transcript (${label}): ${filesErr.message}`)

  // Intentionally NO extracted case_files row — the orphan.
  return { caseId, finalPath, transcriptPath }
}

async function assertExtractedRow(caseId, finalPath, label) {
  const { data: rows, error } = await admin
    .from('case_files')
    .select('id, file_type, storage_path, file_name')
    .eq('case_id', caseId)
    .eq('file_type', 'extracted')
  if (error) fail(`case_files select (${label}): ${error.message}`)
  if (!rows?.length) fail(`${label}: no extracted case_files row after heal`)
  if (!rows.some((r) => r.storage_path === finalPath)) {
    fail(`${label}: extracted row path mismatch ${JSON.stringify(rows)}`)
  }
  ok(`${label}: extracted case_files row present`)
  return rows[0]
}

console.log('\n=== A) Edge skip-path heal (analyze-case) ===')
{
  const { caseId, finalPath } = await plantOrphanCase('edge-heal')
  console.log('  case', caseId)

  const { data: before } = await admin
    .from('case_files')
    .select('file_type')
    .eq('case_id', caseId)
  if ((before || []).some((f) => f.file_type === 'extracted')) {
    fail('precondition: extracted row should be absent')
  }
  ok('precondition: orphan (storage yes, case_files no)')

  const invoke = await fetch(`${url}/functions/v1/analyze-case`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sr}`,
      apikey: sr,
    },
    body: JSON.stringify({
      case_id: caseId,
      pass: 'proofread',
      file_index: 0,
      batch_index: 0,
      attempt: 0,
      internal: true,
    }),
  })
  const invokeText = await invoke.text()
  console.log('  invoke HTTP', invoke.status, invokeText.slice(0, 180))
  if (!invoke.ok) fail(`analyze-case invoke failed: ${invoke.status} ${invokeText}`)

  let status = null
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const { data: c } = await admin
      .from('cases')
      .select('status, analysis_stage, last_error')
      .eq('id', caseId)
      .single()
    status = c?.status
    if (c?.status === 'analyzed') break
    if (c?.status === 'failed') fail(`case failed: ${c.last_error}`)
    // Row may appear before status flips — check early.
    const { data: mid } = await admin
      .from('case_files')
      .select('id')
      .eq('case_id', caseId)
      .eq('file_type', 'extracted')
      .limit(1)
    if (mid?.length) {
      ok(`pointer healed at poll ${i + 1} (status=${c?.status})`)
      // wait a bit more for analyzed if needed
      if (c?.status === 'analyzed') break
    }
  }

  await assertExtractedRow(caseId, finalPath, 'edge')
  const { data: c2 } = await admin.from('cases').select('status').eq('id', caseId).single()
  if (c2?.status !== 'analyzed') {
    fail(`expected analyzed, got ${c2?.status}`)
  }
  ok('case reached analyzed')

  // soft-delete smoke case
  await admin.from('cases').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', caseId)
}

console.log('\n=== B) Client-style heal (editor loadCase pattern) ===')
{
  const { caseId, finalPath } = await plantOrphanCase('client-heal')
  console.log('  case', caseId)

  const prefix = `${userId}/${caseId}/extracted`
  const { data: listed, error: listErr } = await admin.storage.from('case-files').list(prefix, { limit: 20 })
  if (listErr) fail(`storage list: ${listErr.message}`)
  const jsonFile = listed?.find((f) => /\.json$/i.test(f.name))
  if (!jsonFile) fail('no extracted json in storage for client heal')

  const storagePath = `${prefix}/${jsonFile.name}`
  const fileSize = jsonFile.metadata?.size ?? extractedBytes.length
  const { data: healed, error: healErr } = await admin
    .from('case_files')
    .insert({
      case_id: caseId,
      file_type: 'extracted',
      file_name: jsonFile.name,
      file_size: typeof fileSize === 'number' ? fileSize : extractedBytes.length,
      storage_path: storagePath,
      mime_type: 'application/json',
    })
    .select('*')
    .single()
  if (healErr) fail(`client heal insert: ${healErr.message}`)
  if (healed.storage_path !== finalPath) fail(`path mismatch ${healed.storage_path}`)
  ok('client heal insert succeeded')

  const { data: blob, error: dlErr } = await admin.storage.from('case-files').download(healed.storage_path)
  if (dlErr || !blob) fail(`download after heal: ${dlErr?.message}`)
  const parsed = JSON.parse(await blob.text())
  if ((parsed.entries || []).length !== 2) fail('downloaded entries mismatch')
  if ((parsed.annotations || []).length !== 1) fail('downloaded annotations mismatch')
  ok('download + parse after heal')

  await admin.from('cases').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', caseId)
}

console.log('\nPASS: Dev extracted-pointer heal smoke green.')
