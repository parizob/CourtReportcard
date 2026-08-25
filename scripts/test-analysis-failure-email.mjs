/**
 * Unit checks for prohibited-content failure classification + email copy.
 * Run: node scripts/test-analysis-failure-email.mjs
 */
import assert from 'assert'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../supabase/functions/analyze-case/emails.ts'),
  'utf8',
)

function isProhibitedContentError(err) {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /PROHIBITED_CONTENT|blockReason\s*=\s*PROHIBITED/i.test(msg)
}

function failureEmailKind(err, repeatFailure) {
  if (isProhibitedContentError(err)) return 'prohibited'
  if (repeatFailure) return 'repeat'
  return 'transient'
}

assert.ok(isProhibitedContentError(new Error('PROHIBITED_CONTENT: Gemini blocked this request (blockReason=PROHIBITED_CONTENT finishReason=unknown)')))
assert.ok(isProhibitedContentError('Gemini returned no content. finishReason=unknown blockReason=PROHIBITED_CONTENT parts=0'))
assert.ok(!isProhibitedContentError(new Error('ANALYSIS_TIMEOUT')))
assert.ok(!isProhibitedContentError(new Error('PROOFREAD_EMPTY_RESULT: 0 annotations')))

assert.strictEqual(
  failureEmailKind(new Error('PROHIBITED_CONTENT: blocked'), true),
  'prohibited',
)
assert.strictEqual(failureEmailKind(new Error('timeout'), true), 'repeat')
assert.strictEqual(failureEmailKind(new Error('timeout'), false), 'transient')

assert.ok(src.includes("wasn't a temporary glitch"))
assert.ok(src.includes("Uploading the same file again won't help"))
assert.ok(!/Please try uploading again/.test(src.split("kind === 'prohibited'")[1]?.split('} else if')[0] || ''))

const indexSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../supabase/functions/analyze-case/index.ts'),
  'utf8',
)
assert.ok(indexSrc.includes('!isProhibitedContentError(err)'))
assert.ok(indexSrc.includes('PROHIBITED_CONTENT: Gemini blocked this request'))

console.log('test-analysis-failure-email: ok')
