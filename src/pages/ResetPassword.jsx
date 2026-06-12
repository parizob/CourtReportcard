import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BrandLogo from '../components/BrandLogo'

const STATE = { WAITING: 'waiting', READY: 'ready', INVALID: 'invalid', SUCCESS: 'success' }

export default function ResetPassword() {
  const navigate = useNavigate()
  const { openModal, signOut } = useAuth()
  const [state, setState] = useState(STATE.WAITING)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the link token is processed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setState(STATE.READY)
      }
    })

    // If the page loads without a recovery token (e.g. direct navigation),
    // give Supabase a moment to process the hash, then fall back to invalid.
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) setState(STATE.INVALID)
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setSaving(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateErr) {
      setError(updateErr.message || 'Failed to update password. The link may have expired.')
      return
    }
    await signOut()
    setState(STATE.SUCCESS)
  }

  const goToSignIn = () => {
    navigate('/')
    openModal('signin')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />
          <div className="px-8 pt-8 pb-10">

            <div className="mb-6"><BrandLogo size={22} /></div>

            {/* Waiting for token */}
            {state === STATE.WAITING && (
              <div className="text-center py-8">
                <svg className="animate-spin h-8 w-8 text-primary mx-auto mb-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-on-surface-variant">Verifying your reset link…</p>
              </div>
            )}

            {/* Invalid / expired link */}
            {state === STATE.INVALID && (
              <div className="text-center py-4">
                <span className="material-symbols-outlined text-4xl text-error block mb-3">link_off</span>
                <h2 className="font-headline text-lg font-bold text-on-surface mb-2">Link expired or invalid</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                  This password reset link has already been used or has expired. Reset links are valid for 60 minutes.
                </p>
                <button
                  onClick={goToSignIn}
                  className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {/* Set new password form */}
            {state === STATE.READY && (
              <>
                <h2 className="font-headline text-xl font-bold text-on-surface mb-1">Set a new password</h2>
                <p className="text-xs text-on-surface-variant mb-6">Choose something you haven't used before.</p>

                {error && (
                  <div className="mb-4 p-3 bg-error-container/30 border border-error/20 rounded-lg text-xs text-error font-medium flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm mt-px shrink-0">error</span>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving…
                      </>
                    ) : (
                      'Set New Password'
                    )}
                  </button>
                </form>
              </>
            )}

            {/* Success */}
            {state === STATE.SUCCESS && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-primary">check_circle</span>
                </div>
                <h2 className="font-headline text-lg font-bold text-on-surface mb-2">Password updated</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-8">
                  Your password has been changed. Sign in below with your new password to get back to work.
                </p>
                <button
                  onClick={goToSignIn}
                  className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">login</span>
                  Sign In
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
