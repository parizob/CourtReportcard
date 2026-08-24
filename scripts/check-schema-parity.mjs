#!/usr/bin/env node
/**
 * Compare curated schema expectations across Dev and Prod.
 *
 * Does NOT prove full schema equality — only that columns/tables the app
 * and Edge Functions currently write/read exist on both sides.
 *
 * Usage:
 *   npm run check:schema-parity
 *
 * Exit 1 if Dev is missing anything Prod has (or anything in the checklist).
 * This is the tripwire for "we deployed code that writes analysis_stage but
 * Dev never got the migration."
 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'

const DEV_REF = 'jotklhjskmewzfsgzkvp'
const PROD_REF = 'wyexjojoezttbzhcpkco'

/**
 * Curated surface the product actually depends on.
 * Add a row here whenever a migration introduces a column/table that
 * Edge Functions or the client will select/update.
 */
const CHECKS = [
  { kind: 'column', table: 'cases', column: 'tokens_charged' },
  { kind: 'column', table: 'cases', column: 'last_error' },
  { kind: 'column', table: 'cases', column: 'analysis_restart_count' },
  { kind: 'column', table: 'cases', column: 'analysis_stage' },
  { kind: 'column', table: 'cases', column: 'last_exported_at' },
  { kind: 'column', table: 'cases', column: 'export_count' },
  { kind: 'column', table: 'user_profiles', column: 'heard_about_status' },
  { kind: 'column', table: 'user_profiles', column: 'heard_about' },
  { kind: 'column', table: 'user_profiles', column: 'export_include_line_numbers' },
  { kind: 'column', table: 'user_profiles', column: 'export_include_page_numbers' },
  { kind: 'column', table: 'user_profiles', column: 'auto_advance_on_accept' },
  { kind: 'column', table: 'case_metrics', column: 'dropped_annotations_count' },
  { kind: 'column', table: 'case_metrics', column: 'custom_changed' },
  { kind: 'column', table: 'token_ledger', column: 'stripe_checkout_session_id' },
  { kind: 'column', table: 'token_ledger', column: 'price_cents' },
  { kind: 'table', table: 'promo_codes' },
  { kind: 'table', table: 'promo_redemptions' },
  { kind: 'table', table: 'upload_failure_fingerprints' },
  { kind: 'table', table: 'telemetry_events' },
]

function apiKey(ref) {
  const keys = JSON.parse(
    execSync(`supabase projects api-keys --project-ref ${ref} -o json`, {
      encoding: 'utf8',
    }),
  )
  const sr = keys.find((k) => k.name === 'service_role')?.api_key
  if (!sr) throw new Error(`No service_role key for ${ref}`)
  return sr
}

function clientFor(ref) {
  return createClient(`https://${ref}.supabase.co`, apiKey(ref), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function probe(admin, check) {
  if (check.kind === 'table') {
    const { error } = await admin.from(check.table).select('*').limit(1)
    if (!error) return { ok: true }
    // Empty table is fine; missing relation is not.
    if (/does not exist|Could not find the table/i.test(error.message)) {
      return { ok: false, detail: error.message }
    }
    // RLS/permission weirdness still means the table exists.
    return { ok: true, detail: `reachable (${error.message})` }
  }

  const { error } = await admin.from(check.table).select(check.column).limit(1)
  if (!error) return { ok: true }
  if (/does not exist|Could not find/i.test(error.message)) {
    return { ok: false, detail: error.message }
  }
  return { ok: true, detail: `reachable (${error.message})` }
}

function label(check) {
  return check.kind === 'table' ? `table ${check.table}` : `${check.table}.${check.column}`
}

const dev = clientFor(DEV_REF)
const prod = clientFor(PROD_REF)

console.log('Schema parity probe')
console.log(`  Dev  ${DEV_REF}`)
console.log(`  Prod ${PROD_REF}`)
console.log('')

let missingDev = 0
let missingProd = 0
let drift = 0

for (const check of CHECKS) {
  const [d, p] = await Promise.all([probe(dev, check), probe(prod, check)])
  const name = label(check)
  if (d.ok && p.ok) {
    console.log(`  ok   ${name}`)
    continue
  }
  if (!d.ok && p.ok) {
    missingDev++
    drift++
    console.error(`  FAIL Dev missing ${name}`)
    if (d.detail) console.error(`       ${d.detail}`)
    continue
  }
  if (d.ok && !p.ok) {
    missingProd++
    drift++
    console.error(`  FAIL Prod missing ${name} (Dev has it — ship migration to Prod?)`)
    if (p.detail) console.error(`       ${p.detail}`)
    continue
  }
  drift++
  console.error(`  FAIL both missing ${name}`)
}

console.log('')
if (drift === 0) {
  console.log(`All ${CHECKS.length} checks present on Dev and Prod.`)
  process.exit(0)
}

console.error(`${drift} mismatch(es): Dev-missing=${missingDev}, Prod-missing=${missingProd}`)
console.error('Fix: apply the pending migration to the lagging project (Dev first), then re-run.')
console.error('  npm run check:schema-parity')
process.exit(1)
