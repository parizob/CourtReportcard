import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { proofreadTranscript, fixAnnotationPositions, deduplicateTranscript, flexFind, applyCorrection, applyCorrectionDetailed, buildCleanContentMap } from '../../lib/gemini'
import { countPages } from '../../lib/pageCount'
import { countByType } from '../../lib/annotationStats'
import Tooltip from '../../components/Tooltip'

export default function DashboardEditor() {
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case')
  const { tokenBalance, spendTokens, refreshTokens } = useAuth()

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
  const [originalText, setOriginalText] = useState(null)
  const [showReanalyzeConfirm, setShowReanalyzeConfirm] = useState(false)
  const [customTexts, setCustomTexts] = useState({})
  const [inlinePopover, setInlinePopover] = useState(null) // { id, top, left, placeAbove }
  const [legendOpen, setLegendOpen] = useState(false)

  const entriesRef = useRef(entries)
  const annotationsRef = useRef(annotations)
  const originalTextRef = useRef(originalText)
  useEffect(() => { entriesRef.current = entries }, [entries])
  useEffect(() => { annotationsRef.current = annotations }, [annotations])
  useEffect(() => { originalTextRef.current = originalText }, [originalText])

  // Dismiss inline popover on escape, scroll, or window resize
  useEffect(() => {
    if (!inlinePopover) return
    const close = () => setInlinePopover(null)
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [inlinePopover])

  const currentSnapshot = useMemo(
    () => JSON.stringify({ entries, annotations, originalText }),
    [entries, annotations, originalText]
  )
  const hasChanges = currentSnapshot !== originalSnapshot

  const sortedAnnotations = useMemo(() => {
    const entryIndexMap = new Map(entries.map((e, i) => [e.id, i]))
    return (anns) => anns
      .map((a) => ({ a, ei: entryIndexMap.get(a.entry_id) ?? Infinity, s: a.start ?? 0 }))
      .sort((x, y) => x.ei !== y.ei ? x.ei - y.ei : x.s - y.s)
      .map(({ a }) => a)
  }, [entries])

  const openAnnotations = useMemo(
    () => sortedAnnotations(annotations.filter((a) => a.status === 'open')),
    [annotations, sortedAnnotations]
  )

  const resolvedAnnotations = useMemo(
    () => sortedAnnotations(annotations.filter((a) => a.status === 'accepted' || a.status === 'ignored')),
    [annotations, sortedAnnotations]
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
        setOriginalText(parsed.originalText || null)
        setOriginalSnapshot(JSON.stringify({
          entries: dedupedEntries,
          annotations: fixedAnnotations,
          originalText: parsed.originalText || null,
        }))

        // Sync metrics from annotation file on load so dashboard always reflects reality
        const accepted = fixedAnnotations.filter((a) => a.status === 'accepted').length
        const ignored = fixedAnnotations.filter((a) => a.status === 'ignored').length
        const open = fixedAnnotations.filter((a) => a.status === 'open').length
        const custom_changed = fixedAnnotations.filter((a) => a.status === 'accepted' && a._originalSuggestion !== undefined && a.suggestion !== a._originalSuggestion).length
        const total = fixedAnnotations.length
        supabase.from('case_metrics').upsert({
          case_id: caseId,
          total_entries: dedupedEntries.length,
          total_issues: total,
          accepted,
          ignored,
          open,
          custom_changed,
          last_reviewed_at: new Date().toISOString(),
        }, { onConflict: 'case_id' }).then(({ error }) => {
          if (error) console.error('case_metrics sync failed (editor load):', error.message)
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

  const updateEntryText = useCallback((id, newText) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, text: newText } : e)))
    setSaved(false)
  }, [])

  const updateEntrySpeaker = useCallback((id, newSpeaker) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, speaker: newSpeaker } : e)))
    setSaved(false)
  }, [])

  const syncTimerRef = useRef(null)

  const debouncedSync = useCallback(() => {
    clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(async () => {
      const latestAnnotations = annotationsRef.current
      const latestEntries = entriesRef.current
      const latestOriginalText = originalTextRef.current

      if (!caseId || !extractedFilePath) return

      const accepted = latestAnnotations.filter((a) => a.status === 'accepted').length
      const ignored = latestAnnotations.filter((a) => a.status === 'ignored').length
      const open = latestAnnotations.filter((a) => a.status === 'open').length
      const custom_changed = latestAnnotations.filter((a) => a.status === 'accepted' && a._originalSuggestion !== undefined && a.suggestion !== a._originalSuggestion).length
      const total = latestAnnotations.length

      const { error: upsertError } = await supabase.from('case_metrics').upsert({
        case_id: caseId,
        total_entries: latestEntries.length,
        total_issues: total,
        accepted,
        ignored,
        open,
        custom_changed,
        annotations_by_type: countByType(latestAnnotations),
        last_reviewed_at: new Date().toISOString(),
      }, { onConflict: 'case_id' })
      if (upsertError) console.error('case_metrics save failed:', upsertError.message)

      if (total > 0 && open === 0) {
        await supabase.from('cases').update({ status: 'reviewed' }).eq('id', caseId)
      }

      try {
        const payload = {
          title,
          extracted_at: new Date().toISOString(),
          entries: latestEntries,
          annotations: latestAnnotations,
        }
        if (latestOriginalText) payload.originalText = latestOriginalText

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const { error: upErr } = await supabase.storage
          .from('case-files')
          .upload(extractedFilePath, blob, { upsert: true })
        if (upErr) console.error('Persist JSON storage error:', upErr)
        else setOriginalSnapshot(JSON.stringify({ entries: latestEntries, annotations: latestAnnotations, originalText: latestOriginalText }))
      } catch (err) {
        console.error('Persist JSON failed:', err)
      }
    }, 600)
  }, [caseId, extractedFilePath, title])

  useEffect(() => () => clearTimeout(syncTimerRef.current), [])

  const acceptAnnotation = useCallback((annotationId, customSuggestion) => {
    const curAnnotations = annotationsRef.current
    const curEntries = entriesRef.current
    const curOriginalText = originalTextRef.current

    const ann = curAnnotations.find((a) => a.id === annotationId)
    if (!ann || ann.status !== 'open') return

    const finalSuggestion = customSuggestion ?? ann.suggestion

    // Track exactly where in the entry text the replacement was made so
    // reopenAnnotation can revert it without searching (which finds wrong matches).
    let appliedEntryId = null
    let appliedAt = null
    let appliedEnd = null
    let appliedMatchedText = null

    const newEntries = curEntries.map((e) => {
      if (e.id !== ann.entry_id) return e
      const m = flexFind(e.text, ann.original)
      if (!m) return e
      appliedEntryId = e.id
      appliedAt = m.start
      appliedEnd = m.start + finalSuggestion.length
      appliedMatchedText = e.text.substring(m.start, m.end)
      return { ...e, text: e.text.substring(0, m.start) + finalSuggestion + e.text.substring(m.end) }
    })

    let updatedOriginalText = curOriginalText
    // Cache the clean-content position of this annotation BEFORE applying the
    // correction, while the original word still exists at its unique location.
    // This prevents the highlights builder from latching onto the wrong occurrence
    // of the same word elsewhere in the document after acceptance.
    let _cleanStart = null
    let _cleanEnd = null
    // Track exactly where in originalText the replacement landed so
    // reopenAnnotation can revert it by splicing back the exact matched
    // text, without re-searching (which can match the wrong occurrence of
    // a common word, or fail to restore a line-break-spanning correction).
    let _appliedOriginalStart = null
    let _appliedOriginalEnd = null
    let _appliedOriginalMatchedText = null
    if (curOriginalText) {
      const { cleanContent: cc } = buildCleanContentMap(curOriginalText)
      // Use the entry text as a location anchor to find the right occurrence.
      const annotationEntry = curEntries.find((e) => e.id === ann.entry_id)
      let searchFrom = 0
      if (annotationEntry) {
        const anchor = annotationEntry.text.trim().substring(0, 50)
        if (anchor) {
          const em = flexFind(cc, anchor)
          if (em) searchFrom = em.start
        }
      }
      const wordM = flexFind(cc.substring(searchFrom), ann.original)
      if (wordM) {
        _cleanStart = searchFrom + wordM.start
        _cleanEnd = _cleanStart + finalSuggestion.length
      }
      const detail = applyCorrectionDetailed(curOriginalText, ann.original, finalSuggestion)
      updatedOriginalText = detail.text
      if (detail.start !== -1) {
        _appliedOriginalStart = detail.start
        _appliedOriginalEnd = detail.end
        _appliedOriginalMatchedText = detail.matchedText
      }

      // Recompute _cleanEnd from the post-acceptance clean content. For
      // cross-line annotations the cleanContent span includes newlines
      // (one per blank line between transcript lines), making it longer
      // than finalSuggestion.length. Without this, the green highlight
      // gets truncated at the line break.
      if (_cleanStart !== null) {
        const { cleanContent: postCc } = buildCleanContentMap(updatedOriginalText)
        const postM = flexFind(postCc.substring(_cleanStart), finalSuggestion)
        if (postM) _cleanEnd = _cleanStart + postM.end
      }
    }

    const updatedAnnotations = curAnnotations.map((a) =>
      a.id === annotationId
        ? { ...a, status: 'accepted', suggestion: finalSuggestion, _originalSuggestion: a._originalSuggestion ?? a.suggestion, _appliedEntryId: appliedEntryId, _appliedAt: appliedAt, _appliedEnd: appliedEnd, _appliedMatchedText: appliedMatchedText, _cleanStart, _cleanEnd, _appliedOriginalStart, _appliedOriginalEnd, _appliedOriginalMatchedText }
        : a
    )
    const fixedAnnotations = fixAnnotationPositions(newEntries, updatedAnnotations)

    entriesRef.current = newEntries
    annotationsRef.current = fixedAnnotations
    originalTextRef.current = updatedOriginalText

    setEntries(newEntries)
    setAnnotations(fixedAnnotations)
    if (curOriginalText) setOriginalText(updatedOriginalText)
    setSaved(false)
    setInlinePopover(null)

    debouncedSync()
  }, [debouncedSync])

  const ignoreAnnotation = useCallback((annotationId) => {
    const curAnnotations = annotationsRef.current

    const updated = curAnnotations.map((a) => (a.id === annotationId ? { ...a, status: 'ignored' } : a))

    annotationsRef.current = updated
    setAnnotations(updated)
    setInlinePopover(null)
    setSaved(false)

    debouncedSync()
  }, [debouncedSync])

  const reopenAnnotation = useCallback((annotationId) => {
    const curAnnotations = annotationsRef.current
    const ann = curAnnotations.find((a) => a.id === annotationId)
    if (!ann || ann.status === 'open') return

    let curEntries = entriesRef.current

    // If previously accepted, revert both entries and originalText.
    if (ann.status === 'accepted') {
      // Revert entries using the exact stored position to avoid flexFind matching the wrong word.
      if (ann._appliedAt != null && ann._appliedEntryId != null) {
        curEntries = curEntries.map((e) => {
          if (e.id !== ann._appliedEntryId) return e
          const before = e.text.substring(0, ann._appliedAt)
          const after  = e.text.substring(ann._appliedEnd)
          return { ...e, text: before + (ann._appliedMatchedText ?? ann.original) + after }
        })
        entriesRef.current = curEntries
        setEntries(curEntries)
      }

      // Revert originalText — acceptAnnotation applied the correction here too.
      const curOriginalText = originalTextRef.current
      if (curOriginalText) {
        let reverted = curOriginalText
        if (ann._appliedOriginalStart != null && ann._appliedOriginalMatchedText != null) {
          // Splice back the exact text that was replaced — avoids flexFind
          // matching the wrong occurrence of `suggestion` elsewhere in the
          // document and correctly restores line-break-spanning corrections.
          reverted = curOriginalText.substring(0, ann._appliedOriginalStart) +
            ann._appliedOriginalMatchedText +
            curOriginalText.substring(ann._appliedOriginalEnd)
        } else if (ann.suggestion) {
          reverted = applyCorrection(curOriginalText, ann.suggestion, ann.original)
        }
        originalTextRef.current = reverted
        setOriginalText(reverted)
      }
    }

    const updated = curAnnotations.map((a) =>
      a.id === annotationId
        ? {
            ...a,
            status: 'open',
            // Restore the original AI suggestion so the Accept button doesn't
            // show the user's previous custom correction on reopen.
            suggestion: a._originalSuggestion ?? a.suggestion,
            _originalSuggestion: undefined,
            _appliedEntryId: undefined,
            _appliedAt: undefined,
            _appliedEnd: undefined,
            _appliedMatchedText: undefined,
            _cleanStart: undefined,
            _cleanEnd: undefined,
            _appliedOriginalStart: undefined,
            _appliedOriginalEnd: undefined,
            _appliedOriginalMatchedText: undefined,
          }
        : a
    )
    annotationsRef.current = updated
    setAnnotations(updated)
    setInlinePopover(null)
    setSaved(false)

    debouncedSync()
  }, [debouncedSync])

  const handleReanalyzeClick = () => {
    setShowReanalyzeConfirm(true)
  }

  const reanalyzePages = useMemo(() => {
    if (originalText) return countPages(originalText)
    if (entries.length > 0) return Math.max(1, Math.ceil(entries.length / 25))
    return 1
  }, [originalText, entries])

  // Re-analyze runs as a single, non-chunked proofread call (see api/gemini.js's
  // maxDuration: 300s). At the measured ~2.76s/page proofread rate that's a hard
  // ceiling around 108 pages — this cap leaves real margin below it. Unlike the
  // initial upload/extraction pipeline, Re-analyze isn't chunked yet, so large
  // transcripts are blocked here rather than left to time out.
  const REANALYZE_MAX_PAGES = 75
  const reanalyzeTooLarge = reanalyzePages > REANALYZE_MAX_PAGES

  const handleReanalyzeConfirm = async () => {
    setShowReanalyzeConfirm(false)
    const ok = await spendTokens(reanalyzePages)
    if (!ok) {
      setError('Insufficient tokens. Purchase more in Plans & Billing.')
      return
    }
    setAnalyzing(true)
    setError('')
    try {
      const freshAnnotations = await proofreadTranscript(entries)
      setAnnotations(freshAnnotations)
      setSaved(false)
      refreshTokens()
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
      const payload = { title, extracted_at: new Date().toISOString(), entries, annotations }
      if (originalText) payload.originalText = originalText
      const updatedJson = JSON.stringify(payload, null, 2)
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
        custom_changed: annotations.filter((a) => a.status === 'accepted' && a._originalSuggestion !== undefined && a.suggestion !== a._originalSuggestion).length,
        annotations_by_type: countByType(annotations),
        last_reviewed_at: new Date().toISOString(),
      }, { onConflict: 'case_id' })

      setOriginalSnapshot(JSON.stringify({ entries, annotations, originalText }))
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
    entriesRef.current = snap.entries
    annotationsRef.current = snap.annotations
    originalTextRef.current = snap.originalText ?? null
    setEntries(snap.entries)
    setAnnotations(snap.annotations)
    if (snap.originalText !== undefined) setOriginalText(snap.originalText)
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
      <main className="h-[calc(100vh-65px)] overflow-hidden bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-sm flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-3xl">edit_document</span>
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface mb-1">No transcript selected</h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Select a case from your dashboard to open it in the editor, or upload a new one to get started.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/dashboard" className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all">
              <span className="material-symbols-outlined text-base">dashboard</span>
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

  if (loading) {
    return (
      <main className="h-[calc(100vh-65px)] bg-background flex items-center justify-center">
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
      <main className="h-[calc(100vh-65px)] bg-background flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center gap-5 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-3xl">error</span>
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface mb-1">Failed to load case</h2>
            <p className="text-sm text-on-surface-variant">{error}</p>
          </div>
          <Link to="/dashboard" className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all">
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
              Review flagged issues, accept or ignore suggestions, and edit text directly. Save when you're done.
            </p>
          </div>
          <div className="flex flex-col items-end gap-4 shrink-0">
            <div className="flex items-center gap-3">
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

            {/* Types of Suggestions popover */}
            <div className="relative">
              <button
                onClick={() => setLegendOpen((o) => !o)}
                className="flex items-center gap-1 text-sm text-on-surface-variant/70 hover:text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-sm">help_outline</span>
                Types of Suggestions
                <span className="material-symbols-outlined text-sm">{legendOpen ? 'expand_less' : 'expand_more'}</span>
              </button>

              {legendOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLegendOpen(false)} />
                  <div className="absolute right-0 top-full mt-3 z-50 w-80 bg-surface-container-lowest border border-outline-variant/25 rounded-xl editorial-shadow">
                    <div className="absolute -top-2 right-4 w-4 h-4 bg-surface-container-lowest border-l border-t border-outline-variant/25 rotate-45" />
                    <div className="p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">How to read this transcript</p>

                      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1.5">Suggestions</p>
                      <table className="w-full text-xs border-collapse mb-4">
                        <tbody className="divide-y divide-outline-variant/10">
                          <tr>
                            <td className="py-2 pr-3 w-14">
                              <span className="inline-block border-b-2 border-error text-error font-semibold text-[11px] font-mono px-1">word</span>
                            </td>
                            <td className="py-2 text-on-surface-variant"><span className="font-semibold text-error">Critical error</span> — definite mistake found.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-3">
                              <span className="inline-block border-b-2 border-amber-500 text-amber-700 text-[11px] font-mono px-1">word</span>
                            </td>
                            <td className="py-2 text-on-surface-variant"><span className="font-semibold text-amber-600">Warning</span> — likely error, verify context.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-3">
                              <span className="inline-block border-b border-dotted border-on-surface-variant/40 text-[11px] font-mono text-on-surface px-1">word</span>
                            </td>
                            <td className="py-2 text-on-surface-variant"><span className="font-semibold text-primary">Suggestion</span> — possible style improvement.</td>
                          </tr>
                        </tbody>
                      </table>

                      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1.5">Results</p>
                      <table className="w-full text-xs border-collapse">
                        <tbody className="divide-y divide-outline-variant/10">
                          <tr>
                            <td className="py-2 pr-3 w-14">
                              <span className="inline-block text-green-600 font-semibold text-[11px] font-mono px-1">word</span>
                            </td>
                            <td className="py-2 text-on-surface-variant"><span className="font-semibold text-green-600">Accepted</span> — suggestion applied as-is.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-3">
                              <span className="inline-block text-green-600 font-semibold text-[11px] font-mono px-1">word</span>
                            </td>
                            <td className="py-2 text-on-surface-variant"><span className="font-semibold text-green-600">User changed</span> — your own correction applied.</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-3">
                              <span className="inline-block border-b border-dashed border-on-surface-variant/30 text-on-surface/60 text-[11px] font-mono px-1">word</span>
                            </td>
                            <td className="py-2 text-on-surface-variant"><span className="font-semibold text-on-surface-variant">Ignored</span> — reviewed, kept as-is.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
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
          {openAnnotations.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full text-xs font-bold text-amber-700 editorial-shadow border border-amber-200">
              <span className="material-symbols-outlined text-sm">rate_review</span>
              {openAnnotations.length} suggestion{openAnnotations.length !== 1 ? 's' : ''} to review
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
          {originalText ? (() => {
            // ─── Original-text rendering (preserves exact formatting) ───
            // Build clean content (line numbers stripped) for annotation searching
            const { cleanContent, parsedLines } = buildCleanContentMap(originalText)

            const allOpenAnnotations = annotations.filter((a) => a.status === 'open' || a.status === 'accepted' || a.status === 'ignored')

            // Find highlights by searching in cleanContent (which matches Gemini's extracted text).
            // For accepted annotations, prefer the cached clean-content position stored at accept
            // time — this avoids matching the first occurrence of the accepted word in the document
            // when the same word already exists elsewhere (e.g. "Plaintiff" on page 1 vs the
            // corrected "plaintiff" → "Plaintiff" on page 6).
            const highlights = []
            for (const ann of allOpenAnnotations) {
              if (ann.status === 'accepted' && ann._cleanStart != null) {
                highlights.push({ ...ann, cleanStart: ann._cleanStart, cleanEnd: ann._cleanEnd })
                continue
              }
              const searchWord = ann.status === 'accepted' ? ann.suggestion : ann.original
              if (!searchWord) continue
              const m = flexFind(cleanContent, searchWord)
              if (!m) continue
              highlights.push({ ...ann, cleanStart: m.start, cleanEnd: m.end })
            }
            highlights.sort((a, b) => a.cleanStart - b.cleanStart)
            const cleanHighlights = []
            let lastCleanEnd = 0
            for (const h of highlights) {
              if (h.cleanStart < lastCleanEnd) continue
              cleanHighlights.push(h)
              lastCleanEnd = h.cleanEnd
            }

            // Group lines into pages — prefer actual page-break markers from the file
            // Court reporter software right-justifies page numbers with 30+ leading spaces
            const pageBreakPattern = /^\s{30,}\d{1,4}\s*$/
            const pageBreakIndices = parsedLines.reduce((acc, pl, i) => {
              if (pageBreakPattern.test(pl.fullLine)) acc.push(i)
              return acc
            }, [])

            let pages
            if (pageBreakIndices.length > 1) {
              pages = pageBreakIndices.map((start, p) => {
                const end = p + 1 < pageBreakIndices.length ? pageBreakIndices[p + 1] : parsedLines.length
                const pageNum = parsedLines[start].fullLine.trim()
                return parsedLines.slice(start, end).map((pl, j) => ({ ...pl, lineIdx: start + j, pageNum }))
              })
            } else {
              const LINES_PER_PAGE = 28
              pages = []
              for (let i = 0; i < parsedLines.length; i += LINES_PER_PAGE) {
                pages.push(parsedLines.slice(i, i + LINES_PER_PAGE).map((pl, j) => ({ ...pl, lineIdx: i + j })))
              }
            }

            const renderOriginalLine = (pl, lineKey) => {
              const { prefix, content, fullLine, cleanStart, cleanEnd } = pl

              // Never highlight page-break lines (e.g. "                5") — they
              // can fall inside a cross-page-break match range but have no real text.
              const isPageBreakLine = /^\s*\d{1,4}\s*$/.test(content)
              if (isPageBreakLine) {
                return (
                  <div key={lineKey} className="min-h-[1.5rem]">
                    <span className="whitespace-pre">{fullLine}</span>
                  </div>
                )
              }

              // Find highlights overlapping this line's clean content
              const lineHighlights = cleanHighlights
                .filter((h) => h.cleanStart < cleanEnd && h.cleanEnd > cleanStart)
                .map((h) => ({
                  ...h,
                  localStart: Math.max(0, h.cleanStart - cleanStart),
                  localEnd: Math.min(content.length, h.cleanEnd - cleanStart),
                }))
                .filter((h) => h.localStart < h.localEnd)

              if (lineHighlights.length === 0) {
                return (
                  <div key={lineKey} className="min-h-[1.5rem]">
                    <span className="whitespace-pre-wrap">{fullLine}</span>
                  </div>
                )
              }

              // Render prefix (line number) as plain text, content with highlights
              const parts = []
              if (prefix) {
                parts.push(<span key="pfx" className="whitespace-pre">{prefix}</span>)
              }

              lineHighlights.sort((a, b) => a.localStart - b.localStart)
              let cursor = 0

              for (const h of lineHighlights) {
                if (cursor < h.localStart) {
                  parts.push(<span key={`t-${cursor}`} className="whitespace-pre-wrap">{content.substring(cursor, h.localStart)}</span>)
                }

                let cls = 'inline whitespace-pre-wrap '
                if (h.status === 'accepted') {
                  cls += 'text-green-600 font-semibold cursor-pointer'
                } else if (h.status === 'ignored') {
                  cls += 'border-b border-dashed border-on-surface-variant/30 text-on-surface/60 cursor-pointer'
                } else if (h.severity === 'critical') {
                  cls += 'border-b-2 border-error text-error font-semibold cursor-pointer'
                } else if (h.severity === 'warning') {
                  cls += 'border-b-2 border-amber-500 text-amber-700 cursor-pointer'
                } else {
                  cls += 'border-b border-dotted border-on-surface-variant/40 cursor-pointer'
                }

                const openPopover = (e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  const POPOVER_W = 320
                  const POPOVER_H = 180
                  const margin = 12
                  const spaceBelow = window.innerHeight - rect.bottom
                  const placeAbove = spaceBelow < POPOVER_H + margin && rect.top > POPOVER_H + margin
                  const top = placeAbove ? rect.top - POPOVER_H - 8 : rect.bottom + 8
                  let left = rect.left + rect.width / 2 - POPOVER_W / 2
                  left = Math.max(margin, Math.min(left, window.innerWidth - POPOVER_W - margin))
                  setInlinePopover({ id: h.id, top, left, placeAbove })
                }

                parts.push(
                  <span
                    key={`a-${h.id}-${h.localStart}`}
                    id={`ann-highlight-${h.id}`}
                    className={cls}
                    title={h.status === 'accepted' ? `Accepted: "${h.original}" → "${h.suggestion}"` : h.status === 'ignored' ? `Ignored: "${h.original}"` : `${h.type}: ${h.explanation}`}
                    onClick={openPopover}
                  >
                    {content.substring(h.localStart, h.localEnd)}
                  </span>
                )
                cursor = h.localEnd
              }

              if (cursor < content.length) {
                parts.push(<span key={`t-${cursor}`} className="whitespace-pre-wrap">{content.substring(cursor)}</span>)
              }

              return (
                <div key={lineKey} className="min-h-[1.5rem]">
                  {parts}
                </div>
              )
            }

            return (
              <div className="space-y-8">
                {pages.map((page, pageIdx) => (
                  <div key={pageIdx} className="max-w-4xl mx-auto bg-surface-container-lowest shadow-sm relative">
                    <div className="flex items-center justify-between px-8 pt-4 pb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{caseData?.name}</span>
                      <span className="text-xs text-on-surface-variant/50 font-mono">{page[0]?.pageNum ?? pageIdx + 1}</span>
                    </div>
                    <div className="px-8 pb-6 pt-1 font-mono text-[13px] leading-[1.5rem] text-on-surface">
                      {page.map((pl) => renderOriginalLine(pl, `${pageIdx}-${pl.lineIdx}`))}
                    </div>
                    {pageIdx < pages.length - 1 && (
                      <div className="border-b border-dashed border-outline-variant/20" />
                    )}
                  </div>
                ))}
              </div>
            )
          })() : entries.length > 0 ? (() => {
            // ─── Entry-based rendering (fallback for RTF/PDF/older cases) ───
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
        <aside className="w-80 shrink-0 bg-surface border-l border-outline-variant/15 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">

          {/* Insights header */}
          <div className="p-5 border-b border-outline-variant/10 bg-surface-container-low">
            <div className="flex items-center justify-between">
              <h2 className="font-headline font-bold text-on-surface flex items-center gap-2 text-base">
                <span className="material-symbols-outlined text-tertiary-fixed-dim">auto_awesome</span>
                Insights
              </h2>
              <span className="bg-primary text-on-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                {openAnnotations.length} TO REVIEW
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
                <p className="text-xs text-on-surface-variant">No errors found in this transcript.</p>
              </div>
            )}

            {openAnnotations.map((ann) => (
              <div key={ann.id} id={`ann-card-${ann.id}`} className={`relative p-4 rounded-lg ${severityCardBorder(ann.severity)}`}>
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <Tooltip text="Jump to in transcript" placement="left">
                    <button
                      onClick={() => {
                        const el = document.getElementById(`ann-highlight-${ann.id}`)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded-full text-on-surface-variant/40 hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">my_location</span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Ignore suggestion" placement="left">
                    <button
                      onClick={() => ignoreAnnotation(ann.id)}
                      className="w-5 h-5 flex items-center justify-center rounded-full text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-outline-variant/20 transition-colors text-xs leading-none"
                    >
                      &times;
                    </button>
                  </Tooltip>
                </div>
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
                <div className="mt-2 relative">
                  <input
                    type="text"
                    value={customTexts[ann.id] || ''}
                    onChange={(e) => setCustomTexts((prev) => ({ ...prev, [ann.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customTexts[ann.id]?.trim()) {
                        acceptAnnotation(ann.id, customTexts[ann.id].trim())
                        setCustomTexts((prev) => { const n = { ...prev }; delete n[ann.id]; return n })
                      }
                    }}
                    placeholder="Or enter your own correction…"
                    className="w-full text-xs bg-surface-container/60 border border-outline-variant/25 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary/30 text-on-surface placeholder:text-on-surface-variant/30 pr-9"
                  />
                  {customTexts[ann.id]?.trim() && (
                    <button
                      onClick={() => {
                        acceptAnnotation(ann.id, customTexts[ann.id].trim())
                        setCustomTexts((prev) => { const n = { ...prev }; delete n[ann.id]; return n })
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded bg-primary text-on-primary hover:bg-primary/80 transition-colors"
                      title="Apply custom correction"
                    >
                      <span className="material-symbols-outlined text-[11px]">check</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Resolved annotations */}
          {resolvedAnnotations.length > 0 && (
            <div className="border-t border-outline-variant/10">
              <p className="px-5 pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Resolved ({resolvedAnnotations.length})
              </p>
              <div className="px-5 pb-4 space-y-2">
                {resolvedAnnotations.map((ann) => (
                  <button
                    key={ann.id}
                    id={`ann-card-${ann.id}`}
                    onClick={() => {
                      const el = document.getElementById(`ann-highlight-${ann.id}`)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-3 transition-colors hover:bg-surface-container group ${
                      ann.status === 'accepted' ? 'bg-green-50/60 border border-green-100' : 'bg-surface-container/40 border border-outline-variant/10'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-sm shrink-0 ${ann.status === 'accepted' ? 'text-green-500' : 'text-on-surface-variant/40'}`}>
                      {ann.status === 'accepted' ? 'check_circle' : 'do_not_disturb_on'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {ann.status === 'accepted' ? (
                        <p className="text-xs truncate">
                          <span className="text-on-surface-variant line-through">{ann.original}</span>
                          <span className="text-on-surface-variant mx-1">→</span>
                          <span className="text-green-700 font-semibold">{ann.suggestion}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-on-surface-variant/60 truncate">&ldquo;{ann.original}&rdquo; — kept as-is</p>
                      )}
                    </div>
                    <span className="material-symbols-outlined text-xs text-on-surface-variant/30 group-hover:text-primary shrink-0 transition-colors">open_in_new</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Re-analyze */}
          <div className="px-5 py-4 border-t border-outline-variant/10">
            <button
              onClick={handleReanalyzeClick}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Analyzing...</>
              ) : (
                <><span className="material-symbols-outlined text-base">auto_awesome</span> Re-analyze transcript</>
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

      {/* Inline annotation popover — anchored to clicked highlight */}
      {inlinePopover && (() => {
        const ann = annotations.find((a) => a.id === inlinePopover.id)
        if (!ann) return null

        const isResolved = ann.status === 'accepted' || ann.status === 'ignored'

        return createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setInlinePopover(null)} />
            <div
              className={`fixed z-[91] w-[320px] bg-surface-container-lowest rounded-xl shadow-2xl border p-4 animate-in fade-in zoom-in-95 ${
                isResolved
                  ? ann.status === 'accepted' ? 'border-green-200' : 'border-outline-variant/30'
                  : severityCardBorder(ann.severity)
              }`}
              style={{ top: inlinePopover.top, left: inlinePopover.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setInlinePopover(null)}
                title="Close"
                className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-outline-variant/20 transition-colors text-sm leading-none"
              >
                &times;
              </button>

              {isResolved ? (
                // ── Read-only view for accepted / ignored ──
                <>
                  <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase mb-3 ${ann.status === 'accepted' ? 'text-green-600' : 'text-on-surface-variant/60'}`}>
                    <span className="material-symbols-outlined text-xs">{ann.status === 'accepted' ? 'check_circle' : 'do_not_disturb_on'}</span>
                    {ann.status === 'accepted'
                      ? (ann._originalSuggestion !== undefined && ann.suggestion !== ann._originalSuggestion ? 'User Changed' : 'Accepted')
                      : 'Ignored'} &middot; {typeLabel(ann.type)}
                  </div>
                  <div className={`rounded-lg p-3 mb-3 ${ann.status === 'accepted' ? 'bg-green-50 border border-green-100' : 'bg-surface-container border border-outline-variant/15'}`}>
                    {ann.status === 'accepted' ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-on-surface-variant line-through">{ann.original}</span>
                        <span className="material-symbols-outlined text-sm text-green-600">arrow_forward</span>
                        <span className="text-green-700 font-semibold">{ann.suggestion}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-on-surface-variant/70">
                        <span className="font-semibold text-on-surface">&quot;{ann.original}&quot;</span> — left as-is
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mb-4">{ann.explanation}</p>
                  <button
                    onClick={() => reopenAnnotation(ann.id)}
                    className="w-full text-xs font-bold py-2 rounded border border-outline-variant/40 text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-xs">undo</span>
                    Reopen this suggestion
                  </button>
                </>
              ) : (
                // ── Action view for open annotations ──
                <>
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
                        : 'bg-surface-container text-on-surface hover:shadow-sm'
                    }`}
                  >
                    Accept: &quot;{ann.suggestion}&quot;
                  </button>
                  <div className="mt-2 relative">
                    <input
                      type="text"
                      autoFocus
                      value={customTexts[ann.id] || ''}
                      onChange={(e) => setCustomTexts((prev) => ({ ...prev, [ann.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customTexts[ann.id]?.trim()) {
                          acceptAnnotation(ann.id, customTexts[ann.id].trim())
                          setCustomTexts((prev) => { const n = { ...prev }; delete n[ann.id]; return n })
                        }
                      }}
                      placeholder="Or enter your own correction…"
                      className="w-full text-xs bg-surface-container/60 border border-outline-variant/25 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary/30 text-on-surface placeholder:text-on-surface-variant/30 pr-9"
                    />
                    {customTexts[ann.id]?.trim() && (
                      <button
                        onClick={() => {
                          acceptAnnotation(ann.id, customTexts[ann.id].trim())
                          setCustomTexts((prev) => { const n = { ...prev }; delete n[ann.id]; return n })
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded bg-primary text-on-primary hover:bg-primary/80 transition-colors"
                        title="Apply custom correction"
                      >
                        <span className="material-symbols-outlined text-[11px]">check</span>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => ignoreAnnotation(ann.id)}
                    className="w-full mt-2 text-[10px] text-on-surface-variant/50 hover:text-on-surface-variant transition-colors py-1"
                  >
                    Ignore this suggestion
                  </button>
                </>
              )}
            </div>
          </>,
          document.body
        )
      })()}

      {/* Reanalyze confirmation modal */}
      {showReanalyzeConfirm && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 pt-6 pb-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-tertiary-fixed/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-tertiary-container text-xl">toll</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface mb-1">Re-analyze Transcript?</h3>
                {reanalyzeTooLarge ? (
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    This transcript is <span className="font-bold text-on-surface">{reanalyzePages} pages</span>, which is too large to re-analyze right now.
                    Re-analyze currently supports transcripts up to {REANALYZE_MAX_PAGES} pages. We're working on raising this limit — reach out if you need this transcript re-analyzed in the meantime.
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    This transcript consists of <span className="font-bold text-on-surface">{reanalyzePages} page{reanalyzePages !== 1 ? 's' : ''}</span> and
                    will cost <span className="font-bold text-on-surface">{reanalyzePages} token{reanalyzePages !== 1 ? 's' : ''}</span> (1 per page).
                    You currently have <span className="font-bold text-on-surface">{tokenBalance ?? 0} token{tokenBalance !== 1 ? 's' : ''}</span> remaining.
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowReanalyzeConfirm(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                {reanalyzeTooLarge ? 'Close' : 'Cancel'}
              </button>
              {!reanalyzeTooLarge && (
                <button
                  onClick={handleReanalyzeConfirm}
                  disabled={(tokenBalance ?? 0) < reanalyzePages}
                  className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                  Re-analyze ({reanalyzePages} Token{reanalyzePages !== 1 ? 's' : ''})
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  )
}
