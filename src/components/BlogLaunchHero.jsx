/**
 * Soft celebration banner for the out-of-beta launch post.
 * Brand navy + amber, restrained motion — professional, not carnival.
 */
export default function BlogLaunchHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl editorial-shadow border border-outline-variant/15 mb-10">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-[#00122a]" />
      <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-tertiary-fixed-dim/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-primary-fixed/15 blur-3xl pointer-events-none" />

      {/* Decorative sparks */}
      <span className="blog-spark absolute top-6 left-[12%] text-tertiary-fixed-dim/80 text-lg select-none" aria-hidden="true">✦</span>
      <span className="blog-spark blog-spark-delay absolute top-10 right-[18%] text-tertiary-fixed/70 text-sm select-none" aria-hidden="true">✧</span>
      <span className="blog-spark blog-spark-delay-2 absolute bottom-8 left-[22%] text-primary-fixed/60 text-xs select-none" aria-hidden="true">✦</span>
      <span className="blog-spark absolute bottom-10 right-[14%] text-tertiary-fixed-dim/70 text-base select-none" aria-hidden="true">✧</span>

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 px-6 sm:px-10 py-10 sm:py-12">
        <div className="shrink-0" aria-hidden="true">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Soft glow disc */}
            <circle cx="60" cy="60" r="48" fill="#ffba38" fillOpacity="0.12" />
            {/* Transcript page */}
            <rect x="34" y="22" width="52" height="68" rx="6" fill="#f8f9fa" />
            <rect x="42" y="34" width="28" height="3.5" rx="1.5" fill="#001939" fillOpacity="0.85" />
            <rect x="42" y="44" width="36" height="2.5" rx="1.25" fill="#001939" fillOpacity="0.35" />
            <rect x="42" y="52" width="32" height="2.5" rx="1.25" fill="#001939" fillOpacity="0.35" />
            <rect x="42" y="60" width="36" height="2.5" rx="1.25" fill="#001939" fillOpacity="0.35" />
            <rect x="42" y="68" width="22" height="2.5" rx="1.25" fill="#001939" fillOpacity="0.35" />
            {/* Check mark seal */}
            <circle cx="78" cy="78" r="16" fill="#ffba38" />
            <path
              d="M71.5 78.2L76.2 82.8L85 73.5"
              stroke="#001939"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="text-center sm:text-left">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-tertiary-fixed-dim mb-3">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>celebration</span>
            Out of beta
          </p>
          <p className="font-headline font-extrabold text-2xl sm:text-3xl text-on-primary tracking-tight mb-2">
            Court Reportcard is live
          </p>
          <p className="text-sm text-primary-fixed leading-relaxed max-w-sm">
            Built for court reporters. Ready for real jobs. A small win worth noting.
          </p>
        </div>
      </div>
    </div>
  )
}
