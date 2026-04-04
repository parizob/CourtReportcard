import { useState, useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinkClass = ({ isActive }) =>
  isActive
    ? 'text-primary border-b-2 border-primary pb-1 font-headline font-bold tracking-tight'
    : 'text-on-surface-variant hover:text-primary font-headline font-bold tracking-tight transition-colors duration-200'

export default function SiteHeader() {
  const { isAuthenticated, openModal } = useAuth()

  // Bell notification state
  const [bellRinging, setBellRinging] = useState(false)
  const [hasNotification, setHasNotification] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  // Trigger bell ring + badge after 5s
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasNotification(true)
      setBellRinging(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  // Re-ring every 8s while notification is unread
  useEffect(() => {
    if (!hasNotification) return
    const interval = setInterval(() => {
      setBellRinging(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setBellRinging(true)))
    }, 8000)
    return () => clearInterval(interval)
  }, [hasNotification])

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleBellClick = () => {
    setNotifOpen((v) => !v)
  }

  const dismissNotification = () => {
    setHasNotification(false)
    setNotifOpen(false)
    setBellRinging(false)
  }

  return (
    <nav className="sticky top-0 z-50 bg-[#f8f9fa]">
      <div className="flex justify-between items-center w-full px-8 h-[65px]">

        {/* Left — logo + nav links */}
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-xl font-black text-primary font-headline tracking-tight hover:opacity-80 transition-opacity"
          >
            Court Reportcard
          </Link>
          <div className="hidden md:flex gap-6 items-center">
            <NavLink to="/" end className={navLinkClass}>Home</NavLink>
            <NavLink to="/ourplatform" className={navLinkClass}>Our Platform</NavLink>
            <NavLink to="/aboutus" className={navLinkClass}>About Us</NavLink>
          </div>
        </div>

        {/* Right — auth-aware controls */}
        <div className="flex items-center gap-4">

          {/* Search bar — authenticated only */}
          {isAuthenticated && (
            <div className="hidden lg:flex items-center bg-surface-container-lowest px-4 py-2 rounded-md">
              <span className="material-symbols-outlined text-outline text-sm">search</span>
              <input
                className="bg-transparent border-none outline-none focus:ring-0 text-sm w-48 ml-2"
                placeholder="Search files..."
                type="text"
              />
            </div>
          )}

          {/* Primary action button */}
          {isAuthenticated ? (
            <Link
              to="/ourplatform"
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2 rounded-md font-bold transition-all hover:scale-[1.02] active:scale-95"
            >
              New Upload
            </Link>
          ) : (
            <button
              onClick={() => openModal('signup')}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2 rounded-md font-bold transition-all hover:scale-[1.02] active:scale-95"
            >
              Sign Up
            </button>
          )}

          {/* Bell icon with badge + dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleBellClick}
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

            {/* Notification dropdown */}
            {notifOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-80 bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/20 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15">
                  <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Notifications</span>
                  <button onClick={dismissNotification} className="text-xs text-primary font-semibold hover:underline">
                    Mark as read
                  </button>
                </div>

                {/* Notification item */}
                <div className="px-5 py-4 flex gap-3 hover:bg-surface-container transition-colors">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-tertiary-fixed/30 flex items-center justify-center mt-0.5">
                    <span className="material-symbols-outlined text-tertiary-fixed-dim text-base">card_giftcard</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-on-surface leading-snug mb-1">
                      Sign up today — get 3 free evaluations
                    </p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Create your free account now and we'll run your first 3 transcripts through our full AI review pipeline, completely free. No credit card required.
                    </p>
                    <button
                      onClick={() => { dismissNotification(); openModal('signup') }}
                      className="mt-3 inline-block bg-primary text-on-primary text-xs font-bold px-4 py-1.5 rounded-md hover:bg-primary-container transition-colors"
                    >
                      Claim Free Evaluations →
                    </button>
                  </div>
                </div>

                {/* Empty state shown after dismissal would be handled by !notifOpen */}
                <div className="px-5 py-3 border-t border-outline-variant/10 text-center">
                  <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">
                    Court Reportcard
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Account icon */}
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
