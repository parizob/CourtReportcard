/**
 * Tracks in-flight editor → storage persists so other routes (Export) can
 * wait for the latest accept/ignore save before reading case JSON.
 * Without this, navigating within the debounce window loads a stale file
 * and looks like the user "lost" their accepts.
 */

let chain = Promise.resolve()

export function trackCasePersist(promise) {
  const next = Promise.resolve(promise).then(
    () => {},
    () => {}
  )
  chain = chain.then(() => next)
  return promise
}

export function waitForCasePersists() {
  return chain
}
