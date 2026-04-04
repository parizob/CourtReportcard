import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { proofreadTranscript, fixAnnotationPositions } from '../../lib/gemini'

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
        const loadedEntries = parsed.entries || []
        const fixedAnnotations = fixAnnotationPositions(loadedEntries, parsed.annotations || [])
        setTitle(parsed.title || '')
        setEntries(loadedEntries)
        setAnnotations(fixedAnnotations)
        setOriginalSnapshot(JSON.stringify({
          entries: loadedEntries,
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

  const acceptAnnotation = useCallback((annotationId) => {
    const ann = annotations.find((a) => a.id === annotationId)
    if (!ann || ann.status !== 'open') return

    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== ann.entry_id) return e
        // Find the original text dynamically rather than trusting stored positions
        let realStart = e.text.indexOf(ann.original)
        if (realStart === -1) realStart = e.text.toLowerCase().indexOf(ann.original.toLowerCase())
        if (realStart === -1) {
          // Fallback to stored positions
          realStart = ann.start
        }
        const realEnd = realStart + ann.original.length
        const before = e.text.substring(0, realStart)
        const after = e.text.substring(realEnd)
        return { ...e, text: before + ann.suggestion + after }
      })
    )

    setAnnotations((prev) => {
      const updated = prev.map((a) => {
        if (a.id === annotationId) return { ...a, status: 'accepted' }
        return a
      })
      // Re-fix positions for remaining open annotations in the same entry
      const entry = entries.find((e) => e.id === ann.entry_id)
      if (!entry) return updated
      const newText = (() => {
        let realStart = entry.text.indexOf(ann.original)
        if (realStart === -1) realStart = entry.text.toLowerCase().indexOf(ann.original.toLowerCase())
        if (realStart === -1) realStart = ann.start
        const realEnd = realStart + ann.original.length
        return entry.text.substring(0, realStart) + ann.suggestion + entry.text.substring(realEnd)
      })()
      return fixAnnotationPositions(
        entries.map((e) => (e.id === ann.entry_id ? { ...e, text: newText } : e)),
        updated
      )
    })
    setSaved(false)
  }, [annotations, entries])

  const ignoreAnnotation = useCallback((annotationId) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === annotationId ? { ...a, status: 'ignored' } : a))
    )
    setSaved(false)
  }, [])

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
        .update(extractedFilePath, blob, { upsert: true })
      if (uploadErr) throw uploadErr

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
    for (const a of annotations) {
      if (a.status !== 'open') continue
      if (!map[a.entry_id]) map[a.entry_id] = []
      map[a.entry_id].push(a)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.start - b.start)
    }
    return map
  }, [annotations])

  const renderHighlightedText = (entry) => {
    const entryAnnotations = annotationsByEntry[entry.id]
    if (!entryAnnotations || entryAnnotations.length === 0) {
      return <span>{entry.text}</span>
    }

    // Build resolved positions by searching for `original` in the text
    const resolved = []
    const used = new Set()
    for (const ann of entryAnnotations) {
      if (!ann.original) continue
      let idx = -1
      let searchFrom = 0
      // Find an occurrence that hasn't been claimed by another annotation
      while (true) {
        idx = entry.text.indexOf(ann.original, searchFrom)
        if (idx === -1) {
          idx = entry.text.toLowerCase().indexOf(ann.original.toLowerCase(), searchFrom)
        }
        if (idx === -1) break
        const key = `${idx}-${idx + ann.original.length}`
        if (!used.has(key)) {
          used.add(key)
          break
        }
        searchFrom = idx + 1
      }
      if (idx === -1) continue
      resolved.push({ ...ann, start: idx, end: idx + ann.original.length })
    }

    resolved.sort((a, b) => a.start - b.start)

    // Remove overlapping ranges (keep the first)
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

      let cls = 'inline cursor-pointer '
      if (ann.severity === 'critical') {
        cls += 'border-b-2 border-error text-error font-semibold'
      } else if (ann.severity === 'warning') {
        cls += 'border-b-2 border-tertiary-fixed-dim'
      } else {
        cls += 'border-b border-dotted border-on-surface-variant/40'
      }

      parts.push(
        <span
          key={`a-${ann.id}`}
          className={cls}
          title={`${ann.type}: ${ann.explanation}`}
          onClick={() => {
            const el = document.getElementById(`ann-card-${ann.id}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
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
    warning: 'text-on-tertiary-container',
    suggestion: 'text-primary',
  }[s] || 'text-on-surface-variant')

  const severityCardBorder = (s) => ({
    critical: 'border-l-4 border-error bg-error-container/30',
    warning: 'border-l-4 border-tertiary-fixed-dim bg-surface-container',
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
        <section className="flex-1 bg-surface-container-low px-12 py-10">
          <div className="max-w-3xl mx-auto bg-surface-container-lowest p-12 shadow-sm">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline-variant/10">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{caseData?.name}</span>
              <span className="text-xs text-on-surface-variant/60 font-mono">{entries.length} entries</span>
            </div>

            {entries.length > 0 ? (
              <div className="space-y-8 font-mono text-[15px] leading-relaxed text-on-surface">
                {entries.map((entry) => {
                  const hasOpenAnnotations = annotationsByEntry[entry.id]?.length > 0
                  return (
                    <div key={entry.id} className="group">
                      {entry.speaker && (
                        <div className="flex items-baseline justify-between mb-2">
                          <input
                            type="text"
                            value={entry.speaker}
                            onChange={(e) => updateEntrySpeaker(entry.id, e.target.value)}
                            className={`${speakerColorMap[entry.speaker] || 'bg-surface-container-highest text-on-surface-variant'} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/30 transition-all bg-transparent border-none`}
                            style={{ width: Math.max(80, entry.speaker.length * 9) + 'px' }}
                          />
                          {entry.timestamp && (
                            <span className="text-[10px] text-on-surface-variant/60">{entry.timestamp}</span>
                          )}
                        </div>
                      )}
                      <div className="pl-2 border-l-2 border-transparent hover:border-primary-fixed transition-colors">
                        {hasOpenAnnotations ? (
                          <p className="leading-relaxed">{renderHighlightedText(entry)}</p>
                        ) : (
                          <textarea
                            value={entry.text}
                            onChange={(e) => updateEntryText(entry.id, e.target.value)}
                            className="w-full bg-transparent outline-none resize-none font-mono text-[15px] leading-relaxed text-on-surface focus:bg-primary/[0.03] rounded px-1 -mx-1 transition-colors"
                            rows={Math.max(1, Math.ceil(entry.text.length / 80))}
                            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-4 block">article</span>
                <p className="text-sm text-on-surface-variant">No extracted transcript data found for this case.</p>
              </div>
            )}
          </div>
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
                <span className="shrink-0 inline-block border-b-2 border-tertiary-fixed-dim text-[11px] font-mono text-on-surface px-1 mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-on-tertiary-container">Warning</span> — likely error, verify context.</span>
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
