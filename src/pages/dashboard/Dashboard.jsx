import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const { displayName } = useAuth()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCases()
  }, [])

  const fetchCases = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cases')
      .select('*, case_files(*)')
      .order('created_at', { ascending: false })

    if (!error && data) setCases(data)
    setLoading(false)
  }

  const activeCases = cases.filter((c) => c.status === 'uploaded' || c.status === 'processing')
  const completedCases = cases.filter((c) => c.status === 'analyzed' || c.status === 'exported')

  const stats = [
    { value: String(activeCases.length), label: 'Active Cases', icon: 'folder_open' },
    { value: String(completedCases.length), label: 'Completed Reviews', icon: 'check_circle' },
    { value: cases.length > 0 ? '—' : '—', label: 'Avg. Accuracy', icon: 'speed' },
    { value: '0', label: 'Court Rejections', icon: 'gavel' },
  ]

  const statusLabel = (s) => ({ uploaded: 'Uploaded', processing: 'Processing', analyzed: 'Analyzed', exported: 'Exported' }[s] || s)
  const statusColor = (s) => ({
    uploaded: 'bg-blue-100 text-blue-700',
    processing: 'bg-amber-100 text-amber-700',
    analyzed: 'bg-green-100 text-green-700',
    exported: 'bg-purple-100 text-purple-700',
  }[s] || 'bg-gray-100 text-gray-700')

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const fileCountLabel = (caseRow) => {
    const transcripts = caseRow.case_files?.filter((f) => f.file_type === 'transcript').length || 0
    const audios = caseRow.case_files?.filter((f) => f.file_type === 'audio').length || 0
    const parts = []
    if (transcripts > 0) parts.push(`${transcripts} transcript${transcripts !== 1 ? 's' : ''}`)
    if (audios > 0) parts.push(`${audios} audio`)
    return parts.join(', ') || 'No files'
  }

  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      <div className="max-w-6xl mx-auto">

        <header className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">{today}</p>
              <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">
                Welcome, {displayName}
              </h1>
              <p className="text-on-surface-variant mt-2">
                {cases.length === 0
                  ? 'Upload your first case to get started with AI-powered transcript review.'
                  : 'Here\'s an overview of your cases.'}
              </p>
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
            {cases.length > 0 && (
              <button onClick={fetchCases} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">refresh</span>
                Refresh
              </button>
            )}
          </div>

          {loading ? (
            <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-12 flex flex-col items-center text-center">
              <svg className="animate-spin h-8 w-8 text-primary mb-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-on-surface-variant">Loading cases...</p>
            </div>
          ) : cases.length === 0 ? (
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
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl editorial-shadow overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-outline-variant/10 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                <span>Case</span>
                <span className="w-28 text-center">Files</span>
                <span className="w-24 text-center">Status</span>
                <span className="w-28 text-center">Date</span>
                <span className="w-24 text-center">Actions</span>
              </div>
              {cases.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-4 items-center border-b border-outline-variant/5 last:border-b-0 hover:bg-surface-container/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-lg">folder</span>
                    </div>
                    <span className="text-sm font-semibold text-on-surface truncate">{c.name}</span>
                  </div>
                  <span className="w-28 text-center text-xs text-on-surface-variant">{fileCountLabel(c)}</span>
                  <div className="w-24 flex justify-center">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusColor(c.status)}`}>
                      {statusLabel(c.status)}
                    </span>
                  </div>
                  <span className="w-28 text-center text-xs text-on-surface-variant">{formatDate(c.created_at)}</span>
                  <div className="w-24 flex justify-center gap-1">
                    <Link
                      to={`/dashboard/editor?case=${c.id}`}
                      title="Open in Editor"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">edit_note</span>
                    </Link>
                    <Link
                      to={`/dashboard/export?case=${c.id}`}
                      title="Export"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">cloud_download</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
