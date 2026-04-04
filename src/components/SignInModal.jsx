import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function SignInModal({ onClose, initialTab = 'signin' }) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (tab === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      if (tab === 'signin') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
      }
      onClose()
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-surface-container-lowest rounded-2xl editorial-shadow w-full max-w-md mx-4 overflow-hidden">

        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors text-lg"
        >
          ×
        </button>

        <div className="px-8 pt-8 pb-10">
          <p className="font-headline font-black text-xl text-primary tracking-tight mb-1">Court Reportcard</p>
          <p className="text-xs text-on-surface-variant mb-7">
            {tab === 'signin' ? 'Welcome back. Sign in to your account.' : 'Create your free account to get started.'}
          </p>

          <div className="flex bg-surface-container rounded-lg p-1 mb-6">
            <button
              onClick={() => { setTab('signin'); setError('') }}
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

            {tab === 'signup' && (
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
            )}

            {tab === 'signin' && (
              <div className="text-right">
                <button type="button" className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
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
        </div>
      </div>
    </div>
  )
}
