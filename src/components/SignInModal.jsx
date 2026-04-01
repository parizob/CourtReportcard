import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function SignInModal({ onClose }) {
  const { login } = useAuth()
  const [tab, setTab] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    login()
    onClose()
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Card */}
      <div className="relative bg-surface-container-lowest rounded-2xl editorial-shadow w-full max-w-md mx-4 overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors text-lg"
        >
          ×
        </button>

        <div className="px-8 pt-8 pb-10">
          {/* Logo */}
          <p className="font-headline font-black text-xl text-primary tracking-tight mb-1">Court Reportcard</p>
          <p className="text-xs text-on-surface-variant mb-7">
            {tab === 'signin' ? 'Welcome back. Sign in to your account.' : 'Create your free account to get started.'}
          </p>

          {/* Tab toggle */}
          <div className="flex bg-surface-container rounded-lg p-1 mb-6">
            <button
              onClick={() => setTab('signin')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                tab === 'signin'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                tab === 'signup'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
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
              className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all mt-2"
            >
              {tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-on-surface-variant mt-6">
            {tab === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setTab(tab === 'signin' ? 'signup' : 'signin')}
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
