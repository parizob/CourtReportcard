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
import { EXTRACTION_ONLY_PROMPT, PROOFREAD_ONLY_PROMPT, buildChunkAddendum, buildProofreadReferenceDateBlock } from './prompts.ts'
import {
  escapeHtml,
  failureEmailHtml,
  failureEmailKind,
  isProhibitedContentError,
} from './emails.ts'
import {
  PROOFREAD_PARALLEL_CONCURRENCY,
  PROOFREAD_CLAIM_STALE_MS,
  PROOFREAD_WATCHDOG_GRACE_MS,
  proofreadBatchJsonName,
  proofreadBatchClaimName,
  proofreadMergeLockName,
  proofreadWatchdogLockName,
  isProofreadBatchComplete,
  isProofreadClaimStale,
  planProofreadDispatch,
  needsProofreadZombieWatchdog,
} from './proofreadParallel.ts'

// Measured directly (scripts/calibrate-extraction-model.mjs) against production
// EXTRACTION_ONLY_PROMPT: ~51% faster and ~48% cheaper per page than
// gemini-2.5-flash with matching entry counts — extraction is structured
// parsing, not reasoning, so the lighter model is a safe fit here.
const MODEL_EXTRACT = 'gemini-3.1-flash-lite'
const MODEL_PROOFREAD = 'gemini-2.5-pro'  // Full quality, uncapped thinking — proofreading IS the product
const SITE_URL = 'https://courtreportcard.com'
const FROM_ADDRESS = 'Court Reportcard <noreply@courtreportcard.com>'

// Edge Functions are hard-killed at wall-clock (Free ~150s, Paid ~400s).
// Abort Gemini a bit before that so catch/refund/claim-release can run —
// a hard kill leaves orphan proofread `.claim` files and hangs the wave.
// Override per project via secret ANALYSIS_DEADLINE_MS (Dev free → 135000;
// Prod paid → 370000). Default assumes paid.
const ANALYSIS_DEADLINE_MS = (() => {
  const raw = Number(Deno.env.get('ANALYSIS_DEADLINE_MS'))
  return Number.isFinite(raw) && raw > 10_000 ? raw : 370_000
})()
// Leave wall-clock after Gemini abort for selfFetchContinue / claim release.
// Without this, abort-at-deadline races the platform hard-kill and the
// "fresh try" self-fetch never leaves the dying invocation (prod 2026-08-26:
// Mateo + 8-25 — late extract chunks ANALYSIS_TIMEOUT ×4 → refund).
const CLEANUP_RESERVE_MS = 45_000
const PROOFREAD_CLAIM_REFRESH_MS = 45_000
const PROOFREAD_WATCHDOG_TICK_MS = 45_000
const EXTRACT_HEARTBEAT_MS = 45_000

// ── Chunking (large-transcript support) ──
// Measured directly (see scripts/calibrate-chunk-size.mjs against the real
// production models): extraction runs ~4.21s/page and is the binding
// constraint (not proofreading, despite Pro's uncapped thinking) — a document
// this size regenerates its entire content as JSON, which is a lot of raw
// output tokens even on a fast model. 15 pages/chunk leaves comfortable
// margin (~63s of the 135s budget) for real-world variance and non-Gemini
// overhead this measurement doesn't include (storage I/O, JSON parsing).
// (Briefly tried 10 pages on 2026-08-26 after extract timeouts; reverted —
// calibration and timeout pattern point at hang/dispatch, not chunk size.)
const PAGES_PER_CHUNK = 15
// Below this, the single-call path is completely unchanged — zero regression
// risk to current traffic. 20 pages leaves ~51s margin at the measured rate.
const CHUNK_THRESHOLD_PAGES = 20
// Proofread batches are sized by entry count (not re-split from raw text) —
// roughly matches 15 pages' worth of entries at observed density (~22-24
// entries/page in calibration). Trimmed from 300 on 2026-07-16 after a real
// case's middle batch (a full 300-entry batch, Pro's uncapped thinking) took
// anywhere from ~87s to >135s across repeated attempts on identical content
// while on the Free-tier 135s deadline. Kept at 250 after the Pro upgrade
// (370s deadline) — bigger batches are not worth reintroducing that variance;
// smaller ones would multiply Gemini calls without fixing the real limit.
const ENTRIES_PER_PROOFREAD_BATCH = 250
// Proofread batches for one file run in capped waves (see proofreadParallel.ts)
// instead of a strict serial self-fetch chain — same Gemini call count, lower
// wall-clock on multi-batch jobs. Extract chunks stay serial (v1).
// Non-timeout failures: 1 initial + 3 retries, then refund+delete.
// ANALYSIS_TIMEOUT only: more attempts (each self-fetch gets a fresh Edge
// budget) — slow/hung Gemini on one chunk should not kill a mostly-done job.
// Empty proofread results retry here too, then accept and continue (see
// MIN_ENTRIES_FOR_EMPTY_PROOFREAD_RETRY). Won't help a chunk whose content
// deterministically confuses the model at temperature:0.
// PROHIBITED_CONTENT (Gemini content filter) fails immediately — no retries.
const MAX_CHUNK_ATTEMPTS = 4
const MAX_TIMEOUT_CHUNK_ATTEMPTS = 8

function isAnalysisTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.message === 'ANALYSIS_TIMEOUT'
}

/** Absolute time when Gemini must abort, leaving CLEANUP_RESERVE_MS for dispatch. */
function geminiDeadlineAt(wallDeadlineAt: number): number {
  const remaining = wallDeadlineAt - Date.now()
  if (remaining <= CLEANUP_RESERVE_MS + 10_000) {
    // Short budgets (Dev free ~135s): keep ~20% for cleanup, rest for Gemini.
    return Date.now() + Math.max(5_000, Math.floor(remaining * 0.8))
  }
  return wallDeadlineAt - CLEANUP_RESERVE_MS
}

function canRetryUnit(err: unknown, attempt: number): boolean {
  if (isProhibitedContentError(err)) return false
  const max = isAnalysisTimeoutError(err) ? MAX_TIMEOUT_CHUNK_ATTEMPTS : MAX_CHUNK_ATTEMPTS
  return attempt < max - 1
}

/**
 * Extract-timeout retries keep the SAME inputs as attempt 0 (full chunk text +
 * previous-context when present). We do not strip context or split the chunk:
 * those can mis-label speakers or disturb seam text — unacceptable for filed
 * transcripts. Ops still get chunk X/Y logs + timeout_raw_fail snapshots.
 */
function extractTimeoutStrategy(_attempt: number): 'default' {
  return 'default'
}
// A non-trivial proofread batch that returns zero annotations may be a
// Gemini flake (2026-07-24 Natalie / Alexander rough: prod returned `[]`
// while a local Pro run found 84 issues) OR a legitimately clean batch
// (caption/early pages of a long file, short clean tests, true perfect).
// Treat empty as a soft failure so attempts can re-roll; after
// MAX_CHUNK_ATTEMPTS accept `[]` and continue so later batches still run
// and perfect jobs are not refunded. Large all-clean finals are flagged
// to the founder for spot-check (see ZERO_ISSUE_ALERT_MIN_TOKENS).
const MIN_ENTRIES_FOR_EMPTY_PROOFREAD_RETRY = 40
// Founder alert when a case finalizes with 0 suggestions at/above this
// page-token size. Short test uploads stay quiet.
const ZERO_ISSUE_ALERT_MIN_TOKENS = 40
const FOUNDER_ALERT_EMAIL = 'brandon@courtreportcard.com'

/** Mirrors src/lib/pageCount.js's countPages. */
function countPages(text: string): number {
  if (!text) return 0
  if (text.includes('\f')) {
    const segments = text.split('\f').filter((part) => part.trim().length > 0)
    if (segments.length > 0) return segments.length
  }
  const lines = text.split(/\r?\n/)
  const pageMarkers = lines.filter((l) => /^\s{30,}\d{1,4}\s*$/.test(l))
  if (pageMarkers.length > 0) return pageMarkers.length
  const numbered = lines.filter((l) => /^\s*\d{1,2}(?:[ \t]{2,}|\t)/.test(l)).length
  if (numbered > 0) return Math.max(1, Math.ceil(numbered / 25))
  const nonempty = lines.filter((l) => l.trim().length > 0).length
  return Math.max(1, Math.ceil(nonempty / 25))
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
  const budgetMs = deadlineAt ? Math.max(0, deadlineAt - startedAt) : 0
  console.log(
    `Gemini start (${model}): budget=${(budgetMs / 1000).toFixed(1)}s ` +
    `promptChars=${typeof prompt === 'string' ? prompt.length : 0} filePart=${filePart ? 'yes' : 'no'}`,
  )
  if (deadlineAt) {
    const remaining = deadlineAt - Date.now()
    if (remaining <= 0) {
      console.warn(`Gemini skip (${model}): deadline already passed before fetch`)
      throw new Error('ANALYSIS_TIMEOUT')
    }
    timer = setTimeout(() => {
      console.warn(
        `Gemini abort (${model}): no response after ${((Date.now() - startedAt) / 1000).toFixed(1)}s ` +
        `(budget was ${(budgetMs / 1000).toFixed(1)}s)`,
      )
      controller.abort()
    }, remaining)
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
    const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1)
    if ((err as Error).name === 'AbortError') {
      console.warn(`Gemini aborted (${model}): ANALYSIS_TIMEOUT after ${elapsedS}s`)
      throw new Error('ANALYSIS_TIMEOUT')
    }
    console.warn(`Gemini fetch error (${model}) after ${elapsedS}s:`, (err as Error)?.message || err)
    throw err
  }
  if (timer) clearTimeout(timer)

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    const msg = errBody?.error?.message || `Gemini API error: ${response.status}`
    console.warn(
      `Gemini HTTP ${response.status} (${model}) after ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ${msg}`,
    )
    throw new Error(msg)
  }

  const data = await response.json()
  // Join all text parts — see extractGeminiResponseText (mirrored from
  // src/lib/parseGeminiJson.js). parts[0]-only misses later-part JSON.
  const { rawText, diag } = extractGeminiResponseText(data)

  // Real per-call timing + token usage, visible in Supabase function logs —
  // used to calibrate chunk sizing and to monitor cost/latency once chunking
  // is live in production. Log even when empty so failed calls leave a trail.
  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1)
  if (data.usageMetadata) {
    console.log(`Gemini call (${model}): ${elapsedS}s`, JSON.stringify(data.usageMetadata))
  } else {
    console.log(`Gemini call (${model}): ${elapsedS}s (no usageMetadata)`)
  }

  if (!rawText) {
    console.warn(`Gemini returned no content (${model}):`, JSON.stringify(diag))
    const block = String(diag.blockReason || '')
    const finish = String(diag.finishReason || '')
    if (/PROHIBITED_CONTENT/i.test(block) || /PROHIBITED_CONTENT/i.test(finish)) {
      throw new Error(
        `PROHIBITED_CONTENT: Gemini blocked this request ` +
        `(blockReason=${block || 'none'} finishReason=${finish || 'unknown'})`,
      )
    }
    throw new Error(
      `Gemini returned no content. finishReason=${finish || 'unknown'} ` +
      `blockReason=${block || 'none'} parts=${diag.partCount}`,
    )
  }

  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return parseGeminiJsonText(cleaned)
  } catch (err) {
    // Attach cleaned model text so extract can re-call or persist on final failure.
    // Broken JSON never becomes originalText / export — that stays the uploaded file.
    const wrapped = err instanceof Error ? err : new Error(String(err))
    ;(wrapped as Error & { rawText?: string }).rawText = cleaned
    throw wrapped
  }
}

/** Mirrored from src/lib/parseGeminiJson.js → extractGeminiResponseText. */
function extractGeminiResponseText(data: any): { rawText: string; diag: Record<string, unknown> } {
  const candidate = data?.candidates?.[0]
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
  const texts: string[] = []
  const partSummaries: Array<Record<string, unknown>> = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    const text = typeof p?.text === 'string' ? p.text : ''
    const thought = p?.thought === true
    // Never join thought summaries into the parseable body — that would
    // corrupt JSON when includeThoughts is on or a later model starts
    // returning thought text alongside the answer.
    if (text && !thought) texts.push(text)
    partSummaries.push({
      i,
      keys: p && typeof p === 'object' ? Object.keys(p) : [typeof p],
      textLen: text.length,
      thought,
    })
  }
  const safety = Array.isArray(candidate?.safetyRatings)
    ? candidate.safetyRatings.map((r: any) => ({
      category: r?.category,
      probability: r?.probability,
      blocked: r?.blocked,
    }))
    : null
  return {
    rawText: texts.join(''),
    diag: {
      finishReason: candidate?.finishReason ?? null,
      finishMessage: candidate?.finishMessage ?? null,
      blockReason: data?.promptFeedback?.blockReason ?? null,
      blockReasonMessage: data?.promptFeedback?.blockReasonMessage ?? null,
      candidateCount: Array.isArray(data?.candidates) ? data.candidates.length : 0,
      partCount: parts.length,
      partSummaries,
      safetyRatings: safety,
      usageMetadata: data?.usageMetadata ?? null,
    },
  }
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
// value itself.
//
// Also: Gemini occasionally embeds raw U+0000–U+001F chars inside JSON string
// literals (prod 2026-07-27 Roberts / HeatherRoberts2 chunk 4 →
// "Bad control character in string literal"). Happy path still JSON.parse only;
// repair runs only when that specific parse error is thrown.
//
// Structural errors ("Expected ',' or '}'" — Alison McConville 2026-07-28) are
// NOT surgically repaired (guessing quotes can invent wrong transcript text).
// extractContent does one model re-call instead. Mirrored from
// src/lib/parseGeminiJson.js — keep in sync.
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

function escapeRawControlCharsInJsonStrings(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const code = c.charCodeAt(0)
    if (inString) {
      if (escaped) {
        out += c
        escaped = false
        continue
      }
      if (c === '\\') {
        out += c
        escaped = true
        continue
      }
      if (c === '"') {
        out += c
        inString = false
        continue
      }
      if (code < 0x20) {
        if (c === '\n') out += '\\n'
        else if (c === '\r') out += '\\r'
        else if (c === '\t') out += '\\t'
        else out += `\\u${code.toString(16).padStart(4, '0')}`
        continue
      }
      out += c
      continue
    }
    if (c === '"') inString = true
    out += c
  }
  return out
}

function isControlCharParseError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '')
  return /Bad control character|control character in string/i.test(msg)
}

function isStructuralJsonParseError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '')
  return (
    /Expected ',' or '}'|Expected property name|Unexpected token|Unexpected end of JSON|Unterminated string|JSON at position/i.test(
      msg,
    ) && !isControlCharParseError(err)
  )
}

function isGeminiJsonParseError(err: unknown): boolean {
  return (
    isControlCharParseError(err) ||
    isStructuralJsonParseError(err) ||
    /JSON/i.test(String((err as Error)?.message || err || ''))
  )
}

/** Parse cleaned Gemini JSON text (fences already stripped by caller). */
function parseGeminiJsonText(cleaned: string): any {
  const extracted = extractFirstJsonValue(cleaned)
  try {
    return JSON.parse(extracted)
  } catch (err) {
    if (!isControlCharParseError(err)) throw err
    console.warn('Gemini JSON: repairing raw control characters in string literals')
    return JSON.parse(escapeRawControlCharsInJsonStrings(extracted))
  }
}

/** Mirrored from src/lib/parseGeminiJson.js → repairMissingEntryTextKeys. */
function repairMissingEntryTextKeys(text: string): { text: string; repairedCount: number } {
  let repairedCount = 0
  const knownKeys = /^(text|id|speaker|timestamp|line_number)$/
  const out = String(text || '').replace(
    /("speaker"\s*:\s*"(?:\\.|[^"\\])*"\s*,\s*)"((?:\\.|[^"\\])*)"(\s*[,}])/g,
    (match, prefix, bare, suffix) => {
      let keyOrValue: string
      try {
        keyOrValue = JSON.parse(`"${bare}"`)
      } catch {
        return match
      }
      if (typeof keyOrValue !== 'string' || knownKeys.test(keyOrValue)) {
        return match
      }
      let value = keyOrValue
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      repairedCount++
      return `${prefix}"text": ${JSON.stringify(value)}${suffix}`
    },
  )
  return { text: out, repairedCount }
}

/** Mirrored from src/lib/parseGeminiJson.js → parseExtractJsonWithRepairs. */
function parseExtractJsonWithRepairs(rawText: string): { value: any; repairedCount: number } {
  try {
    return { value: parseGeminiJsonText(
      String(rawText || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim(),
    ), repairedCount: 0 }
  } catch (err) {
    if (!isGeminiJsonParseError(err)) throw err
    const cleaned = String(rawText || '')
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const { text, repairedCount } = repairMissingEntryTextKeys(cleaned)
    if (repairedCount === 0) throw err
    try {
      return { value: parseGeminiJsonText(text), repairedCount }
    } catch {
      throw err
    }
  }
}

// Mirrored from src/lib/parseGeminiJson.js → normalizeProofreadGeminiResult.
// Prod 2026-08-09 (Johnston / Alecia): batch 0 returned a bare annotation
// array; reading `.annotations` made us accept empty and drop ~50 real flags.
function normalizeProofreadGeminiResult(result: unknown): { annotations: any[]; shape: 'object' | 'array' | 'empty' | 'other' } {
  if (Array.isArray(result)) {
    return { annotations: result, shape: 'array' }
  }
  if (result && typeof result === 'object' && Array.isArray((result as { annotations?: unknown }).annotations)) {
    return { annotations: (result as { annotations: any[] }).annotations, shape: 'object' }
  }
  if (result == null) {
    return { annotations: [], shape: 'empty' }
  }
  return { annotations: [], shape: 'other' }
}

const EXTRACT_JSON_RECOVERY_SUFFIX =
  '\n\nCRITICAL RECOVERY: Your previous response was not valid JSON. ' +
  'Respond with ONLY a single valid minified JSON object matching the required schema. ' +
  'No markdown fences, no commentary, no trailing text. ' +
  'Escape all quotes and control characters inside string values with valid JSON escapes only. ' +
  'Never pad strings with repeated \\n blank lines — collapse 3+ consecutive newlines to one.'

type ExtractPersistCtx = {
  admin: any
  userId: string
  caseId: string
  /** Filename stem under extracting/, e.g. "Foo_chunk3" or "Foo_entries" */
  failLabel: string
}

/** Best-effort: keep the bad model blob for support (never becomes originalText).
 *  Returns storage path on success so handleFailure can record it in last_error.
 *  Kept out of the failure wipe; purged after 48h via purge_extract_raw_fail_blobs. */
async function persistExtractJsonFail(
  ctx: ExtractPersistCtx | undefined,
  rawText: string | undefined,
): Promise<string | null> {
  if (!ctx || !rawText) return null
  const path = `${ctx.userId}/${ctx.caseId}/extracting/${ctx.failLabel}_raw_fail.txt`
  try {
    const bytes = new TextEncoder().encode(rawText)
    const { error } = await ctx.admin.storage.from('case-files').upload(path, bytes, {
      upsert: true,
      contentType: 'text/plain',
    })
    if (error) {
      console.warn(`Failed to persist extract JSON fail blob: ${error.message}`)
      return null
    }
    console.warn(`Saved extract JSON fail blob (${rawText.length} chars) → ${path}`)
    return path
  } catch (e) {
    console.warn('Failed to persist extract JSON fail blob:', e)
    return null
  }
}

/** Ops-only: keep the hung chunk's input text (48h via existing raw_fail purge).
 *  Filename ends with _raw_fail.txt so handleFailure wipe keeps it. Never UI. */
async function persistExtractTimeoutChunk(
  ctx: ExtractPersistCtx | undefined,
  chunkText: string,
  meta: Record<string, unknown>,
): Promise<string | null> {
  if (!ctx || !chunkText) return null
  const path = `${ctx.userId}/${ctx.caseId}/extracting/${ctx.failLabel}_timeout_raw_fail.txt`
  const body =
    `ANALYSIS_TIMEOUT debug snapshot\n${JSON.stringify(meta)}\n` +
    `---- chunk text (${chunkText.length} chars) ----\n${chunkText}`
  try {
    const bytes = new TextEncoder().encode(body)
    const { error } = await ctx.admin.storage.from('case-files').upload(path, bytes, {
      upsert: true,
      contentType: 'text/plain',
    })
    if (error) {
      console.warn(`Failed to persist extract timeout chunk: ${error.message}`)
      return null
    }
    console.warn(`Saved extract timeout chunk (${chunkText.length} chars) → ${path}`)
    return path
  } catch (e) {
    console.warn('Failed to persist extract timeout chunk:', e)
    return null
  }
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
    // Review-only structural flags: Found "A."/"Q." often missing from entry text.
    if (a.type === 'repeated_paragraph') {
      fixed.push(a)
      continue
    }
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

/** Mirrored in src/lib/gemini.js — strip leaked gutter digits from phrases. */
function stripInteriorLineNumberTokens(phrase: string): string {
  if (!phrase || typeof phrase !== 'string') return phrase
  let out = phrase
  let prev = ''
  do {
    prev = out
    out = out.replace(/(\S)\s+\d{1,4}\s+(?=\S)/g, '$1 ')
  } while (out !== prev)
  return out.replace(/\s+/g, ' ').trim()
}

function sanitizePhraseAgainstEntry(phrase: string, entryText: string): string {
  if (!phrase || typeof phrase !== 'string') return phrase
  if (entryText && flexFind(entryText, phrase)) return phrase
  const stripped = stripInteriorLineNumberTokens(phrase)
  if (
    stripped &&
    stripped !== phrase &&
    entryText &&
    flexFind(entryText, stripped)
  ) {
    return stripped
  }
  return phrase
}

function sanitizeAnnotationLeakedLineNumbers(ann: any, entryText: string): any {
  if (!ann || ann.status === 'accepted' || ann.status === 'ignored') return ann
  if (!ann.original) return ann

  const original = sanitizePhraseAgainstEntry(ann.original, entryText)
  let suggestion = ann.suggestion
  if (suggestion && typeof suggestion === 'string') {
    if (entryText && flexFind(entryText, suggestion)) {
      // already present
    } else if (original !== ann.original) {
      // Only when original changed — avoids mangling real amounts like "1500".
      suggestion = stripInteriorLineNumberTokens(suggestion)
    }
  }

  if (original === ann.original && suggestion === ann.suggestion) return ann

  const next = { ...ann, original, suggestion }
  if (entryText && original !== ann.original) {
    const m = flexFind(entryText, original)
    if (m) {
      next.start = m.start
      next.end = m.end
    }
  }
  return next
}

function sanitizeAnnotationsLeakedLineNumbers(entries: any[], annotations: any[]): any[] {
  if (!Array.isArray(annotations) || annotations.length === 0) return annotations
  let changed = false
  const next = annotations.map((ann) => {
    const entry = (entries || []).find((e) => e.id === ann.entry_id)
    const cleaned = sanitizeAnnotationLeakedLineNumbers(ann, entry?.text ?? '')
    if (cleaned !== ann) changed = true
    return cleaned
  })
  return changed ? next : annotations
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

// Mirrors src/lib/gemini.js detectRepeatedParagraphTypes / mergeRepeatedParagraphAnnotations.
const REPEATED_PARAGRAPH_TYPE = 'repeated_paragraph'
const REPEATED_PARAGRAPH_SUGGESTION =
  'Fix this in your CAT software. Court Reportcard will not change Q/A markers.'
const REPEATED_PARAGRAPH_EXPLANATION_A =
  'Repeated Answer with no other speaker between.'
const REPEATED_PARAGRAPH_EXPLANATION_Q =
  'Repeated Question with no other speaker between.'

function matchTranscriptLineGutterPrefix(line: string): string {
  if (!line) return ''
  const patterns = [
    /^(\s*\d{1,4}\s{2,})/,
    /^(\s*\d{1,2}:\d{2}(?::\d{2})?\s+\d{1,4}\s{2,})/,
    /^(\s*\d{1,2}:\d{2}(?::\d{2})?\s{2,})/,
    /^(\s*\d{1,2}:\d{2}(?::\d{2})?\s+)/,
  ]
  for (const re of patterns) {
    const m = line.match(re)
    if (m) return m[1]
  }
  return ''
}

/** Mirrored in src/lib/gemini.js — strip wrap-line CAT gutters from entry.text. */
function stripEntryTextLineNumberGutters(text: string, opts?: { speaker?: string }): string {
  if (!text) return text
  const sp = String(opts?.speaker || '').toUpperCase()
  if (sp === 'INDEX' || sp === 'EXHIBITS') return text

  return text
    .split('\n')
    .map((line) => {
      const prefix = matchTranscriptLineGutterPrefix(line)
      if (!prefix) return line
      const plain = prefix.match(/^\s*(\d{1,4})\s{2,}$/)
      if (plain) {
        const n = parseInt(plain[1], 10)
        // Typical pages are 1–25; some CAT layouts go higher (26–29 seen in prod).
        if (n >= 1 && n <= 40) return line.slice(prefix.length)
        return line
      }
      if (/\d{1,2}:\d{2}/.test(prefix)) return line.slice(prefix.length)
      return line
    })
    .join('\n')
}

function stripEntriesLineNumberGutters(entries: any[]): any[] {
  if (!Array.isArray(entries)) return entries
  return entries.map((entry) => {
    const text = entry?.text || ''
    const next = stripEntryTextLineNumberGutters(text, { speaker: entry?.speaker })
    if (next === text) return entry
    return { ...entry, text: next }
  })
}

function normalizeAnnotationCompare(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim()
}

function isLineNumberOnlyAnnotation(ann: any): boolean {
  if (!ann || ann.status === 'accepted' || ann.status === 'ignored') return false
  const original = ann.original || ''
  if (!original) return false
  const suggestion = ann.suggestion ?? ''
  const cleanedOriginal = stripEntryTextLineNumberGutters(original)
  const cleanedSuggestion = stripEntryTextLineNumberGutters(suggestion)
  if (cleanedOriginal !== original) {
    return (
      cleanedOriginal === suggestion ||
      normalizeAnnotationCompare(cleanedOriginal) === normalizeAnnotationCompare(cleanedSuggestion)
    )
  }

  const expl = String(ann.explanation || '')
  const explainsGutterLeak =
    /line number/i.test(expl) && /erroneously included/i.test(expl)
  if (!explainsGutterLeak) return false

  const o = normalizeAnnotationCompare(original)
  const s = normalizeAnnotationCompare(suggestion)
  if (o === s) return true
  return (
    normalizeAnnotationCompare(original.replace(/\n/g, ' ')) === s ||
    o === normalizeAnnotationCompare(suggestion.replace(/\n/g, ' '))
  )
}

function dropLineNumberOnlyAnnotations(annotations: any[]): any[] {
  if (!Array.isArray(annotations) || annotations.length === 0) return annotations
  const kept = annotations.filter((a) => !isLineNumberOnlyAnnotation(a))
  return kept.length === annotations.length ? annotations : kept
}

const EXACT_REPEAT_EXPAND_TYPES = new Set(['capitalization', 'spelling'])

function isSafeExactRepeatExpandSeed(ann: any): boolean {
  if (!ann || !EXACT_REPEAT_EXPAND_TYPES.has(ann.type)) return false
  if (ann.status === 'accepted' || ann.status === 'ignored') return false
  if (ann.type === 'repeated_paragraph' || ann.review_only === true) return false
  const original = ann.original || ''
  const suggestion = ann.suggestion ?? ''
  if (!original || !suggestion || original === suggestion) return false
  const words = original.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2 && original.trim().length < 4) return false
  if (ann.type === 'capitalization') {
    return original.toLowerCase() === suggestion.toLowerCase()
  }
  const suggWords = suggestion.trim().split(/\s+/).filter(Boolean)
  return words.length === suggWords.length
}

function findAllExactPhraseStarts(text: string, phrase: string): number[] {
  if (!text || !phrase) return []
  const hits: number[] = []
  let from = 0
  while (from < text.length) {
    const i = text.indexOf(phrase, from)
    if (i === -1) break
    hits.push(i)
    from = i + Math.max(1, phrase.length)
  }
  return hits
}

/**
 * Expand exact capitalization/spelling repeats across the document.
 * Edge call site: proofread merge only (full entries). Mirrored in src/lib/gemini.js
 * for the single-pass harness (no batch merge there).
 */
function expandExactRepeatAnnotations(entries: any[], annotations: any[]): any[] {
  if (!Array.isArray(annotations) || annotations.length === 0) return annotations
  if (!Array.isArray(entries) || entries.length === 0) return annotations

  const out = annotations.map((a) => ({ ...a }))
  let added = 0
  const seenSeeds = new Set<string>()

  for (const ann of annotations) {
    if (!isSafeExactRepeatExpandSeed(ann)) continue
    const phrase = ann.original
    const seedKey = `${phrase}\0${ann.suggestion}\0${ann.type}`
    if (seenSeeds.has(seedKey)) continue
    seenSeeds.add(seedKey)

    const hits: { entry: any; start: number }[] = []
    for (const entry of entries) {
      if (!entry?.text) continue
      for (const start of findAllExactPhraseStarts(entry.text, phrase)) {
        hits.push({ entry, start })
      }
    }
    if (hits.length <= 1) continue

    const covered = new Set<string>()
    for (const a of out) {
      if (a.original !== phrase || a.type !== ann.type || a.suggestion !== ann.suggestion) continue
      if (a.status === 'ignored') continue
      const entryHits = hits.filter((h) => h.entry.id === a.entry_id).map((h) => h.start)
      if (entryHits.length === 0) continue
      if (Number.isFinite(a.start) && entryHits.includes(a.start)) {
        covered.add(`${a.entry_id}\0${a.start}`)
        continue
      }
      const unassigned = entryHits.find((h) => !covered.has(`${a.entry_id}\0${h}`))
      if (unassigned != null) covered.add(`${a.entry_id}\0${unassigned}`)
    }

    for (const { entry, start } of hits) {
      const coverKey = `${entry.id}\0${start}`
      if (covered.has(coverKey)) continue
      const end = start + phrase.length
      // Editor load re-runs ensureAnnotationAnchors for uniqueness; seed with
      // simple before/after so Accept has something immediately.
      const anchor = buildContextAnchorSimple(entry.text, start, end, 2)
      out.push({
        ...ann,
        id: annotations.length + added + 1,
        entry_id: entry.id,
        start,
        end,
        status: 'open',
        _anchorBefore: anchor?.before ?? '',
        _anchorAfter: anchor?.after ?? '',
        _appliedAt: undefined,
        _appliedEnd: undefined,
        _appliedEntryId: undefined,
        _cleanStart: undefined,
        _cleanEnd: undefined,
        matchedText: undefined,
      })
      covered.add(coverKey)
      added++
    }
  }

  if (added === 0) return annotations
  out.forEach((a, i) => { a.id = i + 1 })
  return out
}

function classifyTranscriptParagraphKind(lineContent: string): 'Q' | 'A' | 'COLLOQUY' | 'CONT' | null {
  if (/^\s{10,}\d{1,4}\s*$/.test(lineContent || '')) return null
  const t = (lineContent || '').replace(/\r/g, '').trim()
  if (!t) return null
  if (/^Q\.(?:\s|$)/.test(t)) return 'Q'
  if (/^A\.(?:\s|$)/.test(t)) return 'A'
  if (/^(?:THE\s+)?(?:COURT(?:\s+REPORTER)?|JUDGE|WITNESS|CLERK|BAILIFF)\s*:/i.test(t)) return 'COLLOQUY'
  if (/^(?:MR|MS|MRS|DR)\.?\s+\S[^:]{0,60}:/i.test(t)) return 'COLLOQUY'
  if (/^BY\s+(?:MR|MS|MRS|DR)\.?\s+/i.test(t)) return 'COLLOQUY'
  if (/^[A-Z][A-Z0-9 .,'\-]{0,50}:/.test(t) && !/^(?:Q|A)\./.test(t)) return 'COLLOQUY'
  return 'CONT'
}

function buildContextAnchorSimple(text: string, start: number, end: number, maxWords = 2): { before: string; after: string } {
  if (!text || start < 0 || end > text.length || start > end) return { before: '', after: '' }
  const beforeRaw = text.substring(0, start)
  const afterRaw = text.substring(end)
  const wordRe = /\S+/g
  const beforeWords: { start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = wordRe.exec(beforeRaw))) beforeWords.push({ start: m.index, end: m.index + m[0].length })
  const afterWords: { start: number; end: number }[] = []
  wordRe.lastIndex = 0
  while ((m = wordRe.exec(afterRaw))) afterWords.push({ start: m.index, end: m.index + m[0].length })
  const takeBefore = beforeWords.slice(-Math.max(1, maxWords))
  const takeAfter = afterWords.slice(0, Math.max(1, maxWords))
  return {
    before: takeBefore.length ? beforeRaw.substring(takeBefore[0].start) : '',
    after: takeAfter.length ? afterRaw.substring(0, takeAfter[takeAfter.length - 1].end) : '',
  }
}

function detectRepeatedParagraphTypes(originalText: string | undefined, entries: any[]): any[] {
  if (!originalText || !Array.isArray(entries) || entries.length === 0) return []
  const rawLines = originalText.split('\n')
  let cleanContent = ''
  const parsedLines: { content: string; cleanStart: number; cleanEnd: number }[] = []
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const prefix = matchTranscriptLineGutterPrefix(line)
    const content = line.substring(prefix.length)
    if (i > 0) cleanContent += '\n'
    const cleanStart = cleanContent.length
    cleanContent += content
    parsedLines.push({ content, cleanStart, cleanEnd: cleanContent.length })
  }

  let lastQa: 'Q' | 'A' | null = null
  const flags: any[] = []
  for (const pl of parsedLines) {
    const kind = classifyTranscriptParagraphKind(pl.content)
    if (kind == null) continue
    if (kind === 'COLLOQUY') { lastQa = null; continue }
    if (kind === 'CONT') continue
    if (kind !== 'Q' && kind !== 'A') continue
    if (lastQa === kind) {
      const lineSlice = cleanContent.slice(pl.cleanStart, pl.cleanEnd)
      const mm = /^(\s*)(Q\.|A\.)/.exec(lineSlice)
      if (mm) {
        const marker = mm[2]
        const markerStart = pl.cleanStart + mm[1].length
        const markerEnd = markerStart + marker.length
        const body = lineSlice.slice(mm[0].length).replace(/\s+/g, ' ').trim()
        const needle = body.slice(0, 48)
        let entry = entries[0]
        if (needle.length >= 3) {
          const hits = entries.filter((e) => e?.text && flexFind(e.text, needle))
          if (hits.length) entry = hits[0]
        }
        const anchors = buildContextAnchorSimple(cleanContent, markerStart, markerEnd, 2)
        let start = 0
        let end = 0
        if (entry?.text) {
          const inEntry = flexFind(entry.text, marker)
          if (inEntry) { start = inEntry.start; end = inEntry.end }
        }
        flags.push({
          type: REPEATED_PARAGRAPH_TYPE,
          severity: 'critical',
          original: marker,
          suggestion: REPEATED_PARAGRAPH_SUGGESTION,
          explanation: kind === 'A'
            ? REPEATED_PARAGRAPH_EXPLANATION_A
            : REPEATED_PARAGRAPH_EXPLANATION_Q,
          confidence: 1,
          entry_id: entry?.id ?? entries[0].id,
          start,
          end,
          status: 'open',
          _anchorBefore: anchors.before,
          _anchorAfter: anchors.after,
          _source: 'structural',
        })
      }
    }
    lastQa = kind
  }
  return flags
}

function mergeRepeatedParagraphAnnotations(originalText: string | undefined, entries: any[], annotations: any[]): any[] {
  const base = Array.isArray(annotations) ? annotations : []
  const detected = detectRepeatedParagraphTypes(originalText, entries)
  if (!detected.length) return base
  const existingKeys = new Set(
    base.filter((a) => a?.type === REPEATED_PARAGRAPH_TYPE)
      .map((a) => `${a._anchorBefore || ''}|${a.original}|${a._anchorAfter || ''}`),
  )
  let maxId = 0
  for (const a of base) {
    const n = Number(a?.id)
    if (Number.isFinite(n) && n > maxId) maxId = n
  }
  const added: any[] = []
  for (const d of detected) {
    const key = `${d._anchorBefore || ''}|${d.original}|${d._anchorAfter || ''}`
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    added.push({ ...d, id: ++maxId })
  }
  return added.length ? [...base, ...added] : base
}

const SPEAKER_LABEL_TYPO_TYPE = 'speaker_label_typo'
const CANONICAL_SPEAKER_ROLES = [
  'THE COURT',
  'THE WITNESS',
  'THE CLERK',
  'THE BAILIFF',
  'THE REPORTER',
  'THE COURT REPORTER',
  'JUDGE',
]
const SPEAKER_LABEL_TYPO_MAP: Record<string, string> = {
  'THE CUORT': 'THE COURT',
  'THE COURRT': 'THE COURT',
  'THE COUTR': 'THE COURT',
  'THE CORUT': 'THE COURT',
  'THE WITNES': 'THE WITNESS',
  'THE WITNSES': 'THE WITNESS',
  'THE WITNESSS': 'THE WITNESS',
  'THE CLEARK': 'THE CLERK',
  'THE CLARCK': 'THE CLERK',
  'THE BAILIF': 'THE BAILIFF',
  'THE BAILIIF': 'THE BAILIFF',
  'THE REPORTR': 'THE REPORTER',
  'THE REPOTER': 'THE REPORTER',
  'THE COURT REPORTR': 'THE COURT REPORTER',
  'THE COURT REPOTER': 'THE COURT REPORTER',
}
const SPEAKER_ROLE_FALSE_FRIENDS = new Set(['COUNT', 'COAST', 'CROWN', 'CROFT'])

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) row[j] = j
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = cur
    }
  }
  return row[b.length]
}

function resolveSpeakerRoleTypo(label: string): string | null {
  if (!label || typeof label !== 'string') return null
  const upper = label.replace(/\s+/g, ' ').trim().toUpperCase().replace(/\.$/, '')
  if (!upper) return null
  if (/^(?:MR|MS|MRS|DR)\.?\s+/.test(upper)) return null
  if (CANONICAL_SPEAKER_ROLES.includes(upper)) return null
  if (SPEAKER_LABEL_TYPO_MAP[upper]) return SPEAKER_LABEL_TYPO_MAP[upper]
  const single = /^THE\s+([A-Z]+)$/.exec(upper)
  if (single) {
    const word = single[1]
    if (SPEAKER_ROLE_FALSE_FRIENDS.has(word)) return null
    let best: string | null = null
    let bestD = Infinity
    for (const role of ['COURT', 'WITNESS', 'CLERK', 'BAILIFF', 'REPORTER']) {
      const d = levenshtein(word, role)
      if (d === 1 && d < bestD) {
        bestD = d
        best = `THE ${role}`
      }
    }
    return best
  }
  const two = /^THE\s+([A-Z]+)\s+([A-Z]+)$/.exec(upper)
  if (two) {
    const phrase = `THE ${two[1]} ${two[2]}`
    if (phrase === 'THE COURT REPORTER') return null
    if (levenshtein(phrase.replace(/\s+/g, ''), 'THECOURTREPORTER') <= 2) return 'THE COURT REPORTER'
  }
  if (upper === 'JUDGE' || upper.startsWith('JUDGE ')) return null
  if (levenshtein(upper, 'JUDGE') === 1 && upper.length >= 4) return 'JUDGE'
  return null
}

function speakerLabelTypoSuggestion(canonical: string): string {
  return `Looks like ${canonical}. Fix this in your CAT software. Court Reportcard will not change speaker labels.`
}

function detectSpeakerLabelTypos(originalText: string | undefined, entries: any[]): any[] {
  if (!originalText || !Array.isArray(entries) || entries.length === 0) return []
  const rawLines = originalText.split('\n')
  let cleanContent = ''
  const parsedLines: { content: string; cleanStart: number; cleanEnd: number }[] = []
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const prefix = matchTranscriptLineGutterPrefix(line)
    const content = line.substring(prefix.length)
    if (i > 0) cleanContent += '\n'
    const cleanStart = cleanContent.length
    cleanContent += content
    parsedLines.push({ content, cleanStart, cleanEnd: cleanContent.length })
  }
  const flags: any[] = []
  for (const pl of parsedLines) {
    const line = (pl.content || '').replace(/\r/g, '')
    const mm = /^(\s*)((?:THE\s+[A-Za-z][A-Za-z\s.'-]{0,40}?|JUDGE[A-Za-z]*)\s*):/.exec(line)
    if (!mm) continue
    if (/^(?:MR|MS|MRS|DR)\.?\s+/i.test(line.trim())) continue
    if (/^BY\s+/i.test(line.trim())) continue
    const rawLabel = mm[2].replace(/\s+/g, ' ').trim()
    const canonical = resolveSpeakerRoleTypo(rawLabel)
    if (!canonical) continue
    const labelStart = pl.cleanStart + mm[1].length
    const labelEnd = labelStart + mm[2].length
    const original = cleanContent.slice(labelStart, labelEnd)
    const anchors = buildContextAnchorSimple(cleanContent, labelStart, labelEnd, 2)
    const needle = rawLabel.toUpperCase()
    let entry = entries.find(
      (e) => (e?.speaker || '').replace(/\s+/g, ' ').trim().toUpperCase() === needle,
    ) || entries.find((e) => e?.text && flexFind(e.text, rawLabel)) || entries[0]
    let start = 0
    let end = 0
    if (entry?.text) {
      const inEntry = flexFind(entry.text, original) || flexFind(entry.text, rawLabel)
      if (inEntry) { start = inEntry.start; end = inEntry.end }
    }
    flags.push({
      type: SPEAKER_LABEL_TYPO_TYPE,
      severity: 'critical',
      original,
      suggestion: speakerLabelTypoSuggestion(canonical),
      explanation: `Possible misspelling of speaker label "${canonical}".`,
      confidence: 1,
      entry_id: entry?.id ?? entries[0].id,
      start,
      end,
      status: 'open',
      _anchorBefore: anchors.before,
      _anchorAfter: anchors.after,
      _source: 'structural',
      _canonicalSpeakerLabel: canonical,
    })
  }
  return flags
}

function mergeSpeakerLabelTypoAnnotations(originalText: string | undefined, entries: any[], annotations: any[]): any[] {
  const base = Array.isArray(annotations) ? annotations : []
  const detected = detectSpeakerLabelTypos(originalText, entries)
  if (!detected.length) return base
  const existingKeys = new Set(
    base.filter((a) => a?.type === SPEAKER_LABEL_TYPO_TYPE)
      .map((a) => `${a._anchorBefore || ''}|${a.original}|${a._anchorAfter || ''}`),
  )
  let maxId = 0
  for (const a of base) {
    const n = Number(a?.id)
    if (Number.isFinite(n) && n > maxId) maxId = n
  }
  const added: any[] = []
  for (const d of detected) {
    const key = `${d._anchorBefore || ''}|${d.original}|${d._anchorAfter || ''}`
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    added.push({ ...d, id: ++maxId })
  }
  return added.length ? [...base, ...added] : base
}

function mergeStructuralReviewAnnotations(originalText: string | undefined, entries: any[], annotations: any[]): any[] {
  return mergeSpeakerLabelTypoAnnotations(
    originalText,
    entries,
    mergeRepeatedParagraphAnnotations(originalText, entries, annotations),
  )
}

// Mirrors src/lib/gemini.js detectDoubledTimeMarkers / mergeDoubledTimeMarkerAnnotations.
// Identical pairs with or without periods: "p.m. p.m.", "pm pm", "a.m a.m", etc.
const DOUBLED_TIME_MARKER_RE = /(?<![A-Za-z0-9])([ap]\.?m\.?)\s+\1(?![A-Za-z0-9])/gi

function detectDoubledTimeMarkers(entries: any[]): any[] {
  const flags: any[] = []
  for (const entry of entries || []) {
    const text = entry?.text || ''
    if (!text) continue
    const re = new RegExp(DOUBLED_TIME_MARKER_RE.source, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      flags.push({
        type: 'extra_word',
        severity: 'critical',
        original: m[0],
        suggestion: m[1],
        explanation:
          'Identical time marker repeated back-to-back with no clock digits between the copies.',
        confidence: 1,
        entry_id: entry.id,
        start: m.index,
        end: m.index + m[0].length,
        status: 'open',
        _source: 'deterministic',
      })
    }
  }
  return flags
}

function mergeDoubledTimeMarkerAnnotations(entries: any[], annotations: any[]): any[] {
  const base = Array.isArray(annotations) ? annotations : []
  const detected = detectDoubledTimeMarkers(entries)
  if (!detected.length) return base

  const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const covered = (d: any) =>
    base.some((a) => {
      if (a?.entry_id !== d.entry_id) return false
      const ao = normalize(a.original)
      const dn = normalize(d.original)
      if (!ao || !dn) return false
      if (ao === dn || ao.includes(dn) || dn.includes(ao)) return true
      if (
        typeof a.start === 'number' &&
        typeof a.end === 'number' &&
        a.end > a.start &&
        a.start < d.end &&
        d.start < a.end
      ) {
        return true
      }
      return false
    })

  let maxId = 0
  for (const a of base) {
    const n = Number(a?.id)
    if (Number.isFinite(n) && n > maxId) maxId = n
  }

  const added: any[] = []
  for (const d of detected) {
    if (covered(d)) continue
    added.push({ ...d, id: ++maxId })
  }
  return added.length ? [...base, ...added] : base
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

  annots = sanitizeAnnotationsLeakedLineNumbers(deduped, annots)
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
  // Mirror src/lib/rtf.js — form feed so countPages charges by real page breaks.
  s = s.replace(/\\page\b ?/g, '\f')
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  s = s.replace(/\\u(-?\d+)\??/g, (_, n) => {
    let code = parseInt(n, 10)
    if (code < 0) code += 65536
    return String.fromCharCode(code)
  })
  s = s.replace(/\\\\/g, '\u0001')
  s = s.replace(/\\\{/g, '\u0002')
  s = s.replace(/\\\}/g, '\u0003')
  // Mirror src/lib/rtf.js — StenoCAT \~ = nbsp; \_ = hyphen in compounds.
  s = s.replace(/\\~/g, ' ')
  s = s.replace(/\\_/g, '-')
  s = s.replace(/\\-/g, '-')
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
  persistCtx?: ExtractPersistCtx,
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

  const prompt = `${EXTRACTION_ONLY_PROMPT}${promptSuffix}`
  let extractionResult: any
  try {
    extractionResult = await callGemini(prompt, filePart, deadlineAt, { thinkingLevel: 'minimal' }, MODEL_EXTRACT)
  } catch (err) {
    // Narrow missing-`"text":` repair (Childress) before a recovery re-call.
    // Do not broadly rewrite broken JSON — that can invent transcript text.
    if (!isGeminiJsonParseError(err)) throw err
    const rawFirst = (err as Error & { rawText?: string })?.rawText
    if (rawFirst) {
      try {
        const repaired = parseExtractJsonWithRepairs(rawFirst)
        if (repaired.repairedCount > 0) {
          console.warn(
            `Extract JSON: repaired ${repaired.repairedCount} missing text key(s); skipping recovery re-call`,
          )
          extractionResult = repaired.value
        }
      } catch {
        /* fall through to recovery re-call */
      }
    }
    if (!extractionResult) {
      console.warn(
        `Extract JSON parse failed (${String((err as Error)?.message || err)}); one recovery re-call…`,
      )
      try {
        extractionResult = await callGemini(
          `${prompt}${EXTRACT_JSON_RECOVERY_SUFFIX}`,
          filePart,
          deadlineAt,
          { thinkingLevel: 'minimal' },
          MODEL_EXTRACT,
        )
      } catch (err2) {
        const raw =
          (err2 as Error & { rawText?: string })?.rawText ||
          (err as Error & { rawText?: string })?.rawText
        const rawFailPath = await persistExtractJsonFail(persistCtx, raw)
        if (rawFailPath) {
          ;(err2 as Error & { rawFailPath?: string }).rawFailPath = rawFailPath
        }
        throw err2
      }
    }
  }
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
  // Strip wrap-line CAT gutters before proofread so they are not flagged.
  entries = stripEntriesLineNumberGutters(cleanEntries)

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
    `${PROOFREAD_ONLY_PROMPT}\n\n${buildProofreadReferenceDateBlock()}\n\n${JSON.stringify(entries, null, 2)}`,
    null,
    deadlineAt,
    undefined, // no budget cap — Pro gets full thinking for quality
    MODEL_PROOFREAD,
  )

  const { annotations: rawAnnots, shape: proofreadShape } = normalizeProofreadGeminiResult(proofreadResult)
  if (proofreadShape === 'array') {
    console.warn(`proofread: Gemini returned a bare annotations array (${rawAnnots.length}); normalizing`)
  } else if (proofreadShape === 'other') {
    console.warn('proofread: unexpected Gemini JSON shape (no annotations array)', typeof proofreadResult)
  }

  let annots = rawAnnots.map((a: any, i: number) => ({
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

  // Drop LN-only before sanitize — sanitize strips gutter digits from
  // Found/Suggest and would hide the LN-only pattern.
  annots = dropLineNumberOnlyAnnotations(annots)
  annots = sanitizeAnnotationsLeakedLineNumbers(entries, annots)
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
  // Exact-repeat expand runs once at proofread merge on the full entry list
  // (not here — batch-scoped expand missed cross-batch hits; see Jackie KLINE).
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
  const { entries: deduped } = deduplicateTranscript(allEntries, [])
  const entries = stripEntriesLineNumberGutters(deduped)
  return { title, entries, originalText: plainText, chunkPaths }
}

// ── Email (Resend) ──
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured — skipping email.')
    return
  }
  const safeSubject = String(subject ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject: safeSubject, html }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('Resend email failed:', err)
  }
}

function successEmailHtml(caseName: string, issueCount: number, caseId: string): string {
  const safeName = escapeHtml(caseName)
  const editorUrl = `${SITE_URL}/dashboard/editor?case=${encodeURIComponent(caseId)}`
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <div style="background: #001939; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">Your transcript is ready</p>
      </div>
      <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          Good news — we've finished analyzing <strong>${safeName}</strong> and found
          <strong>${Number(issueCount) || 0} suggestion${issueCount === 1 ? '' : 's'}</strong> to review.
        </p>
        <a href="${editorUrl}" style="display: inline-block; background: #001939; color: white; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; margin: 8px 0 16px;">Open in Editor</a>
        <p style="font-size: 12px; color: #6b7280; margin: 0;">If the button doesn't work, paste this link into your browser:<br />${escapeHtml(editorUrl)}</p>
      </div>
    </div>
  `
}

function zeroIssueAlertHtml(opts: {
  caseName: string
  caseId: string
  userEmail: string
  tokensCharged: number
  totalEntries: number
}): string {
  const safeName = escapeHtml(opts.caseName)
  const safeEmail = escapeHtml(opts.userEmail)
  const safeCaseId = escapeHtml(opts.caseId)
  const editorUrl = `${SITE_URL}/dashboard/editor?case=${encodeURIComponent(opts.caseId)}`
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <div style="background: #001939; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">Spot-check: 0 suggestions on a large case</p>
      </div>
      <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          <strong>${safeName}</strong> finished with 0 suggestions
          (${Number(opts.tokensCharged) || 0} tokens / ${Number(opts.totalEntries) || 0} entries).
          User: ${safeEmail}. Case: ${safeCaseId}.
        </p>
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          Skim for material misses. If it looks clean, do nothing. If you find real errors, email the user personally.
        </p>
        <a href="${editorUrl}" style="display: inline-block; background: #001939; color: white; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px;">Open in Editor</a>
      </div>
    </div>
  `
}

async function sha256HexBytes(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Fingerprint transcript file bytes before storage cleanup. Returns max failure count across files. */
async function recordCaseFailureFingerprints(admin: any, userId: string, caseFiles: any[]): Promise<number> {
  let maxCount = 0
  const transcripts = (caseFiles || []).filter((f: any) => f.file_type === 'transcript' && f.storage_path)
  for (const f of transcripts) {
    try {
      const { data: blob, error } = await admin.storage.from('case-files').download(f.storage_path)
      if (error || !blob) {
        console.error('Fingerprint download failed:', f.storage_path, error)
        continue
      }
      const hash = await sha256HexBytes(await blob.arrayBuffer())
      const { data: newCount, error: rpcErr } = await admin.rpc('admin_record_upload_failure', {
        p_user_id: userId,
        p_hash: hash,
        p_file_name: f.file_name || null,
      })
      if (rpcErr) {
        console.error('admin_record_upload_failure failed:', rpcErr)
        continue
      }
      if ((newCount ?? 0) > maxCount) maxCount = newCount
    } catch (e) {
      console.error('Fingerprint record failed for', f.storage_path, e)
    }
  }
  return maxCount
}

// ── Shared failure handler ──
// Must be once-only: chunked extract/proofread can have overlapping invocations
// that both exhaust retries. Without a claim, each one refunds and the user
// is credited twice for a single spend (seen in production 2026-07-23, case King).
async function handleFailure(admin: any, caseRow: any, caseId: string, err: unknown, stage?: string): Promise<void> {
  console.error('Analysis failed for case', caseId, stage, err)

  // Discover extract JSON fail blobs before wipe so we can keep them (48h TTL)
  // and point ops at the path from cases.last_error. Never shown in the UI.
  const userIdForStorage = caseRow.user_id as string | undefined
  const extractingPrefix = userIdForStorage ? `${userIdForStorage}/${caseId}/extracting` : ''
  let extractingFiles: { name: string }[] = []
  if (extractingPrefix) {
    const listed = await admin.storage.from('case-files').list(extractingPrefix)
    extractingFiles = listed.data || []
  }
  const rawFailFromDisk = extractingFiles
    .filter((f) => typeof f.name === 'string' && f.name.endsWith('_raw_fail.txt'))
    .map((f) => `${extractingPrefix}/${f.name}`)
  const rawFailPath =
    (err as Error & { rawFailPath?: string })?.rawFailPath || rawFailFromDisk[0] || ''
  const rawFailNote = rawFailPath ? ` raw_fail=${rawFailPath}` : ''

  // Truncated so a pathological error (e.g. a huge Gemini error body) can't
  // blow past Postgres's practical row-size comfort zone. Stage is prefixed
  // so a failure is diagnosable straight from the DB — no more reconstructing
  // which chunk/batch died from storage/API request logs after the fact.
  const lastError = `${stage ? `[${stage}] ` : ''}${(err as Error)?.message || String(err)}${rawFailNote}`.slice(0, 2000)

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

  // Claimed row still has the pre-zero charge. Clear it immediately so a
  // concurrent client refund_case_tokens is a no-op (cannot double-credit).
  const refund = claimed.tokens_charged || caseRow.tokens_charged || 0
  if (refund > 0) {
    await admin.from('cases').update({ tokens_charged: 0 }).eq('id', caseId)
  }

  // Hash transcript bytes before storage cleanup so we can block doomed retries.
  const failureCount = await recordCaseFailureFingerprints(
    admin,
    claimed.user_id,
    caseRow.case_files || [],
  )
  const repeatFailure = failureCount >= 2

  // Clean up storage: case_files rows (transcript/extracted) plus intermediate
  // extracting JSON — but keep *_raw_fail.txt for short-lived support debug
  // (purged after 48h; not referenced by the UI).
  const storagePaths: string[] = (caseRow.case_files || [])
    .map((f: any) => f.storage_path)
    .filter(Boolean)
  for (const f of extractingFiles) {
    if (typeof f.name === 'string' && f.name.endsWith('_raw_fail.txt')) continue
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
    const kind = failureEmailKind(err, repeatFailure)
    await sendEmail(
      email,
      `We couldn't finish analyzing ${claimed.name}`,
      failureEmailHtml(claimed.name, refund, kind, SITE_URL),
    )
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
// ── Proofread parallelization (capped waves) ──
// Each batch claims a `.claim` marker before calling Gemini, writes the
// result `.json` when done, then refills the wave up to
// PROOFREAD_PARALLEL_CONCURRENCY and/or race-claims the merge lock.

async function listStorageNames(admin: any, dir: string): Promise<string[]> {
  const { data, error } = await admin.storage.from('case-files').list(dir, { limit: 1000 })
  if (error) throw new Error(`Failed to list ${dir}: ${error.message}`)
  return (data || []).map((f: { name: string }) => f.name)
}

async function scanProofreadInventory(
  admin: any,
  extractingDir: string,
  jsonBaseName: string,
  numBatches: number,
): Promise<{ complete: Set<number>; inFlight: Set<number> }> {
  const names = new Set(await listStorageNames(admin, extractingDir))
  const complete = new Set<number>()
  const inFlight = new Set<number>()
  for (let i = 0; i < numBatches; i++) {
    const jsonName = proofreadBatchJsonName(jsonBaseName, i)
    const claimName = proofreadBatchClaimName(jsonBaseName, i)
    if (names.has(jsonName)) {
      complete.add(i)
      continue
    }
    if (!names.has(claimName)) continue
    const claimPath = `${extractingDir}/${claimName}`
    const { data: blob } = await admin.storage.from('case-files').download(claimPath)
    let claimedAt: string | null = null
    if (blob) {
      try {
        const parsed = JSON.parse(await blob.text())
        claimedAt = parsed?.claimed_at ?? null
      } catch {
        claimedAt = null
      }
    }
    if (isProofreadClaimStale(claimedAt)) {
      await admin.storage.from('case-files').remove([claimPath])
    } else {
      inFlight.add(i)
    }
  }
  return { complete, inFlight }
}

type ClaimResult = 'already_done' | 'busy' | 'claimed'

async function tryClaimProofreadBatch(
  admin: any,
  extractingDir: string,
  jsonBaseName: string,
  batchIndex: number,
  attempt: number,
): Promise<ClaimResult> {
  const jsonPath = `${extractingDir}/${proofreadBatchJsonName(jsonBaseName, batchIndex)}`
  const claimPath = `${extractingDir}/${proofreadBatchClaimName(jsonBaseName, batchIndex)}`

  const { data: jsonBlob } = await admin.storage.from('case-files').download(jsonPath)
  if (jsonBlob) {
    try {
      const parsed = JSON.parse(await jsonBlob.text())
      if (isProofreadBatchComplete(parsed)) return 'already_done'
    } catch {
      // Corrupt partial — treat as missing and reclaim below.
    }
  }

  const claimBody = new TextEncoder().encode(JSON.stringify({
    status: 'in_progress',
    claimed_at: new Date().toISOString(),
    attempt,
  }))

  const { data: claimBlob } = await admin.storage.from('case-files').download(claimPath)
  if (claimBlob) {
    let claimedAt: string | null = null
    try {
      claimedAt = JSON.parse(await claimBlob.text())?.claimed_at ?? null
    } catch {
      claimedAt = null
    }
    if (!isProofreadClaimStale(claimedAt) && attempt === 0) return 'busy'
    const { error } = await admin.storage.from('case-files').upload(claimPath, claimBody, {
      upsert: true,
      contentType: 'application/json',
    })
    if (error) throw new Error(`Failed to refresh claim for batch ${batchIndex}: ${error.message}`)
    return 'claimed'
  }

  const { error } = await admin.storage.from('case-files').upload(claimPath, claimBody, {
    upsert: false,
    contentType: 'application/json',
  })
  if (error) return 'busy'
  return 'claimed'
}

async function releaseProofreadBatchClaim(
  admin: any,
  extractingDir: string,
  jsonBaseName: string,
  batchIndex: number,
): Promise<void> {
  const claimPath = `${extractingDir}/${proofreadBatchClaimName(jsonBaseName, batchIndex)}`
  await admin.storage.from('case-files').remove([claimPath])
}

/** Refresh claimed_at so a live (slow) Gemini call is not stolen as stale. */
async function refreshProofreadBatchClaim(
  admin: any,
  extractingDir: string,
  jsonBaseName: string,
  batchIndex: number,
  attempt: number,
): Promise<void> {
  const claimPath = `${extractingDir}/${proofreadBatchClaimName(jsonBaseName, batchIndex)}`
  const claimBody = new TextEncoder().encode(JSON.stringify({
    status: 'in_progress',
    claimed_at: new Date().toISOString(),
    attempt,
  }))
  const { error } = await admin.storage.from('case-files').upload(claimPath, claimBody, {
    upsert: true,
    contentType: 'application/json',
  })
  if (error) console.warn('proofread claim refresh failed', batchIndex, error.message)
}

/**
 * When siblings finish and one batch is still claimed, nobody is left to call
 * refill after that claim goes stale (or after a hard kill). Schedule a
 * tick-chain watchdog (short sleeps + self-fetch) so recovery does not wait
 * on the 15‑minute stuck sweeper — and so Free-tier 150s kills cannot leave
 * a single long sleep unfinished.
 */
async function scheduleProofreadZombieWatchdog(opts: {
  admin: any
  SUPABASE_URL: string
  SERVICE_ROLE_KEY: string
  caseId: string
  fileIndex: number
  jsonBaseName: string
  extractingDir: string
  numBatches: number
  complete: Set<number>
  inFlight: Set<number>
}): Promise<void> {
  const {
    admin, SUPABASE_URL, SERVICE_ROLE_KEY, caseId, fileIndex,
    jsonBaseName, extractingDir, numBatches, complete, inFlight,
  } = opts
  if (!needsProofreadZombieWatchdog({ numBatches, completeIndices: complete, inFlightIndices: inFlight })) {
    return
  }

  const lockPath = `${extractingDir}/${proofreadWatchdogLockName(jsonBaseName)}`
  const lockBytes = new TextEncoder().encode(JSON.stringify({
    claimed_at: new Date().toISOString(),
    file_index: fileIndex,
  }))
  const { error: lockErr } = await admin.storage.from('case-files').upload(lockPath, lockBytes, {
    upsert: false,
    contentType: 'application/json',
  })
  if (lockErr) return // another sibling already armed the watchdog

  const totalTicks = Math.max(
    1,
    Math.ceil((PROOFREAD_CLAIM_STALE_MS + PROOFREAD_WATCHDOG_GRACE_MS) / PROOFREAD_WATCHDOG_TICK_MS),
  )
  console.warn(
    `proofread zombie watchdog armed case=${caseId} file=${fileIndex} ` +
    `complete=${complete.size}/${numBatches} inFlight=${[...inFlight].join(',') || '-'} ticks=${totalTicks}`,
  )
  try {
    await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, {
      case_id: caseId,
      pass: 'proofread_watchdog',
      file_index: fileIndex,
      batch_index: 0,
      attempt: 0,
      watchdog_tick: 0,
      watchdog_ticks: totalTicks,
    })
  } catch (err) {
    console.warn('failed to dispatch proofread watchdog', err)
    await admin.storage.from('case-files').remove([lockPath])
  }
}

async function dispatchProofreadBatches(
  SUPABASE_URL: string,
  SERVICE_ROLE_KEY: string,
  caseId: string,
  fileIndex: number,
  batchIndices: number[],
): Promise<void> {
  if (batchIndices.length === 0) return
  await Promise.all(batchIndices.map((i) =>
    selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, {
      case_id: caseId,
      pass: 'proofread',
      file_index: fileIndex,
      batch_index: i,
      attempt: 0,
    })
  ))
}

/**
 * After a batch settles (done / busy / skipped): refill the wave and/or
 * race-claim merge when every batch JSON is present.
 * Returns 'merged' | 'dispatched' | 'waiting' | 'busy_merge'.
 */
async function ensureExtractedCaseFileRow(
  admin: any,
  opts: { caseId: string; fileName: string; storagePath: string; fileSize: number },
): Promise<void> {
  const { caseId, fileName, storagePath, fileSize } = opts
  const { data: existing, error: selErr } = await admin
    .from('case_files')
    .select('id')
    .eq('case_id', caseId)
    .eq('storage_path', storagePath)
    .limit(1)
  if (selErr) {
    throw new Error(`case_files lookup failed for extracted pointer: ${selErr.message}`)
  }
  if ((existing?.length ?? 0) > 0) return

  const { error: insErr } = await admin.from('case_files').insert({
    case_id: caseId,
    file_type: 'extracted',
    file_name: fileName,
    file_size: fileSize,
    storage_path: storagePath,
    mime_type: 'application/json',
  })
  if (insErr) {
    throw new Error(`case_files extracted insert failed: ${insErr.message}`)
  }
}

async function refillProofreadWaveOrMerge(opts: {
  admin: any
  SUPABASE_URL: string
  SERVICE_ROLE_KEY: string
  caseId: string
  caseRow: any
  fileIndex: number
  jsonBaseName: string
  /** Original transcript file_name (may still end in .rtf after browser strip). */
  sourceFileName?: string
  extractingDir: string
  extractedDir: string
  entriesPath: string
  finalPath: string
  finalName: string
  title: string
  entries: any[]
  originalText: string | undefined
  numBatches: number
  attempt: number
}): Promise<'merged' | 'dispatched' | 'waiting' | 'busy_merge'> {
  const {
    admin, SUPABASE_URL, SERVICE_ROLE_KEY, caseId, caseRow, fileIndex,
    jsonBaseName, sourceFileName, extractingDir, extractedDir, entriesPath, finalPath, finalName,
    title, entries, originalText, numBatches, attempt,
  } = opts

  const { data: existingFinal } = await admin.storage.from('case-files').list(extractedDir, { search: finalName })
  if ((existingFinal?.length ?? 0) > 0) {
    // Storage can exist without a case_files row (KUNECKI-class orphan). Heal
    // the pointer before advancing or the editor shows an empty transcript.
    const meta = existingFinal.find((f: { name: string }) => f.name === finalName) || existingFinal[0]
    const size = meta?.metadata?.size ?? meta?.metadata?.contentLength ?? 0
    await ensureExtractedCaseFileRow(admin, {
      caseId,
      fileName: finalName,
      storagePath: finalPath,
      fileSize: typeof size === 'number' ? size : 0,
    })
    await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, {
      case_id: caseId, pass: 'proofread', file_index: fileIndex + 1, batch_index: 0, attempt: 0,
    })
    return 'merged'
  }

  const { complete, inFlight } = await scanProofreadInventory(admin, extractingDir, jsonBaseName, numBatches)

  if (complete.size >= numBatches) {
    const lockPath = `${extractingDir}/${proofreadMergeLockName(jsonBaseName)}`
    const lockBytes = new TextEncoder().encode(JSON.stringify({
      claimed_at: new Date().toISOString(),
      file_index: fileIndex,
    }))
    const { data: existingLock } = await admin.storage.from('case-files').download(lockPath)
    if (existingLock) {
      let lockClaimedAt: string | null = null
      try {
        lockClaimedAt = JSON.parse(await existingLock.text())?.claimed_at ?? null
      } catch {
        lockClaimedAt = null
      }
      if (!isProofreadClaimStale(lockClaimedAt)) {
        // Another worker is merging (or just finished — final check above).
        return 'busy_merge'
      }
      // Stale lock — steal.
      const { error: stealErr } = await admin.storage.from('case-files').upload(lockPath, lockBytes, {
        upsert: true, contentType: 'application/json',
      })
      if (stealErr) throw new Error(`Failed to steal merge lock for ${jsonBaseName}: ${stealErr.message}`)
    } else {
      const { error: lockErr } = await admin.storage.from('case-files').upload(lockPath, lockBytes, {
        upsert: false, contentType: 'application/json',
      })
      if (lockErr) return 'busy_merge'
    }

    try {
      let allAnnotations: any[] = []
      let droppedAnnotationsCount = 0
      const batchPaths: string[] = []
      const claimPaths: string[] = []
      for (let i = 0; i < numBatches; i++) {
        const p = `${extractingDir}/${proofreadBatchJsonName(jsonBaseName, i)}`
        batchPaths.push(p)
        claimPaths.push(`${extractingDir}/${proofreadBatchClaimName(jsonBaseName, i)}`)
        const { data: blob, error } = await admin.storage.from('case-files').download(p)
        if (error || !blob) throw new Error(`Missing annotation batch ${i} for ${jsonBaseName} during merge`)
        const batchResult = JSON.parse(await blob.text())
        if (!isProofreadBatchComplete(batchResult)) {
          throw new Error(`Annotation batch ${i} for ${jsonBaseName} is not complete during merge`)
        }
        allAnnotations.push(...(batchResult.annotations || []))
        droppedAnnotationsCount += batchResult.droppedCount || 0
      }

      const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
      const seen = new Set<string>()
      allAnnotations = allAnnotations.filter((a) => {
        const key = `${a.entry_id}:${normalize(a.original)}:${a.type}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      // Sole edge expand site: full entry list after all batches merge so a
      // spelling/caps seed in batch N also opens cards for earlier batches
      // (Prod 2026-08-11 Jackie KLINE: focussed). Do NOT re-apply the coarse
      // entry_id:original:type dedupe after this — that would collapse
      // same-entry multi-hit clones expand just added.
      const beforeExpand = allAnnotations.length
      allAnnotations = expandExactRepeatAnnotations(entries, allAnnotations)
      if (allAnnotations.length > beforeExpand) {
        console.warn(
          `expandExactRepeat (merge): added ${allAnnotations.length - beforeExpand} ` +
          `clone(s) across full entry list for ${jsonBaseName}`,
        )
      }
      allAnnotations.forEach((a, i) => { a.id = i + 1 })
      allAnnotations = mergeStructuralReviewAnnotations(originalText, entries, allAnnotations)
      allAnnotations = mergeDoubledTimeMarkerAnnotations(entries, allAnnotations)
      allAnnotations.forEach((a, i) => { a.id = i + 1 })

      const finalJson: any = {
        title: title || '',
        extracted_at: new Date().toISOString(),
        entries,
        annotations: allAnnotations,
        dropped_annotations_count: droppedAnnotationsCount,
      }
      if (originalText !== undefined) finalJson.originalText = originalText
      // Original upload name kept .rtf even after browser strip → plain storage.
      if (/\.rtf$/i.test(sourceFileName || '')) finalJson.wasRtf = true

      const finalBytes = new TextEncoder().encode(JSON.stringify(finalJson, null, 2))
      await admin.storage.from('case-files').upload(finalPath, finalBytes, { upsert: true, contentType: 'application/json' })
      await ensureExtractedCaseFileRow(admin, {
        caseId,
        fileName: finalName,
        storagePath: finalPath,
        fileSize: finalBytes.byteLength,
      })
      await admin.storage.from('case-files').remove([entriesPath, ...batchPaths, ...claimPaths, lockPath])

      await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, {
        case_id: caseId, pass: 'proofread', file_index: fileIndex + 1, batch_index: 0, attempt: 0,
      })
      return 'merged'
    } catch (err) {
      const stage = `proofread merge file ${fileIndex} attempt ${attempt}`
      if (attempt < MAX_CHUNK_ATTEMPTS - 1) {
        try {
          // Re-enter via sentinel batch_index so merge retries don't re-run Gemini.
          await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, {
            case_id: caseId,
            pass: 'proofread',
            file_index: fileIndex,
            batch_index: numBatches,
            attempt: attempt + 1,
          })
        } catch (retryErr) {
          await handleFailure(admin, caseRow, caseId, err, `${stage} (retry dispatch also failed: ${(retryErr as Error)?.message || retryErr})`)
        }
      } else {
        await handleFailure(admin, caseRow, caseId, err, stage)
      }
      return 'busy_merge'
    }
  }

  const toStart = planProofreadDispatch({
    numBatches,
    completeIndices: complete,
    inFlightIndices: inFlight,
    concurrency: PROOFREAD_PARALLEL_CONCURRENCY,
  })
  if (toStart.length === 0) {
    await scheduleProofreadZombieWatchdog({
      admin,
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
      caseId,
      fileIndex,
      jsonBaseName,
      extractingDir,
      numBatches,
      complete,
      inFlight,
    })
    return 'waiting'
  }
  await dispatchProofreadBatches(SUPABASE_URL, SERVICE_ROLE_KEY, caseId, fileIndex, toStart)
  return 'dispatched'
}

// pass transition) with its own fresh ANALYSIS_DEADLINE_MS budget. Always
// marked `internal` so the receiving invocation skips the client JWT check.
// Retries transient 5xx / network failures — production incident 2026-07-20
// (Bregar): proofread batch 0 succeeded, then the continuation self-fetch
// returned HTTP 500 twice in <1s and the case was refunded without ever
// reaching merge. One or two retries would have absorbed that class of glitch.
async function selfFetchContinue(SUPABASE_URL: string, SERVICE_ROLE_KEY: string, body: Record<string, unknown>): Promise<void> {
  const maxAttempts = 3
  let lastErr: Error | null = null
  console.log(`selfFetchContinue dispatch: ${JSON.stringify(body)}`)
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
      console.warn(`selfFetchContinue network error attempt ${i + 1}/${maxAttempts}:`, lastErr.message)
      if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)))
      continue
    }
    if (resp.ok) {
      console.log(`selfFetchContinue ok (${resp.status}): ${JSON.stringify(body)}`)
      return
    }
    lastErr = new Error(`Failed to invoke continuation (${JSON.stringify(body)}): ${resp.status}`)
    console.warn(`selfFetchContinue HTTP ${resp.status} attempt ${i + 1}/${maxAttempts}: ${JSON.stringify(body)}`)
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

/** Keeps stuck-case sweeper from treating an in-flight analysis as abandoned.
 *  Optional `stage` writes cases.analysis_stage so silent Edge kills leave a
 *  durable breadcrumb (downloaded / extracting / proofreading / …). */
async function touchHeartbeat(admin: any, caseId: string, stage?: string): Promise<void> {
  const patch: Record<string, string> = { updated_at: new Date().toISOString() }
  if (stage) patch.analysis_stage = stage
  const { error } = await admin.from('cases').update(patch).eq('id', caseId)
  if (error) console.warn('analysis heartbeat failed', caseId, error.message)
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
//               in capped parallel waves (PROOFREAD_PARALLEL_CONCURRENCY),
//               race-safe merge via storage lock, then finalizes the case
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
  let failReason: string
  let failStage: string
  let watchdogTick: number
  let watchdogTicks: number
  try {
    const body = await req.json()
    caseId = body.case_id
    pass = body.pass || 'extract'
    fileIndex = body.file_index || 0
    chunkIndex = body.chunk_index || 0
    batchIndex = body.batch_index || 0
    attempt = body.attempt || 0
    internal = body.internal === true
    failReason = typeof body.reason === 'string' ? body.reason : 'STUCK_ANALYSIS_TIMEOUT'
    failStage = typeof body.stage === 'string' ? body.stage : 'stuck sweeper'
    watchdogTick = Number(body.watchdog_tick) || 0
    watchdogTicks = Number(body.watchdog_ticks) || 0
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }
  if (!caseId) return json({ error: 'case_id is required.' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Authz:
  // - Client kick: pass=extract, internal=false → JWT must own the case.
  // - Continuations / pass transitions: internal=true (or non-extract pass) →
  //   must present the service role key. The `internal` body flag alone used
  //   to skip ownership checks, which let any authed client spoof continuations
  //   against another user's case_id (read/delete/refund).
  const authHeader = req.headers.get('Authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  let isServiceRole = Boolean(SERVICE_ROLE_KEY) && bearer === SERVICE_ROLE_KEY
  if (!isServiceRole && bearer.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(bearer.split('.')[1]!))
      isServiceRole = payload?.role === 'service_role'
    } catch { /* ignore */ }
  }

  if (internal || pass !== 'extract') {
    if (!isServiceRole) return json({ error: 'Forbidden.' }, 403)
  } else {
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

  // Stuck-case sweeper (and ops) ask us to run the normal failure path:
  // soft-delete, refund, fingerprint, email. Service-role only (see authz above).
  if (pass === 'fail') {
    await handleFailure(admin, caseRow, caseId, new Error(failReason), failStage)
    return json({ ok: true, status: 'failed' }, 200)
  }

  // Zombie-claim recovery: short ticks under Free-tier wall-clock, then refill
  // (scan drops stale claims and re-dispatches / merges).
  if (pass === 'proofread_watchdog') {
    const work = (async () => {
      const transcriptFiles = caseFiles
        .filter((f: any) => f.file_type === 'transcript')
        .sort((a: any, b: any) => a.file_name.localeCompare(b.file_name))
      const dbFile = transcriptFiles[fileIndex]
      if (!dbFile) return
      const jsonBaseName = safeJsonBaseName(dbFile.file_name)
      const extractingDir = `${caseRow.user_id}/${caseId}/extracting`
      const extractedDir = `${caseRow.user_id}/${caseId}/extracted`
      const entriesPath = `${extractingDir}/${jsonBaseName}_entries.json`
      const finalName = `${jsonBaseName}_extracted.json`
      const finalPath = `${extractedDir}/${finalName}`
      const lockPath = `${extractingDir}/${proofreadWatchdogLockName(jsonBaseName)}`

      const dropLock = async () => {
        await admin.storage.from('case-files').remove([lockPath])
      }

      try {
        await new Promise((r) => setTimeout(r, PROOFREAD_WATCHDOG_TICK_MS))

        const { data: live } = await admin.from('cases').select('status').eq('id', caseId).single()
        if (live?.status !== 'processing') {
          await dropLock()
          return
        }

        const ticks = watchdogTicks > 0 ? watchdogTicks : Math.max(
          1,
          Math.ceil((PROOFREAD_CLAIM_STALE_MS + PROOFREAD_WATCHDOG_GRACE_MS) / PROOFREAD_WATCHDOG_TICK_MS),
        )
        if (watchdogTick + 1 < ticks) {
          // Keep the lock across ticks so siblings don't arm a second chain.
          await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, {
            case_id: caseId,
            pass: 'proofread_watchdog',
            file_index: fileIndex,
            batch_index: 0,
            attempt: 0,
            watchdog_tick: watchdogTick + 1,
            watchdog_ticks: ticks,
          })
          return
        }

        // Drop lock before refill so a still-blocked wave can re-arm cleanly.
        await dropLock()

        const { data: entriesBlob } = await admin.storage.from('case-files').download(entriesPath)
        if (!entriesBlob) return
        let title = ''
        let entries: any[] = []
        let originalText: string | undefined
        try {
          const parsed = JSON.parse(await entriesBlob.text())
          title = parsed.title || ''
          entries = Array.isArray(parsed.entries) ? parsed.entries : []
          originalText = parsed.originalText
        } catch {
          return
        }
        const numBatches = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PROOFREAD_BATCH))
        await touchHeartbeat(admin, caseId, `proofread watchdog file ${fileIndex}`)
        await refillProofreadWaveOrMerge({
          admin,
          SUPABASE_URL,
          SERVICE_ROLE_KEY,
          caseId,
          caseRow,
          fileIndex,
          jsonBaseName,
          sourceFileName: dbFile.file_name,
          extractingDir,
          extractedDir,
          entriesPath,
          finalPath,
          finalName,
          title,
          entries,
          originalText,
          numBatches,
          attempt: 0,
        })
      } catch (err) {
        console.warn('proofread watchdog failed', caseId, err)
        try { await dropLock() } catch { /* ignore */ }
      }
    })()
    runInBackground(work)
    return json({ ok: true, status: 'proofread_watchdog' }, 202)
  }

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

    // Opportunistic platform-wide stuck sweep whenever a real user kicks analysis.
    runInBackground((async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/sweep-stuck-cases`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            apikey: SERVICE_ROLE_KEY,
          },
          body: '{}',
        })
        if (!resp.ok) console.warn('Opportunistic stuck sweep HTTP', resp.status)
      } catch (e) {
        console.warn('Opportunistic stuck sweep failed', e)
      }
    })())
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
      const wallDeadlineAt = Date.now() + ANALYSIS_DEADLINE_MS
      const deadlineAt = geminiDeadlineAt(wallDeadlineAt)
      try {
        await touchHeartbeat(admin, caseId, 'downloading')
        const { data: blob, error: dlErr } = await admin.storage.from('case-files').download(dbFile.storage_path)
        if (dlErr || !blob) {
          throw new Error(
            `Failed to download ${dbFile.file_name}: ${dlErr?.message || 'no blob'} (path=${dbFile.storage_path})`
          )
        }

        const isPdf = dbFile.file_name.toLowerCase().endsWith('.pdf')

        let finalResult: { title: string; entries: any[]; originalText?: string } | null = null
        let mergedChunkPaths: string[] | null = null

        const runExtract = async (
          stage: string,
          run: () => Promise<{ title: string; entries: any[]; originalText?: string }>,
        ) => {
          await touchHeartbeat(admin, caseId, stage)
          const pulse = setInterval(() => {
            void touchHeartbeat(admin, caseId, stage)
          }, EXTRACT_HEARTBEAT_MS)
          try {
            return await run()
          } finally {
            clearInterval(pulse)
          }
        }

        if (isPdf) {
          // PDFs are sent as a binary file part — not text-splittable, so
          // they always take the single-call path regardless of size.
          const pdfBytes = await blob.arrayBuffer()
          finalResult = await runExtract('extracting', () =>
            extractContent(pdfBytes, 'application/pdf', deadlineAt, undefined, {
              admin,
              userId: caseRow.user_id,
              caseId,
              failLabel: `${jsonBaseName}_entries`,
            }),
          )
        } else {
          const rawContent = await blob.text()
          // Content-based (not extension): client now uploads stripped .txt for
          // former .rtf picks; still safe if a legacy .rtf object remains.
          const plainText = isRtf(rawContent) ? stripRtf(rawContent) : rawContent
          if (isRtf(rawContent)) await touchHeartbeat(admin, caseId, 'stripped')
          const totalPages = countPages(plainText)

          if (totalPages <= CHUNK_THRESHOLD_PAGES) {
            // Below the threshold — identical to the original single-call
            // behavior, byte for byte. This is the majority of current traffic.
            finalResult = await runExtract(`extracting file ${fileIndex}`, () =>
              extractContent(plainText, undefined, deadlineAt, undefined, {
                admin,
                userId: caseRow.user_id,
                caseId,
                failLabel: `${jsonBaseName}_entries`,
              }),
            )
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
              const totalChunks = chunks.length
              const strategy = extractTimeoutStrategy(attempt)
              const failLabel = `${jsonBaseName}_chunk${chunkIndex}`
              const persistCtx: ExtractPersistCtx = {
                admin,
                userId: caseRow.user_id,
                caseId,
                failLabel,
              }
              const stage = `extracting file ${fileIndex} chunk ${chunkIndex + 1}/${totalChunks}`
              console.log(
                `extract ${stage} attempt=${attempt} strategy=${strategy} ` +
                `chars=${chunkText.length} prevContextChars=${trailingContext.length}`,
              )

              let chunkResult: { title: string; entries: any[]; originalText?: string }
              try {
                chunkResult = await runExtract(stage, () =>
                  extractContent(chunkText, undefined, deadlineAt, {
                    index: chunkIndex,
                    total: totalChunks,
                    trailingContext,
                  }, persistCtx),
                )
              } catch (chunkErr) {
                if (isAnalysisTimeoutError(chunkErr)) {
                  await persistExtractTimeoutChunk(persistCtx, chunkText, {
                    caseId,
                    fileIndex,
                    chunkIndex,
                    totalChunks,
                    attempt,
                    strategy,
                    trailingContextChars: trailingContext.length,
                    isLastChunk: chunkIndex === totalChunks - 1,
                  })
                }
                throw chunkErr
              }

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
        await touchHeartbeat(admin, caseId, `extract_saved file ${fileIndex}`)

        // Only clean up per-chunk files once the merged result they fed into
        // is durably saved — see mergeExtractionChunks' note on why deletion
        // isn't done there.
        if (mergedChunkPaths) await admin.storage.from('case-files').remove(mergedChunkPaths)

        await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'extract', file_index: fileIndex + 1, chunk_index: 0, attempt: 0 })
      } catch (err) {
        const stage = `extract file ${fileIndex} chunk ${chunkIndex} attempt ${attempt}`
        const errMsg = err instanceof Error ? err.message : String(err)
        if (canRetryUnit(err, attempt)) {
          const nextAttempt = attempt + 1
          const nextStrategy = isAnalysisTimeoutError(err)
            ? extractTimeoutStrategy(nextAttempt)
            : 'default'
          console.warn(
            `extract retrying after error (${errMsg}) case=${caseId} file=${fileIndex} chunk=${chunkIndex} ` +
            `attempt ${attempt} -> ${nextAttempt} nextStrategy=${nextStrategy}`,
          )
          try {
            await touchHeartbeat(admin, caseId, `${stage} - retrying`)
            await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, { case_id: caseId, pass: 'extract', file_index: fileIndex, chunk_index: chunkIndex, attempt: nextAttempt })
          } catch (retryErr) {
            // The original `err` is what actually failed the work — the retry
            // dispatch failing too is secondary, but worth keeping so both are
            // visible instead of the original cause getting silently dropped.
            await handleFailure(admin, caseRow, caseId, err, `${stage} (retry dispatch also failed: ${(retryErr as Error)?.message || retryErr})`)
          }
        } else {
          console.warn(
            `extract giving up (${errMsg}) case=${caseId} file=${fileIndex} chunk=${chunkIndex} attempt=${attempt}`,
          )
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
          const storagePath = `${extractedDir}/${f.name}`
          const size = f.metadata?.size ?? f.metadata?.contentLength ?? 0
          await ensureExtractedCaseFileRow(admin, {
            caseId,
            fileName: f.name,
            storagePath,
            fileSize: typeof size === 'number' ? size : 0,
          })
          const { data: blob } = await admin.storage.from('case-files').download(storagePath)
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

        const { error: analyzedErr } = await admin
          .from('cases')
          .update({ status: 'analyzed', analysis_stage: 'analyzed' })
          .eq('id', caseId)
        if (analyzedErr) {
          // Don't leave the case stuck on "processing" (spinner) if analysis_stage
          // isn't migrated yet on this project — status flip is what the UI needs.
          console.error('Failed to mark case analyzed (with analysis_stage):', analyzedErr.message)
          const { error: statusOnlyErr } = await admin
            .from('cases')
            .update({ status: 'analyzed' })
            .eq('id', caseId)
          if (statusOnlyErr) {
            console.error('Failed to mark case analyzed (status only):', statusOnlyErr.message)
          }
        }

        const { data: u } = await admin.auth.admin.getUserById(caseRow.user_id)
        const userEmail = u?.user?.email
        if (userEmail) {
          await sendEmail(userEmail, `Your transcript is ready — ${caseRow.name}`, successEmailHtml(caseRow.name, totalIssues, caseId))
        }
        const tokensCharged = caseRow.tokens_charged || 0
        if (totalIssues === 0 && tokensCharged >= ZERO_ISSUE_ALERT_MIN_TOKENS) {
          await sendEmail(
            FOUNDER_ALERT_EMAIL,
            `Spot-check: 0 issues on large case — ${caseRow.name}`,
            zeroIssueAlertHtml({
              caseName: caseRow.name,
              caseId,
              userEmail: userEmail || 'unknown',
              tokensCharged,
              totalEntries,
            }),
          )
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
        const meta = existingFinal.find((f: { name: string }) => f.name === finalName) || existingFinal[0]
        const size = meta?.metadata?.size ?? meta?.metadata?.contentLength ?? 0
        await ensureExtractedCaseFileRow(admin, {
          caseId,
          fileName: finalName,
          storagePath: finalPath,
          fileSize: typeof size === 'number' ? size : 0,
        })
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
  const batchName = proofreadBatchJsonName(jsonBaseName, batchIndex)
  const batchPath = `${extractingDir}/${batchName}`

  const waveOpts = {
    admin,
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    caseId,
    caseRow,
    fileIndex,
    jsonBaseName,
    sourceFileName: dbFile.file_name,
    extractingDir,
    extractedDir,
    entriesPath,
    finalPath,
    finalName,
    title,
    entries,
    originalText,
    numBatches,
    attempt,
  }

  // Sentinel: merge-only retry / stuck resume (no Gemini).
  if (batchIndex >= numBatches) {
    const work = (async () => {
      try {
        await touchHeartbeat(admin, caseId, `proofread merge file ${fileIndex}`)
        await refillProofreadWaveOrMerge(waveOpts)
      } catch (err) {
        await handleFailure(admin, caseRow, caseId, err, `proofread merge file ${fileIndex} attempt ${attempt}`)
      }
    })()
    runInBackground(work)
    return json({ ok: true, status: 'proofread_merging' }, 202)
  }

  const work = (async () => {
    const wallDeadlineAt = Date.now() + ANALYSIS_DEADLINE_MS
    const deadlineAt = geminiDeadlineAt(wallDeadlineAt)
    let claimed = false
    try {
      const claim = await tryClaimProofreadBatch(admin, extractingDir, jsonBaseName, batchIndex, attempt)
      if (claim === 'already_done' || claim === 'busy') {
        await refillProofreadWaveOrMerge(waveOpts)
        return
      }
      claimed = true

      // Fill other wave slots while this invocation runs Gemini for batchIndex.
      await refillProofreadWaveOrMerge(waveOpts)

      await touchHeartbeat(admin, caseId, `proofreading file ${fileIndex} batch ${batchIndex}`)
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

      const ownedCount = batchEnd - batchStart
      // Keep claim + case heartbeat fresh while Gemini runs so (a) stuck
      // sweeper doesn't treat a live batch as abandoned and (b) a shortened
      // claim-stale window can reclaim hard-killed workers without stealing
      // slow-but-alive ones.
      const claimPulse = setInterval(() => {
        void touchHeartbeat(admin, caseId, `proofreading file ${fileIndex} batch ${batchIndex}`)
        void refreshProofreadBatchClaim(admin, extractingDir, jsonBaseName, batchIndex, attempt)
      }, PROOFREAD_CLAIM_REFRESH_MS)
      let annotations: any[]
      let droppedCount: number
      try {
        ;({ annotations, droppedCount } = await proofreadContent(batchEntries, deadlineAt, rangeGuard))
      } finally {
        clearInterval(claimPulse)
      }
      if (annotations.length === 0 && ownedCount >= MIN_ENTRIES_FOR_EMPTY_PROOFREAD_RETRY) {
        if (attempt < MAX_CHUNK_ATTEMPTS - 1) {
          console.warn(
            `proofread returned empty annotations for ${ownedCount} owned entries ` +
            `(file ${fileIndex} batch ${batchIndex} attempt ${attempt}) — treating as soft failure`,
          )
          throw new Error(
            `PROOFREAD_EMPTY_RESULT: 0 annotations for ${ownedCount} entries ` +
            `(file ${fileIndex} batch ${batchIndex})`,
          )
        }
        console.warn(
          `proofread still empty after ${MAX_CHUNK_ATTEMPTS} attempts for ${ownedCount} owned entries ` +
          `(file ${fileIndex} batch ${batchIndex}) — accepting empty and continuing`,
        )
      }
      const batchBytes = new TextEncoder().encode(JSON.stringify({ annotations, droppedCount }, null, 2))
      const { error: upErr } = await admin.storage.from('case-files').upload(batchPath, batchBytes, {
        upsert: true,
        contentType: 'application/json',
      })
      if (upErr) throw new Error(`Failed to save annotation batch ${batchIndex} for ${jsonBaseName}: ${upErr.message}`)

      await releaseProofreadBatchClaim(admin, extractingDir, jsonBaseName, batchIndex)
      claimed = false
      await refillProofreadWaveOrMerge({ ...waveOpts, attempt: 0 })
    } catch (err) {
      if (claimed) {
        try {
          await releaseProofreadBatchClaim(admin, extractingDir, jsonBaseName, batchIndex)
        } catch (releaseErr) {
          console.warn('failed to release proofread claim', batchIndex, releaseErr)
        }
      }
      const stage = `proofread file ${fileIndex} batch ${batchIndex} attempt ${attempt}`
      const errMsg = err instanceof Error ? err.message : String(err)
      if (canRetryUnit(err, attempt)) {
        console.warn(
          `proofread retrying after error (${errMsg}) case=${caseId} file=${fileIndex} batch=${batchIndex} ` +
          `attempt ${attempt} -> ${attempt + 1}`,
        )
        try {
          await touchHeartbeat(admin, caseId, `${stage} - retrying`)
          await selfFetchContinue(SUPABASE_URL, SERVICE_ROLE_KEY, {
            case_id: caseId,
            pass: 'proofread',
            file_index: fileIndex,
            batch_index: batchIndex,
            attempt: attempt + 1,
          })
        } catch (retryErr) {
          await handleFailure(admin, caseRow, caseId, err, `${stage} (retry dispatch also failed: ${(retryErr as Error)?.message || retryErr})`)
        }
      } else {
        console.warn(
          `proofread giving up (${errMsg}) case=${caseId} file=${fileIndex} batch=${batchIndex} attempt=${attempt}`,
        )
        await handleFailure(admin, caseRow, caseId, err, stage)
      }
    }
  })()

  runInBackground(work)
  return json({ ok: true, status: 'proofread_started' }, 202)
})
