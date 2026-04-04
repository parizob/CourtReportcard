import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const publicNavClass = ({ isActive }) =>
  isActive
    ? 'text-primary border-b-2 border-primary pb-1 font-headline font-bold tracking-tight'
    : 'text-on-surface-variant hover:text-primary font-headline font-bold tracking-tight transition-colors duration-200'

const appNavClass = ({ isActive }) =>
  isActive
    ? 'text-primary font-headline font-bold tracking-tight text-sm border-b-2 border-primary pb-1'
    : 'text-on-surface-variant hover:text-primary font-headline font-bold tracking-tight text-sm transition-colors duration-200'

export default function SiteHeader() {
  const { isAuthenticated, user, displayName, initials, openModal, signOut } = useAuth()
  const navigate = useNavigate()

  const [bellRinging, setBellRinging] = useState(false)
  const [hasNotification, setHasNotification] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)

  useEffect(() => {
    if (isAuthenticated) return
    const timer = setTimeout(() => {
      setHasNotification(true)
      setBellRinging(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [isAuthenticated])

  useEffect(() => {
    if (!hasNotification || isAuthenticated) return
    const interval = setInterval(() => {
      setBellRinging(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setBellRinging(true)))
    }, 8000)
    return () => clearInterval(interval)
  }, [hasNotification, isAuthenticated])

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const dismissNotification = () => {
    setHasNotification(false)
    setNotifOpen(false)
    setBellRinging(false)
  }

  const handleSignOut = async () => {
    setAccountOpen(false)
    await signOut()
    navigate('/')
  }

  /* ─── Authenticated header ─── */
  if (isAuthenticated) {
    return (
      <nav className="sticky top-0 z-50 bg-[#f8f9fa]">
        <div className="flex justify-between items-center w-full px-8 h-[65px]">

          <div className="flex items-center gap-8">
            <Link
              to="/dashboard"
              className="text-xl font-black text-primary font-headline tracking-tight hover:opacity-80 transition-opacity"
            >
              Court Reportcard
            </Link>
            <div className="hidden md:flex gap-6 items-center">
              <NavLink to="/dashboard" end className={appNavClass}>Dashboard</NavLink>
              <NavLink to="/dashboard/upload" className={appNavClass}>Upload</NavLink>
              <NavLink to="/dashboard/editor" className={appNavClass}>Editor</NavLink>
              <NavLink to="/dashboard/export" className={appNavClass}>Export</NavLink>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center bg-surface-container-lowest px-4 py-2 rounded-md">
              <span className="material-symbols-outlined text-outline text-sm">search</span>
              <input
                className="bg-transparent border-none outline-none focus:ring-0 text-sm w-48 ml-2"
                placeholder="Search cases..."
                type="text"
              />
            </div>

            <Link
              to="/dashboard/upload"
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2 rounded-md font-bold text-sm transition-all hover:scale-[1.02] active:scale-95"
            >
              New Upload
            </Link>

            <button className="flex items-center justify-center hover:bg-surface-container-high p-2 rounded-full transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
            </button>

            <div className="relative" ref={accountRef}>
              <button
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2 hover:bg-surface-container-high px-3 py-1.5 rounded-full transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-xs font-bold">
                  {initials}
                </span>
                <span className="hidden lg:inline text-sm font-semibold text-on-surface truncate max-w-[120px]">{displayName}</span>
                <span className="material-symbols-outlined text-on-surface-variant text-sm">expand_more</span>
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-surface-container-lowest rounded-xl editorial-shadow border border-outline-variant/20 overflow-hidden py-2">
                  <div className="px-4 py-3 border-b border-outline-variant/10">
                    <p className="text-xs font-bold text-on-surface truncate">{displayName}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">dashboard</span>
                    Dashboard
                  </Link>
                  <Link
                    to="/dashboard/upload"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">cloud_upload</span>
                    Upload
                  </Link>
                  <Link
                    to="/support"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">help</span>
                    Help Center
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/20 transition-colors border-t border-outline-variant/10 mt-1"
                  >
                    <span className="material-symbols-outlined text-base">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low h-[1px] w-full" />
      </nav>
    )
  }

  /* ─── Unauthenticated header ─── */
  return (
    <nav className="sticky top-0 z-50 bg-[#f8f9fa]">
      <div className="flex justify-between items-center w-full px-8 h-[65px]">

        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-xl font-black text-primary font-headline tracking-tight hover:opacity-80 transition-opacity"
          >
            Court Reportcard
          </Link>
          <div className="hidden md:flex gap-6 items-center">
            <NavLink to="/" end className={publicNavClass}>Home</NavLink>
            <NavLink to="/ourplatform" className={publicNavClass}>Our Platform</NavLink>
            <NavLink to="/aboutus" className={publicNavClass}>About Us</NavLink>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => openModal('signup')}
            className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2 rounded-md font-bold transition-all hover:scale-[1.02] active:scale-95"
          >
            Sign Up
          </button>

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex items-center justify-center hover:bg-surface-container-high p-2 rounded-full transition-colors"
            >
              <span
                className={`material-symbols-outlined text-on-surface-variant${bellRinging ? ' bell-ring' : ''}`}
                onAnimationEnd={() => setBellRinging(false)}
              >
                notifications
              </span>
              {hasNotification && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                  1
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-80 bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/20 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15">
                  <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Notifications</span>
                  <button onClick={dismissNotification} className="text-xs text-primary font-semibold hover:underline">Mark as read</button>
                </div>
                <div className="px-5 py-4 flex gap-3 hover:bg-surface-container transition-colors">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-tertiary-fixed/30 flex items-center justify-center mt-0.5">
                    <span className="material-symbols-outlined text-tertiary-fixed-dim text-base">card_giftcard</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-on-surface leading-snug mb-1">Sign up today — get 3 free evaluations</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">Create your free account now and we'll run your first 3 transcripts through our full AI review pipeline, completely free.</p>
                    <button
                      onClick={() => { dismissNotification(); openModal('signup') }}
                      className="mt-3 inline-block bg-primary text-on-primary text-xs font-bold px-4 py-1.5 rounded-md hover:bg-primary-container transition-colors"
                    >
                      Claim Free Evaluations →
                    </button>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-outline-variant/10 text-center">
                  <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">Court Reportcard</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => openModal('signin')}
            className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-colors"
          >
            account_circle
          </button>
        </div>
      </div>
      <div className="bg-surface-container-low h-[1px] w-full" />
    </nav>
  )
}
