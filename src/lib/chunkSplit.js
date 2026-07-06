// MIRRORED into supabase/functions/analyze-case/index.ts (Deno can't import
// local relative modules across the two deploy targets the way the browser
// bundle can) — update both sides if you change this file.
import { countPages } from './pageCount.js'

/**
 * Matches the start of a new speaker turn in court-reporter formatted text —
 * a numbered line beginning with "Q.", "A.", an attorney/witness label
 * ("MR. NAME:", "THE WITNESS:", etc.), or a "BY MR./MS." examination header.
 * Mirrors the speaker patterns EXTRACTION_ONLY_PROMPT already recognizes.
 */
const TURN_START_RE = /^\s*\d{0,4}\s*(Q\.|A\.|BY\s+(MR|MS|MRS|DR)\.|MR\.\s|MS\.\s|MRS\.\s|DR\.\s|THE\s+COURT:|THE\s+WITNESS:|THE\s+CLERK:|THE\s+REPORTER:)/

/**
 * Returns the character offset of every speaker-turn start in `text`.
 */
export function findSpeakerTurnBoundaries(text) {
  const lines = text.split('\n')
  const boundaries = []
  let offset = 0
  for (const line of lines) {
    if (TURN_START_RE.test(line)) boundaries.push(offset)
    offset += line.length + 1
  }
  return boundaries
}

/**
 * Finds the best place to cut `text` near `targetOffset`, snapping to the
 * nearest speaker-turn boundary within `windowChars` so a chunk boundary
 * never lands mid-sentence or mid-answer. Falls back to the nearest blank
 * line, then the raw target offset, only if no turn boundary is found nearby.
 */
export function findNearestSplitPoint(text, targetOffset, windowChars = 3000) {
  const boundaries = findSpeakerTurnBoundaries(text)
  let best = null
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
  let bestBlank = null
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

/**
 * Splits `text` into chunks of roughly `pagesPerChunk` pages each, snapping
 * every boundary to the nearest speaker turn (see findNearestSplitPoint).
 * Returns the whole document unchanged as a single-element array if it's at
 * or under `pagesPerChunk` pages. Chunks always concatenate back to the
 * exact original text — no gaps, no overlaps, no dropped characters.
 */
export function splitIntoChunks(text, pagesPerChunk = 15) {
  const totalPages = countPages(text)
  if (totalPages <= pagesPerChunk) return [text]

  const numChunks = Math.ceil(totalPages / pagesPerChunk)
  const approxCharsPerPage = text.length / totalPages

  const splitPoints = []
  for (let i = 1; i < numChunks; i++) {
    const targetOffset = Math.round(i * pagesPerChunk * approxCharsPerPage)
    splitPoints.push(findNearestSplitPoint(text, targetOffset))
  }

  // Guard against pathological documents where snapping could jump backward
  // past (or land exactly on) a prior split point.
  for (let i = 1; i < splitPoints.length; i++) {
    if (splitPoints[i] <= splitPoints[i - 1]) splitPoints[i] = splitPoints[i - 1] + 1
  }

  const chunks = []
  let start = 0
  for (const sp of splitPoints) {
    const clamped = Math.min(sp, text.length)
    chunks.push(text.slice(start, clamped))
    start = clamped
  }
  chunks.push(text.slice(start))
  return chunks
}

/**
 * Extracts the last `numTurns` speaker turns from `chunkText`, for carrying
 * forward as read-only context into the next chunk's prompt — so a judgment
 * call right at a chunk seam (e.g. their/there) still has surrounding
 * context without being re-extracted or re-annotated.
 */
export function extractTrailingContext(chunkText, numTurns = 2) {
  const boundaries = findSpeakerTurnBoundaries(chunkText)
  if (boundaries.length === 0) return ''
  const startIdx = boundaries[Math.max(0, boundaries.length - numTurns)]
  return chunkText.slice(startIdx).trim()
}
