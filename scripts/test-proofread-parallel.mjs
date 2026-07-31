#!/usr/bin/env node
/**
 * Offline unit tests for capped-wave proofread dispatch (no API / Supabase).
 * Run: node scripts/test-proofread-parallel.mjs
 */
import {
  PROOFREAD_PARALLEL_CONCURRENCY,
  PROOFREAD_CLAIM_STALE_MS,
  planProofreadDispatch,
  isProofreadBatchComplete,
  isProofreadClaimStale,
  needsProofreadZombieWatchdog,
  proofreadBatchJsonName,
  proofreadBatchClaimName,
  proofreadMergeLockName,
  proofreadWatchdogLockName,
} from '../src/lib/proofreadParallel.js'

let failed = 0
function assert(cond, name) {
  if (cond) console.log('PASS', name)
  else {
    console.log('FAIL', name)
    failed++
  }
}

assert(PROOFREAD_PARALLEL_CONCURRENCY === 3, 'default concurrency is 3')
assert(PROOFREAD_CLAIM_STALE_MS === 5 * 60 * 1000, 'claim stale is 5 minutes')
assert(proofreadBatchJsonName('Foo', 2) === 'Foo_annotations_batch2.json', 'json name')
assert(proofreadBatchClaimName('Foo', 2) === 'Foo_annotations_batch2.claim', 'claim name')
assert(proofreadMergeLockName('Foo') === 'Foo_proofread_merge.lock', 'merge lock name')
assert(proofreadWatchdogLockName('Foo') === 'Foo_proofread_watchdog.lock', 'watchdog lock name')

assert(isProofreadBatchComplete({ annotations: [] }), 'empty annotations array is complete')
assert(isProofreadBatchComplete({ annotations: [{ id: 1 }] }), 'non-empty annotations complete')
assert(!isProofreadBatchComplete({ status: 'in_progress' }), 'claim payload is not complete')
assert(!isProofreadBatchComplete(null), 'null is not complete')

assert(
  JSON.stringify(planProofreadDispatch({
    numBatches: 8,
    completeIndices: [],
    inFlightIndices: [],
  })) === JSON.stringify([0, 1, 2]),
  'cold start fills 3 slots',
)

assert(
  JSON.stringify(planProofreadDispatch({
    numBatches: 8,
    completeIndices: [0],
    inFlightIndices: [1, 2],
  })) === JSON.stringify([3]),
  'one slot opens → dispatch next missing',
)

assert(
  JSON.stringify(planProofreadDispatch({
    numBatches: 8,
    completeIndices: [0, 1, 2],
    inFlightIndices: [3, 4, 5],
  })) === JSON.stringify([]),
  'at cap → dispatch nothing',
)

assert(
  JSON.stringify(planProofreadDispatch({
    numBatches: 2,
    completeIndices: [],
    inFlightIndices: [],
  })) === JSON.stringify([0, 1]),
  'fewer batches than concurrency',
)

assert(
  JSON.stringify(planProofreadDispatch({
    numBatches: 5,
    completeIndices: [0, 1, 2, 3, 4],
    inFlightIndices: [],
  })) === JSON.stringify([]),
  'all complete → nothing to dispatch',
)

assert(
  JSON.stringify(planProofreadDispatch({
    numBatches: 5,
    completeIndices: new Set([1, 3]),
    inFlightIndices: new Set([0]),
    concurrency: 4,
  })) === JSON.stringify([2, 4]),
  'skips complete + in-flight; respects higher cap',
)

const now = Date.parse('2026-07-31T12:00:00.000Z')
assert(isProofreadClaimStale(null, now), 'null claim is stale')
assert(
  !isProofreadClaimStale(now - 60_000, now),
  '1-minute-old claim is fresh',
)
assert(
  !isProofreadClaimStale(now - 4 * 60_000, now),
  '4-minute-old claim is still fresh',
)
assert(
  isProofreadClaimStale(now - 5 * 60_000, now),
  '5-minute-old claim is stale',
)

assert(
  needsProofreadZombieWatchdog({
    numBatches: 5,
    completeIndices: [0, 2, 3, 4],
    inFlightIndices: [1],
  }),
  'zombie claim: siblings done, one in-flight → need watchdog',
)
assert(
  !needsProofreadZombieWatchdog({
    numBatches: 5,
    completeIndices: [0, 1],
    inFlightIndices: [2],
  }),
  'open slots remain → no zombie watchdog',
)
assert(
  !needsProofreadZombieWatchdog({
    numBatches: 5,
    completeIndices: [0, 1, 2, 3, 4],
    inFlightIndices: [],
  }),
  'all complete → no watchdog',
)

console.log(failed ? `\n${failed} failed` : '\nAll passed')
process.exit(failed ? 1 : 0)
