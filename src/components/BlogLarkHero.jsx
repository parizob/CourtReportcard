/**
 * Visual banner for the Let A Reporter Know (LARK) tips post.
 * Share-the-knowledge mood — same shell as other blog heroes.
 */
export default function BlogLarkHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl editorial-shadow border border-outline-variant/15 mb-10">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary-container via-primary-fixed/40 to-tertiary-fixed/50" />
      <div className="absolute -top-14 -right-12 w-52 h-52 rounded-full bg-tertiary-fixed-dim/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-8 w-44 h-44 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 px-6 sm:px-10 py-10 sm:py-12">
        <div className="shrink-0" aria-hidden="true">
          <svg width="148" height="100" viewBox="0 0 148 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="14" width="140" height="72" rx="14" fill="#001939" />
            <text
              x="74"
              y="60"
              textAnchor="middle"
              fill="#ffffff"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontSize="32"
              fontWeight="800"
              letterSpacing="0.08em"
            >
              LARK
            </text>
          </svg>
        </div>

        <div className="text-center sm:text-left">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary mb-3">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
            Tips worth sharing
          </p>
          <p className="font-headline font-extrabold text-2xl sm:text-3xl text-on-surface tracking-tight mb-2">
            Pass it on.
          </p>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm">
            Small tips for the room, and for each other, that help the person making the record.
          </p>
        </div>
      </div>
    </div>
  )
}
