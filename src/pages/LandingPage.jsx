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
        <section className="relative pt-6 sm:pt-12 pb-16 sm:pb-32 overflow-hidden px-6 sm:px-8 max-w-[1440px] mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 z-10">
              <h1 className="font-headline font-extrabold text-5xl sm:text-6xl lg:text-7xl text-on-surface leading-[1.1] mb-6 tracking-tight">
                Precision Proofreading for <span className="text-primary italic">Court Reporters</span>
              </h1>
              <p className="text-base sm:text-xl text-on-surface-variant mb-8 max-w-xl leading-relaxed">
                Your second set of eyes on every transcript. Court Reportcard catches steno errors, homophone substitutions, missing words, and punctuation mistakes — before a single page leaves your desk.
              </p>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <button
                  onClick={() => openModal('signup')}
                  className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 sm:px-8 py-3 sm:py-4 rounded-md font-bold text-base sm:text-lg editorial-shadow transition-all hover:translate-y-[-2px]"
                >
                  Try Now
                </button>
                <Link to="/ourplatform" className="text-primary px-6 sm:px-8 py-3 sm:py-4 font-bold text-base sm:text-lg hover:underline decoration-tertiary-fixed decoration-2 underline-offset-4">
                  Platform Demo
                </Link>
              </div>
              <div className="mt-10 sm:mt-12 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  Early Access — Now Open
                </span>
                <span className="text-xs text-on-surface-variant">No credit card required</span>
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
                      <p>Could you please state your name for the record and tell the court where you were on the night of the <span className="bg-tertiary-fixed/30 border-b-2 border-tertiary-fixed cursor-help">incident</span>?</p>
                    </div>
                    <div className="pl-8 border-l-2 border-surface-container-low">
                      <div className="inline-block px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-xs font-bold mb-2">A. THE WITNESS</div>
                      <p>My name is Julian Vane. I was at the <span className="relative inline-block">
                        <span className="text-error border border-error rounded-sm px-1 italic">residance</span>
                        <span className="absolute -top-5 left-0 bg-error text-white text-[10px] px-1 rounded">SP?</span>
                      </span> on Oak Street. I arrived at approximately 10:15 PM according to my watch.</p>
                    </div>
                    <div>
                      <div className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold mb-2">Q. MR. HARPER</div>
                      <p>And did you see the vehicle? We have a <span className="border-b-2 border-dotted border-primary italic">conflicting report</span> about the color.</p>
                    </div>
                  </div>
                  {/* Status Bar */}
                  <div className="mt-6 pt-4 border-t border-outline-variant/15 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">AI Review Complete</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">Confidence Score</span>
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
                    <p className="text-on-primary-container text-sm">Every page gets a confidence score so you know exactly where to focus your review.</p>
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
            <h2 className="font-headline font-bold text-xl sm:text-2xl text-on-surface mb-5 tracking-tight whitespace-nowrap">
              Designed for stenographers, scopists, and voice writers.
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed max-w-2xl mx-auto">
              Upload a .txt or .rtf transcript from any CAT software and receive a full annotation report — covering steno errors, homophone substitutions, missing words, incorrect legal terminology, and punctuation mistakes — in under five minutes. Trusted by court reporters reviewing depositions, hearings, and trials.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
