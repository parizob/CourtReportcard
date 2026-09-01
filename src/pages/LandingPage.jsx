import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import SiteFooter from '../components/SiteFooter'

const HERO_TIPS = {
  context: {
    label: 'Context Suggestion',
    labelClass: 'text-error',
    original: 'council',
    suggestion: 'counsel',
    suggestionClass: 'text-on-surface',
    showActions: true,
    explanation:
      'Homophone: in this setting the witness likely means their attorney (counsel), not a governing body.',
  },
  accepted: {
    label: 'Accepted',
    labelClass: 'text-green-600',
    original: 'incidant',
    suggestion: 'incident',
    suggestionClass: 'text-green-600',
    explanation: 'Misspelling of "incident." Accepted by user and applied.',
  },
  ignored: {
    label: 'Ignored',
    labelClass: 'text-on-surface-variant',
    original: '"color"',
    suggestion: 'left as-is',
    suggestionClass: 'text-on-surface',
    strikeOriginal: false,
    explanation: 'American "color" is correct here. Ignored by user.',
  },
}

export default function LandingPage() {
  const { openModal } = useAuth()
  const revealRefs = useRef([])
  const [heroTip, setHeroTip] = useState(null)
  const tip = heroTip ? HERO_TIPS[heroTip] : null

  useEffect(() => {
    const items = revealRefs.current.filter(Boolean)
    if (!items.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    items.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const setRevealRef = (index) => (el) => {
    revealRefs.current[index] = el
  }

  return (
    <div className="bg-background text-on-surface font-body selection:bg-tertiary-fixed selection:text-on-tertiary-fixed">
      <Helmet>
        <title>Court Reportcard | Precision Proofreading for Court Reporters</title>
        <meta name="description" content="Precision transcript proofreading for court reporters and scopists. Catches spelling, punctuation, homophones, and other context-sensitive mistakes before filing. Upload .txt or .rtf — results in minutes." />
        <link rel="canonical" href="https://www.courtreportcard.com/" />
      </Helmet>

      <main>
        {/* Hero Section */}
        <section className="relative pt-10 sm:pt-14 pb-16 sm:pb-32 overflow-hidden px-5 sm:px-12 max-w-[1440px] mx-auto">
          {/* Mobile: headline → mock → copy/CTAs. Desktop: left stack | mock */}
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 lg:items-center">
            <div className="lg:col-span-6 z-10 order-1 page-rise text-center lg:text-left">
              <h1 className="font-headline font-extrabold text-[2rem] leading-[1.15] sm:text-5xl lg:text-7xl lg:leading-[1.1] text-on-surface tracking-tight mb-3 lg:mb-8">
                <span className="block">Your Second Set</span>
                <span className="block">of Eyes on</span>
                <span className="block text-primary italic">Every Transcript</span>
              </h1>
              <p className="lg:hidden text-base text-on-surface-variant leading-relaxed mb-0">
                Precision proofreading for court reporters.
              </p>
              <div className="hidden lg:block">
                <p className="text-xl text-on-surface-variant mb-10 max-w-xl leading-relaxed">
                  Precision proofreading for court reporters. Catch spelling,
                  <br />
                  punctuation, homophones, and other context-sensitive
                  <br />
                  mistakes before a single page leaves your desk.
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <button
                    onClick={() => openModal('signup')}
                    data-track-id="landing_hero_try_now"
                    className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-8 py-3 rounded-lg font-bold text-lg editorial-shadow transition-all hover:translate-y-[-2px] hover:scale-[1.02] active:scale-95"
                  >
                    Get started
                  </button>
                  <Link
                    to="/ourplatform"
                    data-track-id="landing_hero_platform_demo"
                    className="group inline-flex items-center gap-1 text-primary font-bold text-lg no-underline hover:no-underline transition-colors"
                  >
                    See how it works
                    <span
                      className="material-symbols-outlined text-lg transition-transform duration-200 ease-out group-hover:translate-x-1"
                      aria-hidden="true"
                    >
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Visual Representation of Transcript */}
            <div className="lg:col-span-6 relative order-2 page-rise-delay">
              {/* Soft “screen light” wash — navy/steel, not neon */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-3 sm:-inset-5 hero-screen-glow"
              >
                <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
                <div className="absolute inset-[12%] rounded-3xl bg-secondary-container/50 blur-xl" />
              </div>
              <div className="relative">
              <div className="hero-mock-in bg-surface-container-lowest editorial-shadow rounded-xl p-5 sm:p-8 border border-outline-variant/15 relative overflow-hidden">
                {/* Editor Mockup */}
                <div className="space-y-6">
                  <div className="hero-mock-line flex items-center justify-between border-b border-surface-container pb-4">
                    <div className="flex gap-2">
                      <span className="w-3 h-3 rounded-full bg-error/20"></span>
                      <span className="w-3 h-3 rounded-full bg-tertiary-fixed-dim"></span>
                      <span className="w-3 h-3 rounded-full bg-primary-fixed"></span>
                    </div>
                    <span className="font-label text-xs uppercase tracking-widest text-outline">Case #882-TX</span>
                  </div>
                  {/* Transcript Content */}
                  <div className="space-y-8 font-body text-on-surface text-sm leading-relaxed">
                    <div className="hero-mock-line hero-mock-line-delay-1">
                      <div className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold mb-2">Q. MR. HARPER</div>
                      <p>Who did you speak with after the{' '}
                        <span
                          className="relative inline cursor-pointer"
                          onMouseEnter={() => setHeroTip('accepted')}
                          onMouseLeave={() => setHeroTip(null)}
                        >
                          <span className="text-green-600 font-semibold">incident</span>
                        </span>
                        ?</p>
                    </div>
                    <div className="hero-mock-line hero-mock-line-delay-2 pl-8 border-l-2 border-surface-container-low">
                      <div className="inline-block px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-xs font-bold mb-2">A. THE WITNESS</div>
                      <p>First thing I did was call my{' '}
                        <span
                          className="relative inline-block cursor-pointer pt-5 -mt-5"
                          onMouseEnter={() => setHeroTip('context')}
                          onMouseLeave={() => setHeroTip(null)}
                        >
                          <span className="text-error border border-error rounded-sm px-1 leading-none hero-error-pulse">council</span>
                          <span className="hero-badge-pop hidden sm:block absolute top-0 left-0 bg-error text-white text-[10px] px-1 rounded">CTX?</span>
                        </span>
                        {' '} as soon as I got back to my house.</p>
                    </div>
                    <div className="hero-mock-line hero-mock-line-delay-3">
                      <div className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold mb-2">Q. MR. HARPER</div>
                      <p>And when you looked outside, what{' '}
                        <span
                          className="relative inline cursor-pointer"
                          onMouseEnter={() => setHeroTip('ignored')}
                          onMouseLeave={() => setHeroTip(null)}
                        >
                          <span className="border-b-2 border-dotted border-on-surface-variant/50 italic">color</span>
                        </span>
                        {' '}was the vehicle?</p>
                    </div>
                  </div>
                  {/* Suggestion / scorecard panel — fixed height so hover never shifts the hero */}
                  <div className="hero-mock-line hero-mock-line-delay-4 mt-6 pt-4 border-t border-outline-variant/15">
                    <div className="relative w-full sm:h-[6.25rem] rounded-lg bg-surface-container-low/80 border border-outline-variant/15 overflow-hidden">
                      {tip ? (
                        <div className="flex flex-col justify-center px-3 py-2.5 sm:absolute sm:inset-0 sm:px-4 sm:py-3">
                          <div className={`relative mb-0.5 ${tip.showActions ? 'sm:pr-[7.5rem]' : ''}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${tip.labelClass}`}>
                                {tip.label}
                              </span>
                              {tip.showActions && (
                                <div className="flex items-center gap-1.5 sm:hidden" aria-hidden="true">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-transparent bg-surface-container text-on-surface">
                                    Accept
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-outline-variant/25 text-on-surface-variant">
                                    Ignore
                                  </span>
                                </div>
                              )}
                            </div>
                            {tip.showActions && (
                              <div className="absolute -top-0.5 right-0 hidden sm:flex items-center gap-1.5" aria-hidden="true">
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded border border-transparent bg-surface-container text-on-surface">
                                  Accept
                                </span>
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded border border-outline-variant/25 text-on-surface-variant">
                                  Ignore
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-[12px] sm:text-[13px] text-on-surface leading-snug">
                            <span className={`text-on-surface-variant ${tip.strikeOriginal === false ? '' : 'line-through'}`}>
                              {tip.original}
                            </span>
                            {' → '}
                            <span className={`font-bold ${tip.suggestionClass}`}>{tip.suggestion}</span>
                          </p>
                          <p className="mt-1.5 text-[10px] sm:text-[11px] text-on-surface-variant leading-relaxed">
                            {tip.explanation}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col justify-center px-3 py-2.5 sm:absolute sm:inset-0 sm:px-4 sm:py-3">
                          <div className="grid grid-cols-5 gap-1 mb-2 sm:mb-3">
                            {[
                              { value: 3, label: 'Flagged', color: 'text-on-surface' },
                              { value: 1, label: 'Accepted', color: 'text-green-600' },
                              { value: 0, label: 'Changed', color: 'text-green-600' },
                              { value: 1, label: 'Ignored', color: 'text-on-surface-variant' },
                              { value: 1, label: 'Remaining', color: 'text-error' },
                            ].map((s) => (
                              <div key={s.label} className="text-center">
                                <p className={`text-lg sm:text-xl font-extrabold leading-none ${s.color}`}>{s.value}</p>
                                <p className="text-[8px] sm:text-[9px] uppercase tracking-wide text-on-surface-variant mt-0.5">
                                  {s.label}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: '67%' }} />
                            </div>
                            <span className="shrink-0 inline-flex items-baseline gap-1">
                              <span className="text-[11px] font-extrabold tabular-nums leading-none text-on-surface">67%</span>
                              <span className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant">resolved</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>

            <div className="z-10 order-3 page-rise text-center lg:hidden">
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                <button
                  onClick={() => openModal('signup')}
                  data-track-id="landing_hero_try_now"
                  className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-7 py-3 rounded-lg font-bold text-base editorial-shadow transition-all hover:translate-y-[-2px] hover:scale-[1.02] active:scale-95"
                >
                  Get started
                </button>
                <Link
                  to="/ourplatform"
                  data-track-id="landing_hero_platform_demo"
                  className="group inline-flex items-center gap-1 text-primary font-bold text-base no-underline hover:no-underline transition-colors"
                >
                  See how it works
                  <span
                    className="material-symbols-outlined text-lg transition-transform duration-200 ease-out group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    arrow_forward
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Trust band: what you get + why we built it */}
        <section className="py-14 sm:py-20 px-6 sm:px-8 bg-primary/5">
          <div className="max-w-5xl mx-auto">
            <div ref={setRevealRef(0)} className="landing-reveal text-center mb-8 sm:mb-10">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                Built for Court Reporters
              </span>
              <h2 className="font-headline font-bold text-2xl sm:text-3xl text-on-surface mt-3">
                What reporters actually get
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4 sm:gap-5 mb-8 sm:mb-10">
              {[
                {
                  icon: 'spellcheck',
                  title: 'Flags the hard stuff',
                  body: 'Homophones, missing words, punctuation, and steno-style slips before the file leaves your desk.',
                  delay: '',
                  refIdx: 1,
                },
                {
                  icon: 'verified_user',
                  title: 'You stay in control',
                  body: 'Accept or ignore every suggestion. Nothing changes in the transcript unless you say so.',
                  delay: 'landing-reveal-delay-1',
                  refIdx: 2,
                },
                {
                  icon: 'schedule',
                  title: 'Minutes, not hours',
                  body: 'A long deposition that takes a careful human hours comes back ready to review in minutes.',
                  delay: 'landing-reveal-delay-2',
                  refIdx: 3,
                },
              ].map((c) => (
                <div
                  key={c.title}
                  ref={setRevealRef(c.refIdx)}
                  className={`landing-reveal ${c.delay} bg-surface-container-lowest rounded-xl editorial-shadow border border-outline-variant/15 p-6`}
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-on-secondary-container">{c.icon}</span>
                  </div>
                  <h3 className="font-headline font-bold text-lg text-on-surface mb-2">{c.title}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>

            <div
              ref={setRevealRef(4)}
              className="landing-reveal landing-reveal-delay-3 bg-surface-container-lowest rounded-xl editorial-shadow border border-outline-variant/15 p-7 sm:p-10"
            >
              <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 items-start">
                <div className="shrink-0 w-12 sm:w-16 flex justify-center sm:justify-start">
                  <span className="font-headline font-black text-6xl sm:text-7xl text-primary/15 leading-none select-none">
                    &ldquo;
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">
                    Why we built this
                  </span>
                  <p className="text-base sm:text-lg text-on-surface leading-relaxed mb-4">
                    My wife is an experienced stenographer. I watched her spend as many hours proofreading a transcript as she did recording it, alone, under deadline, with no second set of eyes available. That&apos;s the problem Court Reportcard was built to solve.
                  </p>
                  <p className="text-sm font-bold text-on-surface-variant mb-4">— Brandon, Founder</p>
                  <Link
                    to="/aboutus"
                    className="group text-primary font-bold text-sm inline-flex items-center gap-1"
                  >
                    <span className="group-hover:underline">Read our full story</span>
                    <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works + diagnostics */}
        <section className="bg-surface-container-low py-14 sm:py-20 px-6 sm:px-8">
          <div className="max-w-5xl mx-auto">
            <div ref={setRevealRef(5)} className="landing-reveal text-center mb-10 sm:mb-10">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                How it works
              </span>
              <h2 className="font-headline font-bold text-2xl sm:text-3xl text-on-surface mt-3">
                How Court Reportcard Works
              </h2>
            </div>
            <div
              ref={setRevealRef(6)}
              className="landing-reveal grid lg:grid-cols-2 gap-10 sm:gap-8 items-center mb-12 sm:mb-10"
            >
              <div className="order-2 lg:order-1">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-3 block">
                  Context-aware catches
                </span>
                <h3 className="font-headline font-bold text-2xl sm:text-3xl text-on-surface mb-3">
                  Beyond spellcheck
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-6 max-w-md">
                  Court Reportcard flags what a plain spellchecker misses: impossible dates, wrong words in context, and other slips that only make sense when you read the transcript as a whole. You still decide what to accept.
                </p>
                <ul className="space-y-3.5 text-sm text-on-surface-variant leading-relaxed">
                  <li className="flex gap-2.5 items-start">
                    <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">check_circle</span>
                    <span>Homophones and context mix-ups</span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">check_circle</span>
                    <span>Impossible or contradictory dates</span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">check_circle</span>
                    <span>Confidence scores so you know where to focus</span>
                  </li>
                </ul>
              </div>

              {/* Mock of a real Insights critical card — same soft glow as hero dialogue */}
              <div className="relative max-w-md w-full mx-auto order-1 lg:order-2 lg:mx-0 lg:ml-auto">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-1.5"
                >
                  <div className="absolute inset-0 rounded-xl bg-primary/10 blur-xl" />
                  <div className="absolute inset-[18%] rounded-xl bg-secondary-container/40 blur-md" />
                </div>
                <div className="relative bg-surface-container-lowest rounded-lg editorial-shadow border-l-4 border-error p-4 sm:p-5">
                <div className="absolute top-2.5 right-2.5 flex flex-col items-center gap-0.5">
                  <span
                    className="w-5 h-5 flex items-center justify-center rounded-full text-on-surface-variant/40 text-xs leading-none"
                    aria-hidden="true"
                  >
                    &times;
                  </span>
                  <span
                    className="w-5 h-5 flex items-center justify-center rounded-full text-on-surface-variant/30"
                    aria-hidden="true"
                  >
                    <span className="material-symbols-outlined text-xs">my_location</span>
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-error flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-xs">error</span>
                  Context &middot; Critical
                </span>
                <p className="text-sm font-medium text-on-surface mb-1 pr-8">
                  Found <strong>&quot;November 31st&quot;</strong>
                </p>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                  The witness stated the event occurred on November 31st, but November only has 30 days.
                </p>
                <p className="text-[10px] text-on-surface-variant/60 mb-3">Confidence: 96%</p>
                <div className="w-full text-xs font-bold px-3 py-2.5 min-h-[2.5rem] leading-snug rounded border border-transparent bg-surface-container text-on-surface text-center">
                  Accept: &quot;November 30th&quot;
                </div>
                <div className="mt-2">
                  <div className="w-full text-xs bg-surface-container/60 border border-outline-variant/25 px-3 py-2 rounded-lg text-on-surface-variant/40">
                    Enter your own correction…
                  </div>
                </div>
                <p className="mt-3 text-center text-[10px] text-on-surface-variant/50">
                  Ignore this suggestion
                </p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5 sm:gap-5">
              <div
                ref={setRevealRef(7)}
                className="landing-reveal landing-reveal-delay-1 relative z-0 bg-surface-container-lowest rounded-xl editorial-shadow border border-outline-variant/15 p-6 transition-transform duration-300 ease-out hover:scale-[1.05] hover:z-10"
              >
                <div className="w-10 h-10 bg-primary-fixed rounded-lg flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary">cloud_upload</span>
                </div>
                <h3 className="font-headline font-bold text-lg text-on-surface mb-2">Upload Transcript</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Drop in your .txt or .rtf transcript from your steno software. Give the case a name and we&apos;ll start the review.
                </p>
                <div className="absolute top-5 right-5 text-4xl font-black text-surface-container-high/50 select-none" aria-hidden="true">
                  01
                </div>
              </div>
              <div
                ref={setRevealRef(8)}
                className="landing-reveal landing-reveal-delay-2 relative z-0 bg-surface-container-lowest rounded-xl editorial-shadow border border-outline-variant/15 p-6 transition-transform duration-300 ease-out hover:scale-[1.05] hover:z-10"
              >
                <div className="w-10 h-10 bg-tertiary-fixed rounded-lg flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-on-tertiary-fixed">analytics</span>
                </div>
                <h3 className="font-headline font-bold text-lg text-on-surface mb-2">Review Suggestions</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  We flag likely spelling issues, homophones, punctuation mistakes, and other context-sensitive errors. You review each one and decide what to keep.
                </p>
                <div className="absolute top-5 right-5 text-4xl font-black text-surface-container-high/50 select-none" aria-hidden="true">
                  02
                </div>
              </div>
              <div
                ref={setRevealRef(9)}
                className="landing-reveal landing-reveal-delay-3 relative z-0 bg-surface-container-lowest rounded-xl editorial-shadow border border-outline-variant/15 p-6 transition-transform duration-300 ease-out hover:scale-[1.05] hover:z-10"
              >
                <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-on-secondary-container">download_done</span>
                </div>
                <h3 className="font-headline font-bold text-lg text-on-surface mb-2">Export Transcript</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  You stay in control of every change. Accept what looks right, ignore the rest, then download your transcript when you&apos;re done reviewing.
                </p>
                <div className="absolute top-5 right-5 text-4xl font-black text-surface-container-high/50 select-none" aria-hidden="true">
                  03
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-on-surface-variant/70 leading-relaxed mx-auto mt-6 sm:mt-8 italic px-2 whitespace-normal sm:whitespace-nowrap">
              Automated review can miss things, just like a human can. Treat it as a second set of eyes, then finish with your own pass.
            </p>
            <p className="text-center text-[11px] text-on-surface-variant/60 leading-relaxed max-w-md mx-auto mt-2 text-balance">
              Spotted something we missed? Email{' '}
              <a href="mailto:support@courtreportcard.com" className="text-primary/80 hover:underline">
                support@courtreportcard.com
              </a>
              .
            </p>
          </div>
        </section>

        {/* Built for section */}
        <section className="py-14 sm:py-20 px-6 sm:px-8 bg-background">
          <div ref={setRevealRef(10)} className="landing-reveal max-w-5xl mx-auto text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-3 inline-block">
              Built for legal professionals
            </span>
            <h2 className="font-headline font-bold text-2xl sm:text-3xl text-on-surface mb-4 tracking-tight">
              Designed for stenographers, digital reporters, and voice writers.
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl mx-auto">
              Tuned to the errors that actually show up in legal transcripts: spelling, punctuation, homophone substitutions, legal-term mix-ups, and other context-sensitive mistakes. Trusted by court reporters reviewing depositions, hearings, and trials.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
