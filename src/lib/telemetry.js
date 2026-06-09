import { supabase } from './supabase'

const ANON_KEY = 'crc_anon_id'
const SESSION_KEY = 'crc_session_id'

const ADMIN_EMAILS = ['courtreportcard@gmail.com', 'parizob1@gmail.com']

let currentUserId = null

function makeId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch (_) { /* ignore */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Persistent prospect UID. Kept across visits and after sign-in so a
// prospect -> customer journey can be linked.
export function getAnonymousId() {
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id) {
      id = makeId()
      localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch (_) {
    return 'anon-unavailable'
  }
}

// Per-tab session id.
export function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = makeId()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch (_) {
    return 'session-unavailable'
  }
}

export function setTelemetryUser(userId) {
  currentUserId = userId ?? null
}

export function isTelemetryAdmin(email) {
  return !!email && ADMIN_EMAILS.includes(email)
}

// Fire-and-forget event write. Never throws; tracking must not break the UI.
export function trackEvent({
  type,
  name = null,
  trackId = null,
  elementType = null,
  destination = null,
  path = null,
  metadata = {},
} = {}) {
  try {
    const loc = typeof window !== 'undefined' ? window.location : null
    const payload = {
      user_id: currentUserId,
      anonymous_id: getAnonymousId(),
      session_id: getSessionId(),
      event_type: type,
      event_name: name,
      track_id: trackId,
      element_type: elementType,
      path: path ?? (loc ? loc.pathname + loc.search : ''),
      destination,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      metadata,
    }
    supabase
      .from('telemetry_events')
      .insert(payload)
      .then(({ error }) => {
        if (error && import.meta?.env?.DEV) {
          console.debug('[telemetry] insert failed', error.message)
        }
      })
  } catch (err) {
    if (import.meta?.env?.DEV) console.debug('[telemetry] trackEvent error', err)
  }
}
