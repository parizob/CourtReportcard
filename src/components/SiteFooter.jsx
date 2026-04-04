import { Link } from 'react-router-dom'

export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-outline-variant/15">
      <div className="bg-[#f8f9fa]">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-8 w-full max-w-[1440px] mx-auto">
          <div className="mb-6 md:mb-0">
            <Link to="/" className="font-headline font-bold text-primary text-xl hover:opacity-80 transition-opacity">
              Court Reportcard
            </Link>
            <p className="text-on-surface-variant text-[10px] mt-2 font-body uppercase tracking-widest">
              © 2026 Court Reportcard. All Rights Reserved. Confidential Legal Tool.
            </p>
          </div>
          <div className="flex gap-8">
            <a className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100" href="#">
              Terms of Service
            </a>
            <a className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100" href="#">
              Privacy Policy
            </a>
            <Link to="/support" className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100">
              Contact Support
            </Link>
            <a className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100" href="#">
              Security Audit
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
