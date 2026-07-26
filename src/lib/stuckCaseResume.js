/**
 * Decide what the stuck-case sweeper should do for one processing case.
 * Mirrored in supabase/functions/sweep-stuck-cases/index.ts — keep in sync.
 *
 * @param {{
 *   hasExtracted: boolean,
 *   extractingNames?: string[],
 *   restartCount?: number,
 * }} input
 * @returns {'recover_analyzed' | 'resume_proofread' | 're_kick_extract' | 'fail'}
 */
export function decideStuckAction({ hasExtracted, extractingNames = [], restartCount = 0 }) {
  if (hasExtracted) return 'recover_analyzed'

  const hasMergedEntries = extractingNames.some((n) => typeof n === 'string' && n.endsWith('_entries.json'))

  // One automatic recovery attempt total (resume proofread if extract already
  // finished, otherwise re-kick extract). A second stuck → fail+refund.
  if ((restartCount || 0) < 1) {
    return hasMergedEntries ? 'resume_proofread' : 're_kick_extract'
  }
  return 'fail'
}
