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
    explanation: 'Misspelling of "incident." Correction accepted by user and applied.',
  },
  ignored: {
    label: 'Ignored',
    labelClass: 'text-on-surface-variant',
    original: '"color"',
    suggestion: 'left as-is',
    suggestionClass: 'text-on-surface',
    strikeOriginal: false,
    explanation: 'British spelling suggested. American "color" is correct here. Ignored by user.',
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
        <section className="relative pt-10 sm:pt-14 pb-16 sm:pb-32 overflow-hidden px-8 sm:px-12 max-w-[1440px] mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 z-10 page-rise">
              <h1 className="font-headline font-extrabold text-5xl sm:text-6xl lg:text-7xl text-on-surface leading-[1.1] mb-7 sm:mb-8 tracking-tight">
                Your Second Set
                <br />
                of Eyes on
                <br />
                <span className="text-primary italic">Every Transcript</span>
              </h1>
              <p className="text-base sm:text-xl text-on-surface-variant mb-9 sm:mb-10 max-w-xl leading-relaxed">
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
                  className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-7 sm:px-8 py-3 rounded-lg font-bold text-base sm:text-lg editorial-shadow transition-all hover:translate-y-[-2px] hover:scale-[1.02] active:scale-95"
                >
                  Get started
                </button>
                <Link
                  to="/ourplatform"
                  data-track-id="landing_hero_platform_demo"
                  className="group inline-flex items-center gap-1 text-primary font-bold text-base sm:text-lg no-underline hover:no-underline transition-colors"
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

            {/* Visual Representation of Transcript */}
            <div className="lg:col-span-6 relative page-rise-delay">
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
                    <div className="relative w-full h-[5.75rem] sm:h-[6.25rem] rounded-lg bg-surface-container-low/80 border border-outline-variant/15 overflow-hidden">
                      {tip ? (
                        <div className="absolute inset-0 flex flex-col justify-center px-3 py-2.5 sm:px-4 sm:py-3">
                          <div className={`relative mb-0.5 ${tip.showActions ? 'pr-[7.5rem]' : ''}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${tip.labelClass}`}>
                              {tip.label}
                            </span>
                            {tip.showActions && (
                              <div className="absolute -top-0.5 right-0 flex items-center gap-1.5" aria-hidden="true">
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
                          <p className="mt-1.5 text-[10px] sm:text-[11px] text-on-surface-variant leading-relaxed line-clamp-2">
                            {tip.explanation}
                          </p>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col justify-center px-3 py-2.5 sm:px-4 sm:py-3">
                          <div className="grid grid-cols-5 gap-1 mb-3">
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
          </div>
        </section>

        {/* Testimonials — scrolling marquee */}
        <section className="py-14 sm:py-20 bg-primary/5 overflow-hidden">
          <div ref={setRevealRef(0)} className="landing-reveal text-center mb-10 sm:mb-12 px-6">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Feedback from real reporters</span>
          </div>
          {(() => {
            const reviews = [
              { quote: 'This will save me SO much time editing.', name: 'Christina C.', initial: 'CC' },
              { quote: 'Caught all the errors that were missed!', name: 'Zoe Z.', initial: 'ZZ' },
              { quote: 'I am definitely interested.', name: 'Fista S.', initial: 'FS' },
              { quote: 'I love the system.', name: 'James T.', initial: 'JT' },
            ]
            const Card = ({ quote, name, initial }) => (
              <div className="bg-surface-container-lowest rounded-2xl editorial-shadow flex flex-col w-80 shrink-0 transition-transform hover:translate-y-[-2px]">
                <div className="p-7 flex flex-col flex-1">
                  <p className="text-on-surface text-base leading-relaxed flex-1">{quote}</p>
                  <div className="mt-7 pt-5 border-t border-outline-variant/20 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-on-secondary-container tracking-tight">{initial}</span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">{name}</span>
                  </div>
                </div>
              </div>
            )
            return (
              <div ref={setRevealRef(1)} className="landing-reveal">
                <div className="flex animate-marquee gap-6 w-max">
                  {[...reviews, ...reviews].map((r, i) => <Card key={i} {...r} />)}
                </div>
              </div>
            )
          })()}
        </section>

        {/* Founder Story Section */}
        <section className="py-14 sm:py-20 px-6 sm:px-8">
          <div ref={setRevealRef(2)} className="landing-reveal max-w-4xl mx-auto">
            <div className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-8 sm:p-12">
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
                <div className="shrink-0 w-16 sm:w-20 flex justify-center sm:justify-start">
                  <span className="font-headline font-black text-7xl sm:text-8xl text-primary/15 leading-none select-none">&ldquo;</span>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3 block">Why We Built This</span>
                  <p className="text-lg sm:text-xl text-on-surface leading-relaxed mb-4">
                    My wife is an experienced stenographer. I watched her spend as many hours proofreading a transcript as she did recording it — alone, under deadline, with no second set of eyes available. That's the problem Court Reportcard was built to solve.
                  </p>
                  <p className="text-sm font-bold text-on-surface-variant mb-5">— Brandon, Founder</p>
                  <Link to="/aboutus" className="group text-primary font-bold text-sm inline-flex items-center gap-1">
                    <span className="group-hover:underline">Read our full story</span>
                    <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="bg-surface-container-low py-16 sm:py-24 px-6 sm:px-8">
          <div className="max-w-[1440px] mx-auto">
            <div ref={setRevealRef(3)} className="landing-reveal mb-10 sm:mb-16 text-center">
              <h2 className="font-headline font-bold text-3xl sm:text-4xl text-on-surface mb-4">How Court Reportcard Works</h2>
              <div className="w-16 h-1 bg-primary mx-auto"></div>
            </div>
            <div className="grid md:grid-cols-3 gap-6 sm:gap-12">
              {/* Step 1 */}
              <div ref={setRevealRef(4)} className="landing-reveal landing-reveal-delay-1 group relative bg-surface-container-lowest p-8 rounded-xl editorial-shadow transition-all hover:translate-y-[-4px]">
                <div className="w-14 h-14 bg-primary-fixed rounded-lg flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
                  <span className="material-symbols-outlined text-primary group-hover:text-on-primary">cloud_upload</span>
                </div>
                <h3 className="font-headline font-bold text-xl mb-3">Upload Transcript</h3>
                <p className="text-on-surface-variant leading-relaxed">Drop in your .txt or .rtf transcript from your steno software. Give the case a name and we'll start the review.</p>
                <div className="absolute top-8 right-8 text-6xl font-black text-surface-container-high/50 -z-0 select-none">01</div>
              </div>
              {/* Step 2 */}
              <div ref={setRevealRef(5)} className="landing-reveal landing-reveal-delay-2 group relative bg-surface-container-lowest p-8 rounded-xl editorial-shadow transition-all hover:translate-y-[-4px]">
                <div className="w-14 h-14 bg-tertiary-fixed rounded-lg flex items-center justify-center mb-6 group-hover:bg-tertiary-fixed-dim transition-colors">
                  <span className="material-symbols-outlined text-on-tertiary-fixed">analytics</span>
                </div>
                <h3 className="font-headline font-bold text-xl mb-3">Review Suggestions</h3>
                <p className="text-on-surface-variant leading-relaxed">We flag likely spelling issues, homophones, punctuation mistakes, and other context-sensitive errors. You review each one and decide what to keep.</p>
                <div className="absolute top-8 right-8 text-6xl font-black text-surface-container-high/50 -z-0 select-none">02</div>
              </div>
              {/* Step 3 */}
              <div ref={setRevealRef(6)} className="landing-reveal landing-reveal-delay-3 group relative bg-surface-container-lowest p-8 rounded-xl editorial-shadow transition-all hover:translate-y-[-4px]">
                <div className="w-14 h-14 bg-secondary-container rounded-lg flex items-center justify-center mb-6 group-hover:bg-secondary transition-colors">
                  <span className="material-symbols-outlined text-on-secondary-container group-hover:text-on-secondary">download_done</span>
                </div>
                <h3 className="font-headline font-bold text-xl mb-3">Export Transcript</h3>
                <p className="text-on-surface-variant leading-relaxed">You stay in control of every change. Accept what looks right, ignore the rest, then download your transcript when you're done reviewing.</p>
                <div className="absolute top-8 right-8 text-6xl font-black text-surface-container-high/50 -z-0 select-none">03</div>
              </div>
            </div>
          </div>
        </section>

        {/* Advanced Diagnostics Section */}
        <section className="py-16 sm:py-24 px-6 sm:px-8 max-w-[1440px] mx-auto">
          <div ref={setRevealRef(7)} className="landing-reveal bg-primary rounded-2xl overflow-hidden flex flex-col lg:flex-row">
            <div className="lg:w-1/2 p-8 sm:p-12 lg:p-20 flex flex-col justify-center">
              <span className="text-primary-fixed-dim uppercase font-bold tracking-[0.2em] text-xs mb-4">Advanced Diagnostics</span>
              <h2 className="text-on-primary font-headline font-bold text-3xl sm:text-4xl mb-6">Beyond Spellcheck.</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="mt-1"><span className="material-symbols-outlined text-tertiary-fixed-dim">check_circle</span></div>
                  <div>
                    <h4 className="text-on-primary font-bold">Lexical Consistency</h4>
                    <p className="text-on-primary-container text-sm">Ensures technical terms and names are spelled identically throughout 500+ pages.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="mt-1"><span className="material-symbols-outlined text-tertiary-fixed-dim">check_circle</span></div>
                  <div>
                    <h4 className="text-on-primary font-bold">Context Tracking</h4>
                    <p className="text-on-primary-container text-sm">Automatically catch contradictions across dates, document references, and witness statements spanning the entire transcript.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="mt-1"><span className="material-symbols-outlined text-tertiary-fixed-dim">check_circle</span></div>
                  <div>
                    <h4 className="text-on-primary font-bold">Confidence Scoring</h4>
                    <p className="text-on-primary-container text-sm">Every flagged item gets a confidence score so you know exactly where to focus your review.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="mt-1"><span className="material-symbols-outlined text-tertiary-fixed-dim">check_circle</span></div>
                  <div>
                    <h4 className="text-on-primary font-bold">Same-Day Ready</h4>
                    <p className="text-on-primary-container text-sm">Fast enough to check a same-day rough draft before it ships, something a human usually has to rush for.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 bg-surface-container-high relative min-h-[400px]">
              <div className="absolute inset-10 bg-surface rounded-xl editorial-shadow p-6 flex flex-col gap-4">
                <div className="flex gap-2">
                  <div className="h-2 w-full bg-surface-container rounded"></div>
                  <div className="h-2 w-24 bg-primary-fixed rounded"></div>
                </div>
                <div className="h-4 w-full bg-surface-container-low rounded"></div>
                <div className="h-4 w-3/4 bg-surface-container-low rounded"></div>
                <div className="p-4 bg-tertiary-fixed/20 border-l-4 border-tertiary-fixed rounded">
                  <p className="text-xs italic text-on-surface-variant">"Date validation error: The witness stated the event occurred on November 31st, but November only has 30 days."</p>
                </div>
                <div className="h-4 w-full bg-surface-container-low rounded"></div>
              </div>
            </div>
          </div>
        </section>
        {/* Built for section */}
        <section className="py-14 sm:py-20 px-6 sm:px-8 bg-surface-container-low">
          <div ref={setRevealRef(8)} className="landing-reveal max-w-3xl mx-auto text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-4 inline-block">Built for legal professionals</span>
            <h2 className="font-headline font-bold text-xl sm:text-2xl text-on-surface mb-5 tracking-tight">
              Designed for stenographers, digital reporters, and voice writers.
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed max-w-2xl mx-auto">
              Tuned to the errors that actually show up in legal transcripts: spelling, punctuation, homophone substitutions, legal-term mix-ups, and other context-sensitive mistakes. Trusted by court reporters reviewing depositions, hearings, and trials.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
