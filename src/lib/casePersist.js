/**
 * Serializes editor → storage persists so Export / Dashboard / reload always
 * see the latest accept/ignore/reopen state.
 *
 * Design:
 * - `publishCaseReviewPending` stores a module-level snapshot (survives React
 *   unmount). Mutations publish synchronously before enqueueing a save.
 * - Jobs re-read `pending` when they run so the last accept wins.
 * - `waitForCasePersists` must finish before editor/export/dashboard download
 *   so a stale open snapshot cannot overwrite a good save on the way out.
 */

import { supabase, downloadCaseFile, uploadCaseFile } from './supabase'
import { countByType } from './annotationStats'

let chain = Promise.resolve()
let lastError = null

/** @type {null | {
 *   caseId: string,
 *   storagePath: string,
 *   title: string,
 *   entries: unknown[],
 *   annotations: unknown[],
 *   originalText: string | null,
 *   wasRtf?: boolean,
 *   userFinds?: unknown[],
 * }} */
let pending = null

/**
 * @param {() => Promise<unknown>} fn
 *   Resolve with `'skipped'` for no-op early exits so a prior failure is not
 *   cleared. Any other resolution clears lastError. Throw to record failure.
 */
export function enqueueCasePersist(fn) {
  const run = chain.then(
    () => fn(),
    () => fn()
  )
  chain = run.then(
    (result) => {
      if (result !== 'skipped') lastError = null
    },
    (err) => {
      lastError = err
    }
  )
  return run
}

export function clearCasePersistError() {
  lastError = null
}

export async function waitForCasePersists() {
  await chain
  if (lastError) {
    const err = lastError instanceof Error
      ? lastError
      : new Error(lastError?.message || String(lastError) || 'Save failed')
    throw err
  }
}

/** Latest review snapshot for the open case (module-level, survives unmount). */
export function publishCaseReviewPending(snapshot) {
  if (!snapshot?.caseId || !snapshot?.storagePath) return
  pending = {
    caseId: snapshot.caseId,
    storagePath: snapshot.storagePath,
    title: snapshot.title || '',
    entries: snapshot.entries || [],
    annotations: snapshot.annotations || [],
    originalText: snapshot.originalText ?? null,
    wasRtf: snapshot.wasRtf === true,
    userFinds: Array.isArray(snapshot.userFinds) ? snapshot.userFinds : [],
  }
}

export function getCaseReviewPending() {
  return pending
}

export function annotationStatusCounts(annotations) {
  const list = Array.isArray(annotations) ? annotations : []
  return {
    total: list.length,
    accepted: list.filter((a) => a.status === 'accepted').length,
    ignored: list.filter((a) => a.status === 'ignored').length,
    open: list.filter((a) => a.status === 'open').length,
    custom_changed: list.filter(
      (a) =>
        a.status === 'accepted' &&
        a._originalSuggestion !== undefined &&
        a.suggestion !== a._originalSuggestion
    ).length,
  }
}

async function upsertMetricsAndStatus(caseId, entries, annotations) {
  const counts = annotationStatusCounts(annotations)
  const metricsPayload = {
    case_id: caseId,
    total_entries: Array.isArray(entries) ? entries.length : 0,
    total_issues: counts.total,
    accepted: counts.accepted,
    ignored: counts.ignored,
    open: counts.open,
    custom_changed: counts.custom_changed,
    annotations_by_type: countByType(annotations),
    last_reviewed_at: new Date().toISOString(),
  }

  let { error: upsertError } = await supabase
    .from('case_metrics')
    .upsert(metricsPayload, { onConflict: 'case_id' })
  if (upsertError) {
    ;({ error: upsertError } = await supabase
      .from('case_metrics')
      .upsert(metricsPayload, { onConflict: 'case_id' }))
  }
  if (upsertError) {
    throw new Error(
      upsertError.message ||
        'Transcript file saved, but dashboard status did not update. Click Save Changes to retry.'
    )
  }

  if (counts.total > 0 && counts.open === 0) {
    const { error: statusErr } = await supabase
      .from('cases')
      .update({ status: 'reviewed' })
      .eq('id', caseId)
    if (statusErr) console.error('case status → reviewed failed:', statusErr.message)
  } else if (counts.open > 0) {
    // in_progress is display-only; DB check constraint does not allow it.
    const { error: statusErr } = await supabase
      .from('cases')
      .update({ status: 'analyzed' })
      .eq('id', caseId)
    if (statusErr) console.error('case status → analyzed failed:', statusErr.message)
  }

  return counts
}

async function writePendingToStorage(snap) {
  const payload = {
    title: snap.title,
    extracted_at: new Date().toISOString(),
    entries: snap.entries,
    annotations: snap.annotations,
  }
  if (snap.originalText) payload.originalText = snap.originalText
  if (snap.wasRtf === true) payload.wasRtf = true
  // Always write when present (including []) so removals clear prior finds.
  if (Array.isArray(snap.userFinds)) payload.userFinds = snap.userFinds

  const expected = annotationStatusCounts(snap.annotations)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })

  const { error: upErr } = await uploadCaseFile(snap.storagePath, blob)
  if (upErr) throw upErr

  // Confirm the object we just wrote (guards CDN/browser serving a pre-accept
  // copy of the same path). Retry once on mismatch.
  const verify = async () => {
    const { data, error } = await downloadCaseFile(snap.storagePath)
    if (error) throw error
    const parsed = JSON.parse(await data.text())
    const got = annotationStatusCounts(parsed.annotations || [])
    if (
      got.accepted !== expected.accepted ||
      got.ignored !== expected.ignored ||
      got.open !== expected.open ||
      got.total !== expected.total
    ) {
      console.warn(
        `Save verify mismatch: wrote a${expected.accepted}/i${expected.ignored}/o${expected.open} but read a${got.accepted}/i${got.ignored}/o${got.open}`
      )
      const err = new Error('SAVE_VERIFY_MISMATCH')
      err.code = 'SAVE_VERIFY_MISMATCH'
      throw err
    }
  }

  try {
    await verify()
  } catch (err) {
    console.warn('Persist verify failed, rewriting:', err.message)
    const { error: retryErr } = await uploadCaseFile(snap.storagePath, blob)
    if (retryErr) throw retryErr
    try {
      await verify()
    } catch (retryVerifyErr) {
      throw new Error(
        'Could not confirm your save. Click Save Changes and try again.'
      )
    }
  }

  return expected
}

/**
 * Persist the module-level pending snapshot (storage + metrics + status).
 * Safe to call from accept/ignore/reopen, Save, Export flush, and unmount.
 */
export function enqueueCaseReviewSave() {
  return enqueueCasePersist(async () => {
    const snap = pending
    if (!snap?.caseId || !snap?.storagePath) return 'skipped'
    if (!Array.isArray(snap.annotations)) return 'skipped'

    await writePendingToStorage(snap)
    // Re-read pending after the await — a newer accept may have published.
    const latest = pending
    const forMetrics =
      latest && latest.caseId === snap.caseId && latest.storagePath === snap.storagePath
        ? latest
        : snap

    // If a newer pending landed during upload, write that too before metrics
    // so dashboard/export never see metrics ahead of / behind the file.
    if (forMetrics !== snap) {
      await writePendingToStorage(forMetrics)
    }

    await upsertMetricsAndStatus(forMetrics.caseId, forMetrics.entries, forMetrics.annotations)
    return 'ok'
  })
}

/** Sync metrics from an already-loaded annotation file (editor/export load). */
export async function syncMetricsFromAnnotations(caseId, entries, annotations) {
  return upsertMetricsAndStatus(caseId, entries, annotations)
}
