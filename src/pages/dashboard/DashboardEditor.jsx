import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { proofreadTranscript, fixAnnotationPositions, deduplicateTranscript, flexFind } from '../../lib/gemini'

export default function DashboardEditor() {
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case')

  const [caseData, setCaseData] = useState(null)
  const [entries, setEntries] = useState([])
  const [annotations, setAnnotations] = useState([])
  const [originalSnapshot, setOriginalSnapshot] = useState('')
  const [extractedFilePath, setExtractedFilePath] = useState(null)
  const [loading, setLoading] = useState(!!caseId)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')

  const currentSnapshot = useMemo(
    () => JSON.stringify({ entries, annotations }),
    [entries, annotations]
  )
  const hasChanges = currentSnapshot !== originalSnapshot

  const openAnnotations = useMemo(
    () => annotations.filter((a) => a.status === 'open'),
    [annotations]
  )

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
        .select('*, case_files(*)')
        .eq('id', caseId)
        .single()

      if (caseErr) throw caseErr
      setCaseData(caseRow)

      const extractedFile = caseRow.case_files?.find((f) => f.file_type === 'extracted')
      if (extractedFile) {
        setExtractedFilePath(extractedFile.storage_path)
        const { data: blob, error: dlErr } = await supabase.storage
          .from('case-files')
          .download(extractedFile.storage_path)
        if (dlErr) throw dlErr

        const parsed = JSON.parse(await blob.text())

        // Deduplicate entries at load time (cleans up any Gemini duplication in stored JSON)
        const { entries: dedupedEntries, annotations: dedupedAnnotations } =
          deduplicateTranscript(parsed.entries || [], parsed.annotations || [])

        const fixedAnnotations = fixAnnotationPositions(dedupedEntries, dedupedAnnotations)
        setTitle(parsed.title || '')
        setEntries(dedupedEntries)
        setAnnotations(fixedAnnotations)
        setOriginalSnapshot(JSON.stringify({
          entries: dedupedEntries,
          annotations: fixedAnnotations,
        }))
      }
    } catch (err) {
      console.error('Failed to load case:', err)
      setError(err.message || 'Failed to load case.')
    } finally {
      setLoading(false)
    }
  }

  const updateEntryText = useCallback((id, newText) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, text: newText } : e)))
    setSaved(false)
  }, [])

  const updateEntrySpeaker = useCallback((id, newSpeaker) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, speaker: newSpeaker } : e)))
    setSaved(false)
  }, [])

  const persistJsonRef = useRef(null)
  persistJsonRef.current = async (updatedEntries, updatedAnnotations) => {
    if (!extractedFilePath) return
    try {
      const updatedJson = JSON.stringify({
        title,
        extracted_at: new Date().toISOString(),
        entries: updatedEntries,
        annotations: updatedAnnotations,
      }, null, 2)
      const blob = new Blob([updatedJson], { type: 'application/json' })
      const { error: upErr } = await supabase.storage
        .from('case-files')
        .upload(extractedFilePath, blob, { upsert: true })
      if (upErr) console.error('Persist JSON storage error:', upErr)
      else setOriginalSnapshot(JSON.stringify({ entries: updatedEntries, annotations: updatedAnnotations }))
    } catch (err) {
      console.error('Persist JSON failed:', err)
    }
  }

  const syncMetrics = useCallback(async (updatedAnnotations, updatedEntries) => {
    if (!caseId) return
    const accepted = updatedAnnotations.filter((a) => a.status === 'accepted').length
    const ignored = updatedAnnotations.filter((a) => a.status === 'ignored').length
    const open = updatedAnnotations.filter((a) => a.status === 'open').length
    const total = updatedAnnotations.length

    await supabase.from('case_metrics').upsert({
      case_id: caseId,
      total_entries: (updatedEntries || entries).length,
      total_issues: total,
      accepted,
      ignored,
      open,
      last_reviewed_at: new Date().toISOString(),
    }, { onConflict: 'case_id' })

    if (total > 0 && open === 0) {
      await supabase.from('cases').update({ status: 'reviewed' }).eq('id', caseId)
    }

    if (persistJsonRef.current) {
      persistJsonRef.current(updatedEntries || entries, updatedAnnotations)
    }
  }, [caseId, entries])

  const acceptAnnotation = useCallback((annotationId) => {
    const ann = annotations.find((a) => a.id === annotationId)
    if (!ann || ann.status !== 'open') return

    const newEntries = entries.map((e) => {
      if (e.id !== ann.entry_id) return e
      const m = flexFind(e.text, ann.original)
      if (!m) return e
      const before = e.text.substring(0, m.start)
      const after = e.text.substring(m.end)
      return { ...e, text: before + ann.suggestion + after }
    })

    const updatedAnnotations = annotations.map((a) =>
      a.id === annotationId ? { ...a, status: 'accepted' } : a
    )
    const fixedAnnotations = fixAnnotationPositions(newEntries, updatedAnnotations)

    setEntries(newEntries)
    setAnnotations(fixedAnnotations)
    setSaved(false)

    syncMetrics(fixedAnnotations, newEntries)
  }, [annotations, entries, syncMetrics])

  const ignoreAnnotation = useCallback((annotationId) => {
    const updated = annotations.map((a) => (a.id === annotationId ? { ...a, status: 'ignored' } : a))
    setAnnotations(updated)
    setSaved(false)
    syncMetrics(updated, entries)
  }, [annotations, entries, syncMetrics])

  const handleReanalyze = async () => {
    setAnalyzing(true)
    setError('')
    try {
      const freshAnnotations = await proofreadTranscript(entries)
      setAnnotations(freshAnnotations)
      setSaved(false)
    } catch (err) {
      console.error('Re-analysis failed:', err)
      setError(err.message || 'Re-analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!extractedFilePath || !hasChanges) return
    setSaving(true)
    setError('')
    try {
      const updatedJson = JSON.stringify({ title, extracted_at: new Date().toISOString(), entries, annotations }, null, 2)
      const blob = new Blob([updatedJson], { type: 'application/json' })
      const { error: uploadErr } = await supabase.storage
        .from('case-files')
        .upload(extractedFilePath, blob, { upsert: true })
      if (uploadErr) throw uploadErr

      await supabase.from('case_metrics').upsert({
        case_id: caseId,
        total_entries: entries.length,
        total_issues: annotations.length,
        accepted: annotations.filter((a) => a.status === 'accepted').length,
        ignored: annotations.filter((a) => a.status === 'ignored').length,
        open: annotations.filter((a) => a.status === 'open').length,
        last_reviewed_at: new Date().toISOString(),
      }, { onConflict: 'case_id' })

      setOriginalSnapshot(JSON.stringify({ entries, annotations }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Save failed:', err)
      setError(err.message || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = () => {
    const snap = JSON.parse(originalSnapshot)
    setEntries(snap.entries)
    setAnnotations(snap.annotations)
    setSaved(false)
  }

  // ─── Helpers ───

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

  const speakerColors = [
    'bg-secondary-container text-on-secondary-container',
    'bg-surface-container-highest text-on-surface-variant',
    'bg-primary/10 text-primary',
    'bg-tertiary-fixed/20 text-on-tertiary-container',
  ]
  const speakerColorMap = useMemo(() => {
    const map = {}
    let ci = 0
    for (const entry of entries) {
      if (entry.speaker && !map[entry.speaker]) {
        map[entry.speaker] = speakerColors[ci % speakerColors.length]
        ci++
      }
    }
    return map
  }, [entries])

  const annotationsByEntry = useMemo(() => {
    const map = {}
    const entryIdSet = new Set(entries.map((e) => e.id))

    for (const a of annotations) {
      if (a.status !== 'open' && a.status !== 'accepted') continue

      let targetId = a.entry_id
      let matched = false

      // Verify the original text is in the referenced entry (whitespace-flexible)
      if (entryIdSet.has(targetId) && a.original) {
        const entry = entries.find((e) => e.id === targetId)
        if (entry && flexFind(entry.text, a.original)) {
          matched = true
        }
      }

      // If not matched, search all entries by text
      if (!matched && a.original) {
        for (const e of entries) {
          if (flexFind(e.text, a.original)) {
            targetId = e.id
            matched = true
            break
          }
        }
      }

      if (!map[targetId]) map[targetId] = []
      map[targetId].push({ ...a, entry_id: targetId })
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.start - b.start)
    }
    return map
  }, [annotations, entries])

  const renderHighlightedText = (entry) => {
    const entryAnnotations = annotationsByEntry[entry.id]
    if (!entryAnnotations || entryAnnotations.length === 0) {
      return <span>{entry.text}</span>
    }

    const resolved = []
    const used = new Set()
    for (const ann of entryAnnotations) {
      const searchWord = ann.status === 'accepted' ? ann.suggestion : ann.original
      if (!searchWord) continue
      const m = flexFind(entry.text, searchWord)
      if (!m) continue
      const key = `${m.start}-${m.end}`
      if (used.has(key)) continue
      used.add(key)
      resolved.push({ ...ann, start: m.start, end: m.end })
    }

    resolved.sort((a, b) => a.start - b.start)

    const clean = []
    let lastEnd = 0
    for (const r of resolved) {
      if (r.start < lastEnd) continue
      clean.push(r)
      lastEnd = r.end
    }

    const parts = []
    let cursor = 0

    for (const ann of clean) {
      if (cursor < ann.start) {
        parts.push(<span key={`t-${cursor}`}>{entry.text.substring(cursor, ann.start)}</span>)
      }

      let cls = 'inline '
      if (ann.status === 'accepted') {
        cls += 'text-green-600 font-semibold'
      } else if (ann.severity === 'critical') {
        cls += 'border-b-2 border-error text-error font-semibold cursor-pointer'
      } else if (ann.severity === 'warning') {
        cls += 'border-b-2 border-amber-500 text-amber-700 cursor-pointer'
      } else {
        cls += 'border-b border-dotted border-on-surface-variant/40 cursor-pointer'
      }

      parts.push(
        <span
          key={`a-${ann.id}`}
          className={cls}
          title={ann.status === 'accepted' ? `Accepted: "${ann.original}" → "${ann.suggestion}"` : `${ann.type}: ${ann.explanation}`}
          onClick={ann.status === 'open' ? () => {
            const el = document.getElementById(`ann-card-${ann.id}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          } : undefined}
        >
          {entry.text.substring(ann.start, ann.end)}
        </span>
      )
      cursor = ann.end
    }

    if (cursor < entry.text.length) {
      parts.push(<span key={`t-${cursor}`}>{entry.text.substring(cursor)}</span>)
    }

    return <>{parts}</>
  }

  const severityIcon = (s) => ({
    critical: 'priority_high',
    warning: 'hearing',
    suggestion: 'lightbulb',
  }[s] || 'info')

  const severityLabelClass = (s) => ({
    critical: 'text-error',
    warning: 'text-amber-600',
    suggestion: 'text-primary',
  }[s] || 'text-on-surface-variant')

  const severityCardBorder = (s) => ({
    critical: 'border-l-4 border-error bg-error-container/30',
    warning: 'border-l-4 border-amber-500 bg-amber-50',
    suggestion: 'border-l-4 border-primary/30 bg-primary/5',
  }[s] || 'border-l-4 border-outline-variant bg-surface-container')

  const typeLabel = (t) => ({
    spelling: 'Spelling',
    context: 'Context',
    grammar: 'Grammar',
    legal_term: 'Legal Term',
    punctuation: 'Punctuation',
    capitalization: 'Capitalization',
    missing_word: 'Missing Word',
    extra_word: 'Extra Word',
  }[t] || t)

  const transcriptFile = caseData?.case_files?.find((f) => f.file_type === 'transcript')
  const audioFile = caseData?.case_files?.find((f) => f.file_type === 'audio')

  // ─── No case selected ───
  if (!caseId) {
    return (
      <main className="min-h-screen bg-background">
        <div className="px-8 lg:px-12 pt-8 pb-6 max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">edit_note</span>
                Transcript Review
              </p>
              <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">Editor</h1>
              <p className="font-body text-on-surface-variant mt-2 max-w-xl text-sm">
                Review AI-flagged issues, accept corrections, and finalize your transcript before export.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-start bg-surface border-t border-outline-variant/10">
          <div className="flex-1 flex flex-col items-center justify-center py-32 px-8">
            <div className="w-24 h-24 rounded-2xl bg-primary/5 flex items-center justify-center mb-8">
              <span className="material-symbols-outlined text-primary text-5xl">edit_document</span>
            </div>
            <h2 className="font-headline text-2xl font-bold text-on-surface mb-3 text-center">No transcript selected</h2>
            <p className="text-sm text-on-surface-variant max-w-md text-center leading-relaxed mb-8">
              Select a case from your dashboard to open it in the editor, or upload a new case to get started.
            </p>
            <div className="flex gap-3">
              <Link to="/dashboard" className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow">
                <span className="material-symbols-outlined text-base">dashboard</span>
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

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-on-surface-variant font-medium">Loading transcript...</p>
        </div>
      </main>
    )
  }

  if (error && !caseData) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-error text-3xl">error</span>
          </div>
          <h2 className="font-headline text-xl font-bold text-on-surface mb-2">Failed to load case</h2>
          <p className="text-sm text-on-surface-variant mb-6">{error}</p>
          <Link to="/dashboard" className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>
      </main>
    )
  }

  // ─── Editor view ───
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-8 lg:px-12 pt-8 pb-6 max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-primary">edit_note</span>
              Transcript Review
            </p>
            <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
              {caseData?.name || 'Editor'}
            </h1>
            <p className="font-body text-on-surface-variant mt-2 max-w-xl text-sm">
              Review AI-flagged issues, accept or ignore suggestions, and edit text directly. Save when you're done.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {hasChanges && (
              <button onClick={handleRevert} className="flex items-center gap-1.5 text-sm font-bold text-on-surface-variant hover:text-error transition-colors">
                <span className="material-symbols-outlined text-base">undo</span>
                Revert
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed editorial-shadow"
            >
              {saving ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
              ) : saved ? (
                <><span className="material-symbols-outlined text-base">check</span> Saved</>
              ) : (
                <><span className="material-symbols-outlined text-base">save</span> Save Changes</>
              )}
            </button>
          </div>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-3 mt-5">
          {transcriptFile && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest rounded-full text-xs font-bold text-on-surface-variant editorial-shadow border border-outline-variant/20">
              <span className="material-symbols-outlined text-primary text-sm">description</span>
              {transcriptFile.file_name}
            </span>
          )}
          {audioFile && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest rounded-full text-xs font-bold text-on-surface-variant editorial-shadow border border-outline-variant/20">
              <span className="material-symbols-outlined text-tertiary-fixed-dim text-sm">audio_file</span>
              {audioFile.file_name}
            </span>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest rounded-full text-xs font-bold text-on-surface-variant editorial-shadow border border-outline-variant/20">
            <span className="material-symbols-outlined text-primary text-sm">article</span>
            {entries.length} entries
          </span>
          {openAnnotations.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-error-container/40 rounded-full text-xs font-bold text-error editorial-shadow border border-error/20">
              <span className="material-symbols-outlined text-sm">warning</span>
              {openAnnotations.length} issue{openAnnotations.length !== 1 ? 's' : ''} found
            </span>
          )}
          {hasChanges && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full text-xs font-bold text-amber-700 editorial-shadow border border-amber-200">
              <span className="material-symbols-outlined text-sm">edit</span>
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-8 lg:mx-12 mb-4 p-4 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-start gap-2 max-w-6xl">
          <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
          {error}
        </div>
      )}

      {/* Editor + Sidebar */}
      <div className="flex items-start bg-surface border-t border-outline-variant/10">

        {/* Transcript Canvas */}
        <section className="flex-1 bg-surface-container-low px-6 lg:px-12 py-10 overflow-y-auto">
          {entries.length > 0 ? (() => {
            const allLines = []
            for (const entry of entries) {
              const hasAnns = annotationsByEntry[entry.id]?.length > 0
              if (entry.speaker) {
                const prevEntry = allLines.length > 0 ? allLines[allLines.length - 1] : null
                if (prevEntry && prevEntry.type !== 'speaker') {
                  allLines.push({ type: 'blank', entryId: entry.id })
                }
                allLines.push({ type: 'speaker', text: entry.speaker, entryId: entry.id })
              }

              if (hasAnns) {
                // Annotated entries render as ONE block to prevent duplication
                allLines.push({ type: 'annotated-block', text: entry.text, entryId: entry.id, entry })
              } else {
                const lines = entry.text.split('\n')
                for (const line of lines) {
                  const wrapped = wrapLine(line, 65)
                  for (const w of wrapped) {
                    allLines.push({ type: 'text', text: w, entryId: entry.id, entry })
                  }
                }
              }
            }

            const LINES_PER_PAGE = 25
            const pages = []
            for (let i = 0; i < allLines.length; i += LINES_PER_PAGE) {
              pages.push(allLines.slice(i, i + LINES_PER_PAGE))
            }

            return (
              <div className="space-y-8">
                {pages.map((page, pageIdx) => (
                  <div key={pageIdx} className="max-w-3xl mx-auto bg-surface-container-lowest shadow-sm relative">
                    <div className="flex items-center justify-between px-12 pt-6 pb-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{caseData?.name}</span>
                      <span className="text-xs text-on-surface-variant/50 font-mono">{pageIdx + 1}</span>
                    </div>
                    <div className="px-4 pb-8 pt-2">
                      {page.map((line, lineIdx) => {
                        const lineNum = lineIdx + 1
                        if (line.type === 'blank') {
                          return (
                            <div key={`${pageIdx}-${lineIdx}`} className="flex h-7">
                              <span className="w-12 shrink-0 text-right pr-4 text-xs text-on-surface-variant/40 font-mono leading-7 select-none">{lineNum}</span>
                              <div className="flex-1" />
                            </div>
                          )
                        }
                        if (line.type === 'speaker') {
                          return (
                            <div key={`${pageIdx}-${lineIdx}`} className="flex h-7 items-center">
                              <span className="w-12 shrink-0 text-right pr-4 text-xs text-on-surface-variant/40 font-mono leading-7 select-none">{lineNum}</span>
                              <input
                                type="text"
                                value={line.text}
                                onChange={(e) => updateEntrySpeaker(line.entryId, e.target.value)}
                                className={`${speakerColorMap[line.text] || 'bg-surface-container-highest text-on-surface-variant'} px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/30 transition-all border-none`}
                                style={{ width: Math.max(90, line.text.length * 10 + 24) + 'px' }}
                              />
                            </div>
                          )
                        }
                        if (line.type === 'annotated-block') {
                          return (
                            <div key={`${pageIdx}-${lineIdx}`} className="flex min-h-[1.75rem] group/line">
                              <span className="w-12 shrink-0 text-right pr-4 text-xs text-on-surface-variant/40 font-mono leading-7 select-none">{lineNum}</span>
                              <div className="flex-1 font-mono text-[13px] leading-7 text-on-surface" style={{ maxWidth: '42.25em' }}>
                                {renderHighlightedText(line.entry)}
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={`${pageIdx}-${lineIdx}`} className="flex min-h-[1.75rem] group/line">
                            <span className="w-12 shrink-0 text-right pr-4 text-xs text-on-surface-variant/40 font-mono leading-7 select-none">{lineNum}</span>
                            <div className="flex-1 font-mono text-[13px] leading-7 text-on-surface">
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                className="outline-none focus:bg-primary/[0.03] rounded px-0.5 -mx-0.5 transition-colors inline-block w-full whitespace-pre-wrap"
                                onBlur={(e) => {
                                  const currentLines = line.entry.text.split('\n')
                                  const wrappedIdx = (() => {
                                    let count = 0
                                    for (let li = 0; li < currentLines.length; li++) {
                                      const w = wrapLine(currentLines[li], 65)
                                      for (let wi = 0; wi < w.length; wi++) {
                                        if (w[wi] === line.text) return { li, wi, wLen: w.length }
                                        count++
                                      }
                                    }
                                    return null
                                  })()
                                  if (!wrappedIdx) return
                                  const newText = e.target.textContent || ''
                                  const lines = line.entry.text.split('\n')
                                  const wrapped = wrapLine(lines[wrappedIdx.li], 65)
                                  wrapped[wrappedIdx.wi] = newText
                                  lines[wrappedIdx.li] = wrapped.join(' ')
                                  updateEntryText(line.entry.id, lines.join('\n'))
                                }}
                              >
                                {line.text}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {pageIdx < pages.length - 1 && (
                      <div className="border-b border-dashed border-outline-variant/20" />
                    )}
                  </div>
                ))}
              </div>
            )
          })() : (
            <div className="max-w-3xl mx-auto bg-surface-container-lowest p-12 shadow-sm text-center py-16">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-4 block">article</span>
              <p className="text-sm text-on-surface-variant">No extracted transcript data found for this case.</p>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="w-80 shrink-0 bg-surface border-l border-outline-variant/15">

          {/* Legend */}
          <div className="px-5 pt-5 pb-4 border-b border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">How to read this transcript</p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 inline-block border-b-2 border-error text-error font-semibold text-[11px] font-mono px-1 mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-error">Critical error</span> — definite mistake found.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 inline-block border-b-2 border-amber-500 text-amber-700 text-[11px] font-mono px-1 mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-amber-600">Warning</span> — likely error, verify context.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 inline-block border-b border-dotted border-on-surface-variant/40 text-[11px] font-mono text-on-surface px-1 mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-primary">Suggestion</span> — possible style improvement.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 inline-block text-green-600 font-semibold text-[11px] font-mono px-1 mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-green-600">Accepted</span> — correction applied.</span>
              </div>
            </div>
          </div>

          {/* AI Insights header */}
          <div className="p-5 border-b border-outline-variant/10 bg-surface-container-low">
            <div className="flex items-center justify-between">
              <h2 className="font-headline font-bold text-on-surface flex items-center gap-2 text-base">
                <span className="material-symbols-outlined text-tertiary-fixed-dim">auto_awesome</span>
                AI Insights
              </h2>
              <span className="bg-primary text-on-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                {openAnnotations.length} OPEN
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Accept or ignore each suggestion below.</p>
          </div>

          {/* Annotation cards */}
          <div className="p-5 space-y-4">
            {openAnnotations.length === 0 && annotations.length > 0 && (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-4xl text-green-500 block mb-3">check_circle</span>
                <p className="font-bold text-on-surface mb-1">All Issues Resolved</p>
                <p className="text-xs text-on-surface-variant mb-4">Your transcript is ready. Save your changes and export.</p>
                <Link to={`/dashboard/export?case=${caseId}`} className="inline-block px-6 py-2 bg-primary text-on-primary rounded-md font-bold text-sm hover:bg-primary-container transition-colors">
                  Export Now
                </Link>
              </div>
            )}

            {openAnnotations.length === 0 && annotations.length === 0 && (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-4xl text-green-500 block mb-3">verified</span>
                <p className="font-bold text-on-surface mb-1">No Issues Found</p>
                <p className="text-xs text-on-surface-variant">AI analysis found no errors in this transcript.</p>
              </div>
            )}

            {openAnnotations.map((ann) => (
              <div key={ann.id} id={`ann-card-${ann.id}`} className={`relative p-4 rounded-lg ${severityCardBorder(ann.severity)}`}>
                <button
                  onClick={() => ignoreAnnotation(ann.id)}
                  className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-outline-variant/20 transition-colors text-xs leading-none"
                  title="Ignore this suggestion"
                >
                  &times;
                </button>
                <span className={`text-[10px] font-bold uppercase flex items-center gap-1 mb-2 ${severityLabelClass(ann.severity)}`}>
                  <span className="material-symbols-outlined text-xs">{severityIcon(ann.severity)}</span>
                  {typeLabel(ann.type)} &middot; {ann.severity}
                </span>
                <p className="text-sm font-medium mb-1">
                  Found <strong>&quot;{ann.original}&quot;</strong>
                </p>
                <p className="text-xs text-on-surface-variant mb-3">{ann.explanation}</p>
                {ann.confidence && (
                  <p className="text-[10px] text-on-surface-variant/60 mb-3">Confidence: {Math.round(ann.confidence * 100)}%</p>
                )}
                <button
                  onClick={() => acceptAnnotation(ann.id)}
                  className={`w-full text-xs font-bold py-2 rounded transition-colors ${
                    ann.severity === 'critical'
                      ? 'bg-on-error text-error border border-error/20 hover:bg-error-container'
                      : 'bg-surface-container-lowest text-on-surface hover:shadow-sm'
                  }`}
                >
                  Accept: &quot;{ann.suggestion}&quot;
                </button>
              </div>
            ))}
          </div>

          {/* Re-analyze */}
          <div className="px-5 py-4 border-t border-outline-variant/10">
            <button
              onClick={handleReanalyze}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Analyzing...</>
              ) : (
                <><span className="material-symbols-outlined text-base">auto_awesome</span> Re-analyze with AI</>
              )}
            </button>
          </div>

          {/* Case details */}
          <div className="px-5 py-4 border-t border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Case Details</p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Status</span>
                <span className="font-semibold text-on-surface capitalize">{caseData?.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Uploaded</span>
                <span className="font-semibold text-on-surface">
                  {caseData?.created_at && new Date(caseData.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Transcript</span>
                <span className="font-semibold text-on-surface truncate max-w-[140px]">{transcriptFile?.file_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Audio</span>
                <span className="font-semibold text-on-surface truncate max-w-[140px]">{audioFile?.file_name || '—'}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 pt-4 border-t border-outline-variant/10 space-y-3">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base">save</span>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              to={`/dashboard/export?case=${caseId}`}
              className="w-full flex items-center justify-center gap-2 border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-base">cloud_download</span>
              Export This Case
            </Link>
            <Link
              to="/dashboard"
              className="w-full flex items-center justify-center gap-2 text-on-surface-variant text-sm font-medium hover:text-primary transition-colors py-2"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to Dashboard
            </Link>
          </div>
        </aside>
      </div>
    </main>
  )
}
