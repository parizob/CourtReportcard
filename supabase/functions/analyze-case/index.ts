// Background transcript analysis worker.
//
// Triggered (fire-and-forget) by the client after a case's files are uploaded.
// Runs the two-pass Gemini extraction + proofread entirely server-side so the
// user never waits on the upload screen, then emails them the result.
//
// IMPORTANT: the dedup/flexFind logic below (and the prompts in prompts.ts) are
// MIRRORED from src/lib/gemini.js (the browser source of truth). If you change
// the proofreading logic or prompts there, update them here too.
//
// The chunking helpers (countPages, findSpeakerTurnBoundaries,
// findNearestSplitPoint, splitIntoChunks, extractTrailingContext) are
// similarly MIRRORED from src/lib/pageCount.js and src/lib/chunkSplit.js —
// update both sides if you change the splitting/boundary logic.

import { createClient } from 'npm:@supabase/supabase-js@2.45.0'
import { EXTRACTION_ONLY_PROMPT, PROOFREAD_ONLY_PROMPT, buildChunkAddendum } from './prompts.ts'

// Measured directly (scripts/calibrate-extraction-model.mjs) against production
// EXTRACTION_ONLY_PROMPT: ~51% faster and ~48% cheaper per page than
// gemini-2.5-flash with matching entry counts — extraction is structured
// parsing, not reasoning, so the lighter model is a safe fit here.
const MODEL_EXTRACT = 'gemini-3.1-flash-lite'
const MODEL_PROOFREAD = 'gemini-2.5-pro'  // Full quality, uncapped thinking — proofreading IS the product
const SITE_URL = 'https://courtreportcard.com'
const FROM_ADDRESS = 'Court Reportcard <noreply@courtreportcard.com>'

// Free-tier Edge Functions are hard-killed at 150s wall-clock. Abort the Gemini
// calls a bit before that so the failure path (refund + email) always gets to
// run instead of the worker being killed mid-analysis and leaving the case stuck.
const ANALYSIS_DEADLINE_MS = 135000

// ── Chunking (large-transcript support) ──
// Measured directly (see scripts/calibrate-chunk-size.mjs against the real
// production models): extraction runs ~4.21s/page and is the binding
// constraint (not proofreading, despite Pro's uncapped thinking) — a document
// this size regenerates its entire content as JSON, which is a lot of raw
// output tokens even on a fast model. 15 pages/chunk leaves comfortable
// margin (~63s of the 135s budget) for real-world variance and non-Gemini
// overhead this measurement doesn't include (storage I/O, JSON parsing).
const PAGES_PER_CHUNK = 15
// Below this, the single-call path is completely unchanged — zero regression
// risk to current traffic. 20 pages leaves ~51s margin at the measured rate.
const CHUNK_THRESHOLD_PAGES = 20
// Proofread batches are sized by entry count (not re-split from raw text) —
// roughly matches 15 pages' worth of entries at observed density (~22-24
// entries/page in calibration). Trimmed from 300 on 2026-07-16 after a real
// case's middle batch (a full 300-entry batch, Pro's uncapped thinking) took
// anywhere from ~87s to >135s across repeated attempts on identical content —
// ANALYSIS_DEADLINE_MS can't be raised on the free tier (already near the
// 150s hard kill), so this is the only lever left to pull typical per-batch
// latency down from that timeout-prone range without changing the deadline.
const ENTRIES_PER_PROOFREAD_BATCH = 250
// 1 initial attempt + 3 retries per chunk/batch before falling through to the
// full refund+delete path — see handleFailure. Helps transient failures
// (timeout, momentary 5xx); won't help a chunk whose content deterministically
// confuses the model at temperature:0. Raised from 3 to 4 on 2026-07-16
// alongside the ENTRIES_PER_PROOFREAD_BATCH trim above — same incident, an
// extra shot at the timeout coin-flip for a batch that's already borderline.
const MAX_CHUNK_ATTEMPTS = 4

/** Mirrors src/lib/pageCount.js's countPages. */
function countPages(text: string): number {
  if (!text) return 0
  const lines = text.split('\n')
  const pageMarkers = lines.filter((l) => /^\s{30,}\d{1,4}\s*$/.test(l))
  if (pageMarkers.length > 0) return pageMarkers.length
  const numbered = lines.filter((l) => /^\s*\d{1,4}\s{2,}/.test(l)).length
  const lineCount = numbered > 0 ? numbered : lines.filter((l) => l.trim().length > 0).length
  return Math.max(1, Math.ceil(lineCount / 25))
}

/** Mirrors src/lib/chunkSplit.js's TURN_START_RE + findSpeakerTurnBoundaries. */
const TURN_START_RE = /^\s*\d{0,4}\s*(Q\.|A\.|BY\s+(MR|MS|MRS|DR)\.|MR\.\s|MS\.\s|MRS\.\s|DR\.\s|THE\s+COURT:|THE\s+WITNESS:|THE\s+CLERK:|THE\s+REPORTER:)/

function findSpeakerTurnBoundaries(text: string): number[] {
  const lines = text.split('\n')
  const boundaries: number[] = []
  let offset = 0
  for (const line of lines) {
    if (TURN_START_RE.test(line)) boundaries.push(offset)
    offset += line.length + 1
  }
  return boundaries
}

/** Mirrors src/lib/chunkSplit.js's findNearestSplitPoint. */
function findNearestSplitPoint(text: string, targetOffset: number, windowChars = 3000): number {
  const boundaries = findSpeakerTurnBoundaries(text)
  let best: number | null = null
  let bestDist = Infinity
  for (const b of boundaries) {
    const dist = Math.abs(b - targetOffset)
    if (dist < bestDist && dist <= windowChars) {
      best = b
      bestDist = dist
    }
  }
  if (best !== null) return best

  const lines = text.split('\n')
  let offset = 0
  let bestBlank: number | null = null
  let bestBlankDist = Infinity
  for (const line of lines) {
    if (line.trim() === '') {
      const dist = Math.abs(offset - targetOffset)
      if (dist < bestBlankDist && dist <= windowChars) {
        bestBlank = offset
        bestBlankDist = dist
      }
    }
    offset += line.length + 1
  }
  if (bestBlank !== null) return bestBlank
  return targetOffset
}

/** Mirrors src/lib/chunkSplit.js's splitIntoChunks. */
function splitIntoChunks(text: string, pagesPerChunk = PAGES_PER_CHUNK): string[] {
  const totalPages = countPages(text)
  if (totalPages <= pagesPerChunk) return [text]

  const numChunks = Math.ceil(totalPages / pagesPerChunk)
  const approxCharsPerPage = text.length / totalPages

  const splitPoints: number[] = []
  for (let i = 1; i < numChunks; i++) {
    const targetOffset = Math.round(i * pagesPerChunk * approxCharsPerPage)
    splitPoints.push(findNearestSplitPoint(text, targetOffset))
  }
  for (let i = 1; i < splitPoints.length; i++) {
    if (splitPoints[i] <= splitPoints[i - 1]) splitPoints[i] = splitPoints[i - 1] + 1
  }

  const chunks: string[] = []
  let start = 0
  for (const sp of splitPoints) {
    const clamped = Math.min(sp, text.length)
    chunks.push(text.slice(start, clamped))
    start = clamped
  }
  chunks.push(text.slice(start))
  return chunks
}

/** Mirrors src/lib/chunkSplit.js's extractTrailingContext. */
function extractTrailingContext(chunkText: string, numTurns = 2): string {
  const boundaries = findSpeakerTurnBoundaries(chunkText)
  if (boundaries.length === 0) return ''
  const startIdx = boundaries[Math.max(0, boundaries.length - numTurns)]
  return chunkText.slice(startIdx).trim()
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Gemini call (direct; mirrors api/gemini.js generationConfig) ──
// `thinkingConfig` is passed through as-is since the two models in play take
// incompatible shapes: gemini-2.5-pro (proofread) uses the legacy
// `thinkingBudget` number, gemini-3.1-flash-lite (extract) uses the newer
// `thinkingLevel` string — sending both in one request is a 400 error.
async function callGemini(prompt: string, filePart: unknown = null, deadlineAt = 0, thinkingConfig?: Record<string, unknown>, model = MODEL_PROOFREAD): Promise<any> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured.')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const parts: unknown[] = []
  if (filePart) parts.push(filePart)
  parts.push({ text: prompt })

  const controller = new AbortController()
  let timer: number | undefined
  const startedAt = Date.now()
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
          ...(thinkingConfig ? { thinkingConfig } : {}),
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

  // Real per-call timing + token usage, visible in Supabase function logs —
  // used to calibrate chunk sizing and to monitor cost/latency once chunking
  // is live in production.
  if (data.usageMetadata) {
    console.log(`Gemini call (${model}): ${((Date.now() - startedAt) / 1000).toFixed(1)}s`, JSON.stringify(data.usageMetadata))
  }

  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(extractFirstJsonValue(cleaned))
}

// Even with responseMimeType: 'application/json', Gemini has been observed
// (production case: chunk-boundary content landing right at a closing
// certificate/signature page) to emit a complete, valid JSON value and then
// append extra non-whitespace content after it — which a bare JSON.parse
// rejects outright ("Unexpected non-whitespace character after JSON").
// Scans for the first balanced top-level object/array and discards anything
// trailing it, so a well-formed response isn't thrown away over a model-side
// formatting slip. Leaves genuinely malformed/truncated JSON to fail
// JSON.parse normally — this only trims trailing garbage, never repairs the
// value itself. Mirrored in src/lib/gemini.js.
function extractFirstJsonValue(text: string): string {
  const start = text.search(/[{[]/)
  if (start === -1) return text
  const openChar = text[start]
  const closeChar = openChar === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === openChar) depth++
    else if (c === closeChar) {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return text.slice(start)
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

// How far (in entry id, which tracks document order) to look for a
// mis-tagged annotation's real home before treating it as a document-wide
// search. Chosen to comfortably cover an off-by-a-few slip within a single
// proofread batch (see ENTRIES_PER_PROOFREAD_BATCH) without being so wide it
// starts finding coincidental matches from unrelated parts of the document.
const ANNOTATION_REPAIR_WINDOW = 15

function fixAnnotationPositions(entries: any[], annotations: any[]): { annotations: any[]; droppedCount: number } {
  const fixed: any[] = []
  let unresolvedCount = 0
  for (const a of annotations) {
    if (!a.original) { fixed.push(a); continue }
    const entry = entries.find((e) => e.id === a.entry_id)
    if (entry) {
      const m = flexFind(entry.text, a.original)
      if (m) { fixed.push({ ...a, start: m.start, end: m.end }); continue }
    }
    // The model occasionally attaches an otherwise-correct annotation to the
    // wrong entry_id — in practice almost always a small numbering slip
    // (off by a handful), not a random jump to an unrelated part of the
    // document. So: look nearby first, since that's the far more likely
    // real target, and only widen to a full document search if nothing
    // nearby matches. At every tier, only trust a reassignment when it's
    // unique — for common short words (the usual offenders: "on", "any",
    // "same"), a document-wide search alone would happily "confirm" a match
    // at the very first occurrence (usually the opening appearances/
    // admonition section), silently relocating a real correction onto an
    // unrelated sentence with an explanation that no longer matches what's
    // displayed.
    const candidates = entries.filter((e) => e.id !== a.entry_id)
    const nearby = candidates.filter((e) => Math.abs(e.id - a.entry_id) <= ANNOTATION_REPAIR_WINDOW)
    const nearMatches = nearby.map((e) => ({ entry: e, m: flexFind(e.text, a.original) })).filter((r) => r.m)
    if (nearMatches.length === 1) {
      const { entry: e, m } = nearMatches[0]
      fixed.push({ ...a, entry_id: e.id, start: m!.start, end: m!.end })
      continue
    }
    if (nearMatches.length === 0) {
      const far = candidates.filter((e) => Math.abs(e.id - a.entry_id) > ANNOTATION_REPAIR_WINDOW)
      const farMatches = far.map((e) => ({ entry: e, m: flexFind(e.text, a.original) })).filter((r) => r.m)
      if (farMatches.length === 1) {
        const { entry: e, m } = farMatches[0]
        fixed.push({ ...a, entry_id: e.id, start: m!.start, end: m!.end })
        continue
      }
    }
    // Nothing nearby, or genuinely ambiguous (multiple equally-plausible
    // matches) even after widening — there's no reliable signal left to
    // place this correctly, and a wrong guess is worse than no annotation.
    // Logged (not silent) so we can see how often this residual case
    // actually happens and revisit if it's more than rare.
    unresolvedCount++
    console.warn(`Unplaceable annotation dropped: entry_id=${a.entry_id} type=${a.type} original=${JSON.stringify(a.original)}`)
  }
  if (unresolvedCount > 0) {
    console.warn(`fixAnnotationPositions: dropped ${unresolvedCount}/${annotations.length} annotation(s) as unplaceable`)
  }
  return { annotations: fixed, droppedCount: unresolvedCount }
}

// Catches "phantom" annotations the model occasionally produces where the
// claimed error doesn't actually exist in the entry text — these are
// code-detectable bugs (a deterministic string comparison proves them
// wrong), not proofreading judgment calls, so they're filtered here rather
// than left to a prompt instruction the model might not reliably follow.
// Real production case (user: Misty, 2026-07-09): the model flagged a
// missing "?" on a sentence that already ended in "?" (suggestion was
// original text + the mark that was already there), and separately
// suggested "capitalizing" words that were already capitalized (suggestion
// identical to original). Mirrored in src/lib/gemini.js.
function filterPhantomFixes(entries: any[], annotations: any[]): { annotations: any[]; droppedCount: number } {
  const filtered: any[] = []
  let droppedCount = 0
  for (const a of annotations) {
    if (!a.original || !a.suggestion) { filtered.push(a); continue }

    // A real correction can never suggest the exact text that's already there.
    if (a.suggestion === a.original) {
      droppedCount++
      console.warn(`Phantom fix dropped (no-op suggestion): entry_id=${a.entry_id} type=${a.type} original=${JSON.stringify(a.original)}`)
      continue
    }

    // Phantom missing trailing punctuation: suggestion is original + exactly
    // one trailing mark, but that same mark already immediately follows the
    // match in the real entry text (only whitespace, if anything, between them).
    const trailingChar = a.suggestion[a.suggestion.length - 1]
    const isSingleTrailingMarkAddition =
      a.suggestion.length === a.original.length + 1 &&
      a.suggestion.startsWith(a.original) &&
      /[.,!?;:]/.test(trailingChar)
    if (isSingleTrailingMarkAddition) {
      const entry = entries.find((e) => e.id === a.entry_id)
      const m = entry ? flexFind(entry.text, a.original) : null
      const next = m ? entry.text.slice(m.end).match(/^\s*(\S)/) : null
      if (next && next[1] === trailingChar) {
        droppedCount++
        console.warn(`Phantom fix dropped (mark already present): entry_id=${a.entry_id} type=${a.type} original=${JSON.stringify(a.original)} suggestion=${JSON.stringify(a.suggestion)}`)
        continue
      }
    }

    filtered.push(a)
  }
  if (droppedCount > 0) {
    console.warn(`filterPhantomFixes: dropped ${droppedCount}/${annotations.length} phantom annotation(s)`)
  }
  return { annotations: filtered, droppedCount }
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

  annots = fixAnnotationPositions(deduped, annots).annotations

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

// Pass 1 — extraction only (Flash, no thinking). Returns raw entries + title.
// `chunkInfo` is only ever set for text (never PDF — binary file parts aren't
// text-splittable, so PDFs always take the single-call path regardless of size).
async function extractContent(
  fileOrText: string | ArrayBuffer,
  mimeType: string | undefined,
  deadlineAt: number,
  chunkInfo?: { index: number; total: number; trailingContext: string },
): Promise<{ title: string; entries: any[]; originalText?: string }> {
  let filePart: unknown = null
  let promptSuffix = ''
  let originalText: string | undefined

  if (mimeType === 'application/pdf' && fileOrText instanceof ArrayBuffer) {
    filePart = { inlineData: { mimeType: 'application/pdf', data: arrayBufferToBase64(fileOrText) } }
    promptSuffix = '\n\n[PDF file attached above]'
  } else {
    originalText = fileOrText as string
    const chunkAddendum = chunkInfo ? buildChunkAddendum(chunkInfo.index + 1, chunkInfo.total, chunkInfo.trailingContext) : ''
    const contextBlock = chunkInfo?.trailingContext ? `<PREVIOUS_CONTEXT>\n${chunkInfo.trailingContext}\n</PREVIOUS_CONTEXT>\n\n` : ''
    promptSuffix = `\n\n${chunkAddendum}${contextBlock}${originalText}`
  }

  const extractionResult = await callGemini(`${EXTRACTION_ONLY_PROMPT}${promptSuffix}`, filePart, deadlineAt, { thinkingLevel: 'minimal' }, MODEL_EXTRACT)
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

  return {
    title: extractionResult.title || '',
    entries,
    ...(originalText !== undefined ? { originalText } : {}),
  }
}

// Pass 2 — proofreading only (Pro, full uncapped thinking). Returns annotations.
// `ownIdRange` is only set when proofreading is batched (large documents):
// `entries` includes a few leading entries carried from the previous batch as
// read-only context (so judgment calls at the seam have surrounding text to
// reason from), but this batch doesn't "own" those — a deterministic filter,
// not just a prompt instruction, drops any annotation landing outside this
// batch's own range, since model compliance with "don't annotate context"
// isn't guaranteed.
async function proofreadContent(entries: any[], deadlineAt: number, ownIdRange?: { min: number; max: number }): Promise<{ annotations: any[]; droppedCount: number }> {
  const proofreadResult = await callGemini(
    `${PROOFREAD_ONLY_PROMPT}\n\n${JSON.stringify(entries, null, 2)}`,
    null,
    deadlineAt,
    undefined, // no budget cap — Pro gets full thinking for quality
    MODEL_PROOFREAD,
  )

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

  const { annotations: repaired, droppedCount: unplaceableCount } = fixAnnotationPositions(entries, annots)
  const { annotations: real, droppedCount: phantomCount } = filterPhantomFixes(entries, repaired)
  annots = real
  const droppedCount = unplaceableCount + phantomCount

  const entryIds = new Set(entries.map((e: any) => e.id))
  annots = annots.filter((a: any) => entryIds.has(a.entry_id))

  if (ownIdRange) {
    annots = annots.filter((a: any) => a.entry_id >= ownIdRange.min && a.entry_id <= ownIdRange.max)
  }

  const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const seenAnnotations = new Set<string>()
  annots = annots.filter((a: any) => {
    const key = `${a.entry_id}:${normalize(a.original)}:${a.type}`
    if (seenAnnotations.has(key)) return false
    seenAnnotations.add(key)
    return true
  })
  annots.forEach((a: any, i: number) => { a.id = i + 1 })

  return { annotations: annots, droppedCount }
}

// Merges N extraction chunk files for one transcript file into a single
// continuous, deduplicated entries array — reuses deduplicateTranscript
// unchanged (see id-remap-merge design note) by first renumbering every
// entry to a globally-unique id across all chunks, since dedup's internal
// id-remap tables are keyed by raw numeric id and each chunk's ids restart at 1.
// Does NOT delete the chunk files itself — the caller only does that after the
// merged result is durably saved, so a failed save can safely retry the merge
// from the still-intact chunk files instead of burning retries on "missing chunk".
async function mergeExtractionChunks(
  admin: any,
  userId: string,
  caseId: string,
  jsonBaseName: string,
  numChunks: number,
  plainText: string,
): Promise<{ title: string; entries: any[]; originalText: string; chunkPaths: string[] }> {
  let title = ''
  let allEntries: any[] = []
  const chunkPaths: string[] = []
  for (let i = 0; i < numChunks; i++) {
    const path = `${userId}/${caseId}/extracting/${jsonBaseName}_chunk${i}.json`
    chunkPaths.push(path)
    const { data: blob, error } = await admin.storage.from('case-files').download(path)
    if (error || !blob) throw new Error(`Missing chunk ${i} for ${jsonBaseName} during merge`)
    const chunkResult = JSON.parse(await blob.text())
    if (i === 0) title = chunkResult.title || ''
    allEntries.push(...chunkResult.entries)
  }
  allEntries.forEach((e, i) => { e.id = i + 1 })
  const { entries } = deduplicateTranscript(allEntries, [])
  return { title, entries, originalText: plainText, chunkPaths }
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
          This is usually a temporary issue. Please try uploading again — if it happens a second
          time, reach out and we'll take a look.
        </p>
        <a href="${supportUrl}" style="display: inline-block; background: #001939; color: white; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px;">Contact Support</a>
      </div>
    </div>
  `
}

// ── Shared failure handler ──
// Must be once-only: chunked extract/proofread can have overlapping invocations
// that both exhaust retries. Without a claim, each one refunds and the user
// is credited twice for a single spend (seen in production 2026-07-23, case King).
async function handleFailure(admin: any, caseRow: any, caseId: string, err: unknown, stage?: string): Promise<void> {
  console.error('Analysis failed for case', caseId, stage, err)
  // Truncated so a pathological error (e.g. a huge Gemini error body) can't
  // blow past Postgres's practical row-size comfort zone. Stage is prefixed
  // so a failure is diagnosable straight from the DB — no more reconstructing
  // which chunk/batch died from storage/API request logs after the fact.
  const lastError = `${stage ? `[${stage}] ` : ''}${(err as Error)?.message || String(err)}`.slice(0, 2000)

  // Atomic claim: only the first failure path soft-deletes the case. Losers
  // skip refund + email so a race cannot double-credit the ledger.
  const { data: claimed, error: claimErr } = await admin
    .from('cases')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'deleted',
      last_error: lastError,
    })
    .eq('id', caseId)
    .is('deleted_at', null)
    .select('id, user_id, name, tokens_charged')
    .maybeSingle()

  if (claimErr) {
    console.error('Failure claim failed for case', caseId, claimErr)
    return
  }
  if (!claimed) {
    console.warn('Failure already claimed for case', caseId, '— skipping refund/email. Stage:', stage)
    return
  }

  const refund = claimed.tokens_charged || caseRow.tokens_charged || 0

  // Clean up storage: case_files rows (transcript/extracted) plus any
  // intermediate "extracting" JSON entries, which have no DB row.
  const storagePaths: string[] = (caseRow.case_files || [])
    .map((f: any) => f.storage_path)
    .filter(Boolean)
  const { data: extractingFiles } = await admin.storage
    .from('case-files')
    .list(`${claimed.user_id}/${caseId}/extracting`)
  for (const f of extractingFiles || []) {
    storagePaths.push(`${claimed.user_id}/${caseId}/extracting/${f.name}`)
  }
  if (storagePaths.length > 0) {
    await admin.storage.from('case-files').remove(storagePaths)
  }

  const userResult = await admin.auth.admin.getUserById(claimed.user_id)

  if (refund > 0) {
    const { data: prof } = await admin
      .from('user_profiles')
      .select('balance')
      .eq('user_id', claimed.user_id)
      .single()
    if (prof) {
      await Promise.all([
        admin.from('user_profiles')
          .update({ balance: prof.balance + refund, updated_at: new Date().toISOString() })
          .eq('user_id', claimed.user_id),
        admin.from('token_ledger').insert({
          user_id: claimed.user_id,
          amount: refund,
          type: 'refund',
          description: `Refund — failed analysis (${caseId})`,
        }),
      ])
    }
  }

  const email = (userResult as any)?.data?.user?.email
  if (email) {
    await sendEmail(email, `We couldn't finish analyzing ${claimed.name}`, failureEmailHtml(claimed.name, refund))
  }
}

// Storage/object-key segment derived from an uploaded file name. Must stay in
// sync with safeStorageFileName in DashboardUpload.jsx — CAT exports often
// include `#` in job numbers, which becomes a URL fragment if left raw.
function safeJsonBaseName(fileName: string): string {
  const base = (fileName || '').split(/[/\\]/).pop() || 'transcript'
  const withoutExt = base.replace(/\.(rtf|cre|pdf|txt)$/i, '')
  const cleaned = withoutExt.replace(/[^\w.\-() +]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return cleaned || 'transcript'
}

// Fires the next unit of work (next chunk, next batch, next file, or the
// pass transition) with its own fresh ANALYSIS_DEADLINE_MS budget. Always
// marked `internal` so the receiving invocation skips the client JWT check.
// Retries transient 5xx / network failures — production incident 2026-07-20
// (Bregar): proofread batch 0 succeeded, then the continuation self-fetch
// returned HTTP 500 twice in <1s and the case was refunded without ever
// reaching merge. One or two retries would have absorbed that class of glitch.
async function selfFetchContinue(SUPABASE_URL: string, SERVICE_ROLE_KEY: string, body: Record<string, unknown>): Promise<void> {
  const maxAttempts = 3
  let lastErr: Error | null = null
  for (let i = 0; i < maxAttempts; i++) {
    let resp: Response
    try {
      resp = await fetch(`${SUPABASE_URL}/functions/v1/analyze-case`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ ...body, internal: true }),
      })
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      continue
    }
    if (resp.ok) return
    lastErr = new Error(`Failed to invoke continuation (${JSON.stringify(body)}): ${resp.status}`)
    // 4xx (except 429) won't get better on retry — fail fast.
    if (resp.status < 500 && resp.status !== 429) throw lastErr
    if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)))
  }
  throw lastErr || new Error(`Failed to invoke continuation (${JSON.stringify(body)})`)
}

function runInBackground(work: Promise<void>): void {
  // @ts-ignore
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work)
  else work
}

// ── Handler ──
// Supports two passes via `pass` body field, each internally sequenced across
// N extraction chunks / M proofread batches for large documents (see
// PAGES_PER_CHUNK / CHUNK_THRESHOLD_PAGES above):
//   'extract'   (default) — Flash, no thinking. Below CHUNK_THRESHOLD_PAGES,
//               single call per file, unchanged from the original 2-pass
//               design. Above it, splits into chunks (chunk_index), each
//               self-fetched with a fresh budget, then merges into the same
//               `_entries.json` the rest of the pipeline already expects.
//   'proofread' — Pro, full thinking. Batches large entry sets (batch_index)
//               the same way, then merges annotations and finalizes the case
//               once every transcript file's every batch is done.
// `file_index` sequences multiple transcript files on one case (rare in
// practice, but preserved from the original design). `attempt` is a bounded
// per-unit retry counter (see MAX_CHUNK_ATTEMPTS) — a chunk/batch that throws
// is re-invoked in place with a fresh budget before falling through to the
// existing handleFailure (refund + delete + email) path, unchanged.
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
  let pass: string
  let fileIndex: number
  let chunkIndex: number
  let batchIndex: number
  let attempt: number
  let internal: boolean
  try {
    const body = await req.json()
    caseId = body.case_id
    pass = body.pass || 'extract'
    fileIndex = body.file_index || 0
    chunkIndex = body.chunk_index || 0
    batchIndex = body.batch_index || 0
    attempt = body.attempt || 0
    internal = body.internal === true
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }
  if (!caseId) return json({ error: 'case_id is required.' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Only the genuine client-initiated extract call needs the JWT ownership
  // check — every chunk/batch continuation, retry, and pass transition is
  // self-fetched internally with the service role key.
  if (pass === 'extract' && !internal) {
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await userClient.auth.getUser()
    const callerId = userData?.user?.id
    if (!callerId) return json({ error: 'Unauthorized.' }, 401)

    const { data: caseCheck } = await admin.from('cases').select('user_id').eq('id', caseId).single()
    if (!caseCheck) return json({ error: 'Case not found.' }, 404)
    if (caseCheck.user_id !== callerId) return json({ error: 'Forbidden.' }, 403)
  }

  const { data: caseRow, error: caseErr } = await admin
    .from('cases')
    .select('*, case_files(*)')
    .eq('id', caseId)
    .single()

  if (caseErr || !caseRow) return json({ error: 'Case not found.' }, 404)

  const caseFiles: any[] = caseRow.case_files || []

  // Duplicate-kick guard — only relevant for the genuine first external call
  // (e.g. a double-clicked upload button). Every other invocation legitimately
  // expects prior extracting/ state to already exist.
  if (pass === 'extract' && !internal) {
    const alreadyExtracted = caseFiles.some((f: any) => f.file_type === 'extracted')
    const { data: extractingStorageFiles } = await admin.storage
      .from('case-files')
      .list(`${caseRow.user_id}/${caseId}/extracting`)
    const alreadyStarted = alreadyExtracted || (extractingStorageFiles?.length ?? 0) > 0
    if (alreadyStarted) return json({ ok: true, skipped: 'already_started' })
    if (caseRow.status !== 'processing') return json({ ok: true, skipped: `status_${caseRow.status}` })
  }

  // ── Extract pass ──
  if (pass === 'extract') {
    const transcriptFiles = caseFiles.filter((f: any) => f.file_type === 'transcript')
    if (transcriptFiles.length === 0) return json({ error: 'No transcript files.' }, 400)

    if (fileIndex >= transcriptFiles.length) {
      // Every transcript file is fully extracted — hand off to proofreading,
      // which gets its own fresh budget via the same self-fetch pattern.
      const work = (async () => {
        try {
          await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'proofread', file_index: 0, batch_index: 0, attempt: 0 })
        } catch (err) {
          await handleFailure(admin, caseRow, caseId, err, `extract→proofread handoff (file ${fileIndex})`)
        }
      })()
      runInBackground(work)
      return json({ ok: true, status: 'extract_complete' }, 202)
    }

    const dbFile = transcriptFiles[fileIndex]
    const jsonBaseName = safeJsonBaseName(dbFile.file_name)
    const extractingDir = `${caseRow.user_id}/${caseId}/extracting`
    const finalEntriesName = `${jsonBaseName}_entries.json`
    const finalEntriesPath = `${extractingDir}/${finalEntriesName}`
    const chunkName = `${jsonBaseName}_chunk${chunkIndex}.json`
    const chunkPath = `${extractingDir}/${chunkName}`

    // Idempotency — this file's merged entries already exist: skip straight
    // to the next file rather than redoing (or re-triggering) its work.
    const { data: existingFinal } = await admin.storage.from('case-files').list(extractingDir, { search: finalEntriesName })
    if ((existingFinal?.length ?? 0) > 0) {
      const work = (async () => {
        try {
          await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'extract', file_index: fileIndex + 1, chunk_index: 0, attempt: 0 })
        } catch (err) {
          await handleFailure(admin, caseRow, caseId, err, `extract file_index advance (file ${fileIndex})`)
        }
      })()
      runInBackground(work)
      return json({ ok: true, skipped: 'file_already_extracted' }, 202)
    }

    // Idempotency — this specific chunk already exists (only possible once
    // chunking is active): skip straight to the next chunk index. This is
    // what lets a resumed/duplicated invocation pick up from the correct
    // next chunk instead of either redoing work or abandoning the chain.
    const { data: existingChunk } = await admin.storage.from('case-files').list(extractingDir, { search: chunkName })
    if ((existingChunk?.length ?? 0) > 0) {
      const work = (async () => {
        try {
          await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'extract', file_index: fileIndex, chunk_index: chunkIndex + 1, attempt: 0 })
        } catch (err) {
          await handleFailure(admin, caseRow, caseId, err, `extract chunk_index advance (file ${fileIndex} chunk ${chunkIndex})`)
        }
      })()
      runInBackground(work)
      return json({ ok: true, skipped: 'chunk_already_extracted' }, 202)
    }

    const work = (async () => {
      const deadlineAt = Date.now() + ANALYSIS_DEADLINE_MS
      try {
        const { data: blob, error: dlErr } = await admin.storage.from('case-files').download(dbFile.storage_path)
        if (dlErr || !blob) {
          throw new Error(
            `Failed to download ${dbFile.file_name}: ${dlErr?.message || 'no blob'} (path=${dbFile.storage_path})`
          )
        }

        const isPdf = dbFile.file_name.toLowerCase().endsWith('.pdf')
        const isRtf = dbFile.file_name.toLowerCase().endsWith('.rtf')

        let finalResult: { title: string; entries: any[]; originalText?: string } | null = null
        let mergedChunkPaths: string[] | null = null

        if (isPdf) {
          // PDFs are sent as a binary file part — not text-splittable, so
          // they always take the single-call path regardless of size.
          finalResult = await extractContent(await blob.arrayBuffer(), 'application/pdf', deadlineAt)
        } else {
          const rawContent = await blob.text()
          const plainText = isRtf ? stripRtf(rawContent) : rawContent
          const totalPages = countPages(plainText)

          if (totalPages <= CHUNK_THRESHOLD_PAGES) {
            // Below the threshold — identical to the original single-call
            // behavior, byte for byte. This is the majority of current traffic.
            finalResult = await extractContent(plainText, undefined, deadlineAt)
          } else {
            const chunks = splitIntoChunks(plainText, PAGES_PER_CHUNK)

            if (chunkIndex >= chunks.length) {
              // All chunks for this file are in — merge now.
              const merged = await mergeExtractionChunks(admin, caseRow.user_id, caseId, jsonBaseName, chunks.length, plainText)
              finalResult = { title: merged.title, entries: merged.entries, originalText: merged.originalText }
              mergedChunkPaths = merged.chunkPaths
            } else {
              const chunkText = chunks[chunkIndex]
              const trailingContext = chunkIndex > 0 ? extractTrailingContext(chunks[chunkIndex - 1]) : ''
              const chunkResult = await extractContent(chunkText, undefined, deadlineAt, {
                index: chunkIndex,
                total: chunks.length,
                trailingContext,
              })
              const chunkBytes = new TextEncoder().encode(JSON.stringify(chunkResult, null, 2))
              const { error: upErr } = await admin.storage.from('case-files').upload(chunkPath, chunkBytes, { upsert: true, contentType: 'application/json' })
              if (upErr) throw new Error(`Failed to save chunk ${chunkIndex} for ${dbFile.file_name}: ${upErr.message}`)

              await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'extract', file_index: fileIndex, chunk_index: chunkIndex + 1, attempt: 0 })
              return
            }
          }
        }

        // finalResult is set — this file is fully extracted (below threshold,
        // a PDF, or just merged from its chunks). Save under the SAME
        // filename the non-chunked path always used, so proofreading and
        // finalization don't need to know or care whether chunking happened.
        const finalBytes = new TextEncoder().encode(JSON.stringify(finalResult, null, 2))
        const { error: upErr } = await admin.storage.from('case-files').upload(finalEntriesPath, finalBytes, { upsert: true, contentType: 'application/json' })
        if (upErr) throw new Error(`Failed to save entries for ${dbFile.file_name}: ${upErr.message}`)

        // Only clean up per-chunk files once the merged result they fed into
        // is durably saved — see mergeExtractionChunks' note on why deletion
        // isn't done there.
        if (mergedChunkPaths) await admin.storage.from('case-files').remove(mergedChunkPaths)

        await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'extract', file_index: fileIndex + 1, chunk_index: 0, attempt: 0 })
      } catch (err) {
        const stage = `extract file ${fileIndex} chunk ${chunkIndex} attempt ${attempt}`
        if (attempt < MAX_CHUNK_ATTEMPTS - 1) {
          try {
            await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'extract', file_index: fileIndex, chunk_index: chunkIndex, attempt: attempt + 1 })
          } catch (retryErr) {
            // The original `err` is what actually failed the work — the retry
            // dispatch failing too is secondary, but worth keeping so both are
            // visible instead of the original cause getting silently dropped.
            await handleFailure(admin, caseRow, caseId, err, `${stage} (retry dispatch also failed: ${(retryErr as Error)?.message || retryErr})`)
          }
        } else {
          await handleFailure(admin, caseRow, caseId, err, stage)
        }
      }
    })()

    runInBackground(work)
    return json({ ok: true, status: 'extract_started' }, 202)
  }

  // ── Proofread pass ──
  const transcriptFiles = caseFiles.filter((f: any) => f.file_type === 'transcript')

  if (fileIndex >= transcriptFiles.length) {
    // Every transcript file is fully proofread — finalize the case once.
    // Totals are recomputed from the persisted _extracted.json files rather
    // than accumulated across invocations, since local variables don't
    // survive the self-fetch chain — this keeps the finalize step itself
    // idempotent/resumable like everything else.
    const work = (async () => {
      try {
        const extractedDir = `${caseRow.user_id}/${caseId}/extracted`
        const { data: extractedFiles } = await admin.storage.from('case-files').list(extractedDir)
        let totalEntries = 0
        let totalIssues = 0
        let totalDropped = 0
        const byType: Record<string, number> = {}
        for (const f of extractedFiles || []) {
          const { data: blob } = await admin.storage.from('case-files').download(`${extractedDir}/${f.name}`)
          if (!blob) continue
          const finalJson = JSON.parse(await blob.text())
          totalEntries += (finalJson.entries || []).length
          totalIssues += (finalJson.annotations || []).length
          totalDropped += finalJson.dropped_annotations_count || 0
          const fileByType = countByType(finalJson.annotations || [])
          for (const [k, v] of Object.entries(fileByType)) byType[k] = (byType[k] || 0) + (v as number)
        }

        await admin.from('case_metrics').upsert({
          case_id: caseId,
          total_entries: totalEntries,
          total_issues: totalIssues,
          accepted: 0,
          ignored: 0,
          open: totalIssues,
          annotations_by_type: byType,
          dropped_annotations_count: totalDropped,
          last_reviewed_at: new Date().toISOString(),
        }, { onConflict: 'case_id' })

        await admin.from('cases').update({ status: 'analyzed' }).eq('id', caseId)

        const { data: u } = await admin.auth.admin.getUserById(caseRow.user_id)
        if (u?.user?.email) {
          await sendEmail(u.user.email, `Your transcript is ready — ${caseRow.name}`, successEmailHtml(caseRow.name, totalIssues, caseId))
        }
      } catch (err) {
        await handleFailure(admin, caseRow, caseId, err, 'proofread finalize (case-level)')
      }
    })()
    runInBackground(work)
    return json({ ok: true, status: 'proofread_complete' }, 202)
  }

  const dbFile = transcriptFiles[fileIndex]
  const jsonBaseName = safeJsonBaseName(dbFile.file_name)
  const extractingDir = `${caseRow.user_id}/${caseId}/extracting`
  const extractedDir = `${caseRow.user_id}/${caseId}/extracted`
  const entriesPath = `${extractingDir}/${jsonBaseName}_entries.json`
  const finalName = `${jsonBaseName}_extracted.json`
  const finalPath = `${extractedDir}/${finalName}`

  // Idempotency — this file's final proofread output already exists: move on.
  const { data: existingFinal } = await admin.storage.from('case-files').list(extractedDir, { search: finalName })
  if ((existingFinal?.length ?? 0) > 0) {
    const work = (async () => {
      try {
        await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'proofread', file_index: fileIndex + 1, batch_index: 0, attempt: 0 })
      } catch (err) {
        await handleFailure(admin, caseRow, caseId, err, `proofread file_index advance (file ${fileIndex})`)
      }
    })()
    runInBackground(work)
    return json({ ok: true, skipped: 'file_already_proofread' }, 202)
  }

  const { data: entriesBlob, error: entriesErr } = await admin.storage.from('case-files').download(entriesPath)
  if (entriesErr || !entriesBlob) {
    return json({ error: `Entries file not found for ${dbFile.file_name} — extract pass may not have completed.` }, 400)
  }
  let title: string
  let entries: any[]
  let originalText: string | undefined
  try {
    const parsed = JSON.parse(await entriesBlob.text())
    if (!Array.isArray(parsed?.entries)) {
      return json({ error: `Entries file for ${dbFile.file_name} is missing an entries array.` }, 400)
    }
    title = parsed.title || ''
    entries = parsed.entries
    originalText = parsed.originalText
  } catch {
    return json({ error: `Entries file for ${dbFile.file_name} is corrupt or unreadable.` }, 400)
  }
  const numBatches = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PROOFREAD_BATCH))
  const batchName = `${jsonBaseName}_annotations_batch${batchIndex}.json`
  const batchPath = `${extractingDir}/${batchName}`

  if (batchIndex >= numBatches) {
    // All batches for this file are in — merge annotations and finalize it.
    const work = (async () => {
      try {
        let allAnnotations: any[] = []
        let droppedAnnotationsCount = 0
        const batchPaths: string[] = []
        for (let i = 0; i < numBatches; i++) {
          const p = `${extractingDir}/${jsonBaseName}_annotations_batch${i}.json`
          batchPaths.push(p)
          const { data: blob, error } = await admin.storage.from('case-files').download(p)
          if (error || !blob) throw new Error(`Missing annotation batch ${i} for ${jsonBaseName} during merge`)
          const batchResult = JSON.parse(await blob.text())
          allAnnotations.push(...(batchResult.annotations || []))
          droppedAnnotationsCount += batchResult.droppedCount || 0
        }

        // Final cross-batch safety net: the annotation-range-guard in
        // proofreadContent already prevents cross-batch contamination at the
        // source, but this catches any remaining byte-identical duplicate
        // near a seam, the same way the single-call path always has.
        const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
        const seen = new Set<string>()
        allAnnotations = allAnnotations.filter((a) => {
          const key = `${a.entry_id}:${normalize(a.original)}:${a.type}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        allAnnotations.forEach((a, i) => { a.id = i + 1 })

        const finalJson: any = {
          title: title || '',
          extracted_at: new Date().toISOString(),
          entries,
          annotations: allAnnotations,
          dropped_annotations_count: droppedAnnotationsCount,
        }
        if (originalText !== undefined) finalJson.originalText = originalText

        const finalBytes = new TextEncoder().encode(JSON.stringify(finalJson, null, 2))
        await admin.storage.from('case-files').upload(finalPath, finalBytes, { upsert: true, contentType: 'application/json' })
        await admin.from('case_files').insert({
          case_id: caseId,
          file_type: 'extracted',
          file_name: finalName,
          file_size: finalBytes.byteLength,
          storage_path: finalPath,
          mime_type: 'application/json',
        })
        await admin.storage.from('case-files').remove([entriesPath, ...batchPaths])

        await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'proofread', file_index: fileIndex + 1, batch_index: 0, attempt: 0 })
      } catch (err) {
        const stage = `proofread merge file ${fileIndex} batch ${batchIndex} attempt ${attempt}`
        if (attempt < MAX_CHUNK_ATTEMPTS - 1) {
          try {
            await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'proofread', file_index: fileIndex, batch_index: batchIndex, attempt: attempt + 1 })
          } catch (retryErr) {
            await handleFailure(admin, caseRow, caseId, err, `${stage} (retry dispatch also failed: ${(retryErr as Error)?.message || retryErr})`)
          }
        } else {
          await handleFailure(admin, caseRow, caseId, err, stage)
        }
      }
    })()
    runInBackground(work)
    return json({ ok: true, status: 'proofread_merging' }, 202)
  }

  // Idempotency — this batch already exists: skip straight to the next one.
  const { data: existingBatch } = await admin.storage.from('case-files').list(extractingDir, { search: batchName })
  if ((existingBatch?.length ?? 0) > 0) {
    const work = (async () => {
      try {
        await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'proofread', file_index: fileIndex, batch_index: batchIndex + 1, attempt: 0 })
      } catch (err) {
        await handleFailure(admin, caseRow, caseId, err, `proofread batch_index advance (file ${fileIndex} batch ${batchIndex})`)
      }
    })()
    runInBackground(work)
    return json({ ok: true, skipped: 'batch_already_proofread' }, 202)
  }

  const work = (async () => {
    const deadlineAt = Date.now() + ANALYSIS_DEADLINE_MS
    try {
      // A handful of leading entries from the previous batch are included as
      // context (not owned by this batch) so a judgment call right at the
      // seam still has surrounding text to reason from — see ownIdRange /
      // the annotation-range-guard in proofreadContent for how those get
      // filtered back out afterward.
      const CONTEXT_ENTRIES = 8
      const batchStart = batchIndex * ENTRIES_PER_PROOFREAD_BATCH
      const batchEnd = Math.min(entries.length, batchStart + ENTRIES_PER_PROOFREAD_BATCH)
      const contextStart = Math.max(0, batchStart - CONTEXT_ENTRIES)
      const batchEntries = entries.slice(contextStart, batchEnd)
      const rangeGuard = numBatches > 1 ? { min: entries[batchStart].id, max: entries[batchEnd - 1].id } : undefined

      const { annotations, droppedCount } = await proofreadContent(batchEntries, deadlineAt, rangeGuard)
      const batchBytes = new TextEncoder().encode(JSON.stringify({ annotations, droppedCount }, null, 2))
      const { error: upErr } = await admin.storage.from('case-files').upload(batchPath, batchBytes, { upsert: true, contentType: 'application/json' })
      if (upErr) throw new Error(`Failed to save annotation batch ${batchIndex} for ${jsonBaseName}: ${upErr.message}`)

      await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'proofread', file_index: fileIndex, batch_index: batchIndex + 1, attempt: 0 })
    } catch (err) {
      const stage = `proofread file ${fileIndex} batch ${batchIndex} attempt ${attempt}`
      if (attempt < MAX_CHUNK_ATTEMPTS - 1) {
        try {
          await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'proofread', file_index: fileIndex, batch_index: batchIndex, attempt: attempt + 1 })
        } catch (retryErr) {
          await handleFailure(admin, caseRow, caseId, err, `${stage} (retry dispatch also failed: ${(retryErr as Error)?.message || retryErr})`)
        }
      } else {
        await handleFailure(admin, caseRow, caseId, err, stage)
      }
    }
  })()

  runInBackground(work)
  return json({ ok: true, status: 'proofread_started' }, 202)
})
