/**
 * Visual banner for the voice writing explainer post.
 * One simple stenomask: padded cup, mic, handle.
 */
export default function BlogVoiceHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl editorial-shadow border border-outline-variant/15 mb-10">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary-container via-primary-fixed/40 to-tertiary-fixed/50" />
      <div className="absolute -top-14 -right-12 w-52 h-52 rounded-full bg-tertiary-fixed-dim/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-8 w-44 h-44 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 px-6 sm:px-10 py-10 sm:py-12">
        <div className="shrink-0" aria-hidden="true">
          <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="70" cy="58" r="48" fill="#ffba38" fillOpacity="0.14" />

            <ellipse cx="70" cy="48" rx="36" ry="30" fill="#f8f9fa" />
            <ellipse cx="70" cy="48" rx="28" ry="22" fill="#001939" />
            <ellipse cx="70" cy="46" rx="10" ry="8" fill="#d6e3ff" />
            <ellipse cx="70" cy="45" rx="4" ry="5" fill="#ffba38" />

            <rect x="62" y="76" width="16" height="22" rx="5" fill="#4c5e84" />
            <rect x="58" y="94" width="24" height="8" rx="3" fill="#001939" />
          </svg>
        </div>

        <div className="text-center sm:text-left">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary mb-3">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>record_voice_over</span>
            Industry note
          </p>
          <p className="font-headline font-extrabold text-2xl sm:text-3xl text-on-surface tracking-tight mb-2">
            A quiet mask built for speech.
          </p>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm">
            What voice writers do, how a stenomask writes, and how the method got here.
          </p>
        </div>
      </div>
    </div>
  )
}
