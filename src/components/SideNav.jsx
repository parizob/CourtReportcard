import { NavLink, Link } from 'react-router-dom'

export default function SideNav({ activePage = 'editor' }) {
  const navItems = [
    { icon: 'edit_note', label: 'Editor', to: '/editor' },
    { icon: 'folder_open', label: 'Case Files', to: '/ourplatform' },
    { icon: 'slow_motion_video', label: 'Audio Sync', to: '/editor' },
    { icon: 'settings', label: 'Settings', to: '/ourplatform' },
  ]

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 left-0 top-0 fixed bg-surface-container-low py-6 pl-4 transition-transform duration-300 ease-in-out font-body text-sm font-medium z-30">
      <div className="mb-10 px-4">
        <Link to="/" className="font-headline font-black text-xl text-primary tracking-tight hover:opacity-80 transition-opacity">Court Reportcard</Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
            <span className="material-symbols-outlined">account_circle</span>
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-on-surface">Lead Stenographer</p>
            <p className="font-body text-xs text-on-surface-variant">District Court</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              isActive
                ? 'flex items-center gap-3 px-4 py-3 bg-surface-container-lowest text-primary rounded-l-lg shadow-sm'
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
          <p className="text-xs uppercase tracking-widest font-bold mb-2">Pro Access</p>
          <p className="text-sm mb-4 text-white/80 leading-relaxed">Unlock unlimited transcription hours.</p>
          <button className="w-full py-2 bg-tertiary-fixed-dim text-on-tertiary-fixed font-bold text-xs rounded uppercase tracking-tighter">
            Upgrade Plan
          </button>
        </div>
        <a href="#" className="flex items-center gap-3 px-4 py-3 text-on-surface-variant font-body text-sm font-medium">
          <span className="material-symbols-outlined">help</span>
          <span>Help Center</span>
        </a>
      </div>
    </aside>
  )
}
