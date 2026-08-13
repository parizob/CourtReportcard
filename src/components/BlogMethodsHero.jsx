/**
 * Visual banner for the steno / voice / digital methods post.
 * Three capture paths, one shared record — kept minimal on purpose.
 */
export default function BlogMethodsHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl editorial-shadow border border-outline-variant/15 mb-10">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary-container via-primary-fixed/50 to-tertiary-fixed/45" />
      <div className="absolute -top-14 -right-10 w-52 h-52 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-8 w-44 h-44 rounded-full bg-tertiary-fixed-dim/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 px-6 sm:px-10 py-10 sm:py-12">
        <div className="shrink-0" aria-hidden="true">
          <svg width="140" height="112" viewBox="0 0 140 112" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Three simple tool marks */}
            <circle cx="28" cy="28" r="22" fill="#ffffff" />
            <rect x="16" y="22" width="7" height="5" rx="1.5" fill="#001939" />
            <rect x="25" y="22" width="7" height="5" rx="1.5" fill="#001939" />
            <rect x="34" y="22" width="7" height="5" rx="1.5" fill="#4c5e84" />
            <rect x="20" y="29" width="7" height="5" rx="1.5" fill="#4c5e84" />
            <rect x="29" y="29" width="7" height="5" rx="1.5" fill="#001939" />

            <circle cx="70" cy="28" r="22" fill="#ffffff" />
            <ellipse cx="70" cy="24" rx="5" ry="7" fill="#001939" />
            <path d="M63 27c0 5 3 8 7 8s7-3 7-8" stroke="#4c5e84" strokeWidth="2" fill="none" strokeLinecap="round" />
            <line x1="70" y1="35" x2="70" y2="38" stroke="#4c5e84" strokeWidth="2" strokeLinecap="round" />

            <circle cx="112" cy="28" r="22" fill="#ffffff" />
            <path
              d="M100 30v-4 M105 32v-8 M110 31v-6 M115 33v-10 M120 30v-5 M125 32v-7"
              stroke="#ffba38"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Quiet converge into one page */}
            <path d="M28 50v10c0 8 14 14 42 14s42-6 42-14V50" stroke="#ffba38" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.85" />
            <line x1="70" y1="50" x2="70" y2="74" stroke="#ffba38" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
            <rect x="52" y="74" width="36" height="28" rx="6" fill="#001939" />
            <line x1="60" y1="84" x2="80" y2="84" stroke="#d6e3ff" strokeWidth="2" strokeLinecap="round" />
            <line x1="60" y1="90" x2="76" y2="90" stroke="#a9c7ff" strokeWidth="2" strokeLinecap="round" />
            <line x1="60" y1="96" x2="72" y2="96" stroke="#a9c7ff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          </svg>
        </div>

        <div className="text-center sm:text-left">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary mb-3">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>fork_right</span>
            Industry note
          </p>
          <p className="font-headline font-extrabold text-2xl sm:text-3xl text-on-surface tracking-tight mb-2">
            Three paths. One responsibility.
          </p>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm">
            Steno, voice, or digital. Different tools. Same duty when your name is on the pages.
          </p>
        </div>
      </div>
    </div>
  )
}
