import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandLogo from './BrandLogo'

// A single AudioContext shared across chimes. Browsers require it to be
// created (or resumed) in response to a user gesture. We create it lazily
// on the first click and reuse it for every subsequent chime.
let _audioCtx = null

function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new AudioContext() } catch (_) {}
  }
  return _audioCtx
}

// Call once on any user interaction to unlock the context.
function unlockAudio() {
  const ctx = getAudioCtx()
  if (ctx && ctx.state === 'suspended') ctx.resume()
}

function playChime() {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const play = (freq, startTime, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    play(523, ctx.currentTime, 0.5)        // C5
    play(659, ctx.currentTime + 0.18, 0.5) // E5
    play(784, ctx.currentTime + 0.36, 0.7) // G5
  } catch (_) { /* silent fail */ }
}

const publicNavClass = ({ isActive }) =>
  isActive
    ? 'text-primary border-b-2 border-primary pb-1 font-headline font-bold tracking-tight'
    : 'text-on-surface-variant hover:text-primary font-headline font-bold tracking-tight transition-colors duration-200'


const LOW_TOKEN_THRESHOLD = 10
const ADMIN_ALWAYS_SHOW = 'parizob1@gmail.com'

export default function SiteHeader() {
  const { isAuthenticated, user, displayName, initials, openModal, signOut, tokenBalance } = useAuth()
  const navigate = useNavigate()

  // Unauthenticated bell state
  const [bellRinging, setBellRinging] = useState(false)
  const [hasNotification, setHasNotification] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  // Authenticated bell state
  const [authBellRinging, setAuthBellRinging] = useState(false)
  const [hasLowTokenNotif, setHasLowTokenNotif] = useState(false)
  const [lowTokenOpen, setLowTokenOpen] = useState(false)
  const [readyNotifs, setReadyNotifs] = useState([]) // [{id, caseName, caseId}]
  const authNotifRef = useRef(null)

  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Unauthenticated sign-up nudge
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

  // Authenticated low-token nudge
  useEffect(() => {
    if (!isAuthenticated || tokenBalance === null || !user) return
    const isAdmin = user.email === ADMIN_ALWAYS_SHOW
    const isLow = tokenBalance < LOW_TOKEN_THRESHOLD
    if (!isLow && !isAdmin) return

    const timer = setTimeout(() => {
      setHasLowTokenNotif(true)
      setAuthBellRinging(true)
      playChime()
    }, 5000)
    return () => clearTimeout(timer)
  }, [isAuthenticated, tokenBalance, user])

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (authNotifRef.current && !authNotifRef.current.contains(e.target)) setLowTokenOpen(false)
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Unlock the shared AudioContext on the user's first click so chimes can
  // play from timers later (browsers block audio until a gesture has occurred).
  useEffect(() => {
    const unlock = () => { unlockAudio(); document.removeEventListener('click', unlock) }
    document.addEventListener('click', unlock)
    return () => document.removeEventListener('click', unlock)
  }, [])

  useEffect(() => {
    const onReady = (e) => {
      const { caseId, caseName } = e.detail || {}
      if (!caseId) return
      setReadyNotifs((prev) => [...prev, { id: Date.now(), caseId, caseName }])
      setAuthBellRinging(true)
      setLowTokenOpen(true)
      playChime()
    }
    window.addEventListener('transcript-ready', onReady)
    return () => window.removeEventListener('transcript-ready', onReady)
  }, [])

  const dismissNotification = () => {
    setHasNotification(false)
    setNotifOpen(false)
    setBellRinging(false)
  }

  const dismissLowTokenNotif = () => {
    setHasLowTokenNotif(false)
    setReadyNotifs([])
    setLowTokenOpen(false)
    setAuthBellRinging(false)
  }

  const dismissReadyNotif = (id) => {
    setReadyNotifs((prev) => prev.filter((n) => n.id !== id))
  }

  const totalAuthNotifs = (hasLowTokenNotif ? 1 : 0) + readyNotifs.length

  const handleSignOut = async () => {
    setAccountOpen(false)
    await signOut()
    navigate('/')
  }

  /* ─── Authenticated header ─── */
  if (isAuthenticated) {
    return (
      <nav className="sticky top-0 z-50 bg-[#f8f9fa]">
        <div className="flex justify-between items-center w-full px-4 sm:px-8 h-[65px]">

          <Link to="/dashboard" className="hover:opacity-80 transition-opacity">
            <BrandLogo size={22} className="text-xl" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">

            {/* Authenticated notification bell */}
            <div className="relative" ref={authNotifRef}>
              <button
                onClick={() => setLowTokenOpen((v) => !v)}
                data-track-id="header_auth_bell"
                className="relative flex items-center justify-center hover:bg-surface-container-high p-2 rounded-full transition-colors"
              >
                <span
                  className={`material-symbols-outlined text-on-surface-variant${authBellRinging ? ' bell-ring' : ''}`}
                  onAnimationEnd={() => setAuthBellRinging(false)}
                >
                  notifications
                </span>
                {totalAuthNotifs > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-error text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                    {totalAuthNotifs > 9 ? '9+' : totalAuthNotifs}
                  </span>
                )}
              </button>

              {lowTokenOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-80 bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/20 overflow-hidden z-50">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15">
                    <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Notifications</span>
                    {totalAuthNotifs > 0 && (
                      <button onClick={dismissLowTokenNotif} className="text-xs text-primary font-semibold hover:underline">Mark all read</button>
                    )}
                  </div>

                  {/* Transcript ready notifications */}
                  {readyNotifs.map((n) => (
                    <div key={n.id} className="px-5 py-4 flex gap-3 border-b border-outline-variant/10">
                      <div className="shrink-0 w-9 h-9 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                        <span className="material-symbols-outlined text-green-600 text-base">check_circle</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface leading-snug mb-1 truncate">
                          {n.caseName} is ready
                        </p>
                        <p className="text-xs text-on-surface-variant leading-relaxed">Your transcript has been analyzed and is ready to review.</p>
                        <Link
                          to={`/dashboard/editor?case=${n.caseId}`}
                          onClick={() => dismissReadyNotif(n.id)}
                          className="mt-3 inline-block bg-primary text-on-primary text-xs font-bold px-4 py-1.5 rounded-md hover:bg-primary-container transition-colors"
                        >
                          Open in Editor →
                        </Link>
                      </div>
                    </div>
                  ))}

                  {/* Low-token notification */}
                  {hasLowTokenNotif && (
                    <div className="px-5 py-4 flex gap-3">
                      <div className="shrink-0 w-9 h-9 rounded-full bg-tertiary-fixed flex items-center justify-center mt-0.5">
                        <span className="material-symbols-outlined text-on-tertiary-fixed text-base">toll</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-on-surface leading-snug mb-1">You're running low on tokens</p>
                        <p className="text-xs text-on-surface-variant leading-relaxed">We noticed your balance is getting low. Submit a support ticket and we'd love to help get you more tokens.</p>
                        <Link
                          to="/support"
                          onClick={dismissLowTokenNotif}
                          data-track-id="header_low_token_notif_support"
                          className="mt-3 inline-block bg-primary text-on-primary text-xs font-bold px-4 py-1.5 rounded-md hover:bg-primary-container transition-colors"
                        >
                          Submit a Support Ticket →
                        </Link>
                      </div>
                    </div>
                  )}

                  {totalAuthNotifs === 0 && (
                    <div className="px-5 py-8 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant/30 text-3xl mb-2 block">notifications</span>
                      <p className="text-xs text-on-surface-variant/50">No new notifications</p>
                    </div>
                  )}

                  <div className="px-5 py-3 border-t border-outline-variant/10 text-center">
                    <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">Court Reportcard</span>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={accountRef}>
              <button
                onClick={() => setAccountOpen((v) => !v)}
                data-track-id="header_account_menu"
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
                    to="/dashboard/account"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">person</span>
                    Account
                  </Link>
                  <Link
                    to="/dashboard/billing"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">payments</span>
                    Plans &amp; Billing
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">dashboard</span>
                    Dashboard
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
                    data-track-id="header_sign_out"
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
      <div className="flex justify-between items-center w-full px-4 sm:px-8 h-[65px]">

        <div className="flex items-center gap-8">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <BrandLogo size={22} className="text-xl" />
          </Link>
          <div className="hidden md:flex gap-6 items-center">
            <NavLink to="/" end className={publicNavClass}>Home</NavLink>
            <NavLink to="/ourplatform" className={publicNavClass}>Our Platform</NavLink>
            <NavLink to="/aboutus" className={publicNavClass}>About Us</NavLink>
            <NavLink to="/support" className={publicNavClass}>Support</NavLink>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => openModal('signup')}
            data-track-id="header_sign_up"
            className="hidden sm:inline-block bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2 rounded-md font-bold transition-all hover:scale-[1.02] active:scale-95"
          >
            Sign Up
          </button>

          <div className="relative hidden sm:block" ref={notifRef}>
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
                    <p className="text-sm font-semibold text-on-surface leading-snug mb-1">Sign up today — get 50 free tokens</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">Create an account today and receive 50 tokens to start reviewing transcripts through our full proofreading platform. <br /> <i>1 token = 1 page.</i></p>
                    <button
                      onClick={() => { dismissNotification(); openModal('signup') }}
                      data-track-id="header_notification_claim_tokens"
                      className="mt-3 inline-block bg-primary text-on-primary text-xs font-bold px-4 py-1.5 rounded-md hover:bg-primary-container transition-colors"
                    >
                      Claim 50 Free Tokens →
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
            data-track-id="header_sign_in"
            aria-label="Sign in"
            className="hidden sm:inline-flex material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-colors"
          >
            account_circle
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden flex items-center justify-center p-2 rounded-full hover:bg-surface-container-high transition-colors"
            aria-label="Open menu"
          >
            <span className="material-symbols-outlined text-on-surface">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-outline-variant/15 bg-[#f8f9fa]">
          <div className="px-4 py-4 flex flex-col gap-1">
            <NavLink
              to="/" end
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `py-3 px-3 rounded-lg font-headline font-bold tracking-tight ${isActive ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container'}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/ourplatform"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `py-3 px-3 rounded-lg font-headline font-bold tracking-tight ${isActive ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container'}`
              }
            >
              Our Platform
            </NavLink>
            <NavLink
              to="/aboutus"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `py-3 px-3 rounded-lg font-headline font-bold tracking-tight ${isActive ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container'}`
              }
            >
              About Us
            </NavLink>
            <NavLink
              to="/support"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `py-3 px-3 rounded-lg font-headline font-bold tracking-tight ${isActive ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container'}`
              }
            >
              Support
            </NavLink>
            <div className="border-t border-outline-variant/15 my-2" />
            <button
              onClick={() => { setMobileMenuOpen(false); openModal('signup') }}
              data-track-id="header_mobile_sign_up"
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-lg font-bold transition-all"
            >
              Sign Up
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); openModal('signin') }}
              data-track-id="header_mobile_sign_in"
              className="border border-outline-variant/40 text-on-surface py-3 rounded-lg font-bold transition-all hover:bg-surface-container"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-container-low h-[1px] w-full" />
    </nav>
  )
}
