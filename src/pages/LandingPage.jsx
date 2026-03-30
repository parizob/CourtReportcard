import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="bg-background text-on-surface font-body selection:bg-tertiary-fixed selection:text-on-tertiary-fixed">
      {/* TopNavBar */}
      <nav className="bg-[#f8f9fa] top-0 z-50">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-black text-primary font-headline tracking-tight hover:opacity-80 transition-opacity">Court Reportcard</Link>
            <div className="hidden md:flex gap-6 items-center">
              <Link className="text-primary border-b-2 border-primary pb-1 font-headline font-bold tracking-tight" to="/">Home</Link>
              <Link className="text-on-surface-variant hover:text-primary font-headline font-bold tracking-tight transition-colors duration-200" to="/ourplatform">Our Platform</Link>
              <a className="text-on-surface-variant hover:text-primary font-headline font-bold tracking-tight transition-colors duration-200" href="#">About Us</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center bg-surface-container-lowest px-4 py-2 rounded-md">
              <span className="material-symbols-outlined text-outline text-sm">search</span>
              <input className="bg-transparent border-none outline-none focus:ring-0 text-sm w-48 ml-2" placeholder="Search files..." type="text" />
            </div>
            <Link
              to="/ourplatform"
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2 rounded-md font-bold transition-all hover:scale-[1.02] active:scale-95"
            >
              New Upload
            </Link>
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-colors">notifications</span>
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-colors">account_circle</span>
          </div>
        </div>
        <div className="bg-surface-container-low h-[1px] w-full"></div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden px-8 max-w-[1440px] mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 z-10">
              <h1 className="font-headline font-extrabold text-7xl text-on-surface leading-[1.1] mb-6 tracking-tight">
                Proofread in <span className="text-primary italic">Seconds</span>.
              </h1>
              <p className="text-xl text-on-surface-variant mb-8 max-w-xl leading-relaxed">
                Lexicon Precision applies clinical accuracy to court transcripts. Detect conflicts, fix formatting, and ensure every word meets the highest judicial standard.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/ourplatform"
                  className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-8 py-4 rounded-md font-bold text-lg editorial-shadow transition-all hover:translate-y-[-2px]"
                >
                  Try Now
                </Link>
                <button className="text-primary px-8 py-4 font-bold text-lg hover:underline decoration-tertiary-fixed decoration-2 underline-offset-4">
                  Watch Demo
                </button>
              </div>
              <div className="mt-12 flex items-center gap-4">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-secondary-container"></div>
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container"></div>
                  <div className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-high"></div>
                </div>
                <p className="text-sm text-on-surface-variant">Trusted by <span className="font-bold text-on-surface">500+</span> Court Reporters</p>
              </div>
            </div>

            {/* Visual Representation of Transcript */}
            <div className="lg:col-span-6 relative">
              <div className="bg-surface-container-lowest editorial-shadow rounded-xl p-8 border border-outline-variant/15 relative overflow-hidden">
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
                  {/* Float Overlay */}
                  <div className="absolute bottom-6 right-6 glass-panel p-4 rounded-xl editorial-shadow border border-white/50 flex gap-4 items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">Confidence Score</span>
                      <span className="text-xl font-headline font-black text-primary">98.4%</span>
                    </div>
                    <div className="h-8 w-[1px] bg-outline-variant/30"></div>
                    <button className="bg-primary text-on-primary p-2 rounded-lg">
                      <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="bg-surface-container-low py-24 px-8">
          <div className="max-w-[1440px] mx-auto">
            <div className="mb-16 text-center">
              <h2 className="font-headline font-bold text-4xl text-on-surface mb-4">Precision Workflow</h2>
              <div className="w-16 h-1 bg-primary mx-auto"></div>
            </div>
            <div className="grid md:grid-cols-3 gap-12">
              {/* Step 1 */}
              <div className="group relative bg-surface-container-lowest p-8 rounded-xl transition-all hover:translate-y-[-4px]">
                <div className="w-14 h-14 bg-primary-fixed rounded-lg flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
                  <span className="material-symbols-outlined text-primary group-hover:text-on-primary">cloud_upload</span>
                </div>
                <h3 className="font-headline font-bold text-xl mb-3">Upload Transcript</h3>
                <p className="text-on-surface-variant leading-relaxed">Securely upload your RAW files. We support all major stenography software exports and standard text formats.</p>
                <div className="absolute top-8 right-8 text-6xl font-black text-surface-container-high/50 -z-0 select-none">01</div>
              </div>
              {/* Step 2 */}
              <div className="group relative bg-surface-container-lowest p-8 rounded-xl transition-all hover:translate-y-[-4px]">
                <div className="w-14 h-14 bg-tertiary-fixed rounded-lg flex items-center justify-center mb-6 group-hover:bg-tertiary-fixed-dim transition-colors">
                  <span className="material-symbols-outlined text-on-tertiary-fixed">analytics</span>
                </div>
                <h3 className="font-headline font-bold text-xl mb-3">AI Analysis</h3>
                <p className="text-on-surface-variant leading-relaxed">Our legal-trained LLM cross-references audio, checks legal dictionaries, and highlights procedural inconsistencies.</p>
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
        <section className="py-24 px-8 max-w-[1440px] mx-auto">
          <div className="bg-primary rounded-2xl overflow-hidden flex flex-col lg:flex-row">
            <div className="lg:w-1/2 p-12 lg:p-20 flex flex-col justify-center">
              <span className="text-primary-fixed-dim uppercase font-bold tracking-[0.2em] text-xs mb-4">Advanced Diagnostics</span>
              <h2 className="text-on-primary font-headline font-bold text-4xl mb-6">Beyond Spellcheck.</h2>
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
                    <h4 className="text-on-primary font-bold">Procedural Flags</h4>
                    <p className="text-on-primary-container text-sm">Automated detection of missing 'Sworn' markers or incomplete witness transitions.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="mt-1"><span className="material-symbols-outlined text-tertiary-fixed-dim">check_circle</span></div>
                  <div>
                    <h4 className="text-on-primary font-bold">Audio Syncing</h4>
                    <p className="text-on-primary-container text-sm">Jump directly to the audio recording for any low-confidence transcription segment.</p>
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
                  <p className="text-xs italic text-on-surface-variant">"The system flagged a contradiction between the witness's earlier statement on page 14 and their current response."</p>
                </div>
                <div className="h-4 w-full bg-surface-container-low rounded"></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-outline-variant/15">
        <div className="bg-[#f8f9fa]">
          <div className="flex flex-col md:flex-row justify-between items-center px-12 py-8 w-full max-w-[1440px] mx-auto">
            <div className="mb-6 md:mb-0">
              <Link to="/" className="font-headline font-bold text-primary text-xl hover:opacity-80 transition-opacity">Court Reportcard</Link>
              <p className="text-on-surface-variant text-[10px] mt-2 font-body uppercase tracking-widest">© 2024 Court Reportcard. All Rights Reserved. Confidential Legal Tool.</p>
            </div>
            <div className="flex gap-8">
              <a className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100" href="#">Terms of Service</a>
              <a className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100" href="#">Privacy Policy</a>
              <a className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100" href="#">Contact Support</a>
              <a className="text-on-surface-variant font-body text-xs uppercase tracking-widest hover:text-primary-container transition-opacity opacity-80 hover:opacity-100" href="#">Security Audit</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
