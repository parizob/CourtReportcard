import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase, downloadCaseFile } from '../../lib/supabase'
import { fixAnnotationPositions, filterPhantomFixes, deduplicateTranscript, flexFind, applyCorrectionDetailed, buildCleanContentMap, locateAnnotationInCleanContent, locateAnnotationWithAnchor, locateAtAnchorStrict, isSuggestionAlreadyApplied, locateNeedleNear, shiftAcceptedApplySites, repairAcceptedCleanSpans, buildContextAnchor, ensureAnnotationAnchors, wouldFlattenTranscriptStructure, missingCrossLineReopenBytes, sanitizeAnnotationsLeakedLineNumbers, sanitizeAnnotationLeakedLineNumbers } from '../../lib/gemini'
import {
  clearCasePersistError,
  waitForCasePersists,
  publishCaseReviewPending,
  enqueueCaseReviewSave,
  syncMetricsFromAnnotations,
} from '../../lib/casePersist'
import Tooltip from '../../components/Tooltip'

export default function DashboardEditor() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const caseId = searchParams.get('case')

  const [caseData, setCaseData] = useState(null)
  const [entries, setEntries] = useState([])
  const [annotations, setAnnotations] = useState([])
  const [originalSnapshot, setOriginalSnapshot] = useState('')
  const [extractedFilePath, setExtractedFilePath] = useState(null)
  const [loading, setLoading] = useState(!!caseId)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exportPreparing, setExportPreparing] = useState(false)
  const [error, setError] = useState('')
  const [jumpNotice, setJumpNotice] = useState('')
  const [title, setTitle] = useState('')
  const jumpNoticeTimerRef = useRef(null)
  const [originalText, setOriginalText] = useState(null)
  const [customTexts, setCustomTexts] = useState({})
  const [inlinePopover, setInlinePopover] = useState(null) // { id, top, left, placeAbove }
  const [legendOpen, setLegendOpen] = useState(false)
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false)

  const entriesRef = useRef(entries)
  const annotationsRef = useRef(annotations)
  const originalTextRef = useRef(originalText)
  const titleRef = useRef(title)
  const extractedFilePathRef = useRef(extractedFilePath)
  const caseIdRef = useRef(caseId)
  const syncTimerRef = useRef(null)
  const persistNowRef = useRef(null)
  const mountedRef = useRef(true)
  // Only persist after a case has finished loading. Unmount flush without this
  // can upload empty annotations and wipe accepts/ignores (Strict Mode remount
  // or navigating away mid-load).
  const canPersistRef = useRef(false)
  // Bumps on every loadCase; stale async loads must not apply after a newer
  // load started or after the user already accepted in the current session.
  const loadGenRef = useRef(0)
  // Do NOT mirror entries/annotations/originalText via useEffect — that can
  // stomp a newer direct ref write from accept/ignore/reopen with a stale
  // render, so the next persist uploads the pre-reopen state while the UI
  // looks saved. Mutations update refs synchronously; these stay in sync for
  // path/id/title only.
  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { extractedFilePathRef.current = extractedFilePath }, [extractedFilePath])
  useEffect(() => { caseIdRef.current = caseId }, [caseId])
  useEffect(() => {
    canPersistRef.current = false
  }, [caseId])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

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

  // Mirrors Dashboard.jsx's getDisplayStatus() so the case status shown here
  // always matches what the dashboard list shows for the same case.
  const displayStatus = useMemo(() => {
    const total = annotations.length
    if (total === 0) return caseData?.status
    const open = openAnnotations.length
    const resolved = resolvedAnnotations.length
    if (open > 0) return resolved > 0 ? 'in_progress' : 'analyzed'
    if (resolved >= total) return 'reviewed'
    if (resolved > 0) return 'in_progress'
    return caseData?.status
  }, [annotations, openAnnotations, resolvedAnnotations, caseData])

  const statusLabel = (s) => ({ uploaded: 'Uploaded', processing: 'Processing', analyzed: 'Analyzed', in_progress: 'Editing', reviewed: 'Reviewed', exported: 'Exported' }[s] || s)

  useEffect(() => {
    if (!caseId) return
    loadCase()
  }, [caseId])

  const loadCase = async () => {
    const gen = ++loadGenRef.current
    setLoading(true)
    setError('')
    canPersistRef.current = false
    try {
      // Wait for accept/ignore/unmount flushes from the previous editor visit.
      // Otherwise we download a pre-accept snapshot, show everything open, and
      // the next unmount flush writes that open state over the real save.
      try {
        await waitForCasePersists()
      } catch (persistErr) {
        console.warn('Editor load: prior save had an error', persistErr)
      }
      if (gen !== loadGenRef.current) return

      const { data: caseRow, error: caseErr } = await supabase
        .from('cases')
        .select('*, case_files(*)')
        .eq('id', caseId)
        .single()

      if (caseErr) throw caseErr
      if (gen !== loadGenRef.current) return
      setCaseData(caseRow)

      const extractedFile = caseRow.case_files?.find((f) => f.file_type === 'extracted')
      if (extractedFile) {
        // Set path ref before canPersist — persist must never skip for a missing
        // path while the UI is already interactive (useEffect sync is one tick late).
        extractedFilePathRef.current = extractedFile.storage_path
        setExtractedFilePath(extractedFile.storage_path)
        const { data: blob, error: dlErr } = await downloadCaseFile(extractedFile.storage_path)
        if (dlErr) throw dlErr
        if (gen !== loadGenRef.current) return

        const parsed = JSON.parse(await blob.text())

        // Deduplicate entries at load time (cleans up any Gemini duplication in stored JSON)
        const { entries: dedupedEntries, annotations: dedupedAnnotations } =
          deduplicateTranscript(parsed.entries || [], parsed.annotations || [])

        // Strip leaked transcript line numbers from Found/Suggest ("as 16
        // identified") BEFORE position repair — otherwise unplaceable drops.
        const sanitizedAnnotations = sanitizeAnnotationsLeakedLineNumbers(
          dedupedEntries,
          dedupedAnnotations
        )

        // Filtered at load time too (not just at analysis time) so cases
        // processed before this fix existed also get cleaned up on open.
        const positioned = filterPhantomFixes(
          dedupedEntries,
          fixAnnotationPositions(dedupedEntries, sanitizedAnnotations)
        )
        // Context anchors disambiguate twin words; repair cleans legacy
        // _cleanStart drift from older saves.
        const anchored = ensureAnnotationAnchors(dedupedEntries, positioned)
        const fixedAnnotations = repairAcceptedCleanSpans(
          parsed.originalText || null,
          dedupedEntries,
          anchored
        )
        if (gen !== loadGenRef.current) return

        setTitle(parsed.title || '')
        titleRef.current = parsed.title || ''
        setEntries(dedupedEntries)
        setAnnotations(fixedAnnotations)
        setOriginalText(parsed.originalText || null)
        entriesRef.current = dedupedEntries
        annotationsRef.current = fixedAnnotations
        originalTextRef.current = parsed.originalText || null
        setOriginalSnapshot(JSON.stringify({
          entries: dedupedEntries,
          annotations: fixedAnnotations,
          originalText: parsed.originalText || null,
        }))
        publishCaseReviewPending({
          caseId,
          storagePath: extractedFile.storage_path,
          title: parsed.title || '',
          entries: dedupedEntries,
          annotations: fixedAnnotations,
          originalText: parsed.originalText || null,
        })
        canPersistRef.current = true
        // Drop sticky persist failures from a prior session/HMR so Export is not
        // blocked forever after an old constraint error.
        clearCasePersistError()

        // Sync metrics from the annotation file so the dashboard matches storage.
        syncMetricsFromAnnotations(caseId, dedupedEntries, fixedAnnotations).catch((error) => {
          if (gen !== loadGenRef.current) return
          console.error('case_metrics sync failed (editor load):', error.message || error)
        })
      }
    } catch (err) {
      if (gen !== loadGenRef.current) return
      console.error('Failed to load case:', err)
      setError(err.message || 'Failed to load case.')
      canPersistRef.current = false
    } finally {
      if (gen === loadGenRef.current) setLoading(false)
    }
  }

  const updateEntryText = useCallback((id, newText) => {
    const next = entriesRef.current.map((e) => (e.id === id ? { ...e, text: newText } : e))
    entriesRef.current = next
    setEntries(next)
    setSaved(false)
    // Keep module pending current so unmount flush includes typed edits.
    if (canPersistRef.current && caseIdRef.current && extractedFilePathRef.current) {
      publishCaseReviewPending({
        caseId: caseIdRef.current,
        storagePath: extractedFilePathRef.current,
        title: titleRef.current,
        entries: next,
        annotations: annotationsRef.current,
        originalText: originalTextRef.current,
      })
    }
  }, [])

  const updateEntrySpeaker = useCallback((id, newSpeaker) => {
    const next = entriesRef.current.map((e) => (e.id === id ? { ...e, speaker: newSpeaker } : e))
    entriesRef.current = next
    setEntries(next)
    setSaved(false)
    if (canPersistRef.current && caseIdRef.current && extractedFilePathRef.current) {
      publishCaseReviewPending({
        caseId: caseIdRef.current,
        storagePath: extractedFilePathRef.current,
        title: titleRef.current,
        entries: next,
        annotations: annotationsRef.current,
        originalText: originalTextRef.current,
      })
    }
  }, [])

  // Publish module-level pending (survives unmount), then queue a verified save.
  const publishPendingFromRefs = useCallback(() => {
    const id = caseIdRef.current
    const path = extractedFilePathRef.current
    if (!id || !path || !canPersistRef.current) return false
    publishCaseReviewPending({
      caseId: id,
      storagePath: path,
      title: titleRef.current,
      entries: entriesRef.current,
      annotations: annotationsRef.current,
      originalText: originalTextRef.current,
    })
    return true
  }, [])

  const persistNow = useCallback(() => {
    clearTimeout(syncTimerRef.current)
    syncTimerRef.current = null
    if (!publishPendingFromRefs()) {
      return Promise.resolve('skipped')
    }
    return enqueueCaseReviewSave().then((result) => {
      if (result === 'skipped') return result
      // Mark editor clean from what we published, only if still mounted.
      if (!mountedRef.current || !canPersistRef.current) return result
      setOriginalSnapshot(JSON.stringify({
        entries: entriesRef.current,
        annotations: annotationsRef.current,
        originalText: originalTextRef.current,
      }))
      return result
    })
  }, [publishPendingFromRefs])

  persistNowRef.current = persistNow

  // On leave: flush module-level pending (not React refs — those die with unmount).
  useEffect(() => () => {
    clearTimeout(syncTimerRef.current)
    // Publish one last time while refs are still valid, then enqueue.
    if (persistNowRef.current) void persistNowRef.current()
  }, [])

  const goToExport = useCallback(async (e) => {
    e?.preventDefault?.()
    if (!caseId || exportPreparing) return
    setExportPreparing(true)
    setError('')
    try {
      // Always persist + drain the queue before leaving.
      const result = await persistNow()
      if (result === 'skipped') {
        throw new Error('Editor is still loading. Wait a moment, then try Export again.')
      }
      await waitForCasePersists()
      clearCasePersistError()
      navigate(`/dashboard/export?case=${caseId}`)
    } catch (err) {
      console.error('Flush before export failed:', err)
      setError(err.message || 'Could not save your changes before export. Click Save Changes, then try Export again.')
    } finally {
      setExportPreparing(false)
    }
  }, [caseId, exportPreparing, navigate, persistNow])

  const showJumpNotice = useCallback((message) => {
    setJumpNotice(message)
    clearTimeout(jumpNoticeTimerRef.current)
    jumpNoticeTimerRef.current = setTimeout(() => setJumpNotice(''), 4000)
  }, [])

  useEffect(() => () => clearTimeout(jumpNoticeTimerRef.current), [])

  const acceptAnnotation = useCallback((annotationId, customSuggestion) => {
    const curAnnotations = annotationsRef.current
    const curEntries = entriesRef.current
    const curOriginalText = originalTextRef.current

    const rawAnn = curAnnotations.find((a) => a.id === annotationId)
    if (!rawAnn || rawAnn.status !== 'open') return

    // Last-chance strip of leaked line nums if load sanitizer missed them.
    const entryForSanitize = curEntries.find((e) => e.id === rawAnn.entry_id)
    const ann = sanitizeAnnotationLeakedLineNumbers(
      rawAnn,
      entryForSanitize?.text ?? ''
    )
    if (ann !== rawAnn) {
      const patched = curAnnotations.map((a) => (a.id === ann.id ? ann : a))
      annotationsRef.current = patched
      setAnnotations(patched)
    }

    const finalSuggestion = customSuggestion ?? ann.suggestion

    // Track exactly where in the entry text the replacement was made so
    // reopenAnnotation can revert it without searching (which finds wrong matches).
    let appliedEntryId = null
    let appliedAt = null
    let appliedEnd = null
    let appliedMatchedText = null

    const newEntries = curEntries.map((e) => {
      if (e.id !== ann.entry_id) return e

      // Anchor-strict already check: "the" at store must not count as teh→the
      // already applied while "teh" is still at receipt.
      const sugAtAnchor = locateAtAnchorStrict(e.text, ann, finalSuggestion)
      const origAtAnchor = locateAtAnchorStrict(e.text, ann, ann.original)
      if (sugAtAnchor && !origAtAnchor) {
        appliedEntryId = e.id
        appliedAt = sugAtAnchor.start
        appliedEnd = sugAtAnchor.end
        appliedMatchedText = ann.original
        return e
      }

      // Apply at anchored original, then offsets, then flexFind(original).
      const m =
        origAtAnchor ||
        (Number.isFinite(ann.start) &&
        Number.isFinite(ann.end) &&
        e.text.substring(ann.start, ann.end) === ann.original
          ? { start: ann.start, end: ann.end }
          : null) ||
        flexFind(e.text, ann.original)
      if (!m) {
        // Last resort: legacy already-applied ([sic]) without anchors.
        const already = flexFind(e.text, finalSuggestion)
        const stillOrig = flexFind(e.text, ann.original)
        if (isSuggestionAlreadyApplied(e.text, already, stillOrig, ann.original, finalSuggestion)) {
          appliedEntryId = e.id
          appliedAt = already.start
          appliedEnd = already.end
          appliedMatchedText = ann.original
          return e
        }
        return e
      }
      appliedEntryId = e.id
      appliedAt = m.start
      appliedEnd = m.start + finalSuggestion.length
      appliedMatchedText = e.text.substring(m.start, m.end)
      return { ...e, text: e.text.substring(0, m.start) + finalSuggestion + e.text.substring(m.end) }
    })

    // Entry apply is required — otherwise the visible edit and (when there is
    // no originalText) the export source would not include the fix.
    if (appliedEntryId == null) {
      console.warn(
        `Accept blocked: could not apply to entry — id=${ann.id} entry_id=${ann.entry_id} type=${ann.type} original=${JSON.stringify(ann.original)}`
      )
      showJumpNotice('Could not apply this change in the transcript. The suggestion was left open.')
      return
    }

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
    let _appliedOriginalReplacement = null
    if (curOriginalText) {
      // Same locator as underlines — then apply at that exact range so export
      // gets "the cat" when they accepted "the cat".
      const { cleanContent: cc } = buildCleanContentMap(curOriginalText)
      const annotationEntry = curEntries.find((e) => e.id === ann.entry_id)

      // Anchor-strict already / locate — never treat an earlier twin
      // suggestion ("the store") as teh→the already applied.
      const sugAtAnchor = locateAtAnchorStrict(cc, ann, finalSuggestion)
      const origAtAnchor = locateAtAnchorStrict(cc, ann, ann.original)
      const alreadyApplied =
        sugAtAnchor && !origAtAnchor
          ? sugAtAnchor
          : null
      const located =
        origAtAnchor ||
        locateAnnotationWithAnchor(cc, annotationEntry, ann, ann.original)

      if (alreadyApplied) {
        updatedOriginalText = curOriginalText
        _cleanStart = alreadyApplied.cleanStart
        _cleanEnd = alreadyApplied.cleanEnd
        const { cleanToOrig } = buildCleanContentMap(curOriginalText)
        _appliedOriginalStart = cleanToOrig[alreadyApplied.cleanStart]
        _appliedOriginalEnd =
          cleanToOrig[Math.min(alreadyApplied.cleanEnd - 1, cleanToOrig.length - 1)] + 1
        _appliedOriginalReplacement = curOriginalText.substring(
          _appliedOriginalStart,
          _appliedOriginalEnd
        )
        // Never store flat ann.original as undo bytes when the apply site is
        // cross-line — reopen would flatten formatting. Leave matched null so
        // reopen fails closed until a real apply records structured bytes.
        _appliedOriginalMatchedText = /[\r\n]/.test(_appliedOriginalReplacement)
          ? null
          : ann.original
      } else if (
        !origAtAnchor &&
        isSuggestionAlreadyApplied(
          cc,
          locateAnnotationInCleanContent(cc, annotationEntry, ann, finalSuggestion),
          locateAnnotationInCleanContent(cc, annotationEntry, ann, ann.original),
          ann.original,
          finalSuggestion
        )
      ) {
        // Legacy [sic] path when anchors are missing.
        const legacyAlready = locateAnnotationInCleanContent(
          cc,
          annotationEntry,
          ann,
          finalSuggestion
        )
        updatedOriginalText = curOriginalText
        _cleanStart = legacyAlready.cleanStart
        _cleanEnd = legacyAlready.cleanEnd
        const { cleanToOrig } = buildCleanContentMap(curOriginalText)
        _appliedOriginalStart = cleanToOrig[legacyAlready.cleanStart]
        _appliedOriginalEnd =
          cleanToOrig[Math.min(legacyAlready.cleanEnd - 1, cleanToOrig.length - 1)] + 1
        _appliedOriginalReplacement = curOriginalText.substring(
          _appliedOriginalStart,
          _appliedOriginalEnd
        )
        _appliedOriginalMatchedText = /[\r\n]/.test(_appliedOriginalReplacement)
          ? null
          : ann.original
      } else {
        const detail = located
          ? applyCorrectionDetailed(curOriginalText, ann.original, finalSuggestion, {
              cleanStart: located.cleanStart,
              cleanEnd: located.cleanEnd,
            })
          : { text: curOriginalText, start: -1, end: -1, matchedText: null }

        if (detail.start === -1) {
          // Fail closed: do not mark accepted if the export source cannot be updated.
          console.warn(
            `Accept blocked: entry ok but originalText apply failed — id=${ann.id} entry_id=${ann.entry_id} type=${ann.type} original=${JSON.stringify(ann.original)} suggestion=${JSON.stringify(finalSuggestion)} located=${!!located}`
          )
          showJumpNotice('Could not apply this change to the export transcript. The suggestion was left open so nothing is missing from download.')
          return
        }

        updatedOriginalText = detail.text
        _cleanStart = located.cleanStart
        _cleanEnd = located.cleanEnd
        _appliedOriginalStart = detail.start
        _appliedOriginalEnd = detail.end
        _appliedOriginalMatchedText = detail.matchedText
        // Exact post-accept bytes (may include newlines / line numbers when the
        // flag spanned a break). Reopen must splice these — not a flat suggestion.
        _appliedOriginalReplacement = detail.text.substring(detail.start, detail.end)
      }

      // Optional legacy clean span (jump/debug). Paint uses context anchors.
      if (_appliedOriginalStart != null && _appliedOriginalEnd != null) {
        const { cleanContent: postCc, cleanToOrig } = buildCleanContentMap(updatedOriginalText)
        let cs = -1
        let ce = -1
        for (let i = 0; i < cleanToOrig.length; i++) {
          if (cs < 0 && cleanToOrig[i] === _appliedOriginalStart) cs = i
          if (cleanToOrig[i] === _appliedOriginalEnd - 1) ce = i + 1
        }
        if (cs >= 0 && ce > cs && postCc.substring(cs, ce) === finalSuggestion) {
          _cleanStart = cs
          _cleanEnd = ce
        }
      }
    }

    // Context anchor around the applied suggestion — stable across earlier
    // accepts that change length (twin "the" on the same line).
    const postEntry = newEntries.find((e) => e.id === appliedEntryId)
    const appliedAnchor =
      postEntry && appliedAt != null && appliedEnd != null
        ? buildContextAnchor(postEntry.text, appliedAt, appliedEnd)
        : ann._anchorBefore != null
          ? { before: ann._anchorBefore, after: ann._anchorAfter }
          : null

    // Shift reopen splice offsets for later accepts on the same entry/doc.
    // Highlights no longer depend on this — anchors do — but reopen/export do.
    const entryDelta =
      appliedMatchedText != null && appliedAt != null
        ? finalSuggestion.length - appliedMatchedText.length
        : 0
    const originalDelta =
      _appliedOriginalReplacement != null && _appliedOriginalMatchedText != null
        ? _appliedOriginalReplacement.length - _appliedOriginalMatchedText.length
        : 0
    const shifted = shiftAcceptedApplySites(
      curAnnotations,
      {
        entryId: appliedEntryId,
        entryEditEnd:
          appliedAt != null && appliedMatchedText != null
            ? appliedAt + appliedMatchedText.length
            : null,
        entryDelta,
        originalEditEnd:
          _appliedOriginalStart != null && _appliedOriginalMatchedText != null
            ? _appliedOriginalStart + _appliedOriginalMatchedText.length
            : null,
        originalDelta,
        cleanEditEnd: null,
        cleanDelta: 0,
      },
      annotationId
    )

    const updatedAnnotations = shifted.map((a) =>
      a.id === annotationId
        ? {
            ...a,
            status: 'accepted',
            suggestion: finalSuggestion,
            _originalSuggestion: a._originalSuggestion ?? a.suggestion,
            _appliedEntryId: appliedEntryId,
            _appliedAt: appliedAt,
            _appliedEnd: appliedEnd,
            _appliedMatchedText: appliedMatchedText,
            _cleanStart,
            _cleanEnd,
            _appliedOriginalStart,
            _appliedOriginalEnd,
            _appliedOriginalMatchedText,
            _appliedOriginalReplacement,
            _anchorBefore: appliedAnchor?.before ?? a._anchorBefore,
            _anchorAfter: appliedAnchor?.after ?? a._anchorAfter,
          }
        : a
    )
    const fixedAnnotations = ensureAnnotationAnchors(
      newEntries,
      repairAcceptedCleanSpans(
        updatedOriginalText,
        newEntries,
        fixAnnotationPositions(newEntries, updatedAnnotations)
      )
    )

    entriesRef.current = newEntries
    annotationsRef.current = fixedAnnotations
    originalTextRef.current = updatedOriginalText

    setEntries(newEntries)
    setAnnotations(fixedAnnotations)
    if (curOriginalText) setOriginalText(updatedOriginalText)
    setSaved(false)
    setInlinePopover(null)
    setError('')

    void persistNow().then((result) => {
      if (result === 'skipped') {
        setError('Could not save that accept yet. Click Save Changes.')
      }
    }).catch((err) => {
      console.error('Persist after accept failed:', err)
      setError(err.message || 'Could not save that accept. Click Save Changes and try again.')
    })
  }, [persistNow, showJumpNotice])

  const ignoreAnnotation = useCallback((annotationId) => {
    const curAnnotations = annotationsRef.current

    const updated = curAnnotations.map((a) => (a.id === annotationId ? { ...a, status: 'ignored' } : a))

    annotationsRef.current = updated
    setAnnotations(updated)
    setInlinePopover(null)
    setSaved(false)
    setError('')

    void persistNow().then((result) => {
      if (result === 'skipped') {
        setError('Could not save that ignore yet. Click Save Changes.')
      }
    }).catch((err) => {
      console.error('Persist after ignore failed:', err)
      setError(err.message || 'Could not save that ignore. Click Save Changes and try again.')
    })
  }, [persistNow])

  // Jump-to: prefer the exact highlight span; if the cleanContent highlight
  // pass never created one, fall back to the entry / nearest transcript line
  // so the button never dead-ends on long docs with repeated phrases.
  const jumpToAnnotation = useCallback((ann) => {
    const highlight = document.getElementById(`ann-highlight-${ann.id}`)
    if (highlight) {
      highlight.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const entryEl = document.getElementById(`entry-anchor-${ann.entry_id}`)
    if (entryEl) {
      entryEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      console.warn(
        `Jump fallback (entry): no highlight span — id=${ann.id} entry_id=${ann.entry_id} type=${ann.type} original=${JSON.stringify(ann.original)}`
      )
      showJumpNotice('Could not highlight the exact text; jumped to the nearby passage.')
      return
    }

    const curOriginalText = originalTextRef.current
    const curEntries = entriesRef.current
    if (curOriginalText) {
      const { cleanContent, parsedLines } = buildCleanContentMap(curOriginalText)
      const annotationEntry = curEntries.find((e) => e.id === ann.entry_id)
      const searchWord = ann.status === 'accepted' ? ann.suggestion : ann.original
      const located = locateAnnotationWithAnchor(cleanContent, annotationEntry, ann, searchWord)
      // If the exact span still can't be underlined, at least land on the
      // entry's region when the locator found something — or on an entry-
      // prefix hit via a second locate using a wider context.
      let targetPos = located?.cleanStart
      if (targetPos == null && annotationEntry?.text) {
        const anchor = annotationEntry.text.trim().substring(0, 60).replace(/\s+\S*$/, '')
        if (anchor) {
          const em = flexFind(cleanContent, anchor)
          if (em) targetPos = em.start
        }
      }
      if (targetPos != null) {
        const lineIdx = parsedLines.findIndex(
          (pl) => pl.cleanStart <= targetPos && targetPos < pl.cleanEnd
        )
        if (lineIdx >= 0) {
          const lineEl = document.getElementById(`transcript-line-${lineIdx}`)
          if (lineEl) {
            lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            console.warn(
              `Jump fallback (line): no highlight span — id=${ann.id} entry_id=${ann.entry_id} type=${ann.type} original=${JSON.stringify(ann.original)} lineIdx=${lineIdx} located=${!!located}`
            )
            showJumpNotice('Could not highlight the exact text; jumped to the nearby passage.')
            return
          }
        }
      }
    }

    console.warn(
      `Jump failed: no highlight, entry, or line — id=${ann.id} entry_id=${ann.entry_id} type=${ann.type} original=${JSON.stringify(ann.original)}`
    )
    showJumpNotice('Could not locate this flag in the transcript view.')
  }, [showJumpNotice])

  const reopenAnnotation = useCallback((annotationId) => {
    const curAnnotations = annotationsRef.current
    const ann = curAnnotations.find((a) => a.id === annotationId)
    if (!ann || ann.status === 'open') return

    let curEntries = entriesRef.current
    let curOriginalText = originalTextRef.current
    // When reopen lengthens/shortens text (to→too), later accepts must shift
    // or their green span slides onto an earlier twin ("the store").
    let reopenShift = null
    // Entry text is flat (no transcript line nums). originalText may include
    // newlines / line numbers when the flag spanned a break — never use the
    // entry restore bytes to splice originalText (that flattens formatting).
    const entryRestoreText = ann._appliedMatchedText ?? ann.original
    const originalRestoreText = ann._appliedOriginalMatchedText ?? ann.original
    let entrySpan = null
    let originalSpan = null

    // If previously accepted, revert both entries and originalText.
    if (ann.status === 'accepted') {
      // Probe originalText span first (no mutations) so a flatten risk can
      // abort before entry/status diverge from the export source.
      if (curOriginalText && ann.suggestion) {
        if (missingCrossLineReopenBytes(ann)) {
          console.warn(
            `Reopen blocked: cross-line accept missing structured undo — id=${ann.id}`
          )
          showJumpNotice(
            'Could not reopen this change safely because it spans a line break and undo data is missing. Leave it accepted, or re-upload if you need to undo it.'
          )
          return
        }

        const otSlice =
          ann._appliedOriginalStart != null && ann._appliedOriginalEnd != null
            ? curOriginalText.substring(ann._appliedOriginalStart, ann._appliedOriginalEnd)
            : null
        const storedReplacement = ann._appliedOriginalReplacement
        const offsetsMatchReplacement =
          otSlice != null &&
          (otSlice === storedReplacement ||
            otSlice === ann.suggestion ||
            (ann._appliedOriginalMatchedText != null &&
              /[\r\n]/.test(ann._appliedOriginalMatchedText) &&
              !!flexFind(otSlice, ann.suggestion)))

        if (
          ann._appliedOriginalStart != null &&
          ann._appliedOriginalMatchedText != null &&
          offsetsMatchReplacement
        ) {
          originalSpan = {
            start: ann._appliedOriginalStart,
            end: ann._appliedOriginalEnd,
          }
        } else {
          const { cleanContent, cleanToOrig } = buildCleanContentMap(curOriginalText)
          const entryForAnn = curEntries.find(
            (e) => e.id === (ann._appliedEntryId ?? ann.entry_id)
          )
          const anchored = locateAnnotationWithAnchor(
            cleanContent,
            entryForAnn,
            ann,
            ann.suggestion
          )
          if (anchored) {
            const oStart = cleanToOrig[anchored.cleanStart]
            const oEnd = cleanToOrig[anchored.cleanEnd - 1] + 1
            if (oStart != null && oEnd != null && oEnd > oStart) {
              originalSpan = { start: oStart, end: oEnd }
            }
          }
          if (!originalSpan && ann._appliedOriginalStart != null) {
            originalSpan = locateNeedleNear(
              curOriginalText,
              ann.suggestion,
              ann._appliedOriginalStart
            )
          }
        }

        if (
          originalSpan &&
          wouldFlattenTranscriptStructure(
            curOriginalText.substring(originalSpan.start, originalSpan.end),
            originalRestoreText
          )
        ) {
          console.warn(
            `Reopen blocked: flat restore would flatten formatting — id=${ann.id}`
          )
          showJumpNotice(
            'Could not reopen this change safely because it spans a line break. Leave it accepted, or re-upload if you need to undo it.'
          )
          return
        }
      }

      // Revert entry: prefer context anchor (twin-safe), then stored offsets.
      if (ann._appliedEntryId != null && ann.suggestion) {
        curEntries = curEntries.map((e) => {
          if (e.id !== ann._appliedEntryId) return e
          let span = null
          const anchored = locateAnnotationWithAnchor(e.text, e, ann, ann.suggestion)
          if (anchored) {
            span = { start: anchored.cleanStart, end: anchored.cleanEnd }
          } else if (
            ann._appliedAt != null &&
            e.text.substring(ann._appliedAt, ann._appliedEnd) === ann.suggestion
          ) {
            span = { start: ann._appliedAt, end: ann._appliedEnd }
          } else if (ann._appliedAt != null) {
            span = locateNeedleNear(e.text, ann.suggestion, ann._appliedAt)
          }
          if (!span) {
            console.warn(
              `Reopen: could not safely revert entry — id=${ann.id} entry_id=${ann._appliedEntryId} suggestion=${JSON.stringify(ann.suggestion)}`
            )
            return e
          }
          entrySpan = span
          return {
            ...e,
            text:
              e.text.substring(0, span.start) +
              entryRestoreText +
              e.text.substring(span.end),
          }
        })
        entriesRef.current = curEntries
        setEntries(curEntries)
      }

      // Revert originalText using the probed span + structured restore bytes.
      if (curOriginalText && ann.suggestion) {
        let reverted = curOriginalText
        if (originalSpan) {
          reverted =
            curOriginalText.substring(0, originalSpan.start) +
            originalRestoreText +
            curOriginalText.substring(originalSpan.end)
        } else {
          console.warn(
            `Reopen: could not safely revert originalText — id=${ann.id} suggestion=${JSON.stringify(ann.suggestion)}`
          )
        }
        curOriginalText = reverted
        originalTextRef.current = reverted
        setOriginalText(reverted)
      }

      const entryRemoved = entrySpan ? entrySpan.end - entrySpan.start : 0
      const originalRemoved = originalSpan ? originalSpan.end - originalSpan.start : 0
      const entryDelta = entrySpan ? entryRestoreText.length - entryRemoved : 0
      const originalDelta = originalSpan
        ? originalRestoreText.length - originalRemoved
        : 0
      if ((entryDelta !== 0 || originalDelta !== 0) && (entrySpan || originalSpan)) {
        reopenShift = {
          entryId: ann._appliedEntryId ?? ann.entry_id,
          entryEditEnd: entrySpan?.end ?? null,
          entryDelta,
          originalEditEnd: originalSpan?.end ?? null,
          originalDelta,
          cleanEditEnd: null,
          cleanDelta: 0,
        }
      }
    }

    let updated = curAnnotations.map((a) => {
      if (a.id !== annotationId) return a
      const openSuggestion = a._originalSuggestion ?? a.suggestion
      // Rebuild anchor around restored original so paint stays twin-safe.
      let openAnchor = {
        before: a._anchorBefore,
        after: a._anchorAfter,
      }
      if (entrySpan && entryRestoreText) {
        const e = curEntries.find((row) => row.id === (a._appliedEntryId ?? a.entry_id))
        if (e) {
          const rebuilt = buildContextAnchor(
            e.text,
            entrySpan.start,
            entrySpan.start + entryRestoreText.length
          )
          if (rebuilt) openAnchor = rebuilt
        }
      }
      return {
        ...a,
        status: 'open',
        suggestion: openSuggestion,
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
        _appliedOriginalReplacement: undefined,
        _anchorBefore: openAnchor.before,
        _anchorAfter: openAnchor.after,
      }
    })
    if (reopenShift) {
      updated = shiftAcceptedApplySites(updated, reopenShift, annotationId)
    }
    updated = ensureAnnotationAnchors(
      curEntries,
      repairAcceptedCleanSpans(curOriginalText, curEntries, updated)
    )

    annotationsRef.current = updated
    setAnnotations(updated)
    setInlinePopover(null)
    setSaved(false)
    setError('')

    void persistNow().then((result) => {
      if (result === 'skipped') {
        setError('Could not save that reopen yet. Click Save Changes.')
      }
    }).catch((err) => {
      console.error('Persist after reopen failed:', err)
      setError(err.message || 'Could not save that reopen. Click Save Changes and try again.')
    })
  }, [persistNow, showJumpNotice])

  const handleSave = async () => {
    if (!extractedFilePath || !hasChanges) return
    setSaving(true)
    setError('')
    try {
      const result = await persistNow()
      if (result === 'skipped') {
        throw new Error('Editor is still loading. Wait a moment, then click Save Changes again.')
      }
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
      // No font-semibold here: synthetic bold breaks monospace advance widths and
      // makes accepted spans look like shifted/extra letters in the transcript.
      if (ann.status === 'accepted') {
        cls += 'text-green-600'
      } else if (ann.severity === 'critical') {
        cls += 'border-b-2 border-error text-error cursor-pointer'
      } else if (ann.severity === 'warning') {
        cls += 'border-b-2 border-amber-500 text-amber-700 cursor-pointer'
      } else {
        cls += 'border-b border-dotted border-on-surface-variant/40 cursor-pointer'
      }

      parts.push(
        <span
          key={`a-${ann.id}`}
          id={`ann-highlight-${ann.id}`}
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
  // Shared between the desktop in-flow sidebar and the mobile portal-rendered
  // drawer below, so both stay in sync without duplicating this JSX by hand.
  const insightsPanel = (
    <>
      {/* Insights header */}
      <div className="p-4 border-b border-outline-variant/10 bg-surface-container-low">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-headline font-bold text-on-surface flex items-center gap-2 text-base">
            <span className="material-symbols-outlined text-tertiary-fixed-dim">auto_awesome</span>
            Insights
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-primary text-on-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
              {openAnnotations.length} TO REVIEW
            </span>
            <button
              onClick={() => setMobileInsightsOpen(false)}
              className="md:hidden w-6 h-6 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-outline-variant/20 transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">Accept or ignore each suggestion below.</p>
      </div>

      {/* Annotation cards */}
      <div className="p-4 space-y-4">
        {openAnnotations.length === 0 && annotations.length > 0 && (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-4xl text-green-500 block mb-3">check_circle</span>
            <p className="font-bold text-on-surface mb-1">All Issues Resolved</p>
            <p className="text-xs text-on-surface-variant mb-4">Your transcript is ready. Save your changes and export.</p>
            <button type="button" onClick={goToExport} disabled={exportPreparing} className="inline-block px-6 py-2 bg-primary text-on-primary rounded-md font-bold text-sm hover:bg-primary-container transition-colors disabled:opacity-60 disabled:cursor-wait">
              {exportPreparing ? 'Saving…' : 'Export Now'}
            </button>
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
                  onClick={() => jumpToAnnotation(ann)}
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
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Resolved ({resolvedAnnotations.length})
          </p>
          <div className="px-4 pb-4 space-y-2">
            {resolvedAnnotations.map((ann) => (
              <button
                key={ann.id}
                id={`ann-card-${ann.id}`}
                onClick={() => jumpToAnnotation(ann)}
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

      {/* Case details */}
      <div className="px-4 py-4 border-t border-outline-variant/10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Case Details</p>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Status</span>
            <span className="font-semibold text-on-surface">{statusLabel(displayStatus)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Uploaded</span>
            <span className="font-semibold text-on-surface">
              {caseData?.created_at && new Date(caseData.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-on-surface-variant shrink-0">Transcript</span>
            <span className="font-semibold text-on-surface truncate min-w-0" title={transcriptFile?.file_name || ''}>{transcriptFile?.file_name || '—'}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-5 pt-4 border-t border-outline-variant/10 space-y-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-base">save</span>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={goToExport}
          disabled={exportPreparing}
          className="w-full flex items-center justify-center gap-2 border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          <span className="material-symbols-outlined text-base">{exportPreparing ? 'hourglass_top' : 'cloud_download'}</span>
          {exportPreparing ? 'Preparing export…' : 'Export This Case'}
        </button>
        <Link
          to="/dashboard"
          className="w-full flex items-center justify-center gap-2 text-on-surface-variant text-sm font-medium hover:text-primary transition-colors py-2"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>
    </>
  )

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-8 lg:px-12 pt-8 pb-6 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
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
          <div className="flex flex-col items-start md:items-end gap-4 shrink-0">
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Tooltip text="Revert unsaved changes">
                  <button
                    type="button"
                    onClick={handleRevert}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">undo</span>
                  </button>
                </Tooltip>
              )}
              <Tooltip text={saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-r from-primary to-primary-container text-on-primary hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed editorial-shadow"
                >
                  {saving ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <span className="material-symbols-outlined text-xl">{saved ? 'check' : 'save'}</span>
                  )}
                </button>
              </Tooltip>
              <Tooltip text={exportPreparing ? 'Preparing export…' : 'Export'}>
                <button
                  type="button"
                  onClick={goToExport}
                  disabled={exportPreparing}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant/40 text-on-surface hover:bg-surface-container transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                  <span className="material-symbols-outlined text-xl">{exportPreparing ? 'hourglass_top' : 'cloud_download'}</span>
                </button>
              </Tooltip>
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
                  <div className="absolute left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0 top-full mt-3 z-50 w-[min(20rem,calc(100vw-2rem))] md:w-80 bg-surface-container-lowest border border-outline-variant/25 rounded-xl editorial-shadow">
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 w-4 h-4 bg-surface-container-lowest border-l border-t border-outline-variant/25 rotate-45" />
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

      {jumpNotice && (
        <div className="mx-8 lg:mx-12 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium flex items-start gap-2 max-w-6xl" role="status">
          <span className="material-symbols-outlined text-base mt-0.5 shrink-0">info</span>
          {jumpNotice}
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

            // Paint from context anchors + current needle (open=original,
            // accepted=suggestion). Do not trust cached _cleanStart indexes.
            const highlights = []
            for (const ann of allOpenAnnotations) {
              const searchWord = ann.status === 'accepted' ? ann.suggestion : ann.original
              if (!searchWord) continue

              const annotationEntry = entries.find(
                (e) => e.id === (ann._appliedEntryId ?? ann.entry_id)
              )
              const located = locateAnnotationWithAnchor(
                cleanContent,
                annotationEntry,
                ann,
                searchWord
              )
              if (!located) {
                console.warn(
                  `Transcript highlight miss: id=${ann.id} entry_id=${ann.entry_id} type=${ann.type} status=${ann.status} original=${JSON.stringify(ann.original)} searchWord=${JSON.stringify(searchWord)} hasEntry=${!!annotationEntry} hasAnchor=${typeof ann._anchorBefore === 'string'} hasOffsets=${Number.isFinite(ann.start) && Number.isFinite(ann.end)}`
                )
                continue
              }
              highlights.push({ ...ann, cleanStart: located.cleanStart, cleanEnd: located.cleanEnd })
            }
            highlights.sort((a, b) => a.cleanStart - b.cleanStart)
            const cleanHighlights = []
            let lastCleanEnd = 0
            for (const h of highlights) {
              if (h.cleanStart < lastCleanEnd) {
                console.warn(
                  `Transcript highlight skipped (overlap): id=${h.id} entry_id=${h.entry_id} type=${h.type} original=${JSON.stringify(h.original)} cleanStart=${h.cleanStart}`
                )
                continue
              }
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
                  <div key={lineKey} id={`transcript-line-${pl.lineIdx}`} className="min-h-[1.5rem]">
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
                  <div key={lineKey} id={`transcript-line-${pl.lineIdx}`} className="min-h-[1.5rem]">
                    <span className="whitespace-pre">{fullLine}</span>
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
                  parts.push(<span key={`t-${cursor}`} className="whitespace-pre">{content.substring(cursor, h.localStart)}</span>)
                }

                // No font-semibold in the mono transcript: bold synthesizes wider
                // glyphs and makes green spans look offset (black letters mid-word,
                // fake "extra spaces") even when the underlying text is fine.
                let cls = 'inline whitespace-pre '
                if (h.status === 'accepted') {
                  cls += 'text-green-600 cursor-pointer'
                } else if (h.status === 'ignored') {
                  cls += 'border-b border-dashed border-on-surface-variant/30 text-on-surface/60 cursor-pointer'
                } else if (h.severity === 'critical') {
                  cls += 'border-b-2 border-error text-error cursor-pointer'
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
                parts.push(<span key={`t-${cursor}`} className="whitespace-pre">{content.substring(cursor)}</span>)
              }

              return (
                <div key={lineKey} id={`transcript-line-${pl.lineIdx}`} className="min-h-[1.5rem]">
                  {parts}
                </div>
              )
            }

            return (
              <div className="space-y-8">
                {pages.map((page, pageIdx) => (
                  <div key={pageIdx} className="max-w-4xl mx-auto bg-surface-container-lowest shadow-sm relative">
                    <div className="px-8 pt-4 pb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{caseData?.name}</span>
                    </div>
                    <div className="px-8 pb-6 pt-1 font-mono text-[13px] leading-[1.5rem] text-on-surface overflow-x-auto">
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

            const seenEntryAnchors = new Set()
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
                        // One DOM anchor per entry (first rendered line) for jump fallback.
                        const isFirstForEntry = line.entryId != null && !seenEntryAnchors.has(line.entryId)
                        if (isFirstForEntry) seenEntryAnchors.add(line.entryId)
                        const entryAnchorProps = isFirstForEntry ? { id: `entry-anchor-${line.entryId}` } : {}
                        if (line.type === 'blank') {
                          return (
                            <div key={`${pageIdx}-${lineIdx}`} {...entryAnchorProps} className="flex h-7">
                              <span className="w-12 shrink-0 text-right pr-4 text-xs text-on-surface-variant/40 font-mono leading-7 select-none">{lineNum}</span>
                              <div className="flex-1" />
                            </div>
                          )
                        }
                        if (line.type === 'speaker') {
                          return (
                            <div key={`${pageIdx}-${lineIdx}`} {...entryAnchorProps} className="flex h-7 items-center">
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
                            <div key={`${pageIdx}-${lineIdx}`} {...entryAnchorProps} className="flex min-h-[1.75rem] group/line">
                              <span className="w-12 shrink-0 text-right pr-4 text-xs text-on-surface-variant/40 font-mono leading-7 select-none">{lineNum}</span>
                              <div className="flex-1 font-mono text-[13px] leading-7 text-on-surface" style={{ maxWidth: '42.25em' }}>
                                {renderHighlightedText(line.entry)}
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={`${pageIdx}-${lineIdx}`} {...entryAnchorProps} className="flex min-h-[1.75rem] group/line">
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

        {/* Sidebar (desktop) — stays in the flex flow so the transcript column sizes correctly */}
        <aside className="hidden md:block w-64 shrink-0 bg-surface border-l border-outline-variant/15 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
          {insightsPanel}
        </aside>
      </div>

      {/* Mobile Insights drawer — rendered via a portal straight into <body>.
          This page is wrapped in a "page-rise" animation (see index.css) that uses
          animation-fill-mode: both, which leaves a non-"none" transform on that
          ancestor permanently. Per the CSS spec, that makes the ancestor the
          containing block for any `fixed`-positioned descendant, so without the
          portal this drawer would be "fixed" relative to that (very tall) page
          wrapper instead of the viewport, and would scroll with the page instead
          of overlaying it. Portaling to document.body escapes that entirely. */}
      {createPortal(
        <>
          {mobileInsightsOpen && (
            <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileInsightsOpen(false)} />
          )}

          {!mobileInsightsOpen && (
            <button
              onClick={() => setMobileInsightsOpen(true)}
              className="md:hidden fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 bg-primary text-on-primary rounded-l-xl pl-2 pr-1.5 py-3 editorial-shadow"
            >
              <span className="material-symbols-outlined text-lg">auto_awesome</span>
              {openAnnotations.length > 0 && (
                <span className="text-[10px] font-bold leading-none">{openAnnotations.length}</span>
              )}
            </button>
          )}

          <aside
            className={`md:hidden fixed inset-y-0 right-0 z-50 w-[85vw] max-w-sm shadow-2xl transition-transform duration-300 ease-out bg-surface border-l border-outline-variant/15 overflow-y-auto ${mobileInsightsOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            {insightsPanel}
          </aside>
        </>,
        document.body
      )}

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

    </main>
  )
}
