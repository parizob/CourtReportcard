import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import SiteFooter from '../components/SiteFooter'

export default function LandingPage() {
  const { openModal } = useAuth()
  return (
    <div className="bg-background text-on-surface font-body selection:bg-tertiary-fixed selection:text-on-tertiary-fixed">
      <Helmet>
        <title>Court Reportcard | Precision Proofreading for Court Reporters</title>
        <meta name="description" content="Precision transcript proofreading for court reporters and scopists. Catches steno errors, homophone substitutions, and punctuation mistakes before filing. Upload .txt or .rtf — results in minutes." />
        <link rel="canonical" href="https://www.courtreportcard.com/" />
      </Helmet>

      <main>
        {/* Hero Section */}
        <section className="relative pt-8 sm:pt-12 pb-16 sm:pb-32 overflow-hidden px-6 sm:px-8 max-w-[1440px] mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 z-10">
              <h1 className="font-headline font-extrabold text-5xl sm:text-6xl lg:text-7xl text-on-surface leading-[1.1] mb-6 tracking-tight">
                Precision Proofreading for <span className="text-primary italic">Court Reporters</span>
              </h1>
              <p className="text-base sm:text-xl text-on-surface-variant mb-8 max-w-xl leading-relaxed">
                Your second set of eyes on every transcript. Catch steno errors, homophone substitutions, missing words, and punctuation mistakes before a single page leaves your desk.
              </p>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <button
                  onClick={() => openModal('signup')}
                  data-track-id="landing_hero_try_now"
                  className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 sm:px-8 py-3 sm:py-4 rounded-md font-bold text-base sm:text-lg editorial-shadow transition-all hover:translate-y-[-2px]"
                >
                  Try Now
                </button>
                <Link to="/ourplatform" data-track-id="landing_hero_platform_demo" className="border-2 border-primary/30 text-primary px-6 sm:px-8 py-3 sm:py-4 rounded-md font-bold text-base sm:text-lg transition-all hover:bg-primary/10 hover:border-primary/10">
                  Platform Demo
                </Link>
              </div>
            </div>

            {/* Visual Representation of Transcript */}
            <div className="lg:col-span-6 relative">
              <div className="bg-surface-container-lowest editorial-shadow rounded-xl p-5 sm:p-8 border border-outline-variant/15 relative overflow-hidden">
                {/* Editor Mockup */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-surface-container pb-4">
                    <div className="flex gap-2">
                      <span className="w-3 h-3 rounded-full bg-error/20"></span>
                      <span className="w-3 h-3 rounded-full bg-tertiary-fixed-dim"></span>
                      <span className="w-3 h-3 rounded-full bg-primary-fixed"></span>
                    </div>
                    <span className="font-label text-xs uppercase tracking-widest text-outline">Case #882-TX</span>
                  </div>
                  {/* Transcript Content */}
                  <div className="space-y-8 font-body text-on-surface text-sm leading-relaxed">
                    <div>
                      <div className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold mb-2">Q. MR. HARPER</div>
                      <p>Could you please state your name for the record and tell the Court where you were on the night of the <span className="relative inline-block group cursor-pointer">
                        <span className="text-green-600 font-semibold">incident</span>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                          <span className="block text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Accepted Fix</span>
                          <span className="block text-[11px] text-on-surface">
                            <span className="line-through text-on-surface-variant">incidant</span>
                            {' → '}
                            <span className="font-semibold text-green-600">incident</span>
                          </span>
                          <span className="block text-[9px] text-on-surface-variant mt-1">Confidence: 97%</span>
                        </span>
                      </span>?</p>
                    </div>
                    <div className="pl-8 border-l-2 border-surface-container-low">
                      <div className="inline-block px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-xs font-bold mb-2">A. THE WITNESS</div>
                      <p>My name is Julian Vane. I was at the <span className="relative inline-block group cursor-pointer">
                        <span className="text-error border border-error rounded-sm px-1 italic">residance</span>
                        <span className="hidden sm:block absolute -top-5 left-0 bg-error text-white text-[10px] px-1 rounded">SP?</span>
                        {/* Hover tooltip */}
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                          <span className="block text-[10px] font-bold text-error uppercase tracking-wider mb-1">Spelling Error</span>
                          <span className="block text-[11px] text-on-surface">
                            <span className="line-through text-on-surface-variant">residance</span>
                            {' → '}
                            <span className="font-semibold text-green-600">residence</span>
                          </span>
                          <span className="block text-[9px] text-on-surface-variant mt-1">Confidence: 99%</span>
                        </span>
                      </span> on Oak Street. I arrived at approximately 10:15 p.m., according to my watch.</p>
                    </div>
                    <div>
                      <div className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold mb-2">Q. MR. HARPER</div>
                      <p>And did you see the vehicle? We have a <span className="border-b-2 border-dotted border-primary italic">conflicting report</span> about the color.</p>
                    </div>
                  </div>
                  {/* Status Bar */}
                  <div className="mt-6 pt-4 border-t border-outline-variant/15 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-normal">Transcript Analyzed</span>
                    </div>
                    <div className="flex items-center gap-3 ml-auto shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="hidden sm:block text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">Confidence Score</span>
                        <span className="text-lg font-headline font-black text-primary leading-none">98.4%</span>
                      </div>
                      <button className="bg-primary text-on-primary p-2 rounded-lg">
                        <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials — scrolling marquee */}
        <section className="py-14 sm:py-20 bg-primary/5 overflow-hidden">
          <div className="text-center mb-10 sm:mb-12 px-6">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Early feedback from real reporters</span>
          </div>
          {(() => {
            const reviews = [
              { quote: 'This will save me SO much time editing.', name: 'Christina C.', initial: 'CC' },
              { quote: 'Caught all the errors that were missed!', name: 'Zoe Z.', initial: 'ZZ' },
              { quote: 'I am definitely interested.', name: 'Fista S.', initial: 'FS' },
              { quote: 'I love the system.', name: 'James T.', initial: 'JT' },
            ]
            const Card = ({ quote, name, initial }) => (
              <div className="bg-surface-container-lowest rounded-2xl editorial-shadow flex flex-col w-80 shrink-0">
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
              <div className="flex animate-marquee gap-6 w-max">
                {[...reviews, ...reviews].map((r, i) => <Card key={i} {...r} />)}
              </div>
            )
          })()}
        </section>

        {/* Founder Story Section */}
        <section className="py-14 sm:py-20 px-6 sm:px-8">
          <div className="max-w-4xl mx-auto">
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
            <div className="mb-10 sm:mb-16 text-center">
              <h2 className="font-headline font-bold text-3xl sm:text-4xl text-on-surface mb-4">How Court Reportcard Works</h2>
              <div className="w-16 h-1 bg-primary mx-auto"></div>
            </div>
            <div className="grid md:grid-cols-3 gap-6 sm:gap-12">
              {/* Step 1 */}
              <div className="group relative bg-surface-container-lowest p-8 rounded-xl transition-all hover:translate-y-[-4px]">
                <div className="w-14 h-14 bg-primary-fixed rounded-lg flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
                  <span className="material-symbols-outlined text-primary group-hover:text-on-primary">cloud_upload</span>
                </div>
                <h3 className="font-headline font-bold text-xl mb-3">Upload Transcript</h3>
                <p className="text-on-surface-variant leading-relaxed">Securely upload your transcript as a .txt or .rtf file — exported from any steno software. Additional file formats coming soon.</p>
                <div className="absolute top-8 right-8 text-6xl font-black text-surface-container-high/50 -z-0 select-none">01</div>
              </div>
              {/* Step 2 */}
              <div className="group relative bg-surface-container-lowest p-8 rounded-xl transition-all hover:translate-y-[-4px]">
                <div className="w-14 h-14 bg-tertiary-fixed rounded-lg flex items-center justify-center mb-6 group-hover:bg-tertiary-fixed-dim transition-colors">
                  <span className="material-symbols-outlined text-on-tertiary-fixed">analytics</span>
                </div>
                <h3 className="font-headline font-bold text-xl mb-3">Error Detection</h3>
                <p className="text-on-surface-variant leading-relaxed">Our error detection engine checks against legal dictionaries, flags procedural inconsistencies, and scores every page by confidence.</p>
                <div className="absolute top-8 right-8 text-6xl font-black text-surface-container-high/50 -z-0 select-none">02</div>
              </div>
              {/* Step 3 */}
              <div className="group relative bg-surface-container-lowest p-8 rounded-xl transition-all hover:translate-y-[-4px]">
                <div className="w-14 h-14 bg-secondary-container rounded-lg flex items-center justify-center mb-6 group-hover:bg-secondary transition-colors">
                  <span className="material-symbols-outlined text-on-secondary-container group-hover:text-on-secondary">download_done</span>
                </div>
                <h3 className="font-headline font-bold text-xl mb-3">Export Certified</h3>
                <p className="text-on-surface-variant leading-relaxed">Review the changes and export a clean, court-ready document. High-confidence edits can be auto-applied.</p>
                <div className="absolute top-8 right-8 text-6xl font-black text-surface-container-high/50 -z-0 select-none">03</div>
              </div>
            </div>
          </div>
        </section>

        {/* Advanced Diagnostics Section */}
        <section className="py-16 sm:py-24 px-6 sm:px-8 max-w-[1440px] mx-auto">
          <div className="bg-primary rounded-2xl overflow-hidden flex flex-col lg:flex-row">
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
                    <p className="text-on-primary-container text-sm">Fast enough to check a same-day rough draft before it ships, something a scopist rarely has time for.</p>
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
          <div className="max-w-3xl mx-auto text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-4 inline-block">Built for legal professionals</span>
            <h2 className="font-headline font-bold text-xl sm:text-2xl text-on-surface mb-5 tracking-tight">
              Designed for stenographers, scopists, and voice writers.
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed max-w-2xl mx-auto">
              Tuned to the errors that actually show up in legal transcripts: steno errors, homophone substitutions, missing words, incorrect legal terminology, and punctuation mistakes. Trusted by court reporters reviewing depositions, hearings, and trials.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
