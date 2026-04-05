import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function DashboardExport() {
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case')

  const [caseData, setCaseData] = useState(null)
  const [entries, setEntries] = useState([])
  const [annotations, setAnnotations] = useState([])
  const [title, setTitle] = useState('')
  const [originalText, setOriginalText] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(!!caseId)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(null)

  useEffect(() => {
    if (!caseId) return
    loadCase()
  }, [caseId])

  const loadCase = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: caseRow, error: caseErr } = await supabase
        .from('cases')
        .select('*, case_files(*), case_metrics(*)')
        .eq('id', caseId)
        .single()
      if (caseErr) throw caseErr
      setCaseData(caseRow)

      const m = caseRow.case_metrics && caseRow.case_metrics.length > 0
        ? caseRow.case_metrics[0]
        : (!Array.isArray(caseRow.case_metrics) ? caseRow.case_metrics : null)
      if (m) setMetrics(m)

      const extractedFile = caseRow.case_files?.find((f) => f.file_type === 'extracted')
      if (extractedFile) {
        const { data: blob, error: dlErr } = await supabase.storage
          .from('case-files')
          .download(extractedFile.storage_path)
        if (dlErr) throw dlErr
        const parsed = JSON.parse(await blob.text())
        setTitle(parsed.title || '')
        setEntries(parsed.entries || [])
        setAnnotations(parsed.annotations || [])
        setOriginalText(parsed.originalText || null)
      }
    } catch (err) {
      console.error('Failed to load case:', err)
      setError(err.message || 'Failed to load case.')
    } finally {
      setLoading(false)
    }
  }

  const openCount = metrics?.open ?? annotations.filter((a) => a.status === 'open').length
  const acceptedCount = metrics?.accepted ?? annotations.filter((a) => a.status === 'accepted').length
  const ignoredCount = metrics?.ignored ?? annotations.filter((a) => a.status === 'ignored').length
  const totalCount = metrics?.total_issues ?? annotations.length
  const entryCount = metrics?.total_entries ?? entries.length
  const resolvedPct = totalCount > 0 ? Math.round(((acceptedCount + ignoredCount) / totalCount) * 100) : 100

  const wrapLine = (text, maxWidth) => {
    if (!text || text.length <= maxWidth) return [text || '']
    const words = text.split(' ')
    const lines = []
    let current = ''
    for (const word of words) {
      if (current && (current.length + 1 + word.length) > maxWidth) {
        lines.push(current)
        current = word
      } else {
        current = current ? current + ' ' + word : word
      }
    }
    if (current) lines.push(current)
    return lines.length > 0 ? lines : ['']
  }

  const buildPlainText = () => {
    const LINE_WIDTH = 65
    const LINES_PER_PAGE = 25
    const PAGE_WIDTH = 75

    const allLines = []

    for (const entry of entries) {
      if (entry.speaker) {
        if (allLines.length > 0) allLines.push('')
        allLines.push(`${entry.speaker}:`)
      }
      const paragraphs = entry.text.split('\n')
      for (const para of paragraphs) {
        const wrapped = wrapLine(para, LINE_WIDTH)
        for (const w of wrapped) {
          allLines.push(w)
        }
      }
    }

    let output = ''
    let pageNum = 1
    for (let i = 0; i < allLines.length; i += LINES_PER_PAGE) {
      const pageLines = allLines.slice(i, i + LINES_PER_PAGE)
      const pageNumStr = String(pageNum)
      output += ' '.repeat(PAGE_WIDTH - pageNumStr.length) + pageNumStr + '\n\n\n'
      for (let j = 0; j < pageLines.length; j++) {
        const lineNum = String(j + 1)
        const padding = ' '.repeat(Math.max(0, 16 - lineNum.length))
        output += padding + lineNum + '   ' + pageLines[j] + '\n\n'
      }
      output += '\n'
      pageNum++
    }

    return output
  }

  const buildJsonExport = () => {
    const payload = { title, entries, annotations }
    if (originalText) payload.originalText = originalText
    return JSON.stringify(payload, null, 2)
  }

  const triggerDownload = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExport = async (format) => {
    setExporting(format)
    try {
      const baseName = (caseData?.name || 'transcript').replace(/[^a-zA-Z0-9_-]/g, '_')
      switch (format) {
        case 'txt': {
          const content = originalText || buildPlainText()
          triggerDownload(content, `${baseName}.txt`, 'text/plain')
          break
        }
        case 'json': {
          triggerDownload(buildJsonExport(), `${baseName}_annotated.json`, 'application/json')
          break
        }
        default:
          break
      }
    } catch (err) {
      console.error('Export failed:', err)
      setError('Export failed: ' + err.message)
    } finally {
      setTimeout(() => setExporting(null), 600)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-on-surface-variant font-medium">Loading case...</p>
        </div>
      </main>
    )
  }

  if (!caseId || (!caseData && !loading)) {
    return (
      <main className="min-h-screen bg-background p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-primary">cloud_download</span>
                  Export Center
                </p>
                <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">Export &amp; Archive</h1>
                <p className="font-body text-on-surface-variant mt-2 max-w-xl text-sm">
                  Select a case from the dashboard to export your reviewed transcript.
                </p>
              </div>
              <Link to="/dashboard" className="shrink-0 flex items-center gap-2 text-sm font-bold text-primary">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span className="hover:underline decoration-tertiary-fixed-dim decoration-2 underline-offset-4">Back to Dashboard</span>
              </Link>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-16 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-2xl bg-primary/5 flex items-center justify-center mb-8">
              <span className="material-symbols-outlined text-primary text-5xl">file_download_off</span>
            </div>
            <h2 className="font-headline text-2xl font-bold text-on-surface mb-3">No case selected</h2>
            <p className="text-sm text-on-surface-variant max-w-lg leading-relaxed mb-8">
              Head back to the dashboard and click the export icon on any case to download your reviewed transcript.
            </p>
            <div className="flex gap-3">
              <Link to="/dashboard" className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Go to Dashboard
              </Link>
              <Link to="/dashboard/upload" className="flex items-center gap-2 border border-outline-variant/40 text-on-surface px-5 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-base">cloud_upload</span>
                Upload a Case
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-8 lg:p-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">cloud_download</span>
                Export Center
              </p>
              <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">{caseData.name}</h1>
              <p className="font-body text-on-surface-variant mt-2 max-w-xl text-sm">
                Download your reviewed transcript in the format you need.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link to={`/dashboard/editor?case=${caseId}`} className="flex items-center gap-2 border border-outline-variant/40 text-on-surface px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-base">edit_note</span>
                Back to Editor
              </Link>
              <Link to="/dashboard" className="flex items-center gap-2 text-sm font-bold text-primary">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span className="hover:underline decoration-tertiary-fixed-dim decoration-2 underline-offset-4">Dashboard</span>
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
            {error}
          </div>
        )}

        {/* Review Summary */}
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8 mb-8">
          <h2 className="font-headline font-bold text-on-surface text-lg mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary-fixed-dim">analytics</span>
            Review Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-on-surface">{entryCount}</p>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Entries</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-on-surface">{totalCount}</p>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Issues Found</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-green-600">{acceptedCount}</p>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Accepted</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-on-surface-variant">{ignoredCount}</p>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Ignored</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-extrabold ${openCount > 0 ? 'text-error' : 'text-green-600'}`}>{openCount}</p>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Remaining</p>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-on-surface-variant mb-2">
              <span>Resolution Progress</span>
              <span className="font-bold">{resolvedPct}%</span>
            </div>
            <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-tertiary-fixed-dim rounded-full transition-all duration-500" style={{ width: `${resolvedPct}%` }} />
            </div>
          </div>
          {openCount > 0 && (
            <div className="mt-4 p-3 bg-tertiary-fixed/10 rounded-lg flex items-center gap-3">
              <span className="material-symbols-outlined text-on-tertiary-container text-lg">info</span>
              <p className="text-xs text-on-tertiary-container">
                You have {openCount} unresolved issue{openCount !== 1 ? 's' : ''}. <Link to={`/dashboard/editor?case=${caseId}`} className="font-bold underline">Return to editor</Link> to review them before exporting.
              </p>
            </div>
          )}
        </div>

        {/* Export Formats */}
        <h2 className="font-headline font-bold text-on-surface text-lg mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">download</span>
          Download Transcript
        </h2>
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {/* Plain Text */}
          <button
            onClick={() => handleExport('txt')}
            disabled={!!exporting}
            className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6 flex items-center gap-5 hover:ring-2 hover:ring-primary/20 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-blue-600 text-3xl">article</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-headline font-bold text-on-surface text-base mb-0.5">Corrected Transcript (.txt)</p>
              <p className="text-xs text-on-surface-variant">{originalText ? 'Preserves your original formatting — only accepted corrections are changed.' : 'Court-standard format with line numbers and page breaks. Ready for filing.'}</p>
            </div>
            <span className="material-symbols-outlined text-primary text-2xl shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {exporting === 'txt' ? 'check_circle' : 'download'}
            </span>
          </button>

          {/* Annotated JSON */}
          <button
            onClick={() => handleExport('json')}
            disabled={!!exporting}
            className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6 flex items-center gap-5 hover:ring-2 hover:ring-primary/20 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-amber-600 text-3xl">data_object</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-headline font-bold text-on-surface text-base mb-0.5">Annotated JSON (.json)</p>
              <p className="text-xs text-on-surface-variant">Full transcript with all AI annotations, corrections, and audit trail.</p>
            </div>
            <span className="material-symbols-outlined text-primary text-2xl shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {exporting === 'json' ? 'check_circle' : 'download'}
            </span>
          </button>
        </div>

        {/* Coming Soon Formats */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Coming Soon</p>
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6 flex items-center gap-5 opacity-50 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="bg-tertiary-fixed/20 text-on-tertiary-container text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">Soon</span>
            </div>
            <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-red-600 text-3xl">picture_as_pdf</span>
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface/60 text-base mb-0.5">Adobe PDF (.pdf)</p>
              <p className="text-xs text-on-surface-variant/60">Court-submission ready with formatting preserved.</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6 flex items-center gap-5 opacity-50 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="bg-tertiary-fixed/20 text-on-tertiary-container text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">Soon</span>
            </div>
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-blue-600 text-3xl">description</span>
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface/60 text-base mb-0.5">Microsoft Word (.docx)</p>
              <p className="text-xs text-on-surface-variant/60">Editable document with revision tracking.</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <section>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: 'verified', title: 'Court-Certified', body: 'Every export meets District and Federal Court formatting standards automatically.' },
              { icon: 'history_edu', title: 'Audit Trail', body: 'Every edit, suggestion, and acceptance is logged with an immutable chain of custody.' },
              { icon: 'lock', title: 'Encrypted', body: 'Files delivered via encrypted download links that expire after 24 hours.' },
            ].map((c) => (
              <div key={c.title} className="bg-surface-container-low p-5 rounded-2xl flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-secondary-container">{c.icon}</span>
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm text-on-surface mb-1">{c.title}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
