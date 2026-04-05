import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { extractTranscriptWithGemini } from '../../lib/gemini'
import courtReporterFacts from '../../data/courtReporterFacts'

export default function DashboardUpload() {
  const { user } = useAuth()
  const [caseName, setCaseName] = useState('')
  const [transcriptFiles, setTranscriptFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState('')
  const [done, setDone] = useState(false)
  const [createdCaseId, setCreatedCaseId] = useState(null)
  const [error, setError] = useState('')
  const [finishing, setFinishing] = useState(false)

  const [elapsed, setElapsed] = useState(0)
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * courtReporterFacts.length))
  const [factVisible, setFactVisible] = useState(true)
  const timerRef = useRef(null)
  const factTimerRef = useRef(null)

  useEffect(() => {
    if (uploadPhase === 'AI is analyzing your transcript...') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)

      factTimerRef.current = setInterval(() => {
        setFactVisible(false)
        setTimeout(() => {
          setFactIndex((prev) => (prev + 1) % courtReporterFacts.length)
          setFactVisible(true)
        }, 500)
      }, 10000)
    } else {
      clearInterval(timerRef.current)
      clearInterval(factTimerRef.current)
    }
    return () => {
      clearInterval(timerRef.current)
      clearInterval(factTimerRef.current)
    }
  }, [uploadPhase])

  const canUpload = caseName.trim().length > 0 && transcriptFiles.length > 0 && !uploading

  const handleUpload = async () => {
    setError('')
    setUploading(true)
    setUploadPhase('Creating case...')

    try {
      const { data: caseRow, error: caseErr } = await supabase
        .from('cases')
        .insert({ user_id: user.id, name: caseName.trim() })
        .select()
        .single()

      if (caseErr) throw caseErr
      setCreatedCaseId(caseRow.id)

      setUploadPhase('Uploading files...')

      for (const file of transcriptFiles) {
        const storagePath = `${user.id}/${caseRow.id}/transcript/${file.name}`

        const { error: storageErr } = await supabase.storage
          .from('case-files')
          .upload(storagePath, file)
        if (storageErr) throw storageErr

        const { error: fileErr } = await supabase
          .from('case_files')
          .insert({
            case_id: caseRow.id,
            file_type: 'transcript',
            file_name: file.name,
            file_size: file.size,
            storage_path: storagePath,
            mime_type: file.type || null,
          })
        if (fileErr) throw fileErr
      }

      await supabase.from('cases').update({ status: 'processing' }).eq('id', caseRow.id)
      setUploadPhase('AI is analyzing your transcript...')

      let totalEntries = 0
      let totalIssues = 0

      for (const file of transcriptFiles) {
        const isPdf = file.name.toLowerCase().endsWith('.pdf')
        const isTxt = file.name.toLowerCase().endsWith('.txt')
        let extractedJson

        if (isPdf) {
          const buffer = await file.arrayBuffer()
          extractedJson = await extractTranscriptWithGemini(buffer, 'application/pdf')
        } else {
          const rawContent = await file.text()
          extractedJson = await extractTranscriptWithGemini(rawContent)
          if (isTxt) {
            extractedJson.originalText = rawContent
          }
        }

        totalEntries += (extractedJson.entries || []).length
        totalIssues += (extractedJson.annotations || []).length

        const jsonBlob = new Blob(
          [JSON.stringify(extractedJson, null, 2)],
          { type: 'application/json' }
        )

        const jsonFileName = file.name.replace(/\.(rtf|cre|pdf|txt)$/i, '') + '_extracted.json'
        const jsonStoragePath = `${user.id}/${caseRow.id}/extracted/${jsonFileName}`

        await supabase.storage.from('case-files').upload(jsonStoragePath, jsonBlob, { upsert: true })

        await supabase.from('case_files').insert({
          case_id: caseRow.id,
          file_type: 'extracted',
          file_name: jsonFileName,
          file_size: jsonBlob.size,
          storage_path: jsonStoragePath,
          mime_type: 'application/json',
        })
      }

      await supabase.from('case_metrics').upsert({
        case_id: caseRow.id,
        total_entries: totalEntries,
        total_issues: totalIssues,
        accepted: 0,
        ignored: 0,
        open: totalIssues,
        last_reviewed_at: new Date().toISOString(),
      }, { onConflict: 'case_id' })

      await supabase.from('cases').update({ status: 'analyzed' }).eq('id', caseRow.id)

      setFinishing(true)
      await new Promise((r) => setTimeout(r, 800))
      setDone(true)
      setUploading(false)
      setUploadPhase('')
      setFinishing(false)
    } catch (err) {
      console.error('Upload failed:', err)
      setError(err.message || 'Upload failed. Please try again.')
      setUploading(false)
      setUploadPhase('')
    }
  }

  if (uploading && uploadPhase === 'AI is analyzing your transcript...') {
    const currentFact = courtReporterFacts[factIndex]
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-12 text-center max-w-lg w-full">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
            </div>
            <div className="text-left">
              <h2 className="font-headline text-lg font-bold text-on-surface">Analyzing Transcript</h2>
              <p className="text-xs text-on-surface-variant">
                <span className="font-semibold text-on-surface">{caseName}</span> &middot; {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
              </p>
            </div>
          </div>

          <div className="w-full bg-surface-container rounded-full h-1.5 mb-8 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r from-primary to-tertiary-fixed-dim rounded-full transition-all ease-out ${finishing ? 'duration-500' : 'duration-1000'}`}
              style={{ width: finishing ? '100%' : `${Math.min(95, Math.max(5, (elapsed / 120) * 100))}%` }}
            />
          </div>

          <div className="bg-surface-container/50 rounded-xl p-6 mb-6 min-h-[120px] flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs">history_edu</span>
              {currentFact.category}
            </span>
            <p
              className={`text-sm text-on-surface leading-relaxed transition-all duration-300 ${factVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            >
              {currentFact.fact}
            </p>
          </div>

          <p className="text-[11px] text-on-surface-variant/50">
            Please stay on this page while the analysis completes.
          </p>
        </div>
      </main>
    )
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">Analysis Complete</h2>
          <p className="text-sm text-on-surface-variant mb-2">
            <span className="font-semibold text-on-surface">{caseName}</span> has been uploaded and analyzed.
          </p>
          <p className="text-sm text-on-surface-variant mb-8">
            Your transcript has been extracted and proofread. Review flagged issues in the editor.
          </p>

          <div className="flex justify-center gap-3">
            {createdCaseId && (
              <Link
                to={`/dashboard/editor?case=${createdCaseId}`}
                className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">edit_note</span>
                Open in Editor
              </Link>
            )}
            <Link
              to="/dashboard"
              className="border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">dashboard</span>
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 lg:p-12 bg-background">
      <div className="max-w-5xl mx-auto">

        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">cloud_upload</span>
            Upload Files
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            Upload a New Case
          </h1>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xl">
            Name your case, then upload your transcript and audio files. Court Reportcard will analyze them together for the highest accuracy review.
          </p>
        </header>

        {/* Case name */}
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-6 mb-8">
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
            Case Name
          </label>
          <input
            type="text"
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            placeholder="e.g. State vs. Henderson Motion Hearing"
            className="w-full bg-surface-container px-4 py-3 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
          <p className="text-[11px] text-on-surface-variant mt-2">Give your case a descriptive name so you can find it later.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
            {error}
          </div>
        )}

        {/* Dual drop zones */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className={`bg-surface-container-lowest rounded-2xl editorial-shadow p-8 flex flex-col items-center text-center group transition-all ${transcriptFiles.length > 0 ? 'ring-2 ring-primary/30' : 'hover:ring-2 hover:ring-primary/20'}`}>
            {transcriptFiles.length === 0 ? (
              <>
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                  <span className="material-symbols-outlined text-primary text-2xl">description</span>
                </div>
                <h3 className="font-headline font-bold text-lg text-on-surface mb-1">Transcript Files</h3>
                <p className="text-xs text-on-surface-variant mb-5">RTF, CRE, PDF, or TXT format</p>
                <label className="w-full border-2 border-dashed border-outline-variant/30 rounded-xl p-8 cursor-pointer hover:border-primary/40 transition-colors flex flex-col items-center">
                  <span className="material-symbols-outlined text-4xl text-outline mb-3">upload_file</span>
                  <span className="text-sm font-semibold text-on-surface">Drop files here or click to browse</span>
                  <span className="text-xs text-on-surface-variant mt-1">.rtf, .cre, .pdf, .txt files accepted</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".rtf,.cre,.pdf,.txt"
                    multiple
                    onChange={(e) => setTranscriptFiles([...e.target.files])}
                  />
                </label>
              </>
            ) : (
              <>
                <div className="w-full flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-green-600 text-xl">check_circle</span>
                    </div>
                    <div className="text-left">
                      <h3 className="font-headline font-bold text-on-surface text-sm">
                        {transcriptFiles.length} file{transcriptFiles.length !== 1 ? 's' : ''} selected
                      </h3>
                      <p className="text-[10px] text-on-surface-variant">
                        {(Array.from(transcriptFiles).reduce((s, f) => s + f.size, 0) / 1024).toFixed(0)} KB total
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-primary cursor-pointer hover:underline">
                    <span className="material-symbols-outlined text-sm">swap_horiz</span>
                    Change
                    <input
                      type="file"
                      className="hidden"
                      accept=".rtf,.cre,.pdf,.txt"
                      multiple
                      onChange={(e) => { if (e.target.files.length > 0) setTranscriptFiles([...e.target.files]) }}
                    />
                  </label>
                </div>
                <div className="w-full space-y-2">
                  {Array.from(transcriptFiles).map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-surface-container/50 rounded-lg px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-base">description</span>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-on-surface truncate">{f.name}</p>
                        <p className="text-[10px] text-on-surface-variant">
                          {f.name.split('.').pop().toUpperCase()} &middot; {(f.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-green-500 text-lg shrink-0">check</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8 flex flex-col items-center text-center opacity-60 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="bg-tertiary-fixed/20 text-on-tertiary-container text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                Coming Soon
              </span>
            </div>
            <div className="w-14 h-14 rounded-xl bg-tertiary-fixed/10 flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-tertiary-fixed-dim/50 text-2xl">audio_file</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface/60 mb-1">Audio Recording</h3>
            <p className="text-xs text-on-surface-variant/60 mb-5">WAV, MP3, or DSS format</p>
            <div className="w-full border-2 border-dashed border-outline-variant/15 rounded-xl p-8 flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl text-outline/30 mb-3">mic</span>
              <span className="text-sm font-semibold text-on-surface/40">Audio upload coming soon</span>
              <span className="text-xs text-on-surface-variant/40 mt-1">Cross-reference audio with transcripts for maximum accuracy</span>
            </div>
          </div>
        </div>

        {/* Upload action */}
        <div className="flex items-center justify-between bg-surface-container-lowest rounded-xl editorial-shadow px-6 py-4">
          <div className="text-sm text-on-surface-variant">
            {uploading ? (
              <span className="flex items-center gap-2 font-semibold text-primary">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {uploadPhase}
              </span>
            ) : transcriptFiles.length === 0 ? (
              'No files selected'
            ) : (
              <span className="font-semibold text-on-surface">
                {transcriptFiles.length} transcript{transcriptFiles.length !== 1 ? 's' : ''} ready
              </span>
            )}
          </div>
          <button
            disabled={!canUpload}
            onClick={handleUpload}
            className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-8 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">cloud_upload</span>
                Upload &amp; Analyze
              </>
            )}
          </button>
        </div>

        {/* Tips */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {[
            { icon: 'lightbulb', title: 'Best Results', desc: 'Upload both transcript and audio for cross-referenced accuracy analysis.' },
            { icon: 'lock', title: 'Secure', desc: 'All files are encrypted at rest and in transit. SOC 2 compliant infrastructure.' },
            { icon: 'schedule', title: 'Fast', desc: 'Most cases are analyzed within 2–5 minutes, regardless of transcript length.' },
          ].map((tip) => (
            <div key={tip.title} className="flex items-start gap-3 bg-surface-container/40 rounded-xl p-4">
              <span className="material-symbols-outlined text-primary mt-0.5">{tip.icon}</span>
              <div>
                <p className="text-xs font-bold text-on-surface">{tip.title}</p>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
