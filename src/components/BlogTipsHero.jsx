/**
 * Visual banner for the homophone tips post.
 * Lighter, wit-forward — same polish as the launch hero, different mood.
 */
export default function BlogTipsHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl editorial-shadow border border-outline-variant/15 mb-10">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary-container via-primary-fixed/40 to-tertiary-fixed/50" />
      <div className="absolute -top-14 -right-12 w-52 h-52 rounded-full bg-tertiary-fixed-dim/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-8 w-44 h-44 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 px-6 sm:px-10 py-10 sm:py-12">
        <div className="shrink-0" aria-hidden="true">
          <svg width="132" height="120" viewBox="0 0 132 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Left chip: wrong-ish vibe */}
            <rect x="8" y="28" width="72" height="36" rx="10" fill="#ffffff" stroke="#c3c6d0" strokeWidth="1.5" />
            <text x="44" y="51" textAnchor="middle" fill="#747780" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="13" fontWeight="700">
              council
            </text>
            <line x1="22" y1="38" x2="66" y2="54" stroke="#ba1a1a" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />

            {/* Right chip: correct */}
            <rect x="52" y="56" width="72" height="36" rx="10" fill="#001939" />
            <text x="88" y="79" textAnchor="middle" fill="#ffffff" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="13" fontWeight="700">
              counsel
            </text>

            {/* Swap arrows */}
            <path
              d="M44 22c18-10 36-4 44 8"
              stroke="#ffba38"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <path d="M82 24l8 4-2 8" fill="#ffba38" />
          </svg>
        </div>

        <div className="text-center sm:text-left">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary mb-3">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>spellcheck</span>
            Homophone field guide
          </p>
          <p className="font-headline font-extrabold text-2xl sm:text-3xl text-on-surface tracking-tight mb-2">
            Sounds right. Still wrong.
          </p>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm">
            The pairs that wait until 11:47 p.m. to ruin a perfectly good page.
          </p>
        </div>
      </div>
    </div>
  )
}
