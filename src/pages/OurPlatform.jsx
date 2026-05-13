import { useAuth } from '../context/AuthContext'
import SiteFooter from '../components/SiteFooter'

const callouts = [
  {
    n: 1,
    title: 'Line-by-Line Transcript View',
    body: 'Your exact .txt file — line numbers intact, original formatting preserved. Every flagged word is underlined directly in the text, so you never lose your place.',
  },
  {
    n: 2,
    title: 'Annotation Sidebar',
    body: 'Every AI-flagged issue surfaces in a panel beside the transcript. Severity, type, suggested fix, and confidence — all at a glance. Jump to any flag in one click.',
  },
  {
    n: 3,
    title: 'Accept or Ignore, In Context',
    body: 'One click accepts the correction. One click dismisses it. You never leave the page, never lose your scroll position, never second-guess what you were reviewing.',
  },
  {
    n: 4,
    title: 'Confidence Score Per Page',
    body: 'Each page is scored by the model\'s certainty across every word it processed. Pages below 95% surface first. You know immediately where the risk is.',
  },
  {
    n: 5,
    title: 'Audit Trail Built In',
    body: 'Every accept, every ignore, every manual edit is timestamped and logged automatically. Your chain of custody is court-ready before you ever export.',
  },
]

const stats = [
  {
    metric: '< 3 min',
    label: 'to analyze a 200-page deposition',
    sub: 'A human scopist averages 6–8 hours for the same file.',
  },
  {
    metric: '100%',
    label: 'of words evaluated for errors',
    sub: 'No line skipped. No page rushed. No homophone missed.',
  },
  {
    metric: '~97%',
    label: 'cost reduction vs. manual review',
    sub: 'Cents per page instead of dollars per hour.',
  },
]

export default function OurPlatform() {
  const { openModal } = useAuth()

  return (
    <div className="bg-background text-on-background">
      <main>

        {/* ─── Hero ─── */}
        <section className="px-8 pt-20 pb-16 lg:pt-28 lg:pb-20">
          <div className="max-w-4xl mx-auto text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-5 inline-block">The Platform</span>
            <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-extrabold text-on-surface tracking-tight leading-[1.05] mb-6">
              The fastest way to review<br/>a court transcript. By far.
            </h1>
            <p className="text-on-surface-variant text-lg max-w-2xl mx-auto leading-relaxed">
              A 200-page deposition that takes an experienced scopist six hours takes Court Reportcard under three minutes — at a fraction of the cost, with nothing missed.
            </p>
          </div>
        </section>

        {/* ─── Stats ─── */}
        <section className="px-8 pb-20">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {stats.map((s) => (
              <div key={s.metric} className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-7 text-center">
                <p className="font-headline text-4xl font-extrabold text-primary mb-1">{s.metric}</p>
                <p className="text-sm font-semibold text-on-surface mb-2">{s.label}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">{s.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Editor Mockup + Callouts ─── */}
        <section className="px-8 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 max-w-xl">
              <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">Inside the Editor</span>
              <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight mb-3">
                Built for the way you actually work.
              </h2>
              <p className="text-on-surface-variant text-base leading-relaxed">
                No learning curve. No new workflow. Your transcript — surfaced, scored, and ready to sign off on.
              </p>
            </div>

            {/* Editor mockup — full width, accurate to real UI */}
            <div className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 overflow-hidden mb-14">
              {/* Window chrome */}
              <div className="flex items-center justify-between border-b border-outline-variant/15 px-5 py-3 bg-surface-container">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-error/40"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-300/70"></span>
                  <span className="w-3 h-3 rounded-full bg-green-400/60"></span>
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Smith v. Hargrove — Deposition of Julian Vane — Page 14 of 47</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/50">Confidence</span>
                  <span className="text-sm font-headline font-extrabold text-primary">98.4%</span>
                </div>
              </div>

              {/* Two-panel layout: transcript + sidebar */}
              <div className="flex min-h-[340px]">

                {/* Left: transcript */}
                <div className="flex-1 px-8 py-6 font-mono text-[13px] text-on-surface leading-7 overflow-hidden border-r border-outline-variant/10">
                  <div className="space-y-0">
                    {[
                      { n: 20, text: 'Q.  Could you please state your name for the record' },
                      { n: 21, text: '    and tell the court where you were on the night' },
                      { n: 22, text: '    of the incident?' },
                      { n: 23, text: '' },
                      { n: 24, text: 'A.  My name is Julian Vane.  I arrived at the' },
                      { n: 25, text: null, highlighted: true },
                      { n: 26, text: '    10:15 PM.  We had a prior engagement that' },
                      { n: 27, text: '    evening but we did not stay passed midnight.' },
                      { n: 28, text: '' },
                    ].map((line) => (
                      <div key={line.n} className="flex min-h-[1.75rem]">
                        <span className="w-10 shrink-0 text-right pr-4 text-xs text-on-surface-variant/40 select-none leading-7">{line.n}</span>
                        {line.highlighted ? (
                          <span className="leading-7">
                            {'    '}
                            <span className="border-b-2 border-error text-error font-semibold">residance</span>
                            {' on Oak Street at approximately'}
                          </span>
                        ) : (
                          <span className="whitespace-pre leading-7">{line.text}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: annotation sidebar */}
                <div className="w-72 shrink-0 bg-surface-container/50 px-4 py-5 space-y-3 overflow-hidden">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant/60 mb-4">3 issues · 1 open</p>

                  {/* Active annotation card */}
                  <div className="bg-surface-container-lowest rounded-xl border-l-4 border-error p-3 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-error text-xs">error</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-error">Spelling · Critical</span>
                    </div>
                    <p className="text-xs font-semibold text-on-surface mb-0.5">Found &ldquo;residance&rdquo;</p>
                    <p className="text-[10px] text-on-surface-variant mb-2 leading-relaxed">Should be &ldquo;residence&rdquo;. Common phonetic misspelling.</p>
                    <p className="text-[9px] text-on-surface-variant/60 mb-2">Confidence: 99%</p>
                    <button className="w-full bg-primary text-on-primary text-[10px] font-bold py-1.5 rounded-md text-center">
                      Accept: &ldquo;residence&rdquo;
                    </button>
                  </div>

                  {/* Resolved card */}
                  <div className="bg-surface-container-lowest rounded-xl border-l-4 border-green-500/50 p-3 opacity-60">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-green-600 text-xs">check_circle</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-green-600">Context · Resolved</span>
                    </div>
                    <p className="text-xs font-semibold text-on-surface">Found &ldquo;passed&rdquo;</p>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed">Accepted → &ldquo;past&rdquo;</p>
                  </div>

                  {/* Ignored card */}
                  <div className="bg-surface-container-lowest rounded-xl border-l-4 border-outline-variant/30 p-3 opacity-50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-on-surface-variant/50 text-xs">do_not_disturb_on</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/50">Punctuation · Ignored</span>
                    </div>
                    <p className="text-xs font-semibold text-on-surface">Found &ldquo;PM.  We&rdquo;</p>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed">Double space after period.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Numbered callout list below mockup */}
            <div className="grid md:grid-cols-5 gap-6">
              {callouts.map((c) => (
                <div key={c.n} className="group">
                  <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-extrabold mb-3 transition-transform group-hover:scale-110">
                    {c.n}
                  </div>
                  <h4 className="font-headline font-bold text-sm text-on-surface mb-1.5">{c.title}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Why it matters ─── */}
        <section className="px-8 pb-24 bg-surface-container/30">
          <div className="max-w-4xl mx-auto py-20">
            <div className="text-center mb-14">
              <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">The Business Case</span>
              <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
                Time is money. Errors are liability.
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-8">
                <span className="material-symbols-outlined text-primary text-2xl mb-4 block">schedule</span>
                <h3 className="font-headline font-bold text-lg text-on-surface mb-3">Before Court Reportcard</h3>
                <ul className="space-y-2.5 text-sm text-on-surface-variant">
                  {[
                    '6–8 hours of manual review per deposition',
                    'Errors caught only if the proofreader is sharp that day',
                    'No systematic record of what was changed or why',
                    'Turnaround measured in days',
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-error/60 mt-2" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-primary rounded-2xl editorial-shadow p-8">
                <span className="material-symbols-outlined text-on-primary text-2xl mb-4 block">auto_fix_high</span>
                <h3 className="font-headline font-bold text-lg text-on-primary mb-3">After Court Reportcard</h3>
                <ul className="space-y-2.5 text-sm text-on-primary-container/90">
                  {[
                    'Under 3 minutes to surface every issue in a 200-page file',
                    'Every word evaluated — no fatigue, no off days',
                    'Full audit trail exported with every transcript',
                    'Turnaround measured in minutes',
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-on-primary/60 mt-2" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="px-8 py-28">
          <div className="max-w-3xl mx-auto bg-primary rounded-3xl editorial-shadow p-10 md:p-14 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary-fixed-dim mb-4 block">Start Today</span>
            <h3 className="font-headline text-3xl md:text-4xl font-extrabold text-on-primary tracking-tight mb-4 leading-tight">
              Your next deposition review starts in 3 minutes.
            </h3>
            <p className="text-on-primary-container/90 text-base mb-8 max-w-lg mx-auto leading-relaxed">
              50 free tokens — one per page — the moment you sign up. No credit card. No onboarding call. Just upload and go.
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
