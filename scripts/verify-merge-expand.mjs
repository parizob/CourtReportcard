#!/usr/bin/env node
/**
 * Verify merge-time exact-repeat expand (Jackie / focussed class).
 *
 * 1) Offline: unit suite + merge-only simulation (no Gemini, no network).
 * 2) Live Dev (default): plant 2 proofread batch JSONs (seed only in batch 1),
 *    invoke analyze-case merge sentinel (batch_index >= numBatches), assert
 *    the final extracted JSON has cards on early + late entries.
 *
 * Usage:
 *   node scripts/verify-merge-expand.mjs
 *   node scripts/verify-merge-expand.mjs --offline-only
 */
import { createClient } from '@supabase/supabase-js'
import { execSync, spawnSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { expandExactRepeatAnnotations } from '../src/lib/gemini.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_REF = 'jotklhjskmewzfsgzkvp'
const offlineOnly = process.argv.includes('--offline-only')

function fail(msg) {
  console.error('FAIL:', msg)
  process.exit(1)
}

function ok(msg) {
  console.log('  ok ', msg)
}

console.log('=== 1) Unit suite ===')
{
  const r = spawnSync(process.execPath, ['scripts/test-expand-exact-repeats.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  process.stdout.write(r.stdout || '')
  process.stderr.write(r.stderr || '')
  if (r.status !== 0) fail('test-expand-exact-repeats.mjs failed')
}

console.log('\n=== 2) Offline merge-only simulation (no per-batch expand) ===')
{
  function mergeExpand(entries, batchAnnotationLists) {
    let all = batchAnnotationLists.flat()
    const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
    const seen = new Set()
    all = all.filter((a) => {
      const key = `${a.entry_id}:${normalize(a.original)}:${a.type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return expandExactRepeatAnnotations(entries, all)
  }

  const entries = [
    { id: 10, text: 'I was focussed on the eyeglasses.' },
    { id: 20, text: 'Still focussed mostly on that.' },
    { id: 300, text: 'People are focussed on building that business.' },
  ]
  const batch0 = []
  const batch1 = [{
    id: 1,
    entry_id: 300,
    type: 'spelling',
    original: 'focussed',
    suggestion: 'focused',
    status: 'open',
    start: entries[2].text.indexOf('focussed'),
    end: entries[2].text.indexOf('focussed') + 8,
  }]
  const out = mergeExpand(entries, [batch0, batch1])
  const ids = out.filter((a) => a.original === 'focussed').map((a) => a.entry_id).sort((a, b) => a - b)
  if (ids.join(',') !== '10,20,300') fail(`expected cards on 10,20,300 got ${ids}`)
  ok('cross-batch seed → early hits')
}

if (offlineOnly) {
  console.log('\nAll offline checks passed (--offline-only).')
  process.exit(0)
}

console.log('\n=== 3) Live Dev Edge merge (no Gemini) ===')
console.log(`This will hit Dev (${DEV_REF}) — write test case + merge invoke`)

const keys = JSON.parse(
  execSync(`supabase projects api-keys --project-ref ${DEV_REF} -o json`, { encoding: 'utf8' }),
)
const sr = keys.find((k) => k.name === 'service_role')?.api_key
if (!sr) fail('no Dev service_role key')
const url = `https://${DEV_REF}.supabase.co`
const admin = createClient(url, sr, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Prefer Brandon's Dev account if present; else any user.
let userId
{
  const { data: listed, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
  if (error) fail(`listUsers: ${error.message}`)
  const users = listed?.users || []
  const prefer = users.find((u) => /parizob1@gmail\.com/i.test(u.email || ''))
  userId = (prefer || users[0])?.id
  if (!userId) fail('no Dev auth users to attach test case')
  console.log('  using user', prefer?.email || users[0]?.email)
}

const BATCH = 250
const nEntries = BATCH + 1 // forces 2 proofread batches
const entries = []
for (let i = 1; i <= nEntries; i++) {
  if (i === 1) {
    entries.push({ id: i, speaker: 'A', text: 'I was focussed on the eyeglasses.' })
  } else if (i === nEntries) {
    entries.push({
      id: i,
      speaker: 'A',
      text: 'People there are focussed on building that business.',
    })
  } else {
    entries.push({ id: i, speaker: 'Q', text: `Okay line ${i}.` })
  }
}

const seedStart = entries[nEntries - 1].text.indexOf('focussed')
const batch0 = { annotations: [], droppedCount: 0 }
const batch1 = {
  annotations: [{
    id: 1,
    entry_id: nEntries,
    type: 'spelling',
    original: 'focussed',
    suggestion: 'focused',
    status: 'open',
    start: seedStart,
    end: seedStart + 'focussed'.length,
    explanation: 'verify-merge-expand seed',
    confidence: 0.99,
    severity: 'critical',
  }],
  droppedCount: 0,
}

const caseName = `verify-merge-expand ${new Date().toISOString().slice(0, 19)}`
const { data: caseRow, error: caseErr } = await admin
  .from('cases')
  .insert({
    user_id: userId,
    name: caseName,
    status: 'processing',
    analysis_stage: 'proofreading',
    tokens_charged: 0,
  })
  .select('id')
  .single()
if (caseErr) fail(`create case: ${caseErr.message}`)
const caseId = caseRow.id
const base = 'verify_merge_expand'
const extractingDir = `${userId}/${caseId}/extracting`
const extractedDir = `${userId}/${caseId}/extracted`
const transcriptPath = `${userId}/${caseId}/transcript/${base}.txt`
const entriesPath = `${extractingDir}/${base}_entries.json`
const batch0Path = `${extractingDir}/${base}_annotations_batch0.json`
const batch1Path = `${extractingDir}/${base}_annotations_batch1.json`
const finalPath = `${extractedDir}/${base}_extracted.json`

const originalText = entries.map((e) => e.text).join('\n')
const entriesJson = JSON.stringify({ title: caseName, entries, originalText }, null, 2)

async function upload(path, body, contentType) {
  const { error } = await admin.storage.from('case-files').upload(path, body, {
    upsert: true,
    contentType,
  })
  if (error) fail(`upload ${path}: ${error.message}`)
}

await upload(transcriptPath, originalText, 'text/plain')
await upload(entriesPath, entriesJson, 'application/json')
await upload(batch0Path, JSON.stringify(batch0, null, 2), 'application/json')
await upload(batch1Path, JSON.stringify(batch1, null, 2), 'application/json')

const { error: filesErr } = await admin.from('case_files').insert({
  case_id: caseId,
  file_type: 'transcript',
  file_name: `${base}.txt`,
  file_size: originalText.length,
  storage_path: transcriptPath,
  mime_type: 'text/plain',
})
if (filesErr) fail(`case_files: ${filesErr.message}`)

console.log('  case', caseId)
console.log('  invoking merge sentinel (batch_index=2, numBatches=2)…')

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
    batch_index: 2, // >= numBatches → merge only, no Gemini
    attempt: 0,
    internal: true,
  }),
})
const invokeText = await invoke.text()
console.log('  invoke HTTP', invoke.status, invokeText.slice(0, 200))
if (!invoke.ok) fail(`analyze-case invoke failed: ${invoke.status} ${invokeText}`)

let final = null
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 1500))
  const { data: blob, error } = await admin.storage.from('case-files').download(finalPath)
  if (!error && blob) {
    final = JSON.parse(await blob.text())
    break
  }
  const { data: c } = await admin.from('cases').select('status, analysis_stage, last_error').eq('id', caseId).single()
  if (c?.status === 'failed') fail(`case failed: ${c.last_error}`)
  process.stdout.write(`  waiting… status=${c?.status} stage=${c?.analysis_stage}\n`)
}

if (!final) fail('timed out waiting for extracted JSON after merge')

const focus = (final.annotations || []).filter((a) => (a.original || '').toLowerCase() === 'focussed')
const entryIds = focus.map((a) => a.entry_id).sort((a, b) => a - b)
console.log('  focussed cards', focus.length, 'entry_ids', entryIds)

if (!entryIds.includes(1)) fail('missing early entry 1 card (cross-batch expand broken)')
if (!entryIds.includes(nEntries)) fail('missing seed entry card')
if (focus.length < 2) fail(`expected >= 2 focussed cards, got ${focus.length}`)

const { data: c2 } = await admin.from('cases').select('status').eq('id', caseId).single()
console.log('  case status', c2?.status)
console.log(`  editor (Dev): https://courtreportcard.com would not apply — use localhost with Dev keys`)
console.log(`  case id: ${caseId}`)

console.log('\nPASS: offline + live Dev merge expand verified.')
