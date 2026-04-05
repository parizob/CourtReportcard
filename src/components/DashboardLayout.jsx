import { useState } from 'react'
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', to: '/dashboard', end: true },
  { icon: 'cloud_upload', label: 'Upload', to: '/dashboard/upload' },
  { icon: 'edit_note', label: 'Editor', to: '/dashboard/editor' },
  { icon: 'cloud_download', label: 'Export', to: '/dashboard/export' },
]

const gettingStartedSteps = [
  { step: '1', icon: 'cloud_upload', title: 'Upload', desc: 'Drag and drop your transcript (RTF/CRE) and audio recording (WAV/MP3/DSS). Give your case a name so you can find it later.' },
  { step: '2', icon: 'edit_note', title: 'Review', desc: 'Our AI highlights errors, low-confidence words, and suggests corrections in real time. Accept or ignore each suggestion with a single click.' },
  { step: '3', icon: 'cloud_download', title: 'Export', desc: 'Download court-ready transcripts in PDF, Word, or Case CATalyst format with a full audit trail included.' },
]

export default function DashboardLayout() {
  const { pathname } = useLocation()
  const { signOut, tokenBalance } = useAuth()
  const navigate = useNavigate()
  const [showGettingStarted, setShowGettingStarted] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <div className="flex flex-1">

        <aside className="hidden md:flex flex-col w-64 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] bg-surface-container-low py-6 pl-4 overflow-y-auto font-body text-sm font-medium">
          {/* Token balance */}
          <NavLink
            to="/dashboard/billing"
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
              <p className="font-body text-lg font-extrabold text-on-surface leading-tight">{tokenBalance ?? '—'}</p>
              <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">transcript tokens</p>
            </div>
          </NavLink>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 pr-0">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
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

          {/* Bottom actions */}
          <div className="mt-auto pr-4 space-y-2">
            <button
              onClick={() => setShowGettingStarted(true)}
              className="flex items-center gap-3 px-4 py-3 text-on-surface-variant font-body text-sm font-medium hover:text-primary transition-colors w-full"
            >
              <span className="material-symbols-outlined">school</span>
              <span>Getting Started</span>
            </button>
            <Link to="/support" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant font-body text-sm font-medium hover:text-primary transition-colors">
              <span className="material-symbols-outlined">help</span>
              <span>Help Center</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 text-on-surface-variant font-body text-sm font-medium hover:text-error transition-colors w-full"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <div key={pathname} className="flex-1 min-w-0 page-rise">
          <Outlet />
        </div>

      </div>

      {/* Getting Started Modal */}
      {showGettingStarted && (
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
        </div>
      )}
    </div>
  )
}
