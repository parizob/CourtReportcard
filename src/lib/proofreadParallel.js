/**
 * Pure helpers for capped-wave proofread parallelization.
 * MIRRORED into supabase/functions/analyze-case/proofreadParallel.ts —
 * update both if you change dispatch / inventory rules.
 */

/** Max proofread Gemini calls in flight for one file. */
export const PROOFREAD_PARALLEL_CONCURRENCY = 3

/**
 * Claim older than this may be stolen by a retry / stuck resume / watchdog.
 * Kept under a typical Edge waitUntil budget so a finishing sibling can sleep
 * this long then reclaim. Live workers must refresh claimed_at while Gemini runs.
 */
export const PROOFREAD_CLAIM_STALE_MS = 5 * 60 * 1000

/** Extra grace after stale before the zombie-claim watchdog re-scans. */
export const PROOFREAD_WATCHDOG_GRACE_MS = 30 * 1000

export function proofreadBatchJsonName(jsonBaseName, batchIndex) {
  return `${jsonBaseName}_annotations_batch${batchIndex}.json`
}

export function proofreadBatchClaimName(jsonBaseName, batchIndex) {
  return `${jsonBaseName}_annotations_batch${batchIndex}.claim`
}

export function proofreadMergeLockName(jsonBaseName) {
  return `${jsonBaseName}_proofread_merge.lock`
}

export function proofreadWatchdogLockName(jsonBaseName) {
  return `${jsonBaseName}_proofread_watchdog.lock`
}

/**
 * True when merge is blocked on claimed-but-not-done batches (the zombie-claim
 * hang: siblings finished, one claim left, nobody left to refill after it dies).
 */
export function needsProofreadZombieWatchdog({ numBatches, completeIndices, inFlightIndices }) {
  const complete = completeIndices instanceof Set ? completeIndices : new Set(completeIndices)
  const inFlight = inFlightIndices instanceof Set ? inFlightIndices : new Set(inFlightIndices)
  if (numBatches <= 0) return false
  if (complete.size >= numBatches) return false
  return inFlight.size > 0 && planProofreadDispatch({
    numBatches,
    completeIndices: complete,
    inFlightIndices: inFlight,
  }).length === 0
}

/** Result file is merge-ready when it carries an annotations array. */
export function isProofreadBatchComplete(parsed) {
  return Boolean(parsed && Array.isArray(parsed.annotations))
}

/**
 * @param {object} opts
 * @param {number} opts.numBatches
 * @param {Set<number>|number[]} opts.completeIndices - batches with result JSON
 * @param {Set<number>|number[]} opts.inFlightIndices - claimed, not yet complete
 * @param {number} [opts.concurrency]
 * @returns {number[]} batch indices to self-fetch next (may be empty)
 */
export function planProofreadDispatch({
  numBatches,
  completeIndices,
  inFlightIndices,
  concurrency = PROOFREAD_PARALLEL_CONCURRENCY,
}) {
  const complete = completeIndices instanceof Set ? completeIndices : new Set(completeIndices)
  const inFlight = inFlightIndices instanceof Set ? inFlightIndices : new Set(inFlightIndices)
  if (numBatches <= 0) return []
  if (complete.size >= numBatches) return []

  const slots = Math.max(0, concurrency - inFlight.size)
  if (slots === 0) return []

  const toStart = []
  for (let i = 0; i < numBatches && toStart.length < slots; i++) {
    if (complete.has(i) || inFlight.has(i)) continue
    toStart.push(i)
  }
  return toStart
}

/**
 * Whether a claim timestamp is old enough to steal.
 * @param {number|string|Date|null|undefined} claimedAt
 * @param {number} [now]
 * @param {number} [staleMs]
 */
export function isProofreadClaimStale(claimedAt, now = Date.now(), staleMs = PROOFREAD_CLAIM_STALE_MS) {
  if (claimedAt == null) return true
  const t = typeof claimedAt === 'number' ? claimedAt : Date.parse(String(claimedAt))
  if (!Number.isFinite(t)) return true
  return now - t >= staleMs
}
