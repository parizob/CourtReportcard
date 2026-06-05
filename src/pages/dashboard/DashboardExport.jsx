import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { encodeRtf } from '../../lib/rtf'

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

  const openCount = annotations.filter((a) => a.status === 'open').length
  const customChangedCount = annotations.filter((a) => a.status === 'accepted' && a._originalSuggestion !== undefined && a.suggestion !== a._originalSuggestion).length
  const acceptedCount = annotations.filter((a) => a.status === 'accepted').length - customChangedCount
  const ignoredCount = annotations.filter((a) => a.status === 'ignored').length
  const totalCount = annotations.length || metrics?.total_issues || 0
  const entryCount = metrics?.total_entries ?? entries.length
  const resolvedPct = totalCount > 0 ? Math.round(((acceptedCount + ignoredCount + customChangedCount) / totalCount) * 100) : 100

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
        case 'rtf': {
          const content = originalText || buildPlainText()
          triggerDownload(encodeRtf(content), `${baseName}.rtf`, 'application/rtf')
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
      <main className="h-[calc(100vh-65px)] bg-background flex items-center justify-center">
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
      <main className="h-[calc(100vh-65px)] overflow-hidden bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-3xl">file_download_off</span>
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface mb-1">No case selected</h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Go to the dashboard and click the export icon on any case.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/dashboard" className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Dashboard
            </Link>
            <Link to="/dashboard/upload" className="flex items-center gap-2 border border-outline-variant/40 text-on-surface px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              Upload a Case
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="h-[calc(100vh-65px)] overflow-hidden bg-background flex items-start justify-center px-6 py-7">
      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight truncate">{caseData.name}</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">Download your reviewed transcript</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`/dashboard/editor?case=${caseId}`} className="flex items-center gap-1.5 border border-outline-variant/40 text-on-surface px-3 py-2 rounded-lg font-bold text-xs hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Editor
            </Link>
            <Link to="/dashboard" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Dashboard
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="shrink-0 p-3 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            {error}
          </div>
        )}

        {/* Review summary */}
        <div className="shrink-0 bg-surface-container-lowest rounded-xl editorial-shadow p-4">
          <div className="grid grid-cols-5 gap-3 mb-3">
            {[
              { value: totalCount, label: 'Flagged', color: 'text-on-surface' },
              { value: acceptedCount, label: 'Accepted', color: 'text-green-600' },
              { value: customChangedCount, label: 'Changed', color: 'text-green-600' },
              { value: ignoredCount, label: 'Ignored', color: 'text-on-surface-variant' },
              { value: openCount, label: 'Remaining', color: openCount > 0 ? 'text-error' : 'text-green-600' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] uppercase tracking-widest text-on-surface-variant mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${resolvedPct}%` }} />
            </div>
            <span className="text-xs font-bold text-on-surface-variant shrink-0">{resolvedPct}% resolved</span>
          </div>
          {openCount > 0 && (
            <div className="mt-3 p-2.5 bg-tertiary-fixed/10 rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-on-tertiary-container text-base shrink-0">info</span>
              <p className="text-xs text-on-tertiary-container">
                {openCount} unresolved issue{openCount !== 1 ? 's' : ''} — <Link to={`/dashboard/editor?case=${caseId}`} className="font-bold underline">return to editor</Link> before exporting.
              </p>
            </div>
          )}
        </div>

        {/* Export formats */}
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Download Transcript</p>

        <div className="shrink-0 flex flex-col gap-2">
          {[
            { format: 'txt', icon: 'article', color: 'bg-blue-50 text-blue-600', label: 'Corrected Transcript', ext: '.txt', desc: originalText ? 'Original formatting preserved — only accepted corrections applied.' : 'Court-standard format with line numbers and page breaks.' },
            { format: 'rtf', icon: 'draft',   color: 'bg-indigo-50 text-indigo-600', label: 'Corrected Transcript', ext: '.rtf', desc: 'Rich Text Format — opens in Word, Pages, or any steno software.' },
            { format: 'json', icon: 'data_object', color: 'bg-amber-50 text-amber-600', label: 'Annotated Export', ext: '.json', desc: 'Full transcript with all annotations, corrections, and audit trail.' },
          ].map(({ format, icon, color, label, ext, desc }) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={!!exporting}
              className="bg-surface-container-lowest rounded-xl editorial-shadow px-4 py-3.5 flex items-center gap-4 hover:ring-2 hover:ring-primary/20 transition-all text-left group disabled:opacity-50"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color} bg-opacity-80 group-hover:scale-105 transition-transform`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-headline font-bold text-on-surface text-sm">{label} <span className="text-on-surface-variant font-normal">({ext})</span></p>
                <p className="text-[11px] text-on-surface-variant truncate">{desc}</p>
              </div>
              <span className="material-symbols-outlined text-primary text-xl shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {exporting === format ? 'check_circle' : 'download'}
              </span>
            </button>
          ))}
        </div>

        {/* Coming soon — compact */}
        <div className="shrink-0 flex items-center gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Coming soon</p>
          {[
            { icon: 'picture_as_pdf', label: 'PDF', color: 'text-red-400' },
            { icon: 'description', label: 'DOCX', color: 'text-blue-400' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 opacity-50">
              <span className={`material-symbols-outlined text-sm ${f.color}`}>{f.icon}</span>
              <span className="text-xs font-semibold text-on-surface-variant">{f.label}</span>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
