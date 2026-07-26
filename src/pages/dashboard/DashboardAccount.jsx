import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function DashboardAccount() {
  const { user, displayName, initials, tokenBalance } = useAuth()

  const [firstName, setFirstName] = useState(user?.user_metadata?.first_name || '')
  const [lastName, setLastName] = useState(user?.user_metadata?.last_name || '')
  const [email] = useState(user?.email || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleSaveProfile = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      })
      if (updateErr) throw updateErr
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSaved(false)
    setResetSent(false)
    if (!currentPassword) {
      setPasswordError('Enter your current password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from your current password.')
      return
    }
    if (!email) {
      setPasswordError('No email on this account. Contact support.')
      return
    }
    setPasswordSaving(true)
    try {
      // Re-auth proves they know the current password before we rotate it.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (reauthErr) {
        const msg = (reauthErr.message || '').toLowerCase()
        if (msg.includes('invalid') || msg.includes('credentials')) {
          throw new Error('Current password is incorrect.')
        }
        throw reauthErr
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) throw updateErr
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSaved(true)
      setTimeout(() => setPasswordSaved(false), 4000)
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleForgotPassword = async () => {
    setPasswordError('')
    setPasswordSaved(false)
    setResetSent(false)
    if (!email) {
      setPasswordError('No email on this account. Contact support.')
      return
    }
    setResetSending(true)
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetErr) throw resetErr
      setResetSent(true)
    } catch (err) {
      setPasswordError(err.message || 'Failed to send reset email.')
    } finally {
      setResetSending(false)
    }
  }

  const hasNameChanges =
    firstName.trim() !== (user?.user_metadata?.first_name || '') ||
    lastName.trim() !== (user?.user_metadata?.last_name || '')

  const canUpdatePassword =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    !passwordSaving

  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      <div className="max-w-3xl mx-auto">

        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">person</span>
            Account
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            Account Settings
          </h1>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xl">
            Manage your personal information and account preferences.
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
            {error}
          </div>
        )}

        {/* ─── Profile Card ─── */}
        <section className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8 mb-8 sm:relative">
          {/* Token badge — stacked above the name on mobile so it never overlaps it; top right on desktop */}
          <Link
            to="/dashboard/billing"
            className="flex items-center gap-2 bg-surface-container hover:bg-surface-container-high rounded-xl px-4 py-2.5 transition-colors group w-fit mb-4 sm:mb-0 sm:absolute sm:top-6 sm:right-6"
          >
            <span className="material-symbols-outlined text-tertiary-fixed-dim text-lg">toll</span>
            <span className="text-xl font-extrabold text-on-surface">{tokenBalance ?? '—'}</span>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">tokens</span>
            <span className="material-symbols-outlined text-on-surface-variant/40 text-sm group-hover:text-primary transition-colors">arrow_forward</span>
          </Link>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-2xl font-bold">
              {initials}
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">{displayName}</h2>
              <p className="text-sm text-on-surface-variant">{email}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface/60 outline-none cursor-not-allowed"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/50 bg-surface-container-high px-2 py-0.5 rounded">
                Verified
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1.5">Contact support to change your email address.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveProfile}
              disabled={!hasNameChanges || saving}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  Save Changes
                </>
              )}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Saved
              </span>
            )}
          </div>
        </section>

        {/* ─── Password ─── */}
        <section className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8 mb-8">
          <h3 className="font-headline font-bold text-on-surface text-base mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">lock</span>
            Password
          </h3>
          <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
            Enter your current password, then choose a new one. You will stay signed in after it updates.
          </p>

          {passwordError && (
            <div className="mb-4 p-3 bg-error-container/30 border border-error/20 rounded-lg text-xs text-error font-medium flex items-start gap-2">
              <span className="material-symbols-outlined text-sm mt-px shrink-0">error</span>
              {passwordError}
            </div>
          )}

          {resetSent && (
            <div className="mb-4 p-3 bg-primary/5 border border-primary/15 rounded-lg text-xs text-on-surface font-medium flex items-start gap-2 leading-relaxed">
              <span className="material-symbols-outlined text-sm mt-px shrink-0 text-primary">mail</span>
              <span>
                We sent a password reset link to <span className="font-semibold">{email}</span>. Check your inbox (and spam) and follow the link to set a new password.
              </span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                Current Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetSending}
                  data-track-id="account_forgot_password"
                  className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
                >
                  {resetSending ? 'Sending reset link...' : 'Forgot password? Email me a reset link'}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!canUpdatePassword}
                data-track-id="account_update_password"
                className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {passwordSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Updating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">key</span>
                    Update Password
                  </>
                )}
              </button>
              {passwordSaved && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Password updated
                </span>
              )}
            </div>
          </form>
        </section>

        {/* ─── Danger Zone ─── */}
        <section className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8">
          <h3 className="font-headline font-bold text-on-surface text-base mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-lg">warning</span>
            Danger Zone
          </h3>
          <p className="text-xs text-on-surface-variant mb-4">
            These actions are permanent and cannot be undone.
          </p>
          <button
            disabled
            className="border border-error/30 text-error/60 px-5 py-2.5 rounded-lg font-bold text-sm cursor-not-allowed hover:bg-error-container/10 transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">delete_forever</span>
            Delete Account — Coming Soon
          </button>
        </section>

      </div>
    </main>
  )
}
