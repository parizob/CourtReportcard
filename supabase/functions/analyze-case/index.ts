// Background transcript analysis worker.
//
// Triggered (fire-and-forget) by the client after a case's files are uploaded.
// Runs the two-pass Gemini extraction + proofread entirely server-side so the
// user never waits on the upload screen, then emails them the result.
//
// IMPORTANT: the dedup/flexFind logic below (and the prompts in prompts.ts) are
// MIRRORED from src/lib/gemini.js (the browser source of truth). If you change
// the proofreading logic or prompts there, update them here too.

import { createClient } from 'npm:@supabase/supabase-js@2.45.0'
import { EXTRACTION_ONLY_PROMPT, PROOFREAD_ONLY_PROMPT } from './prompts.ts'

const MODEL = 'gemini-2.5-pro'
const SITE_URL = 'https://courtreportcard.com'
const FROM_ADDRESS = 'Court Reportcard <noreply@courtreportcard.com>'

// Free-tier Edge Functions are hard-killed at 150s wall-clock. Abort the Gemini
// calls a bit before that so the failure path (refund + email) always gets to
// run instead of the worker being killed mid-analysis and leaving the case stuck.
const ANALYSIS_DEADLINE_MS = 135000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Gemini call (direct; mirrors api/gemini.js generationConfig) ──
async function callGemini(prompt: string, filePart: unknown = null, deadlineAt = 0, thinkingBudget?: number): Promise<any> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured.')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
  const parts: unknown[] = []
  if (filePart) parts.push(filePart)
  parts.push({ text: prompt })

  const controller = new AbortController()
  let timer: number | undefined
  if (deadlineAt) {
    const remaining = deadlineAt - Date.now()
    if (remaining <= 0) throw new Error('ANALYSIS_TIMEOUT')
    timer = setTimeout(() => controller.abort(), remaining)
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 131072,
          responseMimeType: 'application/json',
          ...(thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget } } : {}),
        },
      }),
    })
  } catch (err) {
    if (timer) clearTimeout(timer)
    if ((err as Error).name === 'AbortError') throw new Error('ANALYSIS_TIMEOUT')
    throw err
  }
  if (timer) clearTimeout(timer)

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    throw new Error(errBody?.error?.message || `Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) throw new Error('Gemini returned no content.')

  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

// ── flexFind + position fixing (mirrored from src/lib/gemini.js) ──
function _isWordChar(str: string, i: number): boolean {
  if (i < 0 || i >= str.length) return false
  return /\w/.test(str[i])
}

function _checkBoundaries(text: string, start: number, end: number, search: string): boolean {
  const searchStart = search[0]
  const searchEnd = search[search.length - 1]
  if (/\w/.test(searchStart) && _isWordChar(text, start - 1)) return false
  if (/\w/.test(searchEnd) && _isWordChar(text, end)) return false
  return true
}

function flexFind(text: string, search: string): { start: number; end: number } | null {
  if (!text || !search) return null

  let idx = text.indexOf(search)
  while (idx !== -1) {
    if (_checkBoundaries(text, idx, idx + search.length, search)) {
      return { start: idx, end: idx + search.length }
    }
    idx = text.indexOf(search, idx + 1)
  }

  const lowerText = text.toLowerCase()
  const lowerSearch = search.toLowerCase()
  idx = lowerText.indexOf(lowerSearch)
  while (idx !== -1) {
    if (_checkBoundaries(text, idx, idx + lowerSearch.length, lowerSearch)) {
      return { start: idx, end: idx + lowerSearch.length }
    }
    idx = lowerText.indexOf(lowerSearch, idx + 1)
  }

  try {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/\s+/g, '\\s+')
    const startsWord = /^\w/.test(search)
    const endsWord = /\w$/.test(search)
    const wrapped = `${startsWord ? '(?<![\\w])' : ''}${pattern}${endsWord ? '(?![\\w])' : ''}`
    const regex = new RegExp(wrapped, 'i')
    const match = text.match(regex)
    if (match) return { start: match.index!, end: match.index! + match[0].length }
  } catch (_) { /* regex safety */ }

  try {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/\s+/g, '(?:\\s+\\d+)?\\s+')
    const startsWord = /^\w/.test(search)
    const endsWord = /\w$/.test(search)
    const wrapped = `${startsWord ? '(?<![\\w])' : ''}${pattern}${endsWord ? '(?![\\w])' : ''}`
    const regex = new RegExp(wrapped, 'i')
    const match = text.match(regex)
    if (match) return { start: match.index!, end: match.index! + match[0].length }
  } catch (_) { /* regex safety */ }

  return null
}

function fixAnnotationPositions(entries: any[], annotations: any[]): any[] {
  return annotations.map((a) => {
    if (!a.original) return a
    const entry = entries.find((e) => e.id === a.entry_id)
    if (entry) {
      const m = flexFind(entry.text, a.original)
      if (m) return { ...a, start: m.start, end: m.end }
    }
    for (const e of entries) {
      if (e.id === a.entry_id) continue
      const m = flexFind(e.text, a.original)
      if (m) return { ...a, entry_id: e.id, start: m.start, end: m.end }
    }
    return a
  })
}

function deduplicateTranscript(rawEntries: any[], rawAnnotations: any[]): { entries: any[]; annotations: any[] } {
  const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const entryKeyMap: Record<string, number> = {}
  const idRemapTable: Record<number, number> = {}
  const deduped: any[] = []

  for (const entry of rawEntries) {
    const key = `${normalize(entry.speaker)}|||${normalize(entry.text)}`
    if (entryKeyMap[key] !== undefined) {
      idRemapTable[entry.id] = entryKeyMap[key]
    } else {
      deduped.push(entry)
      entryKeyMap[key] = entry.id
    }
  }

  const oldToNewId: Record<number, number> = {}
  deduped.forEach((e, i) => {
    oldToNewId[e.id] = i + 1
    e.id = i + 1
  })

  let annots = (rawAnnotations || []).map((a) => {
    let targetId = a.entry_id
    if (idRemapTable[targetId] !== undefined) targetId = idRemapTable[targetId]
    if (oldToNewId[targetId] !== undefined) targetId = oldToNewId[targetId]
    return { ...a, entry_id: targetId }
  })

  annots = fixAnnotationPositions(deduped, annots)

  const entryIds = new Set(deduped.map((e) => e.id))
  annots = annots.filter((a) => entryIds.has(a.entry_id))

  const seenAnnotations = new Set<string>()
  annots = annots.filter((a) => {
    const key = `${a.entry_id}:${normalize(a.original)}:${a.type}`
    if (seenAnnotations.has(key)) return false
    seenAnnotations.add(key)
    return true
  })

  annots.forEach((a, i) => { a.id = i + 1 })
  return { entries: deduped, annotations: annots }
}

function countByType(annotations: any[]): Record<string, number> {
  if (!Array.isArray(annotations)) return {}
  const counts: Record<string, number> = {}
  for (const a of annotations) {
    const t = a?.type || 'other'
    counts[t] = (counts[t] || 0) + 1
  }
  return counts
}

// ── RTF stripping (mirrored from src/lib/rtf.js) ──
const HEADER_GROUPS = [
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer',
  'object', 'themedata', 'datastore', 'latentstyles', 'rsidtbl', 'mmathPr',
  'wgrffmtfilter', 'listtable', 'listoverridetable', 'revtbl',
]

function isRtf(text: string): boolean {
  return typeof text === 'string' && text.trimStart().startsWith('{\\rtf')
}

function matchGroup(text: string, start: number): number {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '\\' && i + 1 < text.length) { i++; continue }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}

function stripRtf(rtf: string): string {
  if (!isRtf(rtf)) return rtf
  let s = rtf

  let prev
  do {
    prev = s
    const idx = s.search(/\{\\\*/)
    if (idx !== -1) {
      const end = matchGroup(s, idx)
      if (end !== -1) s = s.substring(0, idx) + s.substring(end)
    }
  } while (s !== prev && s.includes('{\\*'))

  for (const grp of HEADER_GROUPS) {
    const re = new RegExp(`\\{\\\\${grp}\\b`)
    let idx
    while ((idx = s.search(re)) !== -1) {
      const end = matchGroup(s, idx)
      if (end === -1) break
      s = s.substring(0, idx) + s.substring(end)
    }
  }

  s = s.replace(/\\par\b ?/g, '\n')
  s = s.replace(/\\line\b ?/g, '\n')
  s = s.replace(/\\tab\b ?/g, '\t')
  s = s.replace(/\\page\b ?/g, '\n\n')
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  s = s.replace(/\\u(-?\d+)\??/g, (_, n) => {
    let code = parseInt(n, 10)
    if (code < 0) code += 65536
    return String.fromCharCode(code)
  })
  s = s.replace(/\\\\/g, '\u0001')
  s = s.replace(/\\\{/g, '\u0002')
  s = s.replace(/\\\}/g, '\u0003')
  s = s.replace(/\\[a-zA-Z]+-?\d* ?/g, '')
  s = s.replace(/\\[^a-zA-Z]/g, '')
  s = s.replace(/[{}]/g, '')
  s = s.replace(/\u0001/g, '\\').replace(/\u0002/g, '{').replace(/\u0003/g, '}')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// Two-pass extraction + proofread (mirrors extractTranscriptWithGemini).
async function analyzeContent(fileOrText: string | ArrayBuffer, mimeType: string | undefined, deadlineAt: number): Promise<any> {
  let filePart: unknown = null
  let promptSuffix = ''

  if (mimeType === 'application/pdf' && fileOrText instanceof ArrayBuffer) {
    filePart = { inlineData: { mimeType: 'application/pdf', data: arrayBufferToBase64(fileOrText) } }
    promptSuffix = '\n\n[PDF file attached above]'
  } else {
    promptSuffix = `\n\n${fileOrText}`
  }

  // Extraction is mostly mechanical transcription, not multi-step reasoning, so a
  // bounded thinking budget keeps latency predictable without hurting accuracy —
  // this leaves more of the 135s deadline for the proofread pass below, which is
  // the call that actually catches transcript errors and keeps full thinking.
  const extractionResult = await callGemini(`${EXTRACTION_ONLY_PROMPT}${promptSuffix}`, filePart, deadlineAt, 1024)
  if (!extractionResult.entries || !Array.isArray(extractionResult.entries)) {
    throw new Error('Gemini response missing "entries" array.')
  }

  let entries = extractionResult.entries.map((entry: any, i: number) => ({
    id: entry.id || i + 1,
    speaker: entry.speaker || 'UNKNOWN',
    text: entry.text || '',
    timestamp: entry.timestamp || null,
    line_number: entry.line_number || null,
  }))

  const { entries: cleanEntries } = deduplicateTranscript(entries, [])
  entries = cleanEntries

  const proofreadResult = await callGemini(`${PROOFREAD_ONLY_PROMPT}\n\n${JSON.stringify(entries, null, 2)}`, null, deadlineAt)

  let annots = (proofreadResult.annotations || []).map((a: any, i: number) => ({
    id: a.id || i + 1,
    entry_id: a.entry_id,
    type: a.type || 'spelling',
    severity: a.severity || 'warning',
    original: a.original || '',
    suggestion: a.suggestion || '',
    explanation: a.explanation || '',
    confidence: a.confidence ?? 0.8,
    start: a.start ?? 0,
    end: a.end ?? 0,
    status: 'open',
  }))

  annots = fixAnnotationPositions(entries, annots)

  const entryIds = new Set(entries.map((e: any) => e.id))
  annots = annots.filter((a: any) => entryIds.has(a.entry_id))

  const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const seenAnnotations = new Set<string>()
  annots = annots.filter((a: any) => {
    const key = `${a.entry_id}:${normalize(a.original)}:${a.type}`
    if (seenAnnotations.has(key)) return false
    seenAnnotations.add(key)
    return true
  })
  annots.forEach((a: any, i: number) => { a.id = i + 1 })

  return {
    title: extractionResult.title || '',
    extracted_at: new Date().toISOString(),
    entries,
    annotations: annots,
  }
}

// ── Email (Resend) ──
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured — skipping email.')
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('Resend email failed:', err)
  }
}

function successEmailHtml(caseName: string, issueCount: number, caseId: string): string {
  const editorUrl = `${SITE_URL}/dashboard/editor?case=${caseId}`
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <div style="background: #001939; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">Your transcript is ready</p>
      </div>
      <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          Good news — we've finished analyzing <strong>${caseName}</strong> and found
          <strong>${issueCount} suggestion${issueCount === 1 ? '' : 's'}</strong> to review.
        </p>
        <a href="${editorUrl}" style="display: inline-block; background: #001939; color: white; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; margin: 8px 0 16px;">Open in Editor</a>
        <p style="font-size: 12px; color: #6b7280; margin: 0;">If the button doesn't work, paste this link into your browser:<br />${editorUrl}</p>
      </div>
    </div>
  `
}

function failureEmailHtml(caseName: string, refunded: number): string {
  const supportUrl = `${SITE_URL}/support`
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <div style="background: #001939; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">We couldn't finish your transcript</p>
      </div>
      <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          We hit a problem analyzing <strong>${caseName}</strong>, so it wasn't completed.
          We've <strong>refunded ${refunded} token${refunded === 1 ? '' : 's'}</strong> — you weren't charged.
        </p>
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          This usually happens with very large files. Try splitting the transcript into chunks of
          roughly 50 pages each and uploading again.
        </p>
        <a href="${supportUrl}" style="display: inline-block; background: #001939; color: white; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px;">Contact Support</a>
      </div>
    </div>
  `
}

// ── Handler ──
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  let caseId: string
  try {
    const body = await req.json()
    caseId = body.case_id
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }
  if (!caseId) return json({ error: 'case_id is required.' }, 400)

  // Verify the caller owns the case (defense in depth on top of verify_jwt).
  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData } = await userClient.auth.getUser()
  const callerId = userData?.user?.id
  if (!callerId) return json({ error: 'Unauthorized.' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: caseRow, error: caseErr } = await admin
    .from('cases')
    .select('*, case_files(*)')
    .eq('id', caseId)
    .single()

  if (caseErr || !caseRow) return json({ error: 'Case not found.' }, 404)
  if (caseRow.user_id !== callerId) return json({ error: 'Forbidden.' }, 403)

  // Idempotency: only process a case that's actively 'processing' with no result yet.
  const alreadyExtracted = (caseRow.case_files || []).some((f: any) => f.file_type === 'extracted')
  if (alreadyExtracted) {
    if (caseRow.status === 'processing') {
      await admin.from('cases').update({ status: 'analyzed' }).eq('id', caseId)
    }
    return json({ ok: true, skipped: 'already_analyzed' })
  }
  if (caseRow.status !== 'processing') {
    return json({ ok: true, skipped: `status_${caseRow.status}` })
  }

  const transcriptFiles = (caseRow.case_files || []).filter((f: any) => f.file_type === 'transcript')
  if (transcriptFiles.length === 0) return json({ error: 'No transcript files.' }, 400)

  // Do the heavy work after responding so the client truly fires-and-forgets.
  const work = (async () => {
    const deadlineAt = Date.now() + ANALYSIS_DEADLINE_MS
    try {
      let totalEntries = 0
      let totalIssues = 0
      const byType: Record<string, number> = {}

      for (const dbFile of transcriptFiles) {
        const { data: blob, error: dlErr } = await admin.storage
          .from('case-files')
          .download(dbFile.storage_path)
        if (dlErr || !blob) throw new Error(`Failed to download ${dbFile.file_name}`)

        const isPdf = dbFile.file_name.toLowerCase().endsWith('.pdf')
        const isTxt = dbFile.file_name.toLowerCase().endsWith('.txt')
        const isRtf = dbFile.file_name.toLowerCase().endsWith('.rtf')

        let extractedJson: any
        if (isPdf) {
          const buffer = await blob.arrayBuffer()
          extractedJson = await analyzeContent(buffer, 'application/pdf', deadlineAt)
        } else {
          const rawContent = await blob.text()
          const plainText = isRtf ? stripRtf(rawContent) : rawContent
          extractedJson = await analyzeContent(plainText, undefined, deadlineAt)
          if (isTxt || isRtf) extractedJson.originalText = plainText
        }

        totalEntries += (extractedJson.entries || []).length
        totalIssues += (extractedJson.annotations || []).length
        const fileByType = countByType(extractedJson.annotations || [])
        for (const [k, v] of Object.entries(fileByType)) byType[k] = (byType[k] || 0) + (v as number)

        const jsonBytes = new TextEncoder().encode(JSON.stringify(extractedJson, null, 2))
        const jsonFileName = dbFile.file_name.replace(/\.(rtf|cre|pdf|txt)$/i, '') + '_extracted.json'
        const jsonStoragePath = `${caseRow.user_id}/${caseId}/extracted/${jsonFileName}`

        await admin.storage.from('case-files').upload(jsonStoragePath, jsonBytes, {
          upsert: true,
          contentType: 'application/json',
        })

        await admin.from('case_files').insert({
          case_id: caseId,
          file_type: 'extracted',
          file_name: jsonFileName,
          file_size: jsonBytes.byteLength,
          storage_path: jsonStoragePath,
          mime_type: 'application/json',
        })
      }

      await admin.from('case_metrics').upsert({
        case_id: caseId,
        total_entries: totalEntries,
        total_issues: totalIssues,
        accepted: 0,
        ignored: 0,
        open: totalIssues,
        annotations_by_type: byType,
        last_reviewed_at: new Date().toISOString(),
      }, { onConflict: 'case_id' })

      await admin.from('cases').update({ status: 'analyzed' }).eq('id', caseId)

      const { data: u } = await admin.auth.admin.getUserById(caseRow.user_id)
      if (u?.user?.email) {
        await sendEmail(u.user.email, `Your transcript is ready — ${caseRow.name}`, successEmailHtml(caseRow.name, totalIssues, caseId))
      }
    } catch (err) {
      console.error('Analysis failed for case', caseId, err)

      // Refund the tokens charged up front (service role bypasses RLS).
      const refund = caseRow.tokens_charged || 0
      if (refund > 0) {
        const { data: prof } = await admin
          .from('user_profiles')
          .select('balance')
          .eq('user_id', caseRow.user_id)
          .single()
        if (prof) {
          await admin.from('user_profiles')
            .update({ balance: prof.balance + refund, updated_at: new Date().toISOString() })
            .eq('user_id', caseRow.user_id)
          await admin.from('token_ledger').insert({
            user_id: caseRow.user_id,
            amount: refund,
            type: 'refund',
            description: 'Refund — failed analysis',
          })
        }
      }

      // Soft-delete so it disappears from the dashboard (matches inline behavior).
      await admin.from('cases')
        .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
        .eq('id', caseId)

      const { data: u } = await admin.auth.admin.getUserById(caseRow.user_id)
      if (u?.user?.email) {
        await sendEmail(u.user.email, `We couldn't finish analyzing ${caseRow.name}`, failureEmailHtml(caseRow.name, refund))
      }
    }
  })()

  // Keep the worker alive until the background work finishes (up to the
  // platform wall-clock limit), but return immediately to the caller.
  // @ts-ignore EdgeRuntime is provided by the Supabase Edge runtime.
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work)
  else await work

  return json({ ok: true, status: 'analysis_started' }, 202)
})
