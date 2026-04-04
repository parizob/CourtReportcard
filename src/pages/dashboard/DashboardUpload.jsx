import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function DashboardUpload() {
  const { user } = useAuth()
  const [caseName, setCaseName] = useState('')
  const [transcriptFiles, setTranscriptFiles] = useState([])
  const [audioFiles, setAudioFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const canUpload = caseName.trim().length > 0 && (transcriptFiles.length > 0 || audioFiles.length > 0) && !uploading

  const handleUpload = async () => {
    setError('')
    setUploading(true)

    try {
      const { data: caseRow, error: caseErr } = await supabase
        .from('cases')
        .insert({ user_id: user.id, name: caseName.trim() })
        .select()
        .single()

      if (caseErr) throw caseErr

      const allFiles = [
        ...transcriptFiles.map((f) => ({ file: f, type: 'transcript' })),
        ...audioFiles.map((f) => ({ file: f, type: 'audio' })),
      ]

      for (const { file, type } of allFiles) {
        const storagePath = `${user.id}/${caseRow.id}/${type}/${file.name}`

        const { error: storageErr } = await supabase.storage
          .from('case-files')
          .upload(storagePath, file)

        if (storageErr) throw storageErr

        const { error: fileErr } = await supabase
          .from('case_files')
          .insert({
            case_id: caseRow.id,
            file_type: type,
            file_name: file.name,
            file_size: file.size,
            storage_path: storagePath,
            mime_type: file.type || null,
          })

        if (fileErr) throw fileErr
      }

      setDone(true)
    } catch (err) {
      console.error('Upload failed:', err)
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">Upload Complete</h2>
          <p className="text-sm text-on-surface-variant mb-2">
            <span className="font-semibold text-on-surface">{caseName}</span> has been created.
          </p>
          <p className="text-sm text-on-surface-variant mb-8">
            Your files are queued for AI-powered review.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/dashboard"
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">dashboard</span>
              View Dashboard
            </Link>
            <button
              onClick={() => { setDone(false); setCaseName(''); setTranscriptFiles([]); setAudioFiles([]) }}
              className="border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Upload Another
            </button>
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
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8 flex flex-col items-center text-center group transition-all hover:ring-2 hover:ring-primary/20">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
              <span className="material-symbols-outlined text-primary text-2xl">description</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-1">Transcript Files</h3>
            <p className="text-xs text-on-surface-variant mb-5">RTF or CRE format</p>
            <label className="w-full border-2 border-dashed border-outline-variant/30 rounded-xl p-8 cursor-pointer hover:border-primary/40 transition-colors flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl text-outline mb-3">upload_file</span>
              <span className="text-sm font-semibold text-on-surface">Drop files here or click to browse</span>
              <span className="text-xs text-on-surface-variant mt-1">.rtf, .cre files accepted</span>
              <input
                type="file"
                className="hidden"
                accept=".rtf,.cre"
                multiple
                onChange={(e) => setTranscriptFiles([...e.target.files])}
              />
            </label>
            {transcriptFiles.length > 0 && (
              <div className="mt-4 w-full text-left">
                {transcriptFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm text-primary">insert_drive_file</span>
                    <span className="truncate">{f.name}</span>
                    <span className="text-[10px] text-on-surface-variant/50 ml-auto">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-8 flex flex-col items-center text-center group transition-all hover:ring-2 hover:ring-primary/20">
            <div className="w-14 h-14 rounded-xl bg-tertiary-fixed/20 flex items-center justify-center mb-5 group-hover:bg-tertiary-fixed/30 transition-colors">
              <span className="material-symbols-outlined text-tertiary-fixed-dim text-2xl">audio_file</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-1">Audio Recording</h3>
            <p className="text-xs text-on-surface-variant mb-5">WAV, MP3, or DSS format</p>
            <label className="w-full border-2 border-dashed border-outline-variant/30 rounded-xl p-8 cursor-pointer hover:border-tertiary-fixed-dim/40 transition-colors flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl text-outline mb-3">mic</span>
              <span className="text-sm font-semibold text-on-surface">Drop files here or click to browse</span>
              <span className="text-xs text-on-surface-variant mt-1">.wav, .mp3, .dss files accepted</span>
              <input
                type="file"
                className="hidden"
                accept=".wav,.mp3,.dss"
                multiple
                onChange={(e) => setAudioFiles([...e.target.files])}
              />
            </label>
            {audioFiles.length > 0 && (
              <div className="mt-4 w-full text-left">
                {audioFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm text-tertiary-fixed-dim">music_note</span>
                    <span className="truncate">{f.name}</span>
                    <span className="text-[10px] text-on-surface-variant/50 ml-auto">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upload action */}
        <div className="flex items-center justify-between bg-surface-container-lowest rounded-xl editorial-shadow px-6 py-4">
          <div className="text-sm text-on-surface-variant">
            {transcriptFiles.length + audioFiles.length === 0 ? (
              'No files selected'
            ) : (
              <span className="font-semibold text-on-surface">
                {transcriptFiles.length} transcript{transcriptFiles.length !== 1 ? 's' : ''}, {audioFiles.length} audio file{audioFiles.length !== 1 ? 's' : ''} ready
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
