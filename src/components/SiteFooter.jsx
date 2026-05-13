import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-outline-variant/15">
      <div className="bg-[#f8f9fa]">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-8 w-full max-w-[1440px] mx-auto">
          <div className="mb-6 md:mb-0">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <BrandLogo size={22} className="text-xl" />
            </Link>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-on-surface-variant text-[10px] font-body uppercase tracking-widest">
                © 2026 Court Reportcard. All Rights Reserved. Confidential Legal Tool.
              </p>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Beta</span>
            </div>
          </div>
          <div className="flex gap-8 md:ml-auto">
            <Link to="/terms" className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100">
              Privacy Policy
            </Link>
            <Link to="/support" className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
