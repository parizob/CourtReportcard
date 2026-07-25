/**
 * Serializes editor → storage persists so Export (and rapid accept/ignore)
 * always see the latest in-memory state.
 *
 * Important: callers must pass a function that reads refs when it runs, not a
 * Promise that already snapped state at schedule time — otherwise a slow
 * earlier save can finish after a later one and wipe an ignore/accept.
 */

let chain = Promise.resolve()

export function enqueueCasePersist(fn) {
  const run = chain.then(
    () => fn(),
    () => fn()
  )
  // Keep the queue alive even if one persist fails.
  chain = run.then(
    () => {},
    () => {}
  )
  return run
}

export function waitForCasePersists() {
  return chain
}
