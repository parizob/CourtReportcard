import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Dashboard() {
  const { displayName } = useAuth()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const stats = [
    { value: '0', label: 'Active Cases', icon: 'folder_open' },
    { value: '0', label: 'Completed Reviews', icon: 'check_circle' },
    { value: '—', label: 'Avg. Accuracy', icon: 'speed' },
    { value: '0', label: 'Court Rejections', icon: 'gavel' },
  ]

  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      <div className="max-w-6xl mx-auto">

        {/* Greeting */}
        <header className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">{today}</p>
              <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">
                Welcome, {displayName}
              </h1>
              <p className="text-on-surface-variant mt-2">Upload your first case to get started with AI-powered transcript review.</p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/dashboard/upload"
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow"
              >
                <span className="material-symbols-outlined text-base">cloud_upload</span>
                Upload New Case
              </Link>
              <Link
                to="/dashboard/export"
                className="flex items-center gap-2 border border-outline-variant/40 text-on-surface px-5 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Exports
              </Link>
            </div>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-container-lowest rounded-xl p-5 editorial-shadow flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-secondary-container">{s.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-headline font-black text-primary leading-none">{s.value}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mt-1">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Case Queue — empty state */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Case Queue</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Your uploaded transcripts and audio files.</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-primary text-4xl">inbox</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2">No cases yet</h3>
            <p className="text-sm text-on-surface-variant max-w-md mb-8 leading-relaxed">
              Your case queue is empty. Upload a transcript and audio file to begin your first AI-powered review. Court Reportcard will analyze your files and surface any errors automatically.
            </p>
            <Link
              to="/dashboard/upload"
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-8 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow"
            >
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              Upload Your First Case
            </Link>
          </div>
        </section>

        {/* Getting started tips */}
        <section className="mt-10">
          <h3 className="font-headline text-lg font-bold text-on-surface mb-4">Getting Started</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { step: '1', icon: 'cloud_upload', title: 'Upload', desc: 'Drag and drop your transcript (RTF/CRE) and audio recording (WAV/MP3/DSS).' },
              { step: '2', icon: 'edit_note', title: 'Review', desc: 'Our AI highlights errors, low-confidence words, and suggests corrections in real time.' },
              { step: '3', icon: 'cloud_download', title: 'Export', desc: 'Download court-ready transcripts in PDF, Word, or Case CATalyst format.' },
            ].map((item) => (
              <div key={item.step} className="bg-surface-container-lowest rounded-xl p-6 editorial-shadow flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">{item.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface mb-1">Step {item.step}: {item.title}</p>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}
