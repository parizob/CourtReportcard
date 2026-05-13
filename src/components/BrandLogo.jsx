import LogoBadge from './LogoBadge'

/**
 * Full brand lockup: shield badge + "ourt Reportcard" text.
 * Usage: <BrandLogo /> or <BrandLogo size={22} className="text-lg" />
 */
export default function BrandLogo({ size = 26, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-px font-headline font-black text-primary tracking-tight ${className}`}>
      <LogoBadge size={size} />
      <span>ourt Reportcard</span>
    </span>
  )
}
