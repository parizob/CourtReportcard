import { supabase } from './supabase'
import { extractTranscriptWithGemini } from './gemini'

const activeJobs = new Map()

export function isAnalyzing(caseId) {
  return activeJobs.has(caseId)
}

export function getActiveJobs() {
  return new Map(activeJobs)
}

export async function startAnalysis(caseId, files, userId) {
  if (activeJobs.has(caseId)) return

  activeJobs.set(caseId, { status: 'running', startedAt: Date.now() })

  try {
    await supabase.from('cases').update({ status: 'processing' }).eq('id', caseId)

    let totalEntries = 0
    let totalIssues = 0

    for (const file of files) {
      const isPdf = file.name.toLowerCase().endsWith('.pdf')
      let extractedJson

      if (isPdf) {
        const buffer = await file.arrayBuffer()
        extractedJson = await extractTranscriptWithGemini(buffer, 'application/pdf')
      } else {
        const rawContent = await file.text()
        extractedJson = await extractTranscriptWithGemini(rawContent)
      }

      totalEntries += (extractedJson.entries || []).length
      totalIssues += (extractedJson.annotations || []).length

      const jsonBlob = new Blob(
        [JSON.stringify(extractedJson, null, 2)],
        { type: 'application/json' }
      )

      const jsonFileName = file.name.replace(/\.(rtf|cre|pdf|txt)$/i, '') + '_extracted.json'
      const jsonStoragePath = `${userId}/${caseId}/extracted/${jsonFileName}`

      await supabase.storage.from('case-files').upload(jsonStoragePath, jsonBlob, { upsert: true })

      await supabase.from('case_files').upsert({
        case_id: caseId,
        file_type: 'extracted',
        file_name: jsonFileName,
        file_size: jsonBlob.size,
        storage_path: jsonStoragePath,
        mime_type: 'application/json',
      }, { onConflict: 'case_id,file_type' }).select()
    }

    await supabase.from('case_metrics').upsert({
      case_id: caseId,
      total_entries: totalEntries,
      total_issues: totalIssues,
      accepted: 0,
      ignored: 0,
      open: totalIssues,
      last_reviewed_at: new Date().toISOString(),
    }, { onConflict: 'case_id' })

    await supabase.from('cases').update({ status: 'analyzed' }).eq('id', caseId)
    activeJobs.set(caseId, { status: 'done' })
  } catch (err) {
    console.error('Background analysis failed for case:', caseId, err)
    await supabase.from('cases').update({ status: 'uploaded' }).eq('id', caseId).catch(() => {})
    activeJobs.set(caseId, { status: 'error', error: err.message })
  } finally {
    setTimeout(() => activeJobs.delete(caseId), 5000)
  }
}

/**
 * Checks for cases stuck at 'processing' or 'uploaded' (with transcript files
 * but no extracted file) and automatically restarts analysis.
 * Called on dashboard load.
 */
export async function retryStuckCases() {
  const { data: stuckCases, error } = await supabase
    .from('cases')
    .select('*, case_files(*)')
    .in('status', ['processing', 'uploaded'])

  if (error || !stuckCases) return

  for (const c of stuckCases) {
    if (activeJobs.has(c.id)) continue

    const transcriptFiles = (c.case_files || []).filter((f) => f.file_type === 'transcript')
    const hasExtracted = (c.case_files || []).some((f) => f.file_type === 'extracted')

    if (transcriptFiles.length === 0) continue
    if (hasExtracted && c.status === 'uploaded') {
      await supabase.from('cases').update({ status: 'analyzed' }).eq('id', c.id)
      continue
    }
    if (hasExtracted) continue

    activeJobs.set(c.id, { status: 'running', startedAt: Date.now() })
    await supabase.from('cases').update({ status: 'processing' }).eq('id', c.id)

    runRetry(c, transcriptFiles).catch(() => {})
  }
}

async function runRetry(caseRow, transcriptDbFiles) {
  try {
    let totalEntries = 0
    let totalIssues = 0

    for (const dbFile of transcriptDbFiles) {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('case-files')
        .download(dbFile.storage_path)
      if (dlErr || !blob) {
        console.error('Failed to download file for retry:', dbFile.file_name, dlErr)
        continue
      }

      const isPdf = dbFile.file_name.toLowerCase().endsWith('.pdf')
      let extractedJson

      if (isPdf) {
        const buffer = await blob.arrayBuffer()
        extractedJson = await extractTranscriptWithGemini(buffer, 'application/pdf')
      } else {
        const rawContent = await blob.text()
        extractedJson = await extractTranscriptWithGemini(rawContent)
      }

      totalEntries += (extractedJson.entries || []).length
      totalIssues += (extractedJson.annotations || []).length

      const jsonBlob = new Blob(
        [JSON.stringify(extractedJson, null, 2)],
        { type: 'application/json' }
      )

      const jsonFileName = dbFile.file_name.replace(/\.(rtf|cre|pdf|txt)$/i, '') + '_extracted.json'
      const userId = caseRow.user_id
      const jsonStoragePath = `${userId}/${caseRow.id}/extracted/${jsonFileName}`

      await supabase.storage.from('case-files').upload(jsonStoragePath, jsonBlob, { upsert: true })

      const existing = (caseRow.case_files || []).find(
        (f) => f.file_type === 'extracted' && f.file_name === jsonFileName
      )
      if (existing) {
        await supabase.from('case_files')
          .update({ file_size: jsonBlob.size, storage_path: jsonStoragePath })
          .eq('id', existing.id)
      } else {
        await supabase.from('case_files').insert({
          case_id: caseRow.id,
          file_type: 'extracted',
          file_name: jsonFileName,
          file_size: jsonBlob.size,
          storage_path: jsonStoragePath,
          mime_type: 'application/json',
        })
      }
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
    activeJobs.set(caseRow.id, { status: 'done' })
  } catch (err) {
    console.error('Retry analysis failed for case:', caseRow.id, err)
    await supabase.from('cases').update({ status: 'uploaded' }).eq('id', caseRow.id).catch(() => {})
    activeJobs.set(caseRow.id, { status: 'error', error: err.message })
  } finally {
    setTimeout(() => activeJobs.delete(caseRow.id), 5000)
  }
}
