/**
 * Visual banner for the backbone / turnaround industry post.
 * Traffic clears when friction drops — reporters keep the system moving.
 */
export default function BlogBackboneHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl editorial-shadow border border-outline-variant/15 mb-10">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-[#00122a]" />
      <div className="absolute -top-20 right-0 w-64 h-64 rounded-full bg-tertiary-fixed-dim/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 left-1/4 w-56 h-56 rounded-full bg-primary-fixed/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-10 px-6 sm:px-10 py-10 sm:py-12">
        <div className="shrink-0" aria-hidden="true">
          <svg width="148" height="120" viewBox="0 0 148 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Road bed */}
            <rect x="10" y="18" width="128" height="84" rx="14" fill="#000d1f" fillOpacity="0.55" />
            <rect x="18" y="26" width="112" height="68" rx="10" fill="#001939" />

            {/* Center dashes — clear path */}
            <g className="blog-lane-dash" opacity="0.9">
              <rect x="70" y="32" width="4" height="10" rx="2" fill="#ffba38" />
              <rect x="70" y="48" width="4" height="10" rx="2" fill="#ffba38" fillOpacity="0.75" />
              <rect x="70" y="64" width="4" height="10" rx="2" fill="#ffba38" fillOpacity="0.55" />
              <rect x="70" y="80" width="4" height="10" rx="2" fill="#ffba38" fillOpacity="0.35" />
            </g>

            {/* Left lane: jam (stacked, brake lights) */}
            <g opacity="0.95">
              <rect x="28" y="34" width="28" height="14" rx="4" fill="#3a4a66" />
              <circle cx="32" cy="48" r="2.2" fill="#ba1a1a" />
              <circle cx="52" cy="48" r="2.2" fill="#ba1a1a" />

              <rect x="28" y="52" width="28" height="14" rx="4" fill="#3a4a66" />
              <circle cx="32" cy="66" r="2.2" fill="#ba1a1a" />
              <circle cx="52" cy="66" r="2.2" fill="#ba1a1a" />

              <rect x="28" y="70" width="28" height="14" rx="4" fill="#2f3d56" />
              <circle cx="32" cy="84" r="2.2" fill="#ba1a1a" fillOpacity="0.7" />
              <circle cx="52" cy="84" r="2.2" fill="#ba1a1a" fillOpacity="0.7" />
            </g>

            {/* Right lane: flowing traffic */}
            <g className="blog-flow-car">
              <rect x="88" y="30" width="28" height="14" rx="4" fill="#d6e3ff" />
              <circle cx="92" cy="44" r="2" fill="#ffba38" />
              <circle cx="112" cy="44" r="2" fill="#ffba38" />
            </g>
            <g className="blog-flow-car blog-flow-car-delay">
              <rect x="88" y="54" width="28" height="14" rx="4" fill="#a9c7ff" />
              <circle cx="92" cy="68" r="2" fill="#ffba38" />
              <circle cx="112" cy="68" r="2" fill="#ffba38" />
            </g>
            <g className="blog-flow-car blog-flow-car-delay-2">
              <rect x="88" y="78" width="28" height="14" rx="4" fill="#d6e3ff" fillOpacity="0.85" />
              <circle cx="92" cy="92" r="2" fill="#ffba38" />
              <circle cx="112" cy="92" r="2" fill="#ffba38" />
            </g>

          </svg>
        </div>

        <div className="text-center sm:text-left">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-tertiary-fixed-dim mb-3">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>route</span>
            System note
          </p>
          <p className="font-headline font-extrabold text-2xl sm:text-3xl text-on-primary tracking-tight mb-2">
            Clear the friction. Keep the backbone moving.
          </p>
          <p className="text-sm text-primary-fixed leading-relaxed max-w-sm">
            One brake light becomes a jam. Faster, cleaner turnaround helps the whole system stay open.
          </p>
        </div>
      </div>
    </div>
  )
}
