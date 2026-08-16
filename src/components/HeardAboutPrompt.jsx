import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/telemetry'

export const HEARD_ABOUT_OPTIONS = [
  { id: 'facebook_group', label: 'Facebook group' },
  { id: 'socials', label: 'Social media' },
  { id: 'colleague', label: 'Colleague' },
  { id: 'association_email', label: 'Association email' },
  { id: 'blog_search', label: 'Blog or search' },
  { id: 'ad', label: 'Ad' },
  { id: 'other', label: 'Other' },
]

/**
 * One-time modal. Parent only mounts when heard_about_status === 'pending'.
 * Only Save or Skip clear pending — backdrop click does not dismiss.
 */
export default function HeardAboutPrompt({ onDone }) {
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const otherInputRef = useRef(null)

  useEffect(() => {
    if (selected === 'other') otherInputRef.current?.focus()
  }, [selected])

  const finish = (status) => {
    onDone?.(status)
  }

  const submit = async ({ skipped }) => {
    setError('')
    if (!skipped && !selected) {
      setError('Pick one option, or skip.')
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('set_heard_about', {
        p_skipped: skipped,
        p_source: skipped ? null : selected,
        p_detail:
          skipped || selected !== 'other' ? null : detail.trim() || null,
      })
      if (rpcErr) throw rpcErr
      trackEvent({
        type: 'attribution',
        name: skipped ? 'heard_about_skipped' : 'heard_about_answered',
        trackId: skipped ? 'heard_about_skip' : 'heard_about_submit',
        metadata: skipped
          ? {}
          : { source: selected, has_detail: Boolean(detail.trim()) },
      })
      finish(data || (skipped ? 'skipped' : 'answered'))
    } catch (err) {
      console.error('set_heard_about failed:', err)
      setError(err.message || 'Could not save. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="heard-about-title"
        className="relative bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl editorial-shadow w-full max-w-sm max-h-[min(92vh,36rem)] overflow-y-auto"
      >
        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim sticky top-0 z-10" />

        <div className="px-5 pt-5 pb-5">
          <h2
            id="heard-about-title"
            className="font-headline font-bold text-lg text-on-surface tracking-tight text-center"
          >
            How did you hear about us?
          </h2>
          <p className="text-xs text-on-surface-variant leading-relaxed mt-1.5 mb-4 text-center">
            Thanks for joining. This helps us reach more reporters.
          </p>

          <ul className="space-y-1.5 mb-4">
            {HEARD_ABOUT_OPTIONS.map((opt) => {
              const active = selected === opt.id
              if (opt.id === 'other' && active) {
                return (
                  <li key={opt.id}>
                    <div className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-primary bg-primary/5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border-2 border-primary flex items-center justify-center shrink-0"
                        aria-hidden="true"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </span>
                      <input
                        ref={otherInputRef}
                        type="text"
                        maxLength={200}
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        disabled={submitting}
                        placeholder="Other (tell us briefly)"
                        aria-label="Other"
                        className="flex-1 min-w-0 bg-transparent border-none outline-none focus:ring-0 text-sm font-bold text-on-surface placeholder:text-on-surface-variant/50 placeholder:font-medium py-0.5"
                      />
                    </div>
                  </li>
                )
              }
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setSelected(opt.id)
                      if (opt.id !== 'other') setDetail('')
                    }}
                    data-track-id={`heard_about_option_${opt.id}`}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm font-bold transition-all border ${
                      active
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container text-on-surface border-outline-variant/15 hover:border-primary/30 hover:bg-primary/5'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        active ? 'border-on-primary' : 'border-outline-variant/50'
                      }`}
                      aria-hidden="true"
                    >
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-on-primary" />}
                    </span>
                    {opt.label}
                  </button>
                </li>
              )
            })}
          </ul>

          {error && (
            <p className="text-xs text-error mb-3 text-center" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={submitting || !selected}
              onClick={() => submit({ skipped: false })}
              data-track-id="heard_about_submit"
              className="flex-1 inline-flex items-center justify-center bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-2.5 rounded-lg font-bold text-sm editorial-shadow transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit({ skipped: true })}
              data-track-id="heard_about_skip"
              className="shrink-0 text-sm font-bold text-on-surface-variant hover:text-primary py-2 transition-colors disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
