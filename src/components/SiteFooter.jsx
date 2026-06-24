import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-outline-variant/15">
      <div className="bg-[#f8f9fa]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-6 sm:px-12 py-8 w-full max-w-[1440px] mx-auto gap-6 md:gap-4">
          <div>
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <BrandLogo size={22} className="text-xl" />
            </Link>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <p className="text-on-surface-variant text-[10px] font-body uppercase tracking-widest">
                © 2026 Court Reportcard. All Rights Reserved.
              </p>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Beta</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 md:gap-8 md:ml-auto">
            <Link to="/terms" className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100">
              Privacy Policy
            </Link>
            <Link to="/support" className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100">
              Contact Support
            </Link>
            <a
              href="https://www.facebook.com/profile.php?id=61570212954926"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Court Reportcard on Facebook"
              className="opacity-80 hover:opacity-100 transition-opacity text-on-surface-variant hover:text-primary-container"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
