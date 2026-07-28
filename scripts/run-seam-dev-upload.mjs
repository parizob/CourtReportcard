#!/usr/bin/env node
/**
 * Upload transcript_08_chunk_seams.txt to Dev and kick analyze-case.
 *
 * Usage:
 *   SEED_EMAIL='…' SEED_PASSWORD='…' node scripts/run-seam-dev-upload.mjs
 *
 * Uses VITE_SUPABASE_* from .env (must be Dev). Charges ~32 tokens.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { countPages } from '../src/lib/pageCount.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!m || process.env[m[1]] != null) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      process.env[m[1]] = v
    }
  } catch { /* optional */ }
}

loadEnvFile(join(__dirname, '../.env'))
loadEnvFile(join(__dirname, '../.env.local'))

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.SEED_EMAIL || process.env.VITE_BILLING_TEST_USER_EMAIL
const password = process.env.SEED_PASSWORD || process.env.VITE_BILLING_TEST_USER_PASSWORD

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}
if (!url.includes('jotklhj')) {
  console.error('Refusing to run: VITE_SUPABASE_URL is not Dev (jotklhj…). Got:', url)
  process.exit(1)
}
if (!email || !password) {
  console.error('Set SEED_EMAIL and SEED_PASSWORD (Dev login), then re-run.')
  process.exit(1)
}

const fileName = 'transcript_08_chunk_seams.txt'
const plainText = readFileSync(join(__dirname, 'test-transcripts', fileName), 'utf8')
const pages = countPages(plainText)
console.log(`Transcript pages: ${pages}, bytes: ${plainText.length}`)

const supabase = createClient(url, anon)
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
if (authErr) {
  console.error('Sign-in failed:', authErr.message)
  process.exit(1)
}
const userId = auth.user.id
console.log('Signed in as', email)

const { data: bal } = await supabase.from('user_profiles').select('balance').eq('user_id', userId).single()
console.log('Balance before:', bal?.balance)
if ((bal?.balance ?? 0) < pages) {
  console.error(`Need ${pages} tokens; balance is ${bal?.balance}. Top up Dev account first.`)
  process.exit(1)
}

const { data: spent, error: spendErr } = await supabase.rpc('spend_tokens', { p_amount: pages })
if (spendErr) {
  console.error('spend_tokens failed:', spendErr.message)
  process.exit(1)
}
console.log('spend_tokens ok, new balance hint:', spent)

const caseName = `Chunk seam stress ${new Date().toISOString().slice(0, 16)}`
const { data: caseRow, error: caseErr } = await supabase
  .from('cases')
  .insert({ user_id: userId, name: caseName, tokens_charged: pages, status: 'uploaded' })
  .select()
  .single()
if (caseErr) {
  console.error('Create case failed:', caseErr.message)
  process.exit(1)
}

const storagePath = `${userId}/${caseRow.id}/transcript/${fileName}`
const { error: upErr } = await supabase.storage
  .from('case-files')
  .upload(storagePath, Buffer.from(plainText, 'utf8'), { contentType: 'text/plain', upsert: true })
if (upErr) {
  console.error('Upload failed:', upErr.message)
  process.exit(1)
}

const { error: fileErr } = await supabase.from('case_files').insert({
  case_id: caseRow.id,
  file_type: 'transcript',
  file_name: fileName,
  file_size: plainText.length,
  storage_path: storagePath,
  mime_type: 'text/plain',
})
if (fileErr) {
  console.error('case_files insert failed:', fileErr.message)
  process.exit(1)
}

await supabase.from('cases').update({ status: 'processing' }).eq('id', caseRow.id)

const { error: invokeErr } = await supabase.functions.invoke('analyze-case', {
  body: { case_id: caseRow.id },
})
if (invokeErr) {
  console.error('analyze-case invoke failed:', invokeErr.message)
  process.exit(1)
}

console.log('\nStarted analysis')
console.log('  case id:', caseRow.id)
console.log('  name:   ', caseName)
console.log('Polling…')

const deadline = Date.now() + 45 * 60 * 1000
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15000))
  const { data: c } = await supabase
    .from('cases')
    .select('id, status, analysis_stage, last_error, deleted_at')
    .eq('id', caseRow.id)
    .single()
  console.log(
    new Date().toISOString(),
    c?.status,
    c?.analysis_stage || '',
    c?.last_error ? `ERR:${String(c.last_error).slice(0, 120)}` : '',
  )
  if (c?.status === 'analyzed') {
    console.log('\nDONE analyzed')
    console.log(
      'Score with: node scripts/score-dense-dev-case.mjs',
      caseRow.id,
      'transcript_08_chunk_seams.manifest.json',
    )
    process.exit(0)
  }
  if (c?.status === 'deleted' || c?.deleted_at) {
    console.error('\nFAILED / deleted')
    console.error(c?.last_error)
    process.exit(1)
  }
}

console.error('Timed out after 45 min still processing')
process.exit(1)
