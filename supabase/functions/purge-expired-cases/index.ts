// 90-day case content purge.
//
// Supabase blocks `DELETE FROM storage.objects` in SQL
// ("Direct deletion from storage tables is not allowed"), so the old
// `public.purge_expired_cases()` RPC fails whenever expired cases still have
// files. This Edge Function deletes via the Storage API, then marks cases
// purged (metrics retained).
//
// Auth: service role only (cron / manual ops).
// Schedule: daily 03:00 UTC via pg_cron + pg_net (same pattern as
// sweep-stuck-cases). Also invoke manually with service role Bearer.

import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

const RETENTION_DAYS = 90
const RAW_FAIL_TTL_MS = 48 * 60 * 60 * 1000
const RAW_FAIL_SCAN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const BATCH_LIMIT = 100

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function isServiceRoleBearer(bearer: string, serviceRoleKey: string): boolean {
  if (serviceRoleKey && bearer === serviceRoleKey) return true
  if (bearer.split('.').length !== 3) return false
  try {
    const payload = JSON.parse(atob(bearer.split('.')[1]!))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

/** Drop extract JSON fail blobs older than 48h under recently-deleted cases. */
async function purgeExpiredRawFailBlobs(admin: ReturnType<typeof createClient>): Promise<number> {
  const cutoffMs = Date.now() - RAW_FAIL_TTL_MS
  const scanAfter = new Date(Date.now() - RAW_FAIL_SCAN_WINDOW_MS).toISOString()
  const { data: cases, error } = await admin
    .from('cases')
    .select('id, user_id')
    .not('deleted_at', 'is', null)
    .gte('deleted_at', scanAfter)
    .limit(200)
  if (error) {
    console.warn('purgeExpiredRawFailBlobs case query failed', error.message)
    return 0
  }

  let removed = 0
  for (const c of cases || []) {
    const prefix = `${c.user_id}/${c.id}/extracting`
    const { data: files } = await admin.storage.from('case-files').list(prefix)
    const doomed = (files || [])
      .filter((f: { name?: string; created_at?: string }) => {
        if (!String(f.name || '').endsWith('_raw_fail.txt')) return false
        const created = f.created_at ? Date.parse(f.created_at) : NaN
        return Number.isFinite(created) && created < cutoffMs
      })
      .map((f: { name: string }) => `${prefix}/${f.name}`)
    if (!doomed.length) continue
    const { error: rmErr } = await admin.storage.from('case-files').remove(doomed)
    if (rmErr) console.warn('purgeExpiredRawFailBlobs remove failed', rmErr.message)
    else removed += doomed.length
  }
  return removed
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!isServiceRoleBearer(bearer, SERVICE_ROLE_KEY)) {
    return json({ error: 'Unauthorized. Service role required.' }, 401)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: expired, error: qErr } = await admin
    .from('cases')
    .select('id, name, user_id, created_at')
    .is('purged_at', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT)

  if (qErr) {
    console.error('purge query failed', qErr)
    return json({ error: qErr.message }, 500)
  }

  const results: { case_id: string; name: string; files_removed: number; ok: boolean; error?: string }[] = []

  for (const c of expired || []) {
    try {
      const { data: files, error: fErr } = await admin
        .from('case_files')
        .select('id, storage_path')
        .eq('case_id', c.id)
      if (fErr) throw new Error(fErr.message)

      const paths = (files || [])
        .map((f) => f.storage_path)
        .filter((p): p is string => Boolean(p))

      let filesRemoved = 0
      if (paths.length) {
        // Storage API accepts batches; chunk to stay under limits.
        const CHUNK = 50
        for (let i = 0; i < paths.length; i += CHUNK) {
          const slice = paths.slice(i, i + CHUNK)
          const { error: rmErr } = await admin.storage.from('case-files').remove(slice)
          if (rmErr) throw new Error(`storage.remove: ${rmErr.message}`)
          filesRemoved += slice.length
        }
      }

      const { error: delFilesErr } = await admin.from('case_files').delete().eq('case_id', c.id)
      if (delFilesErr) throw new Error(delFilesErr.message)

      const { error: upErr } = await admin
        .from('cases')
        .update({ purged_at: new Date().toISOString(), status: 'purged' })
        .eq('id', c.id)
        .is('purged_at', null)
      if (upErr) throw new Error(upErr.message)

      results.push({ case_id: c.id, name: c.name, files_removed: filesRemoved, ok: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('purge case failed', c.id, msg)
      results.push({ case_id: c.id, name: c.name, files_removed: 0, ok: false, error: msg })
    }
  }

  let rawFailPurged = 0
  try {
    rawFailPurged = await purgeExpiredRawFailBlobs(admin)
  } catch (e) {
    console.warn('purgeExpiredRawFailBlobs error', e)
  }

  const purged = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  return json({
    ok: failed === 0,
    cutoff,
    scanned: (expired || []).length,
    purged,
    failed,
    raw_fail_blobs_removed: rawFailPurged,
    results,
  })
})
