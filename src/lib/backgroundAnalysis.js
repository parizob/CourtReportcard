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

      await supabase.storage.from('case-files').upload(jsonStoragePath, jsonBlob)

      await supabase.from('case_files').insert({
        case_id: caseId,
        file_type: 'extracted',
        file_name: jsonFileName,
        file_size: jsonBlob.size,
        storage_path: jsonStoragePath,
        mime_type: 'application/json',
      })
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
