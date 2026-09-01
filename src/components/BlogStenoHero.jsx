/**
 * Visual banner for the stenography roots post.
 * One clear stenotype: number bar, chorded keys, vowel bank.
 */
export default function BlogStenoHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl editorial-shadow border border-outline-variant/15 mb-10">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary-container via-primary-fixed/40 to-tertiary-fixed/50" />
      <div className="absolute -top-14 -right-12 w-52 h-52 rounded-full bg-tertiary-fixed-dim/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-8 w-44 h-44 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 px-6 sm:px-10 py-10 sm:py-12">
        <div className="shrink-0" aria-hidden="true">
          <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="70" cy="64" r="48" fill="#ffba38" fillOpacity="0.14" />

            <rect x="52" y="10" width="36" height="26" rx="4" fill="#f8f9fa" />
            <path d="M58 18c8-3 16 2 22-1" stroke="#4c5e84" strokeWidth="1.7" fill="none" strokeLinecap="round" />
            <path d="M58 24c7-2 15 3 22 0" stroke="#4c5e84" strokeWidth="1.7" fill="none" strokeLinecap="round" />
            <path d="M58 30c8-2 14 2 20-1" stroke="#4c5e84" strokeWidth="1.7" fill="none" strokeLinecap="round" />

            <rect x="18" y="34" width="104" height="72" rx="14" fill="#f8f9fa" />
            <rect x="26" y="42" width="88" height="56" rx="10" fill="#001939" />
            <rect x="32" y="48" width="76" height="5" rx="2" fill="#ffba38" />

            <rect x="32" y="58" width="11" height="11" rx="2.5" fill="#d6e3ff" />
            <rect x="45" y="58" width="11" height="11" rx="2.5" fill="#d6e3ff" />
            <rect x="58" y="58" width="11" height="11" rx="2.5" fill="#d6e3ff" />
            <rect x="71" y="58" width="11" height="11" rx="2.5" fill="#d6e3ff" />
            <rect x="84" y="58" width="11" height="11" rx="2.5" fill="#d6e3ff" />
            <rect x="97" y="58" width="11" height="11" rx="2.5" fill="#a9c7ff" />

            <rect x="38" y="72" width="11" height="11" rx="2.5" fill="#a9c7ff" />
            <rect x="51" y="72" width="11" height="11" rx="2.5" fill="#d6e3ff" />
            <rect x="78" y="72" width="11" height="11" rx="2.5" fill="#d6e3ff" />
            <rect x="91" y="72" width="11" height="11" rx="2.5" fill="#d6e3ff" />

            <rect x="40" y="87" width="13" height="7" rx="2" fill="#ffba38" />
            <rect x="55" y="87" width="13" height="7" rx="2" fill="#ffba38" />
            <rect x="72" y="87" width="13" height="7" rx="2" fill="#ffba38" />
            <rect x="87" y="87" width="13" height="7" rx="2" fill="#ffba38" />
          </svg>
        </div>

        <div className="text-center sm:text-left">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary mb-3">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
            Industry note
          </p>
          <p className="font-headline font-extrabold text-2xl sm:text-3xl text-on-surface tracking-tight mb-2">
            A keyboard built for speech.
          </p>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm">
            What stenographers do, how a stenotype writes, and how the machine got here.
          </p>
        </div>
      </div>
    </div>
  )
}
