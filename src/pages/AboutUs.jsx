import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'

const stats = [
  { value: '94%', label: 'Avg. accuracy on first pass' },
  { value: '3×', label: 'Faster than manual review' },
  { value: '60%', label: 'Reduction in correction costs' },
  { value: '1', label: 'Secure place for every file' },
]

const pillars = [
  {
    icon: 'spellcheck',
    title: 'What We Do',
    color: 'bg-secondary-container text-on-secondary-container',
    accent: 'border-secondary',
    body: 'Court Reportcard is an AI-powered proofreading platform built exclusively for stenographers and digital court reporters. We scan every transcript against audio, flag mismatches, catch low-confidence words, and surface legal-dictionary errors — all before a single page leaves your desk.',
  },
  {
    icon: 'savings',
    title: 'A Fraction of the Cost',
    color: 'bg-tertiary-fixed/20 text-on-tertiary-container',
    accent: 'border-tertiary-fixed-dim',
    body: 'Traditional QA means hours of manual review at full billing rates. Court Reportcard cuts that to minutes. Whether you\'re a solo reporter or managing a firm, you recover time and margin on every job — without sacrificing the accuracy courts demand.',
  },
  {
    icon: 'folder_open',
    title: 'Everything in One Place',
    color: 'bg-primary-fixed/30 text-primary',
    accent: 'border-primary-fixed-dim',
    body: 'Upload transcripts and audio, review flagged errors, accept corrections, and export certified-ready documents — all inside a single dashboard. No more juggling email threads, shared drives, and third-party tools. Your case history is searchable and always accessible.',
  },
]

const timeline = [
  {
    year: '2023',
    heading: 'First exposure',
    detail: 'A close family friend — a veteran stenographer — showed us her daily workflow: a 4-hour deposition, six hours of solo review, and still a looming certification deadline. We couldn\'t unsee it.',
  },
  {
    year: '2024',
    heading: 'Research & interviews',
    detail: 'We spent twelve months talking to reporters across the country. Every conversation confirmed the same pain: the work is important, the pressure is relentless, and the tools haven\'t caught up.',
  },
  {
    year: '2025',
    heading: 'First prototype',
    detail: 'We built an early audio-to-transcript diff engine and handed it to five reporters for beta testing. Average review time dropped from hours to under 30 minutes.',
  },
  {
    year: '2026',
    heading: 'Court Reportcard launches',
    detail: 'After refining accuracy, legal-dictionary matching, and the export pipeline, we opened the platform to reporters nationwide. The mission stays the same: make court reporting easier without making it worse.',
  },
]

export default function AboutUs() {
  return (
    <div className="bg-background text-on-surface font-body min-h-screen">

      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden px-8 pt-10 pb-20 max-w-[1440px] mx-auto">
        {/* decorative blobs */}
        <div className="absolute -top-16 -right-32 w-[520px] h-[520px] bg-secondary-container rounded-full opacity-20 blur-3xl pointer-events-none" />
        <div className="absolute top-0 -left-24 w-[340px] h-[340px] bg-tertiary-fixed rounded-full opacity-10 blur-3xl pointer-events-none" />

        {/* Two-column hero */}
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">

          {/* Left — text */}
          <div>
            <h1 className="font-headline font-extrabold text-6xl lg:text-7xl text-on-surface leading-[1.08] tracking-tight mb-6">
              We exist because<br />
              <span className="text-primary italic">court reporters</span><br />
              deserve better tools.
            </h1>
            <p className="text-xl text-on-surface-variant leading-relaxed max-w-2xl">
              We stumbled into the world of court reporting and couldn't leave. The work is consequential, the deadlines are punishing, and the tooling was decades behind. So we built what we wished already existed.
            </p>
          </div>

          {/* Right — gavel with spinning squares */}
          <div className="flex items-center justify-center">
            <div className="relative w-80 h-80 flex items-center justify-center">

              {/* 6 squares, each 45° apart (2.5s delay per step in a 20s cycle) */}
              {[
                { delay: '0s',     colors: '#ffba38, #a9c7ff, #001939, #4c5e84, #ffba38', opacity: 1    },
                { delay: '-2.5s',  colors: '#a9c7ff, #001939, #4c5e84, #ffba38, #a9c7ff', opacity: 0.92 },
                { delay: '-5s',    colors: '#001939, #4c5e84, #ffba38, #a9c7ff, #001939', opacity: 0.85 },
                { delay: '-7.5s',  colors: '#4c5e84, #ffba38, #a9c7ff, #001939, #4c5e84', opacity: 0.78 },
                { delay: '-10s',   colors: '#ffba38, #001939, #a9c7ff, #4c5e84, #ffba38', opacity: 0.72 },
                { delay: '-12.5s', colors: '#001939, #a9c7ff, #4c5e84, #ffba38, #001939', opacity: 0.65 },
              ].map((sq, i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-[0.75rem] spin-very-slow"
                  style={{
                    background: `conic-gradient(from 0deg, ${sq.colors})`,
                    animationDelay: sq.delay,
                    opacity: sq.opacity,
                  }}
                />
              ))}

              {/* Dark navy backing square to make gavel pop */}
              <div className="absolute w-36 h-36 rounded-2xl bg-primary z-[5] shadow-[0_0_32px_rgba(0,25,57,0.6)]" />

              {/* Gavel icon */}
              <span
                className="relative z-10 material-symbols-outlined text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)]"
                style={{ fontSize: '110px', fontVariationSettings: "'FILL' 1, 'wght' 200, 'GRAD' 0, 'opsz' 48" }}
              >
                gavel
              </span>

            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 mt-14 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-container-lowest rounded-xl p-6 editorial-shadow border border-outline-variant/10">
              <p className="font-headline font-black text-4xl text-primary mb-1">{s.value}</p>
              <p className="text-xs text-on-surface-variant leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Three Pillars */}
      <section className="bg-surface-container-low py-20 px-8">
        <div className="max-w-[1440px] mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">The Platform</p>
          <h2 className="font-headline font-extrabold text-4xl text-on-surface mb-12 max-w-xl">Three things we obsess over</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {pillars.map((p) => (
              <div key={p.title} className={`bg-surface-container-lowest rounded-2xl p-8 editorial-shadow border-t-4 ${p.accent}`}>
                <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl mb-6 ${p.color}`}>
                  <span className="material-symbols-outlined">{p.icon}</span>
                </span>
                <h3 className="font-headline font-bold text-xl text-on-surface mb-3">{p.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why we do it — origin story */}
      <section className="py-24 px-8 max-w-[1440px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Left — copy */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Our Story</p>
            <h2 className="font-headline font-extrabold text-4xl text-on-surface mb-6 leading-tight">
              Why we built this
            </h2>
            <p className="text-base text-on-surface-variant leading-relaxed mb-5">
              Court reporting is one of the last skilled professions that the modern software industry largely ignored. These reporters sit in high-pressure rooms — depositions, trials, grand juries — capturing every spoken word verbatim. A single missed phrase can affect a case outcome.
            </p>
            <p className="text-base text-on-surface-variant leading-relaxed mb-5">
              After watching how long post-session review actually takes, and hearing the anxiety around certification deadlines, we became convinced: this problem is solvable with the right technology.
            </p>
            <p className="text-base text-on-surface-variant leading-relaxed">
              Court Reportcard was built with deep respect for the craft. We don't try to replace the reporter — we remove the tedium so they can focus on what only a skilled human can do: guarantee accuracy under oath.
            </p>

            <div className="mt-10 flex gap-4">
              <Link
                to="/ourplatform"
                className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-md font-bold text-sm hover:translate-y-[-1px] transition-all editorial-shadow"
              >
                Try the Platform
              </Link>
              <Link
                to="/ourplatform/editor"
                className="border border-outline-variant/40 text-on-surface px-6 py-3 rounded-md font-bold text-sm hover:bg-surface-container transition-colors"
              >
                See the Editor
              </Link>
            </div>
          </div>

          {/* Right — timeline */}
          <div className="relative pl-6 border-l-2 border-outline-variant/30 space-y-10">
            {timeline.map((t, i) => (
              <div key={t.year} className="relative">
                <span className="absolute -left-[2.15rem] top-1 w-7 h-7 rounded-full bg-surface-container-lowest border-2 border-primary flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary block" />
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-tertiary-fixed-dim mb-1">{t.year}</p>
                <h4 className="font-headline font-bold text-base text-on-surface mb-1">{t.heading}</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed">{t.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA banner */}
      <section className="bg-primary text-on-primary py-20 px-8">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="font-headline font-extrabold text-3xl mb-2">Ready to see it in action?</h2>
            <p className="text-on-primary/70 text-base">Upload your first transcript in under a minute. No credit card required.</p>
          </div>
          <Link
            to="/ourplatform"
            className="shrink-0 bg-tertiary-fixed-dim text-on-tertiary-fixed px-8 py-4 rounded-md font-bold text-base hover:brightness-105 transition-all editorial-shadow"
          >
            Start for Free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-container-low border-t border-outline-variant/20 px-8 py-8">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
          <span className="font-headline font-black text-primary text-base">Court Reportcard</span>
          <span>© 2024 Court Reportcard. Built for stenographers who deserve better.</span>
          <div className="flex gap-6">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <Link to="/ourplatform" className="hover:text-primary transition-colors">Platform</Link>
            <Link to="/aboutus" className="hover:text-primary transition-colors">About</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
