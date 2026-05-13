import { useAuth } from '../context/AuthContext'
import SiteFooter from '../components/SiteFooter'

const callouts = [
  {
    n: 1,
    title: 'Confidence Score',
    body: 'Every page gets a single number — the AI\'s certainty across every word it read. Anything below 95% gets your attention first.',
  },
  {
    n: 2,
    title: 'Low-Confidence Words',
    body: 'Dotted underline marks every word the model wasn\'t sure about. Hover to see the alternative reading. Click to accept it.',
  },
  {
    n: 3,
    title: 'Speaker Pills',
    body: 'Speakers are auto-detected from transcript context. Click any pill to rename — every instance updates everywhere, instantly.',
  },
  {
    n: 4,
    title: 'Inline Suggestions',
    body: 'Corrections appear in context, never in popups. Accept, reject, or ignore without leaving the line you\'re reading.',
  },
  {
    n: 5,
    title: 'Audit Trail',
    body: 'Every edit is logged with timestamp and source — yours or the AI\'s. Your chain of custody is airtight before you ever export.',
  },
]

export default function OurPlatform() {
  const { openModal } = useAuth()

  return (
    <div className="bg-background text-on-background">
      <main>

        {/* ─── Hero ─── */}
        <section className="px-8 pt-20 pb-16 lg:pt-28 lg:pb-20">
          <div className="max-w-5xl mx-auto text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-5 inline-block">The Platform</span>
            <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-extrabold text-on-surface tracking-tight leading-[1.05] mb-6">
              What one page of transcript<br/>looks like inside Court Reportcard.
            </h1>
            <p className="text-on-surface-variant text-lg max-w-2xl mx-auto leading-relaxed">
              Upload a .txt transcript. Get back a fully scored, annotated review — with every uncertain word flagged and every edit logged. Here&rsquo;s what&rsquo;s actually happening on the page.
            </p>
          </div>
        </section>

        {/* ─── Anatomy of a Review ─── */}
        <section className="px-8 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">Anatomy of a Review</span>
              <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight mb-3">
                Five things happen automatically.
              </h2>
              <p className="text-on-surface-variant text-base leading-relaxed">
                Every transcript is parsed, scored, and annotated the moment it&rsquo;s uploaded. Hover the numbered pins to see what each piece does.
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8 items-start">

              {/* Left: Editor mockup with numbered pins */}
              <div className="lg:col-span-7">
                <div className="relative bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-6 md:p-8">
                  {/* Mockup header */}
                  <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-error/30"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-primary-fixed"></span>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Case #882-TX · Page 14 of 47</span>
                  </div>

                  {/* Transcript body */}
                  <div className="font-body text-sm text-on-surface space-y-6 leading-relaxed">

                    {/* Speaker 1 — pin 3 anchored here */}
                    <div className="relative">
                      <span className="absolute -left-3 -top-2 z-10 w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-extrabold shadow-md ring-4 ring-background">3</span>
                      <div className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold mb-2 ml-6">Q. MR. HARPER</div>
                      <p className="ml-6">Could you please state your name for the record and tell the court where you were on the night of the incident?</p>
                    </div>

                    {/* Witness response */}
                    <div className="pl-6 border-l-2 border-surface-container-low">
                      <div className="inline-block px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-xs font-bold mb-2">A. THE WITNESS</div>
                      <p>
                        My name is Julian Vane. I arrived at the{' '}
                        <span className="relative inline-block">
                          {/* Pin 2 */}
                          <span className="absolute -top-3 -left-3 z-10 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-extrabold shadow-md ring-4 ring-background">2</span>
                          <span className="border-b-2 border-dotted border-tertiary-fixed-dim cursor-help">residance</span>
                        </span>
                        {' '}on Oak Street at approximately 10:15 PM.
                      </p>
                    </div>

                    {/* Inline suggestion card — pin 4 */}
                    <div className="relative ml-6 max-w-sm">
                      <span className="absolute -left-3 -top-2 z-10 w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-extrabold shadow-md ring-4 ring-background">4</span>
                      <div className="bg-tertiary-fixed/15 border border-tertiary-fixed/40 rounded-xl p-4 ml-6">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-tertiary-fixed-dim text-base">lightbulb</span>
                          <span className="text-[10px] uppercase tracking-widest font-bold text-on-tertiary-container">Suggested Correction</span>
                        </div>
                        <p className="text-xs text-on-surface mb-3">
                          &ldquo;residance&rdquo; → <span className="font-bold">&ldquo;residence&rdquo;</span> · 99% confidence
                        </p>
                        <div className="flex gap-2">
                          <button className="flex-1 bg-primary text-on-primary text-xs font-bold py-1.5 rounded-md">Accept</button>
                          <button className="flex-1 bg-surface-container text-on-surface text-xs font-bold py-1.5 rounded-md border border-outline-variant/20">Ignore</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status bar — pins 1 and 5 */}
                  <div className="mt-8 pt-4 border-t border-outline-variant/15 flex items-center justify-between">
                    <div className="relative flex items-center gap-2">
                      <span className="absolute -top-3 -left-3 z-10 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-extrabold shadow-md ring-4 ring-background">5</span>
                      <span className="material-symbols-outlined text-on-surface-variant/60 text-base">history</span>
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">3 edits logged · last 2:14 PM</span>
                    </div>
                    <div className="relative flex flex-col items-end">
                      <span className="absolute -top-3 -right-3 z-10 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-extrabold shadow-md ring-4 ring-background">1</span>
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">Page Confidence</span>
                      <span className="text-2xl font-headline font-black text-primary leading-none mt-0.5">98.4%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Numbered callout list */}
              <div className="lg:col-span-5 lg:pl-4">
                <div className="space-y-5">
                  {callouts.map((c) => (
                    <div key={c.n} className="flex gap-4 group">
                      <div className="shrink-0 w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-extrabold transition-transform group-hover:scale-110">
                        {c.n}
                      </div>
                      <div className="pt-1">
                        <h4 className="font-headline font-bold text-base text-on-surface mb-1">{c.title}</h4>
                        <p className="text-sm text-on-surface-variant leading-relaxed">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="px-8 pb-28">
          <div className="max-w-3xl mx-auto bg-primary rounded-3xl editorial-shadow p-10 md:p-14 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary-fixed-dim mb-4 block">Ready to Start?</span>
            <h3 className="font-headline text-3xl md:text-4xl font-extrabold text-on-primary tracking-tight mb-4 leading-tight">
              Get full access to every feature.
            </h3>
            <p className="text-on-primary-container/90 text-base mb-8 max-w-md mx-auto">
              50 free tokens — one per page — when you sign up. No credit card required.
            </p>
            <button
              onClick={() => openModal('signup')}
              className="inline-flex items-center gap-2 bg-tertiary-fixed-dim text-on-tertiary-fixed px-8 py-3.5 rounded-lg font-bold text-sm uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all"
            >
              Get Early Access
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  )
}
