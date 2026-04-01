import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'

const navItems = [
  { icon: 'cloud_upload', label: 'Upload', to: '/ourplatform', end: true },
  { icon: 'edit_note', label: 'Transcript Editor', to: '/ourplatform/editor' },
  { icon: 'cloud_download', label: 'Export', to: '/ourplatform/export' },
]

export default function OurPlatformLayout() {
  const { pathname } = useLocation()
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">

      {/* Sidebar + content */}
      <div className="flex flex-1">

        {/* Sidebar — fixed below the header */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] bg-surface-container-low py-6 pl-4 overflow-y-auto font-body text-sm font-medium">
          <div className="mb-8 px-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
              <span className="material-symbols-outlined">account_circle</span>
            </div>
            <div>
              <p className="font-body text-sm font-semibold text-on-surface">Jane Doe</p>
              <p className="font-body text-xs text-on-surface-variant">ZZ Reporting LLC</p>
            </div>
          </div>

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

          <div className="mt-auto pr-4 space-y-4">
            <div className="p-4 bg-primary-container rounded-xl text-on-primary-container">
              <p className="text-xs uppercase tracking-widest font-bold mb-1 text-primary-fixed-dim">Ready to Start?</p>
              <p className="text-sm mb-4 text-white/80 leading-relaxed">Get full access to every feature — no credit card required.</p>
              <Link
                to="/"
                className="block w-full py-2 bg-tertiary-fixed-dim text-on-tertiary-fixed font-bold text-xs rounded uppercase tracking-tighter text-center"
              >
                Get Early Access
              </Link>
            </div>
            <Link to="/aboutus" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant font-body text-sm font-medium hover:text-primary transition-colors">
              <span className="material-symbols-outlined">info</span>
              <span>About Us</span>
            </Link>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant font-body text-sm font-medium hover:text-primary transition-colors">
              <span className="material-symbols-outlined">help</span>
              <span>Help Center</span>
            </a>
          </div>
        </aside>

        {/* Page content — animates on sub-route change, sidebar stays put */}
        <div key={pathname} className="flex-1 min-w-0 page-rise">
          <Outlet />
        </div>

      </div>
    </div>
  )
}
