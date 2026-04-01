import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SignInModal from './SignInModal'

const navLinkClass = ({ isActive }) =>
  isActive
    ? 'text-primary border-b-2 border-primary pb-1 font-headline font-bold tracking-tight'
    : 'text-on-surface-variant hover:text-primary font-headline font-bold tracking-tight transition-colors duration-200'

export default function SiteHeader() {
  const { isAuthenticated } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

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
              onClick={() => setModalOpen(true)}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2 rounded-md font-bold transition-all hover:scale-[1.02] active:scale-95"
            >
              Sign Up
            </button>
          )}

          {/* Icons — always visible */}
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-colors">notifications</span>
          <button
            onClick={() => setModalOpen(true)}
            className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-colors"
          >
            account_circle
          </button>

        </div>

      </div>
      <div className="bg-surface-container-low h-[1px] w-full" />

      {modalOpen && <SignInModal onClose={() => setModalOpen(false)} />}
    </nav>
  )
}
