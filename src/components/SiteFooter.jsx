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
            <p className="text-on-surface-variant text-[10px] font-body uppercase tracking-widest mt-2">
              © 2026 Court Reportcard. All Rights Reserved.
            </p>
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
            <a
              href="https://www.linkedin.com/company/court-reportcard/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Court Reportcard on LinkedIn"
              className="opacity-80 hover:opacity-100 transition-opacity text-on-surface-variant hover:text-primary-container"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
