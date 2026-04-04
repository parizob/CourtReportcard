import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const stats = [
  { value: '3', label: 'Active Cases', icon: 'folder_open' },
  { value: '12', label: 'Completed Reviews', icon: 'check_circle' },
  { value: '99.4%', label: 'Avg. Accuracy', icon: 'speed' },
  { value: '0', label: 'Court Rejections', icon: 'gavel' },
]

const cases = [
  {
    icon: 'article',
    type: 'Transcript + Audio',
    name: 'State_vs_Henderson_Motion_Hearing',
    meta: 'RTF + WAV • 48 min • Uploaded today',
    status: 'analyzed',
    statusColor: 'bg-tertiary-fixed-dim',
    statusLabel: 'Analyzed',
  },
  {
    icon: 'audio_file',
    type: 'Audio Only',
    name: 'Depositions_Miller_Case_304',
    meta: 'WAV • 1h 22m • Uploaded yesterday',
    status: 'processing',
    progress: 65,
    statusLabel: 'Processing',
  },
  {
    icon: 'task_alt',
    type: 'Transcript + Audio',
    name: 'Arraignment_Circuit_Court_4A',
    meta: 'CRE + MP3 • 12 min • Uploaded Mar 28',
    status: 'ready',
    statusColor: 'bg-green-500',
    statusLabel: 'Ready',
  },
  {
    icon: 'article',
    type: 'Transcript Only',
    name: 'Grand_Jury_Proceedings_2026_Q1',
    meta: 'RTF • 94 pages • Uploaded Mar 27',
    status: 'analyzed',
    statusColor: 'bg-tertiary-fixed-dim',
    statusLabel: 'Analyzed',
  },
]

export default function Dashboard() {
  const { user } = useAuth()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      <div className="max-w-6xl mx-auto">

        {/* Greeting */}
        <header className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">{today}</p>
              <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">
                Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
              </h1>
              <p className="text-on-surface-variant mt-2">Here's an overview of your active cases and recent activity.</p>
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

        {/* Case Queue */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Case Queue</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Your uploaded transcripts and audio files.</p>
            </div>
            <div className="relative">
              <input
                className="bg-surface-container-lowest text-sm font-body px-10 py-2 border-none rounded-md focus:ring-2 ring-primary/20 w-56 editorial-shadow outline-none"
                placeholder="Search cases..."
                type="text"
              />
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">search</span>
            </div>
          </div>

          <div className="space-y-3">
            {cases.map((file) => (
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
                        <div className="h-full bg-primary rounded-full" style={{ width: `${file.progress}%` }} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">{file.statusLabel}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${file.statusColor}`} />
                      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{file.statusLabel}</span>
                    </div>
                  )}
                  <div className={`flex gap-1 ${file.status === 'processing' ? 'opacity-30 pointer-events-none' : ''}`}>
                    <Link to="/dashboard/editor" className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container-low" title="Open in Editor">
                      <span className="material-symbols-outlined">edit_note</span>
                    </Link>
                    <Link to="/dashboard/export" className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container-low" title="Export">
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

          {/* Empty state hint */}
          <div className="mt-6 p-6 border-2 border-dashed border-outline-variant/20 rounded-xl text-center">
            <span className="material-symbols-outlined text-3xl text-outline-variant mb-2 block">add_circle_outline</span>
            <p className="text-sm text-on-surface-variant">
              <Link to="/dashboard/upload" className="text-primary font-semibold hover:underline">Upload a new case</Link> to start an AI-powered review.
            </p>
          </div>
        </section>

      </div>
    </main>
  )
}
