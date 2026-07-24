// Stuck-case sweeper: find cases left in `processing` with no heartbeat,
// re-kick analysis once, then refund+fail (same path as analyze-case failures).
//
// Auth:
// - Service role → all users' stuck cases (cron / analyze-case opportunistic kick)
// - User JWT → only that user's stuck cases (dashboard safety net)
//
// Schedule (recommended): Supabase Dashboard → Edge Functions → sweep-stuck-cases
// → Add schedule every 5 minutes, auth with service role. Also invoked
// opportunistically from analyze-case and from the dashboard via
// retryStuckCases().

import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

const STUCK_AFTER_MS = 15 * 60 * 1000
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function clearExtracting(admin: any, userId: string, caseId: string): Promise<void> {
  const prefix = `${userId}/${caseId}/extracting`
  const { data: files } = await admin.storage.from('case-files').list(prefix)
  if (!files?.length) return
  const paths = files.map((f: { name: string }) => `${prefix}/${f.name}`)
  await admin.storage.from('case-files').remove(paths)
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
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  // Prefer exact key match; also accept any JWT whose payload role is
  // service_role (covers key rotation / CLI vs dashboard secret drift).
  let isServiceRole = Boolean(SERVICE_ROLE_KEY) && bearer === SERVICE_ROLE_KEY
  if (!isServiceRole && bearer.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(bearer.split('.')[1]!))
      isServiceRole = payload?.role === 'service_role'
    } catch { /* ignore */ }
  }

  let scopeUserId: string | null = null
  if (!isServiceRole) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await userClient.auth.getUser()
    scopeUserId = userData?.user?.id ?? null
    if (!scopeUserId) return json({ error: 'Unauthorized.' }, 401)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS).toISOString()

  let q = admin
    .from('cases')
    .select('id, user_id, name, tokens_charged, analysis_restart_count, updated_at, case_files(file_type, storage_path)')
    .eq('status', 'processing')
    .is('deleted_at', null)
    .lt('updated_at', stuckBefore)
    .limit(25)

  if (scopeUserId) q = q.eq('user_id', scopeUserId)

  const { data: stuck, error } = await q
  if (error) {
    console.error('sweep query failed', error)
    return json({ error: error.message }, 500)
  }

  const results: { case_id: string; action: string }[] = []

  for (const c of stuck || []) {
    const files = (c as any).case_files || []
    const hasExtracted = files.some((f: any) => f.file_type === 'extracted')

    // Extracted JSON exists but status never flipped — recover without re-billing.
    if (hasExtracted) {
      const { error: upErr } = await admin
        .from('cases')
        .update({ status: 'analyzed', updated_at: new Date().toISOString() })
        .eq('id', c.id)
        .eq('status', 'processing')
      results.push({ case_id: c.id, action: upErr ? `recover_failed:${upErr.message}` : 'recovered_analyzed' })
      continue
    }

    const restarts = c.analysis_restart_count || 0

    if (restarts < 1) {
      try {
        await clearExtracting(admin, c.user_id, c.id)
        const { error: bumpErr } = await admin
          .from('cases')
          .update({
            analysis_restart_count: 1,
            updated_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', c.id)
          .eq('status', 'processing')
        if (bumpErr) {
          results.push({ case_id: c.id, action: `restart_bump_failed:${bumpErr.message}` })
          continue
        }

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/analyze-case`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            apikey: SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({ case_id: c.id, pass: 'extract', internal: true }),
        })
        results.push({
          case_id: c.id,
          action: resp.ok ? 're_kicked' : `re_kick_http_${resp.status}`,
        })
      } catch (err) {
        results.push({
          case_id: c.id,
          action: `re_kick_error:${(err as Error)?.message || err}`,
        })
      }
      continue
    }

    // Already re-kicked once — fail + refund via analyze-case handleFailure.
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/analyze-case`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          case_id: c.id,
          pass: 'fail',
          stage: 'stuck sweeper (after one re-kick)',
          reason: 'STUCK_ANALYSIS_TIMEOUT',
        }),
      })
      results.push({
        case_id: c.id,
        action: resp.ok ? 'failed_refunded' : `fail_http_${resp.status}`,
      })
    } catch (err) {
      results.push({
        case_id: c.id,
        action: `fail_error:${(err as Error)?.message || err}`,
      })
    }
  }

  return json({ ok: true, checked: (stuck || []).length, results })
})
