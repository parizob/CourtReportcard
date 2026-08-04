import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { sha256Hex } from '../../lib/fileHash'
import { prepareTranscriptUpload } from '../../lib/prepareTranscriptUpload'

// After this many failures for the same file contents, block further uploads
// of that file and point the user to support (Gemini cost on doomed retries).
const RETRY_BLOCK_AFTER = 2

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
// CHUNK_THRESHOLD_PAGES / PROOFREAD_PARALLEL_CONCURRENCY in
// supabase/functions/analyze-case/). Proofread batches run in capped parallel
// waves; extract chunks stay serial. Ranges stay generous so a slow run still
// lands inside what we told the user to expect. Tuned 2026-07-31 against Dev
// parallel soak (~51-page dense job ~4 min end-to-end).
function processingTimeEstimate(pages) {
  if (pages < 20) return { prefix: 'This usually takes ', duration: '2 to 5 minutes', suffix: '.' }
  if (pages < 50) return { prefix: 'This usually takes ', duration: '3 to 7 minutes', suffix: '.' }
  if (pages < 100) return { prefix: 'This usually takes ', duration: '6 to 12 minutes', suffix: '.' }
  if (pages < 150) return { prefix: 'This usually takes ', duration: '10 to 20 minutes', suffix: '.' }
  return { prefix: 'This can take ', duration: '15 to 30 minutes', suffix: ' for very large documents.' }
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
  const [searchParams] = useSearchParams()
  const preview = searchParams.get('preview')
  const previewRetryBanner = preview === 'retry-banner'
  const previewTooLarge = preview === 'too-large'
  // UI-only: confirmation card without upload / Gemini (e.g. ?preview=started&pages=55).
  const previewStarted = preview === 'started'
  const previewPages = (() => {
    const n = Number(searchParams.get('pages'))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 55
  })()
  const [caseName, setCaseName] = useState(previewStarted ? 'Sample Case' : '')
  const [transcriptFiles, setTranscriptFiles] = useState([])
  const [fileHash, setFileHash] = useState(null)
  // retryBlocked keeps Upload disabled; retryBannerVisible is the dismissible alert.
  const [retryBlocked, setRetryBlocked] = useState(previewRetryBanner)
  const [retryBannerVisible, setRetryBannerVisible] = useState(previewRetryBanner)
  const [retryBannerExiting, setRetryBannerExiting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState('')
  const [done, setDone] = useState(previewStarted)
  const [error, setError] = useState('')
  const [tooLargeBannerVisible, setTooLargeBannerVisible] = useState(previewTooLarge)
  const [tooLargeBannerExiting, setTooLargeBannerExiting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPages, setPendingPages] = useState(previewStarted ? previewPages : 0)
  const [counting, setCounting] = useState(false)
  const [phiCertified, setPhiCertified] = useState(false)

  const canUpload =
    caseName.trim().length > 0 &&
    transcriptFiles.length > 0 &&
    !uploading &&
    !counting &&
    !retryBlocked

  const markRetryBlocked = () => {
    setRetryBlocked(true)
    setRetryBannerExiting(false)
    setRetryBannerVisible(true)
  }

  const clearRetryState = () => {
    setRetryBlocked(previewRetryBanner)
    setRetryBannerVisible(previewRetryBanner)
    setRetryBannerExiting(false)
  }

  // Same dismiss pattern as the billing checkout banner: hold 5s, collapse, unmount.
  useEffect(() => {
    if (!retryBannerVisible) return
    setRetryBannerExiting(false)
    const exitTimer = setTimeout(() => setRetryBannerExiting(true), 5000)
    const removeTimer = setTimeout(() => {
      setRetryBannerVisible(false)
      setRetryBannerExiting(false)
    }, 5340)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [retryBannerVisible])

  useEffect(() => {
    if (!tooLargeBannerVisible) return
    setTooLargeBannerExiting(false)
    const exitTimer = setTimeout(() => setTooLargeBannerExiting(true), 5000)
    const removeTimer = setTimeout(() => {
      setTooLargeBannerVisible(false)
      setTooLargeBannerExiting(false)
    }, 5340)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [tooLargeBannerVisible])

  const showTooLargeBanner = (on) => {
    if (on) {
      setTooLargeBannerExiting(false)
      setTooLargeBannerVisible(true)
      setError('')
    } else {
      setTooLargeBannerVisible(false)
      setTooLargeBannerExiting(false)
    }
  }

  const resetForm = () => {
    setDone(false)
    setCaseName('')
    setTranscriptFiles([])
    setFileHash(null)
    clearRetryState()
    setPendingPages(0)
    setError('')
    showTooLargeBanner(false)
  }

  const onTranscriptChosen = async (file) => {
    if (!file) return
    const err = validateFile(file)
    if (err) {
      setTranscriptFiles([])
      setFileHash(null)
      clearRetryState()
      if (err === 'TRANSCRIPT_TOO_LARGE') {
        showTooLargeBanner(true)
      } else {
        showTooLargeBanner(false)
        setError(err)
      }
      return
    }
    setError('')
    showTooLargeBanner(false)
    setTranscriptFiles([file])
    setFileHash(null)
    clearRetryState()
    try {
      const hash = await sha256Hex(file)
      setFileHash(hash)
      const { data: count, error: countErr } = await supabase.rpc('get_upload_failure_count', {
        p_hash: hash,
      })
      if (countErr) {
        console.error('Failure fingerprint check failed:', countErr)
        return
      }
      if ((count ?? 0) >= RETRY_BLOCK_AFTER) markRetryBlocked()
    } catch (hashErr) {
      console.error('Could not hash transcript file:', hashErr)
    }
  }

  const handleUploadClick = async () => {
    setError('')
    setCounting(true)
    try {
      let totalPages = 0
      for (const file of transcriptFiles) {
        const text = await file.text()
        totalPages += prepareTranscriptUpload(file.name, text).pages
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
        // Strip RTF in the browser and store plain text. Edge RTF stripping has
        // never successfully finished a real case (silent stuck failures).
        const text = await file.text()
        const prepared = prepareTranscriptUpload(file.name, text)
        const storageName = safeStorageFileName(prepared.uploadFileName)
        const storagePath = `${user.id}/${caseRow.id}/transcript/${storageName}`
        const blob = new Blob([prepared.plainText], { type: prepared.mimeType })

        const { error: storageErr } = await supabase.storage
          .from('case-files')
          .upload(storagePath, blob, { contentType: prepared.mimeType })
        if (storageErr) throw storageErr
        uploadedPaths.push(storagePath)

        const { error: fileErr } = await supabase
          .from('case_files')
          .insert({
            case_id: caseRow.id,
            file_type: 'transcript',
            // Keep original .rtf in file_name so the editor can soft-wrap; storage
            // still holds stripped plain text under uploadFileName.
            file_name: prepared.displayName,
            file_size: blob.size,
            storage_path: storagePath,
            mime_type: prepared.mimeType,
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

      // Upload never completed — return the tokens charged on this case.
      if (tokensCharged > 0 && createdId) {
        const refunded = await refundTokens(createdId, 'Refund — failed upload')
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

      // Fingerprint this file so a doomed retry of the same bytes can be blocked.
      const hashToRecord = fileHash || (transcriptFiles[0] ? await sha256Hex(transcriptFiles[0]).catch(() => null) : null)
      if (hashToRecord) {
        const { data: newCount } = await supabase.rpc('record_upload_failure', {
          p_hash: hashToRecord,
          p_file_name: transcriptFiles[0]?.name || null,
        })
        if ((newCount ?? 0) >= RETRY_BLOCK_AFTER) markRetryBlocked()
      }

      const tooLarge = err.message === 'TRANSCRIPT_TOO_LARGE'
      if (tooLarge) {
        showTooLargeBanner(true)
      } else {
        setError(err.message || 'Upload failed. Please try again.')
      }
      setUploading(false)
      setUploadPhase('')
      refreshTokens()
    }
  }

  if (done) {
    // Same shell as the upload form: center in the content column (not the
    // full viewport, which pulls the card left toward the sidebar).
    const timeEst = processingTimeEstimate(pendingPages)
    return (
      <main className="h-[calc(100vh-65px)] overflow-y-auto bg-background flex flex-col px-6 py-8">
        <div className="w-full max-w-md mx-auto my-auto bg-surface-container-lowest rounded-2xl editorial-shadow p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-primary text-3xl">hourglass_top</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-on-surface mb-3">Analysis started</h2>
          <p className="text-sm text-on-surface-variant mb-2 leading-relaxed">
            We're analyzing <span className="font-semibold text-on-surface">{caseName}</span> now.{' '}
            {timeEst.prefix}
            <span className="inline-block px-1.5 py-0.5 rounded-md bg-primary-fixed/50 text-on-surface font-semibold whitespace-nowrap">
              {timeEst.duration}
            </span>
            {timeEst.suffix}{' '}
            You can safely close this tab.
          </p>
          <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">
            We'll email you the moment it's ready, and you can track progress on your dashboard.
          </p>

          <div className="flex flex-col items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary px-8 py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all editorial-shadow whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              Go to Dashboard
            </Link>
            <button
              type="button"
              onClick={resetForm}
              className="group text-sm font-bold text-primary inline-flex items-center gap-1 hover:text-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] transition-transform group-hover:scale-125">add</span>
              Upload another
            </button>
          </div>
        </div>
      </main>
    )
  }

  // Tall screens: my-auto vertically centers the form.
  // Short/zoomed: no free space left, so my-auto collapses and overflow-y-auto
  // lets them scroll to Upload and Analyze (without clipping the top).
  return (
    <main className="h-[calc(100vh-65px)] overflow-y-auto bg-background flex flex-col px-6 py-8">
      <div className="w-full max-w-xl mx-auto my-auto flex flex-col gap-5">

        {/* Header */}
        <div className="shrink-0">
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">Upload New Case</h1>
          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
            Name your case and upload an English transcript (.txt or .rtf). Plain .txt from your CAT software is preferred. It usually keeps line numbers clearer than .rtf.
          </p>
        </div>

        {/* Retry block — same file contents failed twice already */}
        {retryBannerVisible && (
          <div
            className={`shrink-0 grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
              retryBannerExiting ? 'grid-rows-[0fr] opacity-0 mb-0' : 'grid-rows-[1fr] opacity-100'
            }`}
          >
            <div className="overflow-hidden min-h-0">
              <div className="p-3.5 bg-surface-container-lowest border border-error/25 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-error text-lg shrink-0 mt-0.5">front_hand</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface">This file has already failed twice.</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    Please don&apos;t keep uploading it. That won&apos;t fix the issue, and it burns processing on a file that needs a human look.
                    {' '}
                    <Link to="/support" className="font-bold text-primary hover:underline">
                      Contact support
                    </Link>
                    {' '}
                    and we&apos;ll dig in.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Too-large banner — soft amber warning, same dismiss as retry/billing */}
        {tooLargeBannerVisible && !retryBlocked && (
          <div
            className={`shrink-0 grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
              tooLargeBannerExiting ? 'grid-rows-[0fr] opacity-0 mb-0' : 'grid-rows-[1fr] opacity-100'
            }`}
          >
            <div className="overflow-hidden min-h-0">
              <div className="p-3.5 bg-surface-container-lowest border border-tertiary-fixed-dim/40 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-tertiary-fixed-dim text-lg shrink-0 mt-0.5">volunteer_activism</span>
                <div>
                  <p className="text-sm font-bold text-on-surface">That file looks unusually large for a transcript.</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Double check it exported correctly, or reach out and we'll take a look.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other upload errors */}
        {error && !retryBlocked && !tooLargeBannerVisible && (
          <div className="shrink-0 p-3 bg-error-container/30 border border-error/20 rounded-xl text-sm text-error font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            {error}
          </div>
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
                <p className="text-xs text-on-surface-variant/60 mt-1">.txt preferred · .rtf also works · English only</p>
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.rtf"
                  onChange={(e) => onTranscriptChosen(e.target.files[0])}
                />
              </label>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-5 gap-3 min-w-0 w-full overflow-hidden">
                <div className="flex items-center gap-3 w-full min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${retryBlocked ? 'bg-error-container/40' : 'bg-green-100'}`}>
                    <span className={`material-symbols-outlined text-lg ${retryBlocked ? 'text-error' : 'text-green-600'}`}>
                      {retryBlocked ? 'block' : 'check_circle'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{transcriptFiles[0].name}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {transcriptFiles[0].name.split('.').pop().toUpperCase()} &middot; {(transcriptFiles[0].size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <span className={`material-symbols-outlined text-lg shrink-0 ${retryBlocked ? 'text-error' : 'text-green-500'}`}>
                    {retryBlocked ? 'block' : 'check'}
                  </span>
                </div>
                <label className="flex items-center gap-1 text-xs font-bold text-primary cursor-pointer hover:underline">
                  <span className="material-symbols-outlined text-sm">swap_horiz</span>
                  Change file
                  <input
                    type="file"
                    className="hidden"
                    accept=".txt,.rtf"
                    onChange={(e) => onTranscriptChosen(e.target.files[0])}
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
        <div className="shrink-0 flex items-center justify-between gap-4 bg-surface-container-lowest rounded-xl editorial-shadow px-5 py-3.5">
          <div className="min-w-0 flex-1">
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
            <div className="flex items-start gap-1.5 mt-1 max-w-xl text-[9px] leading-snug text-on-surface-variant/70">
              <span className="font-semibold tracking-wide shrink-0">NOTE:</span>
              <p className="italic min-w-0">
                Index and exhibit lists are not reviewed. Leave them out
                <br />
                of the upload if you want to save tokens.
              </p>
            </div>
          </div>
          <button
            disabled={!canUpload}
            onClick={handleUploadClick}
            className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-7 py-2.5 rounded-lg font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
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
                <p className="text-sm text-on-surface-variant mb-3 leading-relaxed">
                  This transcript consists of <span className="font-bold text-on-surface">{pendingPages.toLocaleString()} page{pendingPages !== 1 ? 's' : ''}</span> and
                  will cost <span className="font-bold text-on-surface">{pendingPages.toLocaleString()} token{pendingPages !== 1 ? 's' : ''}</span>.
                  You currently have <span className="font-bold text-on-surface">{(tokenBalance ?? 0).toLocaleString()} token{tokenBalance !== 1 ? 's' : ''}</span>.
                </p>
                <p className="text-xs text-on-surface-variant mb-5 leading-relaxed italic">
                  <span className="font-semibold not-italic tracking-wide">NOTE:</span>{' '}
                  Index and exhibit lists are not reviewed. Leave them out
                  <br />
                  of the upload if you want to save tokens.
                </p>
                <label className="flex items-start gap-3 cursor-pointer group mb-6 p-3 rounded-lg bg-error-container/20 border border-error/20">
                  <input
                    type="checkbox"
                    checked={phiCertified}
                    onChange={(e) => setPhiCertified(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-on-surface leading-relaxed">
                    I certify that this transcript contains <span className="font-bold">no Protected Health Information (PHI)</span>, does not include any data regulated under HIPAA, and is not subject to a sealing or protective order.
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
