import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', to: '/dashboard', end: true },
  { icon: 'cloud_upload', label: 'Upload', to: '/dashboard/upload' },
  { icon: 'edit_note', label: 'Editor', to: '/dashboard/editor' },
  { icon: 'cloud_download', label: 'Export', to: '/dashboard/export' },
]

export default function DashboardLayout() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <div className="flex flex-1">

        <aside className="hidden md:flex flex-col w-64 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] bg-surface-container-low py-6 pl-4 overflow-y-auto font-body text-sm font-medium">
          {/* User info */}
          <div className="mb-8 px-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="font-body text-sm font-semibold text-on-surface truncate">{user?.email || 'User'}</p>
              <p className="font-body text-xs text-on-surface-variant">Free Plan</p>
            </div>
          </div>

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
    </div>
  )
}
