import { Link } from 'react-router-dom'

const stats = [
  { value: '99.8%', label: 'Transcription Accuracy' },
  { value: '12,400+', label: 'Legal Terms in Dictionary' },
  { value: '94%', label: 'Faster Than Manual Review' },
  { value: '0', label: 'Court Rejections to Date' },
]

const features = [
  {
    icon: 'shield_lock',
    title: 'End-to-End Encrypted',
    body: 'Every file is encrypted in transit and at rest. Only you can access your case files — not us, not anyone else.',
  },
  {
    icon: 'gavel',
    title: 'Court-Ready Formatting',
    body: 'Transcripts auto-format to District and Federal Court standards, eliminating submission rejections entirely.',
  },
  {
    icon: 'bolt',
    title: 'Instant AI Processing',
    body: 'Pair your RTF/CRE transcript with case audio and receive a fully flagged, cross-referenced review in minutes — not days.',
  },
]

const demoFiles = [
  {
    icon: 'article',
    type: 'Transcript + Audio',
    name: 'State_vs_Henderson_Motion_Hearing',
    meta: 'RTF • 48m audio • 142MB total',
    status: 'analyzed',
    statusColor: 'bg-tertiary-fixed-dim',
    statusLabel: 'Analyzed',
  },
  {
    icon: 'audio_file',
    type: 'Audio only',
    name: 'Depositions_Miller_Case_304',
    meta: 'WAV • 1h 22m • 480MB',
    status: 'processing',
    progress: 65,
    statusLabel: 'Processing',
  },
  {
    icon: 'task_alt',
    type: 'Transcript + Audio',
    name: 'Arraignment_Circuit_Court_4A',
    meta: 'CRE • 12m audio • 24MB total',
    status: 'ready',
    statusColor: 'bg-green-500',
    statusLabel: 'Ready',
  },
]

export default function OurPlatform() {
  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      {/* Page Header */}
      <header className="max-w-6xl mx-auto mb-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary mb-2 block">Step 1 of 3</span>
            <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">Upload Your Files</h1>
            <p className="font-body text-on-surface-variant mt-2 max-w-lg">
              Upload your transcript (.RTF) and the matching case audio. Our AI cross-references both to catch every error — even the ones that pass a human read.
            </p>
          </div>
          <Link
            to="/ourplatform/editor"
            className="shrink-0 flex items-center gap-2 text-sm font-bold text-primary hover:underline decoration-tertiary-fixed-dim decoration-2 underline-offset-4"
          >
            Skip to Editor Demo <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="max-w-6xl mx-auto mb-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-container-lowest rounded-xl p-5 editorial-shadow text-center">
              <p className="text-3xl font-headline font-black text-primary">{s.value}</p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Upload Drop Zones — Transcript + Audio side by side */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Transcript Upload */}
            <div className="relative group bg-surface-container-lowest border-2 border-dashed border-outline-variant/30 rounded-2xl h-[260px] flex flex-col items-center justify-center transition-all hover:border-secondary/60 editorial-shadow cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary-container/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"></div>
              <div className="absolute top-4 left-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">Transcript</span>
              </div>
              <div className="w-14 h-14 bg-secondary-container/40 rounded-full flex items-center justify-center mb-4 group-hover:bg-secondary-container/70 transition-colors">
                <span className="material-symbols-outlined text-3xl text-secondary">article</span>
              </div>
              <h3 className="font-headline text-base font-bold text-on-surface mb-1 text-center px-4">Drop Your Transcript</h3>
              <p className="text-on-surface-variant font-body text-xs mb-4 text-center px-6">
                RTF format. Exported directly from Case CATalyst, Eclipse, or any steno software.
              </p>
              <button className="px-5 py-2 bg-secondary text-on-secondary text-xs font-bold rounded-md transition-all active:scale-95 hover:opacity-90">
                Browse Files
              </button>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <span className="text-[10px] uppercase tracking-widest font-bold text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">lock</span> Encrypted upload
                </span>
              </div>
            </div>

            {/* Audio Upload */}
            <div className="relative group bg-surface-container-lowest border-2 border-dashed border-outline-variant/30 rounded-2xl h-[260px] flex flex-col items-center justify-center transition-all hover:border-primary/50 editorial-shadow cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary-container/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"></div>
              <div className="absolute top-4 left-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">Audio</span>
              </div>
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-3xl text-primary">mic</span>
              </div>
              <h3 className="font-headline text-base font-bold text-on-surface mb-1 text-center px-4">Drop Your Case Audio</h3>
              <p className="text-on-surface-variant font-body text-xs mb-4 text-center px-6">
                WAV, MP3, or DSS — up to 2GB. Our AI syncs each word to the exact moment in the recording.
              </p>
              <Link
                to="/ourplatform/editor"
                className="px-5 py-2 bg-gradient-to-r from-primary to-primary-container text-white text-xs font-bold rounded-md transition-all active:scale-95 hover:translate-y-[-1px] shadow-md shadow-primary/20"
              >
                Try the Demo →
              </Link>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <span className="text-[10px] uppercase tracking-widest font-bold text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">verified</span> HIPAA Compliant
                </span>
              </div>
            </div>
          </div>

          {/* Why it's better — inline callout */}
          <div className="p-4 bg-tertiary-fixed/20 border-l-4 border-tertiary-fixed rounded-lg flex items-start gap-3">
            <span className="material-symbols-outlined text-on-tertiary-container mt-0.5 shrink-0">tips_and_updates</span>
            <p className="text-sm text-on-surface">
              <span className="font-bold">Why upload both?</span> When your RTF/CRE transcript is paired with the audio recording, our AI can detect word-level mismatches — catching errors that neither document alone would reveal. Accuracy jumps from 94% to 99.8%.
            </p>
          </div>
        </section>

        {/* Side Panel: Why CR */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-surface-container-low p-5 rounded-2xl flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-secondary-container">{f.icon}</span>
              </div>
              <div>
                <h4 className="font-headline font-bold text-sm text-on-surface mb-1">{f.title}</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </aside>

        {/* Demo Files Section */}
        <section className="lg:col-span-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-headline text-xl font-bold text-on-surface">Live Case Queue</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">This is what your dashboard looks like once files are uploaded.</p>
            </div>
            <div className="relative">
              <input className="bg-surface-container-lowest text-sm font-body px-10 py-2 border-none rounded-md focus:ring-2 ring-primary/20 w-56 editorial-shadow outline-none" placeholder="Search cases..." type="text" />
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">search</span>
            </div>
          </div>

          <div className="space-y-3">
            {demoFiles.map((file) => (
              <div key={file.name} className="bg-surface-container-lowest p-5 rounded-xl editorial-shadow flex items-center transition-all hover:bg-surface-container-low/60 group">
                <div className="w-12 h-12 bg-primary/5 rounded flex items-center justify-center mr-5 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary">{file.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h5 className="font-body font-bold text-on-surface text-sm truncate">{file.name}</h5>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-on-secondary-container bg-secondary-container px-2 py-0.5 rounded-full">{file.type}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{file.meta}</p>
                </div>
                <div className="flex items-center gap-8 ml-4">
                  {file.status === 'processing' ? (
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${file.progress}%` }}></div>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">{file.statusLabel}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${file.statusColor}`}></span>
                      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{file.statusLabel}</span>
                    </div>
                  )}
                  <div className={`flex gap-1 ${file.status === 'processing' ? 'opacity-30 pointer-events-none' : ''}`}>
                    <Link to="/ourplatform/editor" className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container-low" title="Open in Editor">
                      <span className="material-symbols-outlined">edit_note</span>
                    </Link>
                    <Link to="/ourplatform/export" className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container-low" title="Export">
                      <span className="material-symbols-outlined">download</span>
                    </Link>
                    <button className="p-2 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-error-container/20" title="Delete">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 bg-primary rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-headline text-2xl font-bold text-on-primary mb-1">See What Happens Next</h3>
              <p className="text-on-primary-container text-sm">Your transcript and audio are paired and processed — now walk through the AI-powered editor that catches what humans miss.</p>
            </div>
            <Link
              to="/ourplatform/editor"
              className="shrink-0 px-8 py-3 bg-tertiary-fixed-dim text-on-tertiary-fixed font-bold rounded-md hover:bg-tertiary-fixed transition-colors whitespace-nowrap"
            >
              Explore the Editor →
            </Link>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-16 border-t border-outline-variant/15 flex flex-col md:flex-row justify-between items-center py-8">
        <p className="font-body text-xs uppercase tracking-widest text-on-surface-variant mb-4 md:mb-0">© 2024 Court Reportcard. All Rights Reserved.</p>
        <div className="flex gap-6">
          <a className="font-body text-xs uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors" href="#">Terms</a>
          <a className="font-body text-xs uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy</a>
          <a className="font-body text-xs uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors" href="#">Support</a>
        </div>
      </footer>
    </main>
  )
}
