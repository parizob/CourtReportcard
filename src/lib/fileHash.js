/** SHA-256 hex digest of a File / Blob (browser SubtleCrypto). */
export async function sha256Hex(file) {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
