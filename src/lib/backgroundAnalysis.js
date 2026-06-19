import { supabase } from './supabase'

// Analysis now runs server-side in the `analyze-case` Edge Function (triggered
// fire-and-forget right after upload). This module is only a safety net: if a
// case is still 'processing' a few minutes later with no result — e.g. the
// initial invoke never reached the server because the user closed the tab too
// fast — we re-invoke the worker. The browser never runs Gemini itself.

const STUCK_AFTER_MS = 3 * 60 * 1000

/**
 * Finds the current user's cases stuck at 'processing' for more than a few
 * minutes with no extracted result yet, and re-triggers the background worker.
 * Safe to call repeatedly; the Edge Function is idempotent.
 */
export async function retryStuckCases() {
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS).toISOString()

  const { data: stuckCases, error } = await supabase
    .from('cases')
    .select('id, case_files(file_type)')
    .eq('status', 'processing')
    .is('deleted_at', null)
    .lt('updated_at', stuckBefore)

  if (error || !stuckCases) return

  for (const c of stuckCases) {
    const hasExtracted = (c.case_files || []).some((f) => f.file_type === 'extracted')
    if (hasExtracted) continue

    supabase.functions
      .invoke('analyze-case', { body: { case_id: c.id } })
      .catch((e) => console.error('Failed to re-trigger analysis for', c.id, e))
  }
}
