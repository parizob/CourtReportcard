import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'

function SettingToggle({ id, title, help, checked, onChange, disabled }) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-4 ${disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
          checked ? 'bg-primary' : 'bg-surface-container-high'
        } disabled:cursor-not-allowed`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface-container-lowest shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-on-surface">{title}</span>
        <span className="block text-xs text-on-surface-variant leading-relaxed mt-0.5">{help}</span>
      </span>
    </label>
  )
}

export default function DashboardSettings() {
  const {
    preferences,
    preferencesLoading,
    updatePreferences,
  } = useAuth()

  const [savingKey, setSavingKey] = useState(null)
  const [error, setError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  const savedTimerRef = useRef(null)

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
  }, [])

  const lineOn = preferences?.export_include_line_numbers !== false
  const pageOn = preferences?.export_include_page_numbers !== false
  const autoOn = preferences?.auto_advance_on_accept === true

  const setPref = async (patch) => {
    const key = Object.keys(patch)[0]
    setSavingKey(key)
    setError('')
    try {
      await updatePreferences(patch)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      setSavedFlash(true)
      savedTimerRef.current = setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setError(err.message || 'Could not save that setting.')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      <div className="max-w-3xl mx-auto">
        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">settings</span>
            Settings
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            Settings
          </h1>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xl leading-relaxed">
            Defaults for export and the editor. Changing options on the Export page for one download does not update these.
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
            {error}
          </div>
        )}

        <section className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">
              Export defaults
            </p>
            <div className="space-y-5">
              <SettingToggle
                id="pref-line-numbers"
                title="Include line numbers"
                help="The 1 to 25 numbers down the left side of each page. Used as the starting choice on Export when the transcript has line numbers."
                checked={lineOn}
                disabled={preferencesLoading || savingKey === 'export_include_line_numbers'}
                onChange={(v) => setPref({ export_include_line_numbers: v })}
              />
              <SettingToggle
                id="pref-page-numbers"
                title="Include page numbers"
                help="The page number at the top of each transcript page. Used as the starting choice on Export when the transcript has page numbers."
                checked={pageOn}
                disabled={preferencesLoading || savingKey === 'export_include_page_numbers'}
                onChange={(v) => setPref({ export_include_page_numbers: v })}
              />
            </div>
          </div>

          <div className="border-t border-outline-variant/15 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">
              Editor
            </p>
            <SettingToggle
              id="pref-auto-advance"
              title="Auto-advance after Accept or Ignore"
              help="Jump to the next open suggestion in the transcript."
              checked={autoOn}
              disabled={preferencesLoading || savingKey === 'auto_advance_on_accept'}
              onChange={(v) => setPref({ auto_advance_on_accept: v })}
            />
          </div>
        </section>
      </div>

      {savedFlash && createPortal(
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl editorial-shadow bg-surface-container-lowest border border-outline-variant/15 text-sm font-medium text-on-surface"
          style={{ animation: 'settingsSavedIn 200ms ease-out' }}
        >
          <span className="material-symbols-outlined text-base text-primary">check_circle</span>
          Saved
        </div>,
        document.body,
      )}
      <style>{`
        @keyframes settingsSavedIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </main>
  )
}
