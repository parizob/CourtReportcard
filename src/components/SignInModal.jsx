import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/telemetry'
import BrandLogo from './BrandLogo'

export default function SignInModal({ onClose, initialTab = 'signin' }) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState(initialTab)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [agreedToTos, setAgreedToTos] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [confirmPending, setConfirmPending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (tab === 'signup') {
      if (!firstName.trim() || !lastName.trim()) {
        setError('First and last name are required.')
        return
      }
      if (password !== confirm) {
        setError('Passwords do not match.')
        return
      }
      if (!agreedToTos) {
        setError('You must read and agree to the Terms of Service to create an account.')
        return
      }
    }

    setSubmitting(true)
    try {
      if (tab === 'signin') {
        await signIn(email, password)
        onClose()
        navigate('/dashboard')
      } else {
        await signUp(email, password, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        })
        setPendingEmail(email)
        setConfirmPending(true)
        trackEvent({
          type: 'signup_confirm_prompt_shown',
          name: 'signup_confirm_prompt_shown',
          metadata: { email },
        })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResetSubmitting(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/dashboard`,
    })
    setResetSubmitting(false)
    if (err) {
      setError(err.message || 'Failed to send reset email.')
    } else {
      setResetSent(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-surface-container-lowest rounded-2xl editorial-shadow w-full max-w-md mx-4 overflow-y-auto max-h-[90vh]">

        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors text-lg"
        >
          ×
        </button>

        <div className="px-8 pt-8 pb-10">
          <div className="mb-1"><BrandLogo size={22} className="text-xl" /></div>
          <p className="text-xs text-on-surface-variant mb-7">
            {confirmPending ? 'One more step before you can sign in.' : forgotMode ? 'Enter your email to receive a password reset link.' : tab === 'signin' ? 'Welcome back. Sign in to your account.' : 'Create your account and receive 50 free tokens to get started.'}
          </p>

          {/* Email confirmation pending view */}
          {confirmPending ? (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-primary">mark_email_unread</span>
              </div>
              <h2 className="font-headline text-lg font-bold text-on-surface mb-2">Check your inbox</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-1">
                We sent a confirmation link to
              </p>
              <p className="font-semibold text-on-surface text-sm mb-5">{pendingEmail}</p>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-8">
                Click the link in that email to activate your account, then come back here to sign in. Don't forget to check your spam folder if you don't see it within a minute.
              </p>
              <button
                onClick={() => {
                  trackEvent({
                    type: 'click',
                    name: 'signup_confirm_prompt_go_to_signin',
                    trackId: 'signup_confirm_prompt_go_to_signin',
                    metadata: { email: pendingEmail },
                  })
                  setConfirmPending(false)
                  setTab('signin')
                  setPassword('')
                  setConfirm('')
                  setError('')
                }}
                data-track-id="signup_confirm_prompt_go_to_signin"
                className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">login</span>
                I've confirmed — Sign In
              </button>
              <button
                onClick={onClose}
                className="mt-3 w-full text-xs text-on-surface-variant hover:text-primary transition-colors py-2"
              >
                I'll do this later
              </button>
            </div>
          ) : forgotMode ? (
            resetSent ? (
              <div className="text-center py-4">
                <span className="material-symbols-outlined text-4xl text-primary block mb-3">mark_email_read</span>
                <p className="font-bold text-on-surface mb-1">Check your inbox</p>
                <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                  We sent a password reset link to <span className="font-semibold text-on-surface">{resetEmail}</span>. Follow the link in the email to set a new password.
                </p>
                <button
                  onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail('') }}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  ← Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && (
                  <div className="p-3 bg-error-container/30 border border-error/20 rounded-lg text-xs text-error font-medium flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm mt-px shrink-0">error</span>
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  data-track-id="signin_modal_send_reset_link"
                  className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {resetSubmitting ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError('') }}
                  className="w-full text-xs text-on-surface-variant hover:text-primary transition-colors py-1"
                >
                  ← Back to Sign In
                </button>
              </form>
            )
          ) : (
          <>
          <div className="flex bg-surface-container rounded-lg p-1 mb-6">
            <button
              onClick={() => { setTab('signin'); setError('') }}
              data-track-id="signin_modal_tab_signin"
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                tab === 'signin'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError('') }}
              data-track-id="signin_modal_tab_signup"
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                tab === 'signup'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-error-container/30 border border-error/20 rounded-lg text-xs text-error font-medium flex items-start gap-2">
              <span className="material-symbols-outlined text-sm mt-px shrink-0">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {tab === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>

            {tab === 'signup' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Password
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
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                  Password
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
            )}

            {tab === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setError(''); setResetEmail(email) }}
                  data-track-id="signin_modal_forgot_password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {tab === 'signup' && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedToTos}
                  onChange={(e) => setAgreedToTos(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0 cursor-pointer"
                />
                <span className="text-xs text-on-surface-variant leading-relaxed group-hover:text-on-surface transition-colors">
                  I have read and agree to the{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-semibold hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Terms of Service
                  </Link>
                  , including the strict prohibition on uploading Protected Health Information (PHI).
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={submitting}
              data-track-id={tab === 'signin' ? 'signin_modal_submit_signin' : 'signin_modal_submit_signup'}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {tab === 'signin' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                tab === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-on-surface-variant mt-6">
            {tab === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setTab(tab === 'signin' ? 'signup' : 'signin'); setError('') }}
              className="text-primary font-semibold hover:underline"
            >
              {tab === 'signin' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  )
}

