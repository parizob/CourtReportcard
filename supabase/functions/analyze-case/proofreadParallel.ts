// MIRRORED from src/lib/proofreadParallel.js — update both if you change
// dispatch / inventory rules. Deno Edge can't import from src/.

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

export function proofreadBatchJsonName(jsonBaseName: string, batchIndex: number): string {
  return `${jsonBaseName}_annotations_batch${batchIndex}.json`
}

export function proofreadBatchClaimName(jsonBaseName: string, batchIndex: number): string {
  return `${jsonBaseName}_annotations_batch${batchIndex}.claim`
}

export function proofreadMergeLockName(jsonBaseName: string): string {
  return `${jsonBaseName}_proofread_merge.lock`
}

export function proofreadWatchdogLockName(jsonBaseName: string): string {
  return `${jsonBaseName}_proofread_watchdog.lock`
}

/**
 * True when merge is blocked on claimed-but-not-done batches (the zombie-claim
 * hang: siblings finished, one claim left, nobody left to refill after it dies).
 */
export function needsProofreadZombieWatchdog(opts: {
  numBatches: number
  completeIndices: Set<number> | number[]
  inFlightIndices: Set<number> | number[]
}): boolean {
  const complete = opts.completeIndices instanceof Set
    ? opts.completeIndices
    : new Set(opts.completeIndices)
  const inFlight = opts.inFlightIndices instanceof Set
    ? opts.inFlightIndices
    : new Set(opts.inFlightIndices)
  if (opts.numBatches <= 0) return false
  if (complete.size >= opts.numBatches) return false
  return inFlight.size > 0 && planProofreadDispatch({
    numBatches: opts.numBatches,
    completeIndices: complete,
    inFlightIndices: inFlight,
  }).length === 0
}

/** Result file is merge-ready when it carries an annotations array. */
export function isProofreadBatchComplete(parsed: unknown): boolean {
  return Boolean(parsed && typeof parsed === 'object' && Array.isArray((parsed as { annotations?: unknown }).annotations))
}

/**
 * Pick batch indices to self-fetch so in-flight work stays at `concurrency`.
 */
export function planProofreadDispatch(opts: {
  numBatches: number
  completeIndices: Set<number> | number[]
  inFlightIndices: Set<number> | number[]
  concurrency?: number
}): number[] {
  const {
    numBatches,
    completeIndices,
    inFlightIndices,
    concurrency = PROOFREAD_PARALLEL_CONCURRENCY,
  } = opts
  const complete = completeIndices instanceof Set ? completeIndices : new Set(completeIndices)
  const inFlight = inFlightIndices instanceof Set ? inFlightIndices : new Set(inFlightIndices)
  if (numBatches <= 0) return []
  if (complete.size >= numBatches) return []

  const slots = Math.max(0, concurrency - inFlight.size)
  if (slots === 0) return []

  const toStart: number[] = []
  for (let i = 0; i < numBatches && toStart.length < slots; i++) {
    if (complete.has(i) || inFlight.has(i)) continue
    toStart.push(i)
  }
  return toStart
}

export function isProofreadClaimStale(
  claimedAt: number | string | Date | null | undefined,
  now = Date.now(),
  staleMs = PROOFREAD_CLAIM_STALE_MS,
): boolean {
  if (claimedAt == null) return true
  const t = typeof claimedAt === 'number' ? claimedAt : Date.parse(String(claimedAt))
  if (!Number.isFinite(t)) return true
  return now - t >= staleMs
}
