#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'

const PROD = 'wyexjojoezttbzhcpkco'
const keys = JSON.parse(
  execSync(`supabase projects api-keys --project-ref ${PROD} -o json`, { encoding: 'utf8' }),
)
const sr = keys.find((k) => k.name === 'service_role').api_key
const sb = createClient(`https://${PROD}.supabase.co`, sr, {
  auth: { persistSession: false },
})

const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
const emailBy = Object.fromEntries((list?.users || []).map((u) => [u.id, u.email]))
const isInternal = (e) => /parizob1|zoezimm|@courtreportcard/i.test(e || '')

const metrics = []
for (let offset = 0; offset < 2000; offset += 200) {
  const { data, error } = await sb
    .from('case_metrics')
    .select(
      'case_id, total_issues, dropped_annotations_count, accepted, ignored, open, total_entries, last_reviewed_at',
    )
    .order('last_reviewed_at', { ascending: false })
    .range(offset, offset + 199)
  if (error) throw error
  metrics.push(...(data || []))
  if (!data || data.length < 200) break
}

const caseIds = [...new Set(metrics.map((m) => m.case_id))]
const cases = []
for (let i = 0; i < caseIds.length; i += 80) {
  const { data, error } = await sb
    .from('cases')
    .select('id, name, status, user_id, created_at, deleted_at, tokens_charged')
    .in('id', caseIds.slice(i, i + 80))
  if (error) throw error
  cases.push(...(data || []))
}
const cBy = Object.fromEntries(cases.map((c) => [c.id, c]))

const rows = metrics
  .map((m) => {
    const c = cBy[m.case_id]
    if (!c || c.deleted_at) return null
    const email = emailBy[c.user_id]
    return {
      ...m,
      email,
      name: c.name,
      status: c.status,
      created: c.created_at,
      tokens: c.tokens_charged || 0,
      internal: isInternal(email),
    }
  })
  .filter(Boolean)

const withDrop = rows.filter((r) => (r.dropped_annotations_count || 0) > 0)
const zero = rows.filter((r) => (r.total_issues || 0) === 0 && (r.total_entries || 0) > 0)

console.log('=== SUMMARY ===')
console.log({
  cases: rows.length,
  with_dropped: withDrop.length,
  drop_sum: withDrop.reduce((s, r) => s + r.dropped_annotations_count, 0),
  zero_issues: zero.length,
  ext_dropped: withDrop.filter((r) => !r.internal).length,
  ext_zero: zero.filter((r) => !r.internal).length,
})

console.log('\n=== EXTERNAL DROPPED ===')
for (const r of withDrop
  .filter((r) => !r.internal)
  .sort((a, b) => b.dropped_annotations_count - a.dropped_annotations_count)
  .slice(0, 30)) {
  const denom = (r.total_issues || 0) + r.dropped_annotations_count
  const pct = denom ? Math.round((100 * r.dropped_annotations_count) / denom) : 0
  console.log(
    `${String(r.dropped_annotations_count).padStart(4)} drop | ${String(r.total_issues).padStart(4)} kept (${String(pct).padStart(2)}%) | ${String(r.tokens).padStart(3)}pg | ${r.email} | ${(r.name || '').slice(0, 36)} | ${(r.created || '').slice(0, 10)}`,
  )
}

console.log('\n=== EXTERNAL ZERO ISSUES tokens>=10 ===')
for (const r of zero
  .filter((r) => !r.internal && r.tokens >= 10)
  .sort((a, b) => (b.created || '').localeCompare(a.created || ''))
  .slice(0, 25)) {
  console.log(
    `${String(r.tokens).padStart(3)}pg | entries=${String(r.total_entries).padStart(5)} | drop=${r.dropped_annotations_count || 0} | ${r.email} | ${(r.name || '').slice(0, 36)} | ${(r.created || '').slice(0, 10)}`,
  )
}

const since = '2026-08-08'
console.log('\n=== SINCE Aug 8 (external drop or zero) ===')
for (const r of rows
  .filter(
    (r) =>
      !r.internal &&
      (r.created || '') >= since &&
      ((r.dropped_annotations_count || 0) > 0 || (r.total_issues || 0) === 0),
  )
  .sort((a, b) => (b.created || '').localeCompare(a.created || ''))) {
  console.log(
    `  ${(r.created || '').slice(0, 16)} drop=${r.dropped_annotations_count || 0} kept=${r.total_issues} pg=${r.tokens} | ${r.email} | ${r.name}`,
  )
}
EOF