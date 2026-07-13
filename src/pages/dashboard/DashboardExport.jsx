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
        const loadedAnnotations = parsed.annotations || []
        setEntries(parsed.entries || [])
        setAnnotations(loadedAnnotations)
        setOriginalText(parsed.originalText || null)

        // Sync case_metrics from annotation file so dashboard stays accurate
        const accepted = loadedAnnotations.filter((a) => a.status === 'accepted').length
        const ignored = loadedAnnotations.filter((a) => a.status === 'ignored').length
        const open = loadedAnnotations.filter((a) => a.status === 'open').length
        const custom_changed = loadedAnnotations.filter((a) => a.status === 'accepted' && a._originalSuggestion !== undefined && a.suggestion !== a._originalSuggestion).length
        const total = loadedAnnotations.length
        supabase.from('case_metrics').upsert({
          case_id: caseId,
          total_issues: total,
          accepted,
          ignored,
          open,
          custom_changed,
          last_reviewed_at: new Date().toISOString(),
        }, { onConflict: 'case_id' }).then(({ error }) => {
          if (error) console.error('case_metrics sync failed (export load):', error.message)
          else if (total > 0 && open === 0) {
            supabase.from('cases').update({ status: 'reviewed' }).eq('id', caseId)
          }
        })
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

  // Removes the line-number column while preserving all content indentation.
  // Line numbers sit in a fixed-width band on the left; we detect that band's
  // width (the body's left margin) and slice exactly that many characters from
  // every line. Content indentation BEYOND the band is left untouched, so
  // captions, "Plaintiff," indents, Q/A alignment, etc. stay exactly as-is.
  const buildCleanText = () => {
    const source = originalText || buildPlainText()
    const lines = source.split('\n')

    // The body left margin = the smallest "<spaces><number><spaces>" prefix
    // among numbered lines. Un-indented lines (vs., names, Q/A) produce the true
    // column width; indented lines produce a longer prefix and don't lower the min.
    let colWidth = Infinity
    for (const l of lines) {
      const m = l.match(/^(\s*\d{1,4}\s+)\S/)
      if (m) colWidth = Math.min(colWidth, m[1].length)
    }
    if (!isFinite(colWidth) || colWidth === 0) return source

    return lines
      .map((line) => {
        // Blank testimony line: just a bare line number in the left band, no
        // content. (A lone number further right is a page number — leave it.)
        if (/^\s*\d{1,4}\s*$/.test(line) && line.search(/\d/) < colWidth) return ''
        const isNumbered = /^\s*\d{1,4}\s/.test(line)
        const bandIsBlank = /^\s*$/.test(line.slice(0, colWidth))
        // Only cut the band when it holds a line number or pure whitespace
        // (continuation/blank lines). Never slice into actual content.
        if (isNumbered || bandIsBlank) return line.slice(colWidth)
        return line
      })
      .join('\n')
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
        case 'txt_clean': {
          triggerDownload(buildCleanText(), `${baseName}.txt`, 'text/plain')
          break
        }
        case 'rtf_clean': {
          triggerDownload(encodeRtf(buildCleanText()), `${baseName}.rtf`, 'application/rtf')
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
    <main className="h-[calc(100vh-65px)] overflow-y-auto bg-background flex items-start justify-center px-6 py-7">
      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Header */}
        <div className="shrink-0 flex flex-col-reverse sm:flex-row items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 w-full sm:w-auto">
            <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight truncate">{caseData.name}</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">Download your reviewed transcript</p>
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
          <div className="shrink-0 p-3 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            {error}
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

        {/* Export formats — two columns */}
        <div className="shrink-0 grid grid-cols-2 gap-4">

          {/* With line numbers */}
          <div className="flex flex-col gap-2">
            <div className="h-9 flex flex-col justify-end px-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">With Line<br className="sm:hidden" /> Numbers</p>
            </div>
            {[
              { format: 'txt', icon: 'article', color: 'bg-blue-50 text-blue-600', ext: '.txt', desc: 'Plain text.' },
              { format: 'rtf', icon: 'draft', color: 'bg-indigo-50 text-indigo-600', ext: '.rtf', desc: 'Rich text.' },
            ].map(({ format, icon, color, ext, desc }) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                disabled={!!exporting}
                data-track-id={`export_${format}`}
                className="h-[60px] bg-surface-container-lowest rounded-xl editorial-shadow px-4 flex items-center gap-3 hover:ring-2 hover:ring-primary/20 transition-all text-left group disabled:opacity-50"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color} bg-opacity-80 group-hover:scale-105 transition-transform`}>
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-on-surface text-sm">Transcript <span className="text-on-surface-variant font-normal">({ext})</span></p>
                  <p className="hidden sm:block text-[11px] text-on-surface-variant leading-snug truncate">{desc}</p>
                </div>
                <span className="material-symbols-outlined text-primary text-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {exporting === format ? 'check_circle' : 'download'}
                </span>
              </button>
            ))}
          </div>

          {/* Without line numbers */}
          <div className="flex flex-col gap-2">
            <div className="h-9 flex flex-col justify-end px-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Without Line<br className="sm:hidden" /> Numbers</p>
            </div>
            {[
              { format: 'txt_clean', icon: 'article', color: 'bg-blue-50 text-blue-600', ext: '.txt', desc: 'Plain text.' },
              { format: 'rtf_clean', icon: 'draft', color: 'bg-indigo-50 text-indigo-600', ext: '.rtf', desc: 'Rich text.' },
            ].map(({ format, icon, color, ext, desc }) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                disabled={!!exporting}
                data-track-id={`export_${format}`}
                className="h-[60px] bg-surface-container-lowest rounded-xl editorial-shadow px-4 flex items-center gap-3 hover:ring-2 hover:ring-primary/20 transition-all text-left group disabled:opacity-50"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color} bg-opacity-80 group-hover:scale-105 transition-transform`}>
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold text-on-surface text-sm">Transcript <span className="text-on-surface-variant font-normal">({ext})</span></p>
                  <p className="hidden sm:block text-[11px] text-on-surface-variant leading-snug truncate">{desc}</p>
                </div>
                <span className="material-symbols-outlined text-primary text-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {exporting === format ? 'check_circle' : 'download'}
                </span>
              </button>
            ))}
          </div>

        </div>

        {/* Which version tip */}
        <div className="shrink-0 relative group/tip w-fit">
          <button className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/70 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">help_outline</span>
            Not sure which version to use?
          </button>
          <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 w-80 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
            <div className="bg-[#1a1a2e] text-white rounded-xl px-5 py-4 text-[11px] leading-relaxed shadow-xl">
              <p className="text-white font-bold text-sm text-center mb-3 tracking-tight">Which version should I use?</p>
              <div className="grid grid-cols-2 divide-x divide-white/15">
                <div className="pr-4 flex flex-col items-center text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-tertiary-fixed-dim mb-1.5">With Line Numbers</p>
                  <p className="text-white/75 leading-relaxed">Use if your software imports the file as-is.</p>
                  <p className="text-white/40 mt-2 text-[10px]">e.g. <span className="text-white/70 font-medium">Case CATalyst</span></p>
                </div>
                <div className="pl-4 flex flex-col items-center text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-tertiary-fixed-dim mb-1.5">Without Line Numbers</p>
                  <p className="text-white/75 leading-relaxed">Use if your software adds its own numbers on import.</p>
                  <p className="text-white/40 mt-2 text-[10px]">e.g. <span className="text-white/70 font-medium">Eclipse</span></p>
                </div>
              </div>
              <p className="text-white/30 mt-3 text-[10px] text-center">When in doubt, check your software's import settings.</p>
            </div>
            <div className="w-2 h-2 bg-[#1a1a2e] rotate-45 ml-4 -mt-[5px]" />
          </div>
        </div>

        {/* Annotated export — full width */}
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Annotated Export</p>

        <button
          onClick={() => handleExport('json')}
          disabled={!!exporting}
          data-track-id="export_json"
          className="shrink-0 bg-surface-container-lowest rounded-xl editorial-shadow px-4 py-3 flex items-center gap-3 hover:ring-2 hover:ring-primary/20 transition-all text-left group disabled:opacity-50"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-50 text-amber-600 bg-opacity-80 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-lg">data_object</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-headline font-bold text-on-surface text-sm">Annotated Export <span className="text-on-surface-variant font-normal">(.json)</span></p>
            <p className="hidden sm:block text-[11px] text-on-surface-variant leading-snug">Full transcript with all annotations, corrections, and audit trail.</p>
          </div>
          <span className="material-symbols-outlined text-primary text-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {exporting === 'json' ? 'check_circle' : 'download'}
          </span>
        </button>

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
