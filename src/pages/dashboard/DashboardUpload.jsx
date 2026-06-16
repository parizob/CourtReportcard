import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { extractTranscriptWithGemini } from '../../lib/gemini'
import { countPages } from '../../lib/pageCount'
import { countByType } from '../../lib/annotationStats'
import { stripRtf } from '../../lib/rtf'
import courtReporterFacts from '../../data/courtReporterFacts'

const ALLOWED_EXTENSIONS = ['.txt', '.rtf']
const MAX_FILE_BYTES = 1 * 1024 * 1024 // 1 MB — mirrors the server-side limit

function validateFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Only .txt and .rtf files are supported.'
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'TRANSCRIPT_TOO_LARGE'
  }
  return null
}

export default function DashboardUpload() {
  const { user, tokenBalance, spendTokens, refreshTokens } = useAuth()
  const [caseName, setCaseName] = useState('')
  const [transcriptFiles, setTranscriptFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState('')
  const [done, setDone] = useState(false)
  const [createdCaseId, setCreatedCaseId] = useState(null)
  const [error, setError] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPages, setPendingPages] = useState(0)
  const [counting, setCounting] = useState(false)
  const [phiCertified, setPhiCertified] = useState(false)

  const [elapsed, setElapsed] = useState(0)
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * courtReporterFacts.length))
  const [factVisible, setFactVisible] = useState(true)
  const timerRef = useRef(null)
  const factTimerRef = useRef(null)

  useEffect(() => {
    if (uploadPhase === 'Analyzing your transcript...') {
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

  const canUpload = caseName.trim().length > 0 && transcriptFiles.length > 0 && !uploading && !counting

  const handleUploadClick = async () => {
    setError('')
    setCounting(true)
    try {
      let totalPages = 0
      for (const file of transcriptFiles) {
        const text = await file.text()
        const isRtf = file.name.toLowerCase().endsWith('.rtf')
        totalPages += countPages(isRtf ? stripRtf(text) : text)
      }
      setPendingPages(totalPages)
      setPhiCertified(false)
      setConfirmOpen(true)
    } catch (err) {
      console.error('Page count failed:', err)
      setError('Could not read transcript file. Please try again.')
    } finally {
      setCounting(false)
    }
  }

  const handleConfirmUpload = async () => {
    setConfirmOpen(false)
    setError('')

    const tokenOk = await spendTokens(pendingPages)
    if (!tokenOk) {
      setError('Failed to use tokens. Please try again.')
      return
    }

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
      setUploadPhase('Analyzing your transcript...')

      let totalEntries = 0
      let totalIssues = 0
      const byType = {}

      for (const file of transcriptFiles) {
        const isPdf = file.name.toLowerCase().endsWith('.pdf')
        const isTxt = file.name.toLowerCase().endsWith('.txt')
        const isRtf = file.name.toLowerCase().endsWith('.rtf')
        let extractedJson

        if (isPdf) {
          const buffer = await file.arrayBuffer()
          extractedJson = await extractTranscriptWithGemini(buffer, 'application/pdf')
        } else {
          const rawContent = await file.text()
          // Strip RTF markup so Gemini and the editor see clean text.
          const plainText = isRtf ? stripRtf(rawContent) : rawContent
          extractedJson = await extractTranscriptWithGemini(plainText)
          if (isTxt || isRtf) {
            extractedJson.originalText = plainText
          }
        }

        totalEntries += (extractedJson.entries || []).length
        totalIssues += (extractedJson.annotations || []).length
        const fileByType = countByType(extractedJson.annotations || [])
        for (const [k, v] of Object.entries(fileByType)) {
          byType[k] = (byType[k] || 0) + v
        }

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
        annotations_by_type: byType,
        last_reviewed_at: new Date().toISOString(),
      }, { onConflict: 'case_id' })

      await supabase.from('cases').update({ status: 'analyzed' }).eq('id', caseRow.id)

      setFinishing(true)
      await new Promise((r) => setTimeout(r, 800))
      setDone(true)
      setUploading(false)
      setUploadPhase('')
      setFinishing(false)
      refreshTokens()
    } catch (err) {
      console.error('Upload failed:', err)
      setError(err.message === 'TRANSCRIPT_TOO_LARGE' ? 'TRANSCRIPT_TOO_LARGE' : (err.message || 'Upload failed. Please try again.'))
      setUploading(false)
      setUploadPhase('')
    }
  }

  if (uploading && uploadPhase === 'Analyzing your transcript...') {
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
              className={`h-full bg-gradient-to-r from-primary to-tertiary-fixed-dim rounded-full transition-all ease-out ${finishing ? 'duration-500' : 'duration-[2000ms]'}`}
              style={{ width: finishing ? '100%' : `${Math.max(4, (90 * elapsed) / (elapsed + 90))}%` }}
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
    <main className="h-[calc(100vh-65px)] overflow-hidden bg-background flex items-start justify-center px-6 py-8">
      <div className="w-full max-w-xl flex flex-col gap-5">

        {/* Header */}
        <div className="shrink-0">
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">Upload New Case</h1>
          <p className="text-xs text-on-surface-variant mt-1">Name your case and upload your transcript to get started.</p>
        </div>

        {/* Error banner */}
        {error && (
          error === 'TRANSCRIPT_TOO_LARGE' ? (
            <div className="shrink-0 p-3.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">volunteer_activism</span>
              <div>
                <p className="text-sm font-bold text-on-surface">File too large for a single pass.</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Try chunks of <span className="font-semibold text-on-surface">~100 pages each</span>.</p>
              </div>
            </div>
          ) : (
            <div className="shrink-0 p-3 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              {error}
            </div>
          )
        )}

        {/* Case name — prominent */}
        <div className="shrink-0 bg-surface-container-lowest rounded-xl editorial-shadow p-5">
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
            Case Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            placeholder="e.g. State vs. Henderson — Motion Hearing"
            className="w-full bg-surface-container px-4 py-4 rounded-lg text-base text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        {/* Drop zone + info row */}
        <div className="shrink-0 flex gap-4">

          {/* Drop zone — compact fixed height */}
          <div className={`flex-1 h-44 min-w-0 overflow-hidden bg-surface-container-lowest rounded-xl editorial-shadow flex flex-col transition-all ${transcriptFiles.length > 0 ? 'ring-2 ring-primary/30' : ''}`}>
            {transcriptFiles.length === 0 ? (
              <label className="flex-1 flex flex-col items-center justify-center cursor-pointer rounded-xl hover:bg-surface-container/30 transition-colors group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                  <span className="material-symbols-outlined text-primary text-xl">upload_file</span>
                </div>
                <p className="text-sm font-semibold text-on-surface">Drop file here or click to browse</p>
                <p className="text-xs text-on-surface-variant/60 mt-1">.txt or .rtf</p>
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.rtf"
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (!file) return
                    const err = validateFile(file)
                    if (err) { setError(err); setTranscriptFiles([]); return }
                    setError('')
                    setTranscriptFiles([file])
                  }}
                />
              </label>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-5 gap-3 min-w-0 w-full overflow-hidden">
                <div className="flex items-center gap-3 w-full min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{transcriptFiles[0].name}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {transcriptFiles[0].name.split('.').pop().toUpperCase()} &middot; {(transcriptFiles[0].size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-green-500 text-lg shrink-0">check</span>
                </div>
                <label className="flex items-center gap-1 text-xs font-bold text-primary cursor-pointer hover:underline">
                  <span className="material-symbols-outlined text-sm">swap_horiz</span>
                  Change file
                  <input
                    type="file"
                    className="hidden"
                  accept=".txt,.rtf"
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (!file) return
                    const err = validateFile(file)
                    if (err) { setError(err); setTranscriptFiles([]); return }
                    setError('')
                    setTranscriptFiles([file])
                  }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Info + token panel */}
          <div className="w-48 shrink-0 h-44 bg-surface-container-lowest rounded-xl editorial-shadow p-4 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Your Balance</p>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-lg">toll</span>
                <span className="text-sm font-bold text-on-surface">{tokenBalance ?? '—'} token{tokenBalance !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { icon: 'lock', text: 'Encrypted & secure' },
                { icon: 'schedule', text: '2–5 min analysis' },
                { icon: 'toll', text: '1 token per page' },
              ].map((item) => (
                <div key={item.icon} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary/70 text-sm shrink-0">{item.icon}</span>
                  <p className="text-[11px] text-on-surface-variant">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="shrink-0 flex items-center justify-between bg-surface-container-lowest rounded-xl editorial-shadow px-5 py-3.5">
          <div className="text-sm">
            {uploading ? (
              <span className="flex items-center gap-2 font-semibold text-primary">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {uploadPhase}
              </span>
            ) : transcriptFiles.length === 0 ? (
              <span className="text-on-surface-variant/50">No file selected</span>
            ) : (
              <span className="font-semibold text-on-surface">Ready to analyze</span>
            )}
          </div>
          <button
            disabled={!canUpload}
            onClick={handleUploadClick}
            className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-7 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading || counting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {counting ? 'Counting pages…' : 'Uploading…'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">cloud_upload</span>
                Upload &amp; Analyze
              </>
            )}
          </button>
        </div>

      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow max-w-md w-full p-8">
            {(tokenBalance ?? 0) < pendingPages ? (
              <>
                <div className="w-12 h-12 rounded-xl bg-error-container/40 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-error text-2xl">error</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-on-surface mb-2">Insufficient Tokens</h3>
                <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
                  This transcript consists of <span className="font-bold text-on-surface">{pendingPages} page{pendingPages !== 1 ? 's' : ''}</span> and
                  would cost <span className="font-bold text-on-surface">{pendingPages} token{pendingPages !== 1 ? 's' : ''}</span>.
                  You currently have <span className="font-bold text-on-surface">{tokenBalance ?? 0} token{tokenBalance !== 1 ? 's' : ''}</span>.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="border border-outline-variant/40 text-on-surface px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <Link
                    to="/dashboard/billing"
                    className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                    Buy More Tokens
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary text-2xl">toll</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-on-surface mb-2">Confirm Upload</h3>
                <p className="text-sm text-on-surface-variant mb-5 leading-relaxed">
                  This transcript consists of <span className="font-bold text-on-surface">{pendingPages} page{pendingPages !== 1 ? 's' : ''}</span> and
                  will cost <span className="font-bold text-on-surface">{pendingPages} token{pendingPages !== 1 ? 's' : ''}</span>.
                  You currently have <span className="font-bold text-on-surface">{tokenBalance ?? 0} token{tokenBalance !== 1 ? 's' : ''}</span>.
                </p>
                <label className="flex items-start gap-3 cursor-pointer group mb-6 p-3 rounded-lg bg-error-container/20 border border-error/20">
                  <input
                    type="checkbox"
                    checked={phiCertified}
                    onChange={(e) => setPhiCertified(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-on-surface leading-relaxed">
                    I certify that this transcript contains <span className="font-bold">no Protected Health Information (PHI)</span> and does not include any data regulated under HIPAA.
                  </span>
                </label>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="border border-outline-variant/40 text-on-surface px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmUpload}
                    disabled={!phiCertified}
                    className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-base">cloud_upload</span>
                    Proceed
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
