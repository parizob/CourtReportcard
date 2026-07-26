import { useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Tooltip from './Tooltip'

const NAV_EXPANDED_KEY = 'cr-dash-nav-expanded'

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', to: '/dashboard', end: true },
  { icon: 'cloud_upload', label: 'Upload', to: '/dashboard/upload' },
  { icon: 'edit_note', label: 'Editor', to: '/dashboard/editor' },
  { icon: 'cloud_download', label: 'Export', to: '/dashboard/export' },
]

const gettingStartedSteps = [
  { step: '1', icon: 'cloud_upload', title: 'Upload', desc: 'Drag and drop your transcript (.txt or .rtf). Give your case a name so you can find it later.' },
  { step: '2', icon: 'edit_note', title: 'Review', desc: 'Every flagged error is highlighted with a suggestion. Accept or ignore each one with a single click.' },
  { step: '3', icon: 'cloud_download', title: 'Export', desc: 'Download your reviewed transcript as .txt, .rtf, or .json. More export formats coming soon.' },
]

function readNavExpanded() {
  try {
    const v = localStorage.getItem(NAV_EXPANDED_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* private mode */
  }
  return true
}

export default function DashboardLayout() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case')
  const { signOut, tokenBalance } = useAuth()
  const navigate = useNavigate()
  const [showGettingStarted, setShowGettingStarted] = useState(false)
  const [navExpanded, setNavExpanded] = useState(readNavExpanded)

  const setExpanded = (next) => {
    setNavExpanded(next)
    try {
      localStorage.setItem(NAV_EXPANDED_KEY, next ? '1' : '0')
    } catch {
      /* private mode */
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const navTo = (item) => {
    // Keep the open case when jumping Editor ↔ Export so accepts aren't
    // reviewed against an empty export screen.
    if (caseId && (item.to === '/dashboard/editor' || item.to === '/dashboard/export')) {
      return `${item.to}?case=${caseId}`
    }
    return item.to
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <div className="flex flex-1">

        {navExpanded ? (
          <aside className="hidden md:flex flex-col w-64 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] bg-surface-container-low py-6 pl-4 overflow-y-auto font-body text-sm font-medium">
            {/* Utility icon bar — same Tooltip as dashboard case actions */}
            <div className="mx-2 mb-0 flex items-center gap-1">
              <Tooltip text="Getting Started" placement="right">
                <button
                  type="button"
                  onClick={() => setShowGettingStarted(true)}
                  data-track-id="dash_getting_started"
                  aria-label="Getting Started"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">school</span>
                </button>
              </Tooltip>
              <Tooltip text="Help Center">
                <Link
                  to="/support"
                  data-track-id="dash_help_center"
                  aria-label="Help Center"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">help</span>
                </Link>
              </Tooltip>
              <div className="ml-auto">
                <Tooltip text="Hide menu" placement="left">
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    data-track-id="dash_nav_collapse"
                    aria-label="Hide menu"
                    aria-expanded="true"
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">left_panel_close</span>
                  </button>
                </Tooltip>
              </div>
            </div>
            <div className="mt-3 mb-4 mx-2 border-t border-outline-variant/25" role="separator" aria-hidden="true" />

            {/* Token balance */}
            <NavLink
              to="/dashboard/billing"
              data-track-id="dash_nav_token_balance"
              className={({ isActive }) =>
                `mb-6 mx-2 flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-tertiary-fixed/15 ring-1 ring-tertiary-fixed-dim/20'
                    : 'bg-surface-container/60 hover:bg-surface-container-high'
                }`
              }
            >
              <div className="w-9 h-9 rounded-lg bg-tertiary-fixed/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-tertiary-container text-lg">toll</span>
              </div>
              <div className="min-w-0">
                <p className="font-body text-lg font-extrabold text-on-surface leading-tight">
                  {tokenBalance != null ? tokenBalance.toLocaleString() : '—'} <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">tokens</span>
                </p>
                <p className="font-body text-[9px] text-on-surface-variant/70 italic normal-case tracking-normal">1 token = 1 page</p>
              </div>
            </NavLink>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 pr-0">
              <p className="px-4 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                Workspace
              </p>
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={navTo(item)}
                  end={item.end}
                  data-track-id={`dash_nav_${item.label.toLowerCase()}`}
                  className={({ isActive }) =>
                    isActive
                      ? 'flex items-center gap-3 px-4 py-3 bg-surface-container-lowest text-primary rounded-l-lg shadow-sm font-semibold'
                      : 'flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high transition-colors rounded-l-lg'
                  }
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto pr-4 pt-4">
              <div className="mb-2 mr-0 border-t border-outline-variant/25" role="separator" aria-hidden="true" />
              <button
                type="button"
                onClick={handleSignOut}
                data-track-id="dash_sign_out"
                className="flex items-center gap-3 px-4 py-3 text-error font-body text-sm font-medium hover:bg-error/10 transition-colors w-full rounded-l-lg"
              >
                <span className="material-symbols-outlined">logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        ) : (
          /* Collapsed tab aligns with Hide menu at the top of the sidebar */
          <aside className="hidden md:block w-0 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] relative z-20">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              data-track-id="dash_nav_expand"
              title="Show navigation"
              aria-label="Show navigation"
              aria-expanded="false"
              className="group absolute left-0 top-6 z-30 flex h-32 w-5 items-center justify-center rounded-r-lg bg-tertiary-fixed text-on-tertiary-fixed editorial-shadow hover:brightness-[0.97] transition-[filter] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] rotate-90 whitespace-nowrap select-none opacity-80 group-hover:opacity-100">
                Menu
              </span>
            </button>
          </aside>
        )}

        <div key={pathname} className="flex-1 min-w-0 page-rise">
          <Outlet />
        </div>

      </div>

      {/* Getting Started Modal */}
      {showGettingStarted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGettingStarted(false)} />
          <div className="relative bg-surface-container-lowest rounded-2xl editorial-shadow p-8 max-w-lg w-full mx-4 z-10">
            <button
              onClick={() => setShowGettingStarted(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">school</span>
              </div>
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface">Getting Started</h2>
                <p className="text-xs text-on-surface-variant">Three steps to a court-ready transcript.</p>
              </div>
            </div>

            <div className="space-y-5">
              {gettingStartedSteps.map((item) => (
                <div key={item.step} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-primary">{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-1">Step {item.step}: {item.title}</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-3">
              <Link
                to="/dashboard/upload"
                onClick={() => setShowGettingStarted(false)}
                data-track-id="dash_getting_started_start_uploading"
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all"
              >
                <span className="material-symbols-outlined text-base">cloud_upload</span>
                Start Uploading
              </Link>
              <button
                onClick={() => setShowGettingStarted(false)}
                className="border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
