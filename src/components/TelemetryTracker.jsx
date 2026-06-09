import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { trackEvent, setTelemetryUser, getAnonymousId } from '../lib/telemetry'

const INTERACTIVE_SELECTOR = 'button, a, [role="button"], [data-track-id]'
const MAX_LABEL_LENGTH = 120

function deriveElementType(el) {
  if (el.dataset.trackType) return el.dataset.trackType
  const tag = el.tagName.toLowerCase()
  if (tag === 'a') return 'link'
  if (tag === 'button') return 'button'
  if (el.getAttribute('role') === 'button') return 'button'
  return 'other'
}

function deriveLabel(el) {
  const explicit = el.dataset.trackId || el.getAttribute('aria-label') || el.getAttribute('title')
  if (explicit) return explicit.trim().slice(0, MAX_LABEL_LENGTH)
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
  if (text) return text.slice(0, MAX_LABEL_LENGTH)
  if (el.tagName.toLowerCase() === 'a') return el.getAttribute('href') || 'link'
  return 'unlabeled'
}

export default function TelemetryTracker() {
  const location = useLocation()
  const { user } = useAuth()
  const lastIdentifiedRef = useRef(null)

  // Keep the telemetry user in sync and emit an identify event linking the
  // persistent anonymous id to the account the first time we see a user.
  useEffect(() => {
    setTelemetryUser(user?.id ?? null)
    if (user?.id && lastIdentifiedRef.current !== user.id) {
      lastIdentifiedRef.current = user.id
      trackEvent({
        type: 'identify',
        name: 'identify',
        metadata: { anonymous_id: getAnonymousId(), email: user.email ?? null },
      })
    }
    if (!user?.id) lastIdentifiedRef.current = null
  }, [user?.id, user?.email])

  // Page views (covers tab changes and ?case= editor/export views).
  useEffect(() => {
    trackEvent({
      type: 'page_view',
      name: location.pathname,
      path: location.pathname + location.search,
    })
  }, [location.pathname, location.search])

  // Global click capture for every button / link / role=button.
  useEffect(() => {
    const handler = (e) => {
      const el = e.target.closest && e.target.closest(INTERACTIVE_SELECTOR)
      if (!el) return
      const destination =
        el.dataset.trackTo || (el.tagName.toLowerCase() === 'a' ? el.getAttribute('href') : null)
      trackEvent({
        type: 'click',
        name: deriveLabel(el),
        trackId: el.dataset.trackId || null,
        elementType: deriveElementType(el),
        destination: destination || null,
      })
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  return null
}
