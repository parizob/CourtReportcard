import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Tooltip from '../../components/Tooltip'
import { retryStuckCases } from '../../lib/backgroundAnalysis'

export default function Dashboard() {
  const { displayName } = useAuth()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const retryRan = useRef(false)
  useEffect(() => {
    fetchCases(true).then(() => {
      if (!retryRan.current) {
        retryRan.current = true
        retryStuckCases()
      }
    })
  }, [])

  useEffect(() => {
    const hasProcessing = cases.some((c) => c.status === 'processing')
    if (!hasProcessing) return
    const interval = setInterval(() => fetchCases(false), 4000)
    return () => clearInterval(interval)
  }, [cases])

  const fetchCases = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const { data, error } = await supabase
      .from('cases')
      .select('*, case_files(*), case_metrics(*)')
      .order('created_at', { ascending: false })
    if (!error && data) setCases(data)
    if (showLoading) setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const caseFiles = deleteTarget.case_files || []
      const storagePaths = caseFiles.map((f) => f.storage_path).filter(Boolean)

      if (storagePaths.length > 0) {
        await supabase.storage.from('case-files').remove(storagePaths)
      }

      // case_files rows are CASCADE deleted when the case is deleted
      const { error } = await supabase.from('cases').delete().eq('id', deleteTarget.id)
      if (error) throw error

      setCases((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Failed to delete case: ' + (err.message || 'Unknown error'))
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = async (file) => {
    setDownloading(file.id)
    try {
      const { data, error } = await supabase.storage
        .from('case-files')
        .download(file.storage_path)
      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = file.file_name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Failed to download file: ' + (err.message || 'Unknown error'))
    } finally {
      setDownloading(null)
    }
  }

  const filteredCases = searchQuery.trim()
    ? cases.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : cases
  const activeCases = filteredCases.filter((c) => c.status === 'uploaded' || c.status === 'processing' || c.status === 'analyzed')
  const completedCases = filteredCases.filter((c) => c.status === 'reviewed' || c.status === 'exported')

  const getMetrics = (c) => (c.case_metrics && c.case_metrics.length > 0 ? c.case_metrics[0] : c.case_metrics && !Array.isArray(c.case_metrics) ? c.case_metrics : null)

  const totalIssuesAll = cases.reduce((sum, c) => { const m = getMetrics(c); return sum + (m?.total_issues || 0) }, 0)
  const totalResolvedAll = cases.reduce((sum, c) => { const m = getMetrics(c); return sum + ((m?.accepted || 0) + (m?.ignored || 0)) }, 0)
  const avgResolution = totalIssuesAll > 0 ? Math.round((totalResolvedAll / totalIssuesAll) * 100) : null

  const stats = [
    { value: String(activeCases.length), label: 'Active Cases', icon: 'folder_open' },
    { value: String(completedCases.length), label: 'Completed Reviews', icon: 'check_circle' },
    { value: avgResolution !== null ? `${avgResolution}%` : '—', label: 'Resolution Rate', icon: 'speed' },
    { value: String(totalIssuesAll), label: 'Total Issues Found', icon: 'auto_awesome' },
  ]

  const statusLabel = (s) => ({ uploaded: 'Uploaded', processing: 'Processing', analyzed: 'Analyzed', reviewed: 'Reviewed', exported: 'Exported' }[s] || s)
  const statusColor = (s) => ({
    uploaded: 'bg-blue-100 text-blue-700',
    processing: 'bg-amber-100 text-amber-700',
    analyzed: 'bg-amber-50 text-amber-600',
    reviewed: 'bg-green-100 text-green-700',
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

  const originalFiles = (caseRow) =>
    (caseRow.case_files || []).filter((f) => f.file_type === 'transcript' || f.file_type === 'audio')

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
            <div className="flex items-center gap-3">
              {cases.length > 0 && (
                <div className="flex items-center bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant/20 editorial-shadow">
                  <span className="material-symbols-outlined text-outline text-sm">search</span>
                  <input
                    className="bg-transparent border-none outline-none focus:ring-0 text-sm w-48 ml-2 placeholder:text-on-surface-variant/50"
                    placeholder="Search cases..."
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-on-surface-variant/50 hover:text-on-surface-variant transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              )}
              {cases.length > 0 && (
                <button onClick={fetchCases} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Refresh
                </button>
              )}
            </div>
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
                Your case queue is empty. Upload a transcript to begin your first AI-powered review.
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
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-outline-variant/10 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                <span>Case</span>
                <span className="w-28 text-center">Files</span>
                <span className="w-24 text-center">Status</span>
                <span className="w-32 text-center">Review</span>
                <span className="w-28 text-center">Date</span>
                <span className="w-32 text-center">Actions</span>
              </div>
              {cases.map((c) => {
                const m = getMetrics(c)
                const resolved = m ? (m.accepted || 0) + (m.ignored || 0) : 0
                const total = m?.total_issues || 0
                const pct = total > 0 ? Math.round((resolved / total) * 100) : null
                return (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-6 py-4 items-center border-b border-outline-variant/5 last:border-b-0 hover:bg-surface-container/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-lg">folder</span>
                    </div>
                    <span className="text-sm font-semibold text-on-surface truncate">{c.name}</span>
                  </div>
                  <span className="w-28 text-center text-xs text-on-surface-variant">{fileCountLabel(c)}</span>
                  <div className="w-24 flex justify-center">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${statusColor(c.status)}`}>
                      {c.status === 'processing' && (
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {statusLabel(c.status)}
                    </span>
                  </div>
                  <div className="w-32 flex justify-center">
                    {pct !== null ? (
                      <Tooltip text={`${resolved}/${total} issues resolved`}>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold ${pct === 100 ? 'text-green-600' : 'text-on-surface-variant'}`}>{pct}%</span>
                        </div>
                      </Tooltip>
                    ) : (
                      <span className="text-[10px] text-on-surface-variant/50">—</span>
                    )}
                  </div>
                  <span className="w-28 text-center text-xs text-on-surface-variant">{formatDate(c.created_at)}</span>
                  <div className="w-32 flex justify-center gap-1">
                    <Tooltip text="View & download files">
                      <button
                        onClick={() => setViewTarget(c)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">folder_open</span>
                      </button>
                    </Tooltip>
                    <Tooltip text="Proofread transcript">
                      <Link
                        to={`/dashboard/editor?case=${c.id}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">edit_note</span>
                      </Link>
                    </Tooltip>
                    <Tooltip text="Export transcript">
                      <Link
                        to={`/dashboard/export?case=${c.id}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">cloud_download</span>
                      </Link>
                    </Tooltip>
                    <Tooltip text="Delete case">
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </Tooltip>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-surface-container-lowest rounded-2xl editorial-shadow p-8 max-w-md w-full mx-4 z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-error text-2xl">delete_forever</span>
              </div>
              <div>
                <h2 className="font-headline text-lg font-bold text-on-surface">Delete Case?</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-2">
              You are about to permanently delete <span className="font-semibold text-on-surface">{deleteTarget.name}</span> and all associated files:
            </p>
            <ul className="text-xs text-on-surface-variant mb-6 space-y-1 pl-4">
              {(deleteTarget.case_files || []).filter((f) => f.file_type !== 'extracted').map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs text-on-surface-variant/60">
                    {f.file_type === 'transcript' ? 'description' : 'audio_file'}
                  </span>
                  {f.file_name}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 bg-error text-on-error px-6 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Deleting...</>
                ) : (
                  <><span className="material-symbols-outlined text-base">delete</span> Delete Permanently</>
                )}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View/Download files modal */}
      {viewTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewTarget(null)} />
          <div className="relative bg-surface-container-lowest rounded-2xl editorial-shadow p-8 max-w-lg w-full mx-4 z-10">
            <button
              onClick={() => setViewTarget(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">folder</span>
              </div>
              <div>
                <h2 className="font-headline text-lg font-bold text-on-surface">{viewTarget.name}</h2>
                <p className="text-xs text-on-surface-variant">Uploaded {formatDate(viewTarget.created_at)}</p>
              </div>
            </div>

            {originalFiles(viewTarget).length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">No original files found for this case.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Uploaded Files</p>
                {originalFiles(viewTarget).map((f) => (
                  <div key={f.id} className="flex items-center justify-between bg-surface-container/40 rounded-xl p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${f.file_type === 'transcript' ? 'bg-primary/10' : 'bg-tertiary-fixed/20'}`}>
                        <span className={`material-symbols-outlined text-lg ${f.file_type === 'transcript' ? 'text-primary' : 'text-tertiary-fixed-dim'}`}>
                          {f.file_type === 'transcript' ? 'description' : 'audio_file'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{f.file_name}</p>
                        <p className="text-[10px] text-on-surface-variant">
                          {f.file_type === 'transcript' ? 'Transcript' : 'Audio'} &middot; {formatSize(f.file_size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(f)}
                      disabled={downloading === f.id}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline disabled:opacity-50 shrink-0 ml-3"
                    >
                      {downloading === f.id ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : (
                        <span className="material-symbols-outlined text-base">download</span>
                      )}
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
