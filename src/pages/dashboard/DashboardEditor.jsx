import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { rtfToText } from '../../lib/parseRtf'

export default function DashboardEditor() {
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case')

  const [caseData, setCaseData] = useState(null)
  const [transcriptText, setTranscriptText] = useState('')
  const [loading, setLoading] = useState(!!caseId)
  const [error, setError] = useState('')

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

      const transcriptFile = caseRow.case_files?.find((f) => f.file_type === 'transcript')
      if (transcriptFile) {
        const { data: blob, error: dlErr } = await supabase.storage
          .from('case-files')
          .download(transcriptFile.storage_path)

        if (dlErr) throw dlErr

        const raw = await blob.text()
        const parsed = rtfToText(raw)
        setTranscriptText(parsed)
      }
    } catch (err) {
      console.error('Failed to load case:', err)
      setError(err.message || 'Failed to load case.')
    } finally {
      setLoading(false)
    }
  }

  // Split transcript text into paragraphs for styled display
  const paragraphs = transcriptText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  // Detect speaker lines (ALL CAPS followed by a colon, or common patterns like "Q.", "A.", "THE COURT:")
  const isSpeakerLine = (line) => /^(Q\.|A\.|THE COURT:|MR\.|MS\.|MRS\.|JUDGE |BY |THE WITNESS:)/.test(line) || /^[A-Z][A-Z .'-]+:/.test(line)

  const extractSpeaker = (line) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0 && colonIdx < 60) {
      return { speaker: line.substring(0, colonIdx).trim(), text: line.substring(colonIdx + 1).trim() }
    }
    if (line.startsWith('Q.') || line.startsWith('A.')) {
      return { speaker: line.substring(0, 2), text: line.substring(2).trim() }
    }
    return null
  }

  // Group consecutive non-speaker lines under the preceding speaker
  const entries = []
  let currentEntry = null

  for (const line of paragraphs) {
    if (isSpeakerLine(line)) {
      const extracted = extractSpeaker(line)
      if (extracted) {
        if (currentEntry) entries.push(currentEntry)
        currentEntry = { speaker: extracted.speaker, lines: [extracted.text] }
      } else {
        if (currentEntry) entries.push(currentEntry)
        currentEntry = { speaker: null, lines: [line] }
      }
    } else {
      if (currentEntry) {
        currentEntry.lines.push(line)
      } else {
        currentEntry = { speaker: null, lines: [line] }
      }
    }
  }
  if (currentEntry) entries.push(currentEntry)

  // Alternate speaker colors
  const speakerColors = [
    'bg-secondary-container text-on-secondary-container',
    'bg-surface-container-highest text-on-surface-variant',
    'bg-primary/10 text-primary',
    'bg-tertiary-fixed/20 text-on-tertiary-container',
  ]
  const speakerColorMap = {}
  let colorIdx = 0
  for (const entry of entries) {
    if (entry.speaker && !speakerColorMap[entry.speaker]) {
      speakerColorMap[entry.speaker] = speakerColors[colorIdx % speakerColors.length]
      colorIdx++
    }
  }

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
              <Link
                to="/dashboard"
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow"
              >
                <span className="material-symbols-outlined text-base">dashboard</span>
                Go to Dashboard
              </Link>
              <Link
                to="/dashboard/upload"
                className="flex items-center gap-2 border border-outline-variant/40 text-on-surface px-5 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-base">cloud_upload</span>
                Upload a Case
              </Link>
            </div>

            <div className="mt-16 w-full max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4 text-center">How the editor works</p>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-error/10 flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-error">priority_high</span>
                  </div>
                  <p className="text-xs font-bold text-on-surface mb-1">Critical Errors</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">Audio confirms a different word. Accept the AI-suggested fix instantly.</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-tertiary-fixed/20 flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-tertiary-fixed-dim">hearing</span>
                  </div>
                  <p className="text-xs font-bold text-on-surface mb-1">Low Confidence</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">Phoneme scan flagged this word. Verify against the audio recording.</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                  </div>
                  <p className="text-xs font-bold text-on-surface mb-1">Accepted</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">Correction applied and logged to the immutable audit trail.</p>
                </div>
              </div>
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

  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-error text-3xl">error</span>
          </div>
          <h2 className="font-headline text-xl font-bold text-on-surface mb-2">Failed to load case</h2>
          <p className="text-sm text-on-surface-variant mb-6">{error}</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>
      </main>
    )
  }

  const transcriptFile = caseData?.case_files?.find((f) => f.file_type === 'transcript')
  const audioFile = caseData?.case_files?.find((f) => f.file_type === 'audio')
  const totalPages = Math.max(1, Math.ceil(paragraphs.length / 25))

  return (
    <main className="min-h-screen bg-background">
      {/* Page Header */}
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
              Review your transcript below. AI analysis will be available once processing completes.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="shrink-0 flex items-center gap-2 text-sm font-bold text-primary"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span className="hover:underline decoration-tertiary-fixed-dim decoration-2 underline-offset-4">Back to Dashboard</span>
          </Link>
        </div>

        {/* File pills */}
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
            {paragraphs.length} lines
          </span>
        </div>
      </div>

      {/* Editor Interface */}
      <div className="flex items-start bg-surface border-t border-outline-variant/10">

        {/* Transcript Canvas */}
        <section className="flex-1 bg-surface-container-low px-12 py-10">
          <div className="max-w-3xl mx-auto bg-surface-container-lowest p-12 shadow-sm">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline-variant/10">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                {caseData?.name}
              </span>
              <span className="text-xs text-on-surface-variant/60 font-mono">Page 1 of {totalPages}</span>
            </div>

            {transcriptText ? (
              <div className="space-y-8 font-mono text-[15px] leading-relaxed text-on-surface">
                {entries.map((entry, idx) => (
                  <div key={idx} className="group">
                    {entry.speaker && (
                      <div className="flex items-baseline justify-between mb-2">
                        <span className={`${speakerColorMap[entry.speaker] || 'bg-surface-container-highest text-on-surface-variant'} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider`}>
                          {entry.speaker}
                        </span>
                      </div>
                    )}
                    <div className="pl-2 border-l-2 border-transparent hover:border-primary-fixed transition-colors cursor-pointer">
                      {entry.lines.map((line, li) => (
                        <p key={li} className={li > 0 ? 'mt-2' : ''}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-4 block">article</span>
                <p className="text-sm text-on-surface-variant">No transcript file was uploaded for this case.</p>
                <p className="text-xs text-on-surface-variant/60 mt-1">Upload a .rtf or .cre file to view it here.</p>
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
                <span className="shrink-0 inline-block ring-2 ring-error ring-offset-1 rounded-sm px-1.5 py-0.5 text-[11px] font-mono text-on-surface bg-surface-container-lowest mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-error">Critical error</span> — audio confirms a different word.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 inline-block border-b-2 border-tertiary-fixed-dim text-[11px] font-mono text-on-surface px-1 mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-on-tertiary-container">Low confidence</span> — phoneme scan flagged this word.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 inline-block text-green-600 font-semibold text-[11px] font-mono px-1 mt-0.5">word</span>
                <span className="text-xs text-on-surface-variant"><span className="font-semibold text-green-600">Accepted</span> — correction applied and logged.</span>
              </div>
            </div>
          </div>

          {/* Case info */}
          <div className="p-5 border-b border-outline-variant/10 bg-surface-container-low">
            <h2 className="font-headline font-bold text-on-surface flex items-center gap-2 text-base">
              <span className="material-symbols-outlined text-tertiary-fixed-dim">folder</span>
              Case Details
            </h2>
          </div>

          <div className="p-5 space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Status</span>
              <span className="font-semibold text-on-surface capitalize">{caseData?.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Uploaded</span>
              <span className="font-semibold text-on-surface">{new Date(caseData?.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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

          {/* Actions */}
          <div className="px-5 pb-5 pt-4 border-t border-outline-variant/10 space-y-3">
            <Link
              to={`/dashboard/export?case=${caseId}`}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-base">cloud_download</span>
              Export This Case
            </Link>
            <Link
              to="/dashboard"
              className="w-full flex items-center justify-center gap-2 border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
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
