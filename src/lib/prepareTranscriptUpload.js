/**
 * Prepare a transcript for storage/analysis.
 *
 * RTF from CAT software (Eclipse, etc.) is stripped to plain text in the
 * browser before upload so the Edge worker never has to run stripRtf on a
 * multi‑MB markup blob — that path has a 100% stuck-failure rate in prod.
 * Fingerprinting still hashes the original File bytes (caller responsibility).
 */

import { stripRtf, isRtf } from './rtf.js'
import { countPages } from './pageCount.js'

/**
 * @param {string} fileName - Original file name from the picker
 * @param {string} text - File contents as text (from File.text())
 * @returns {{
 *   displayName: string,
 *   uploadFileName: string,
 *   plainText: string,
 *   mimeType: string,
 *   wasRtf: boolean,
 *   pages: number,
 * }}
 */
export function prepareTranscriptUpload(fileName, text) {
  const base = (fileName || '').split(/[/\\]/).pop() || 'transcript'
  const extIsRtf = base.toLowerCase().endsWith('.rtf')
  const contentIsRtf = isRtf(text)
  const wasRtf = extIsRtf || contentIsRtf
  const stripped = wasRtf ? stripRtf(text) : text
  // Normalize newlines so editor line maps / highlights aren't split by leftover CRs.
  const plainText = stripped.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const uploadFileName = wasRtf ? base.replace(/\.rtf$/i, '.txt') : base

  return {
    displayName: base,
    uploadFileName,
    plainText,
    mimeType: 'text/plain',
    wasRtf,
    pages: countPages(plainText),
  }
}
