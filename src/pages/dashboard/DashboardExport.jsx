import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, downloadCaseFile } from '../../lib/supabase'
import { encodeRtf } from '../../lib/rtf'
import { ensureAcceptedCorrectionsInOriginalText } from '../../lib/gemini'
import { detectExportNumbering, formatExportText } from '../../lib/exportText'
import { waitForCasePersists, syncMetricsFromAnnotations, annotationStatusCounts } from '../../lib/casePersist'
import { trackEvent } from '../../lib/telemetry'

export default function DashboardExport() {
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case')

  const [caseData, setCaseData] = useState(null)
  const [entries, setEntries] = useState([])
  const [annotations, setAnnotations] = useState([])
  const [originalText, setOriginalText] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(!!caseId)
  const [error, setError] = useState('')
  const [exportBlocked, setExportBlocked] = useState(false)
  const [exporting, setExporting] = useState(null)
  /** Accepted fixes that failed export verify — shown as an explicit list, not buried in prose. */
  const [verifyFailed, setVerifyFailed] = useState([])
  // Defaults follow what is in the file (naked RTF often has neither).
  const [includeLineNumbers, setIncludeLineNumbers] = useState(true)
  const [includePageNumbers, setIncludePageNumbers] = useState(true)
  const [hasLineNumbers, setHasLineNumbers] = useState(true)
  const [hasPageNumbers, setHasPageNumbers] = useState(true)

  useEffect(() => {
    if (!caseId) return
    loadCase()
  }, [caseId])

  const loadCase = async () => {
    setLoading(true)
    setError('')
    setExportBlocked(false)
    setVerifyFailed([])
    try {
      // Wait for in-flight editor saves; fail closed if the last one errored
      // so we never download a pre-accept storage snapshot.
      try {
        await waitForCasePersists()
      } catch (persistErr) {
        console.error('Export blocked: persist queue failed', persistErr)
        setExportBlocked(true)
        throw new Error(
          'We want to make sure your latest changes are on the file before you download. Go back to the editor, click Save Changes, then open Export again.'
        )
      }

      const { data: caseRow, error: caseErr } = await supabase
        .from('cases')
        .select('*, case_files(*), case_metrics(*)')
        .eq('id', caseId)
        .single()
      if (caseErr) throw caseErr

      const m = caseRow.case_metrics && caseRow.case_metrics.length > 0
        ? caseRow.case_metrics[0]
        : (!Array.isArray(caseRow.case_metrics) ? caseRow.case_metrics : null)

      const extractedFile = caseRow.case_files?.find((f) => f.file_type === 'extracted')
      if (extractedFile) {
        const { data: blob, error: dlErr } = await downloadCaseFile(extractedFile.storage_path)
        if (dlErr) throw dlErr
        const parsed = JSON.parse(await blob.text())
        const loadedAnnotations = parsed.annotations || []

        setCaseData(caseRow)
        setEntries(parsed.entries || [])
        setAnnotations(loadedAnnotations)
        setOriginalText(parsed.originalText || null)
        const numbering = detectExportNumbering(parsed.originalText || '')
        setHasLineNumbers(numbering.hasLineNumbers)
        setHasPageNumbers(numbering.hasPageNumbers)
        setIncludeLineNumbers(numbering.hasLineNumbers)
        setIncludePageNumbers(numbering.hasPageNumbers)

        // File is source of truth. Sync metrics from it so dashboard matches
        // what they can download. In-session save failures are fail-closed above.
        const counts = annotationStatusCounts(loadedAnnotations)
        setMetrics({
          ...(m || {}),
          total_issues: counts.total,
          accepted: counts.accepted,
          ignored: counts.ignored,
          open: counts.open,
          custom_changed: counts.custom_changed,
        })
        syncMetricsFromAnnotations(caseId, parsed.entries || [], loadedAnnotations).catch((error) => {
          console.error('case_metrics sync failed (export load):', error.message || error)
        })
      } else {
        setCaseData(caseRow)
        if (m) setMetrics(m)
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

  const resolveExportOriginalText = () => {
    if (!originalText) return null
    const { text, failed } = ensureAcceptedCorrectionsInOriginalText(
      originalText,
      entries,
      annotations
    )
    if (failed.length > 0) {
      const items = failed.map((a) => ({
        id: a.id,
        entry_id: a.entry_id,
        original: a.original,
        suggestion: a.suggestion,
      }))
      console.warn(
        `Export: ${failed.length} accepted fix(es) could not be confirmed in originalText`,
        items
      )
      try {
        sessionStorage.setItem(
          `exportVerifyFailed:${caseId}`,
          JSON.stringify({ caseId, items, at: Date.now() })
        )
      } catch {
        /* private mode / quota — list still shows on this page via thrown path */
      }
      const err = new Error(
        `Export paused to protect your transcript. Only ${failed.length} already-accepted change${failed.length === 1 ? '' : 's'} need attention (not all of your accepted work). See the list below, then open the editor to Reopen and Accept each one again.`
      )
      err.verifyFailed = items
      throw err
    }
    return text
  }

  const buildExportBody = () => {
    const source = resolveExportOriginalText() || buildPlainText()
    return formatExportText(source, { includeLineNumbers, includePageNumbers })
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
    if (exportBlocked) {
      setError('Save your latest changes in the editor first, then open Export again.')
      return
    }
    setExporting(format)
    setError('')
    setVerifyFailed([])
    try {
      const baseName = (caseData?.name || 'transcript').replace(/[^a-zA-Z0-9_-]/g, '_')
      const content = buildExportBody()
      if (format === 'txt') {
        triggerDownload(content, `${baseName}.txt`, 'text/plain')
      } else if (format === 'rtf') {
        triggerDownload(encodeRtf(content), `${baseName}.rtf`, 'application/rtf')
      }
      // Best-effort completion signal — never block the download the user already got.
      try {
        const { error: exportTrackErr } = await supabase.rpc('record_case_export', {
          p_case_id: caseId,
          p_format: format,
        })
        if (exportTrackErr) console.warn('record_case_export failed:', exportTrackErr.message)
      } catch (trackErr) {
        console.warn('record_case_export failed:', trackErr)
      }
      trackEvent({
        type: 'export',
        name: 'case_download',
        trackId: 'export_download',
        elementType: 'button',
        metadata: { case_id: caseId, format },
      })
      try {
        sessionStorage.removeItem(`exportVerifyFailed:${caseId}`)
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error('Export failed:', err)
      if (Array.isArray(err.verifyFailed)) setVerifyFailed(err.verifyFailed)
      setError(err.message || 'Export failed.')
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

  if (!caseId) {
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

  if (!caseData && !loading) {
    return (
      <main className="h-[calc(100vh-65px)] overflow-hidden bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-5">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${exportBlocked ? 'bg-secondary-container/40' : 'bg-error-container/30'}`}>
            <span className={`material-symbols-outlined text-3xl ${exportBlocked ? 'text-secondary' : 'text-error'}`}>
              {exportBlocked ? 'save' : 'error'}
            </span>
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface mb-1">
              {exportBlocked ? 'One quick save first' : 'Could not load case'}
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {error || 'Something went wrong loading this case for download.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to={`/dashboard/editor?case=${caseId}`}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-base">edit_note</span>
              Back to Editor
            </Link>
            <Link to="/dashboard" className="flex items-center gap-2 border border-outline-variant/40 text-on-surface px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="h-[calc(100vh-65px)] overflow-y-auto bg-background flex items-start justify-center px-6 py-7">
      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Header */}
        <div className="shrink-0 flex flex-col-reverse sm:flex-row items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 w-full sm:w-auto">
            <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight truncate">{caseData.name}</h1>
          </div>
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 shrink-0">
            <Link to={`/dashboard/editor?case=${caseId}`} className="flex items-center gap-1.5 border border-outline-variant/40 text-on-surface px-3 py-2 rounded-lg font-bold text-xs hover:bg-surface-container transition-colors sm:mr-1">
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Editor
            </Link>
            <Link to="/dashboard" className="group flex items-center gap-1.5 text-xs font-bold text-primary">
              <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-1">arrow_back</span>
              <span className="group-hover:underline">Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="shrink-0 p-3 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {verifyFailed.length > 0 && (
          <div className="shrink-0 bg-surface-container-lowest border border-error/20 rounded-xl editorial-shadow p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-error mb-1">
              Needs re-accept ({verifyFailed.length})
            </p>
            <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
              You do not need to redo every accepted suggestion. Only these could not be confirmed in the file.
            </p>
            <ul className="space-y-2 mb-4">
              {verifyFailed.map((item) => (
                <li
                  key={item.id}
                  className="text-sm text-on-surface rounded-lg bg-surface-container px-3 py-2 leading-relaxed"
                >
                  <span className="text-on-surface-variant">Found</span>{' '}
                  <span className="font-semibold">
                    {item.original === '' ? '(remove)' : `"${item.original}"`}
                  </span>
                  <span className="text-on-surface-variant mx-1.5">→</span>
                  <span className="font-semibold text-green-800">
                    {item.suggestion === '' ? '(remove)' : `"${item.suggestion}"`}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              to={`/dashboard/editor?case=${caseId}&fixExport=1`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-2.5 rounded-lg font-bold text-xs hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Open editor to fix these
            </Link>
          </div>
        )}

        {/* Review summary */}
        <div className="shrink-0 bg-surface-container-lowest rounded-xl editorial-shadow p-4">
          <div className="grid grid-cols-5 gap-1 sm:gap-3 mb-3">
            {[
              { value: totalCount, label: 'Flagged', color: 'text-on-surface' },
              { value: acceptedCount, label: 'Accepted', color: 'text-green-600' },
              { value: customChangedCount, label: 'Changed', color: 'text-green-600' },
              { value: ignoredCount, label: 'Ignored', color: 'text-on-surface-variant' },
              { value: openCount, label: 'Remaining', color: openCount > 0 ? 'text-error' : 'text-green-600' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] uppercase tracking-wide sm:tracking-widest text-on-surface-variant mt-0.5">{s.label}</p>
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

        {/* Options + download */}
        <div className="shrink-0 flex flex-col gap-3">
          <p className="text-xs text-on-surface-variant leading-relaxed text-center">
            Choose what to include, then download. Always review before you submit.
          </p>

          <div className="bg-surface-container-lowest rounded-xl editorial-shadow p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Include in download</p>
            {[
              {
                available: hasLineNumbers,
                checked: includeLineNumbers,
                onChange: setIncludeLineNumbers,
                title: 'Line numbers',
                help: 'Left-column numbers (1 to 25). Turn off if your CAT software adds its own.',
              },
              {
                available: hasPageNumbers,
                checked: includePageNumbers,
                onChange: setIncludePageNumbers,
                title: 'Page numbers',
                help: 'Centered page headers in the body. Turn off for Case CATalyst or Eclipse re-import.',
              },
            ].map(({ available, checked, onChange, title, help }) => (
              <label
                key={title}
                className={`flex items-start gap-3 ${available ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
              >
                {available ? (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0 cursor-pointer"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 relative block w-4 h-4 shrink-0 rounded border border-outline-variant bg-surface-container-lowest"
                  >
                    <svg viewBox="0 0 16 16" className="absolute inset-0 w-full h-full text-on-surface-variant">
                      <line x1="3.5" y1="12.5" x2="12.5" y2="3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-on-surface">
                    {title}
                  </span>
                  <span className="block text-xs text-on-surface-variant leading-relaxed mt-0.5">
                    {available ? help : 'Unavailable for this transcript.'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { format: 'txt', icon: 'article', color: 'bg-blue-50 text-blue-600', ext: '.txt', desc: 'Plain text.' },
              { format: 'rtf', icon: 'draft', color: 'bg-indigo-50 text-indigo-600', ext: '.rtf', desc: 'Rich text.' },
            ].map(({ format, icon, color, ext, desc }) => (
              <button
                key={format}
                type="button"
                onClick={() => handleExport(format)}
                disabled={!!exporting || exportBlocked}
                data-track-id={`export_${format}_L${includeLineNumbers ? 1 : 0}_P${includePageNumbers ? 1 : 0}`}
                className="h-[60px] bg-surface-container-lowest rounded-xl editorial-shadow px-4 flex items-center gap-3 hover:ring-2 hover:ring-primary/20 transition-all text-left group disabled:opacity-50"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color} bg-opacity-80 group-hover:scale-105 transition-transform`}>
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-on-surface text-sm">
                    Download <span className="text-on-surface-variant font-normal">({ext})</span>
                  </p>
                  <p className="hidden sm:block text-[11px] text-on-surface-variant leading-snug truncate">{desc}</p>
                </div>
                <span className="material-symbols-outlined text-primary text-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {exporting === format ? 'check_circle' : 'download'}
                </span>
              </button>
            ))}
          </div>

          <div className="relative group/tip w-fit mx-auto mt-1">
            <button
              type="button"
              className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/70 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">help_outline</span>
              Not sure which options to use?
            </button>
            <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[min(22rem,calc(100vw-2rem))] opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
              <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl editorial-shadow p-3 space-y-2">
                <div className="rounded-lg bg-surface-container-low px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Case CATalyst</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Line numbers on, page numbers off.
                  </p>
                </div>
                <div className="rounded-lg bg-surface-container-low px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Eclipse</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Line numbers off, page numbers off.
                  </p>
                </div>
                <div className="rounded-lg bg-surface-container-low px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Keep as filed</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Both on (default).
                  </p>
                </div>
                <p className="text-[10px] text-outline px-1 pt-0.5 leading-relaxed">
                  When in doubt, check your software&apos;s import settings.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming soon — compact */}
        <div className="shrink-0 flex items-center gap-3 pt-1">
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
