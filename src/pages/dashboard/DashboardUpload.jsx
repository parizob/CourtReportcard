import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { countPages } from '../../lib/pageCount'
import { stripRtf } from '../../lib/rtf'

const ALLOWED_EXTENSIONS = ['.txt', '.rtf']
// RTF files carry heavy markup overhead (font tables, margin codes, etc.) that
// can make a 49-page transcript 2–3 MB even though the actual text is ~9 KB.
// Keep a generous limit per format rather than one flat number.
const MAX_FILE_BYTES = {
  '.txt': 2 * 1024 * 1024,   // 2 MB — well above any real plain-text transcript
  '.rtf': 10 * 1024 * 1024,  // 10 MB — RTF markup overhead can be 10–50× text size
}

// Rough, honest expectation-setting for the post-upload confirmation screen —
// larger documents go through the chunked/batched pipeline (see
// CHUNK_THRESHOLD_PAGES in supabase/functions/analyze-case/index.ts) and take
// meaningfully longer, with proofread batch time varying by content density.
// Ranges are intentionally generous rather than precise so a slower-than-usual
// run still lands inside what we told the user to expect.
function processingTimeEstimate(pages) {
  if (pages < 20) return 'This usually takes 2 to 5 minutes.'
  if (pages < 50) return 'This usually takes 5 to 10 minutes.'
  if (pages < 100) return 'This usually takes 10 to 20 minutes.'
  if (pages < 150) return 'This can take up to 30 minutes.'
  return 'This can take 30 minutes or more for very large documents.'
}

// Storage object keys are used in HTTP URLs. Characters like `#` and `?` become
// fragments/query strings if any client forgets to encode; `/` nests folders.
// Court reporter CAT exports often include `#` in job numbers (e.g.
// EH.TRAN.JOB#129107.txt). Keep the original name in case_files.file_name for
// display; only the storage key is sanitized. Mirrored for intermediate
// extracting/ paths in supabase/functions/analyze-case/index.ts (safeJsonBaseName).
function safeStorageFileName(name) {
  const base = (name || '').split(/[/\\]/).pop() || 'transcript'
  const cleaned = base.replace(/[^\w.\-() +]/g, '_').replace(/_+/g, '_')
  return cleaned || 'transcript.txt'
}

function validateFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Only .txt and .rtf files are supported.'
  }
  const limit = MAX_FILE_BYTES[ext] ?? MAX_FILE_BYTES['.txt']
  if (file.size > limit) {
    return 'TRANSCRIPT_TOO_LARGE'
  }
  return null
}

export default function DashboardUpload() {
  const { user, tokenBalance, spendTokens, refundTokens, refreshTokens } = useAuth()
  const [caseName, setCaseName] = useState('')
  const [transcriptFiles, setTranscriptFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPages, setPendingPages] = useState(0)
  const [counting, setCounting] = useState(false)
  const [phiCertified, setPhiCertified] = useState(false)

  const canUpload = caseName.trim().length > 0 && transcriptFiles.length > 0 && !uploading && !counting

  const resetForm = () => {
    setDone(false)
    setCaseName('')
    setTranscriptFiles([])
    setPendingPages(0)
    setError('')
  }

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

    // Tokens are charged up front; if anything below fails we must give them back.
    let tokensCharged = pendingPages
    let createdId = null
    const uploadedPaths = []

    setUploading(true)
    setUploadPhase('Creating case...')

    try {
      const { data: caseRow, error: caseErr } = await supabase
        .from('cases')
        .insert({ user_id: user.id, name: caseName.trim(), tokens_charged: pendingPages })
        .select()
        .single()

      if (caseErr) throw caseErr
      createdId = caseRow.id

      setUploadPhase('Uploading files...')

      for (const file of transcriptFiles) {
        const storagePath = `${user.id}/${caseRow.id}/transcript/${safeStorageFileName(file.name)}`

        const { error: storageErr } = await supabase.storage
          .from('case-files')
          .upload(storagePath, file)
        if (storageErr) throw storageErr
        uploadedPaths.push(storagePath)

        const { error: fileErr } = await supabase
          .from('case_files')
          .insert({
            case_id: caseRow.id,
            file_type: 'transcript',
            // Original name for UI; storage_path uses the sanitized key above.
            file_name: file.name,
            file_size: file.size,
            storage_path: storagePath,
            mime_type: file.type || null,
          })
        if (fileErr) throw fileErr
      }

      // Hand the case off to the background worker. Analysis itself (and the
      // email notification + token refund if THAT fails) happens server-side
      // in the analyze-case Edge Function, so the user doesn't wait for
      // Gemini here. But we do need to confirm the handoff itself was
      // accepted — supabase-js does NOT reject on a non-2xx response from
      // the function (it resolves with { error } instead), so a plain
      // .catch() here would silently miss most failure modes (auth/lookup
      // errors, cold-start issues, etc.) and leave the case stuck in
      // "processing" forever with no refund. Awaiting and checking the
      // result routes any handoff failure into the same refund/cleanup path
      // below as every other upload failure.
      await supabase.from('cases').update({ status: 'processing' }).eq('id', caseRow.id)

      setUploadPhase('Starting analysis...')
      const { error: invokeErr } = await supabase.functions
        .invoke('analyze-case', { body: { case_id: caseRow.id } })
      if (invokeErr) throw new Error('Could not start analysis. Please try again — your tokens were not charged.')

      // Handoff confirmed — the worker now owns the charge and refunds it if analysis fails.
      tokensCharged = 0

      setDone(true)
      setUploading(false)
      setUploadPhase('')
      refreshTokens()
    } catch (err) {
      console.error('Upload failed:', err)

      // Upload never completed — return the tokens we charged up front.
      if (tokensCharged > 0) {
        const refunded = await refundTokens(tokensCharged, 'Refund — failed upload')
        if (!refunded) console.error('Token refund failed after upload error.')
      }

      // Soft-delete the half-built case so it doesn't linger as "processing"
      // (mirrors the dashboard delete; 'failed' isn't an allowed status).
      if (createdId) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from('case-files').remove(uploadedPaths)
        }
        await supabase.from('case_files').delete().eq('case_id', createdId)
        await supabase
          .from('cases')
          .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
          .eq('id', createdId)
      }

      const tooLarge = err.message === 'TRANSCRIPT_TOO_LARGE'
      setError(tooLarge ? 'TRANSCRIPT_TOO_LARGE' : (err.message || 'Upload failed. Please try again.'))
      setUploading(false)
      setUploadPhase('')
      refreshTokens()
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="bg-surface-container-lowest rounded-2xl editorial-shadow p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-primary text-3xl">hourglass_top</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-3">Analysis started</h2>
          <p className="text-sm text-on-surface-variant mb-2 leading-relaxed">
            We're analyzing <span className="font-semibold text-on-surface">{caseName}</span> now. {processingTimeEstimate(pendingPages)} You can safely close this tab.
          </p>
          <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">
            We'll email you the moment it's ready, and you can track progress on your dashboard.
          </p>

          <div className="flex justify-center gap-3">
            <Link
              to="/dashboard"
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">dashboard</span>
              Go to Dashboard
            </Link>
            <button
              onClick={resetForm}
              className="border border-outline-variant/40 text-on-surface px-6 py-3 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Upload another
            </button>
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
                <p className="text-sm font-bold text-on-surface">That file looks unusually large for a transcript.</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Double check it exported correctly, or reach out and we'll take a look.</p>
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
                <span className="text-sm font-bold text-on-surface">{tokenBalance != null ? tokenBalance.toLocaleString() : '—'} token{tokenBalance !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { icon: 'lock', text: 'Encrypted & secure' },
                { icon: 'schedule', text: 'Analysis in minutes' },
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

      {confirmOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl editorial-shadow max-w-md w-full p-8">
            {(tokenBalance ?? 0) < pendingPages ? (
              <>
                <div className="w-12 h-12 rounded-xl bg-error-container/40 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-error text-2xl">error</span>
                </div>
                <h3 className="font-headline text-lg font-bold text-on-surface mb-2">Insufficient Tokens</h3>
                <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
                  This transcript consists of <span className="font-bold text-on-surface">{pendingPages.toLocaleString()} page{pendingPages !== 1 ? 's' : ''}</span> and
                  would cost <span className="font-bold text-on-surface">{pendingPages.toLocaleString()} token{pendingPages !== 1 ? 's' : ''}</span>.
                  You currently have <span className="font-bold text-on-surface">{(tokenBalance ?? 0).toLocaleString()} token{tokenBalance !== 1 ? 's' : ''}</span>.
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
                  This transcript consists of <span className="font-bold text-on-surface">{pendingPages.toLocaleString()} page{pendingPages !== 1 ? 's' : ''}</span> and
                  will cost <span className="font-bold text-on-surface">{pendingPages.toLocaleString()} token{pendingPages !== 1 ? 's' : ''}</span>.
                  You currently have <span className="font-bold text-on-surface">{(tokenBalance ?? 0).toLocaleString()} token{tokenBalance !== 1 ? 's' : ''}</span>.
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
        </div>,
        document.body
      )}
    </main>
  )
}
