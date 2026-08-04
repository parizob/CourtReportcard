/**
 * Soft-wrap gate: naked RTF yes; numbered RTF/TXT no.
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { prepareTranscriptUpload } from '../src/lib/prepareTranscriptUpload.js'
import { shouldSoftWrapTranscript } from '../src/lib/transcriptDisplay.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
let failed = 0

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    failed++
  } else {
    console.log('ok:', msg)
  }
}

const wells = prepareTranscriptUpload(
  'WellsDR042926.rtf',
  readFileSync(join(__dirname, '.repro/WellsDR042926.rtf'), 'utf8'),
).plainText

const balloon = prepareTranscriptUpload(
  'pagecount_balloon_89.rtf',
  readFileSync(join(__dirname, '.repro/pagecount_balloon_89.rtf'), 'utf8'),
).plainText

const numberedTxt = Array.from({ length: 50 }, (_, i) => {
  const n = String((i % 25) + 1).padStart(2, ' ')
  return `${n}      Q. Sample numbered line ${i}`
}).join('\n')

assert(shouldSoftWrapTranscript(false, wells) === false, 'TXT path never soft-wraps')
assert(shouldSoftWrapTranscript(true, wells) === true, 'naked Wells RTF soft-wraps')
assert(shouldSoftWrapTranscript(true, balloon) === false, 'numbered balloon RTF does not soft-wrap')
assert(shouldSoftWrapTranscript(true, numberedTxt) === false, 'numbered RTF-like text does not soft-wrap')
assert(shouldSoftWrapTranscript(true, '') === false, 'empty text no wrap')
assert(shouldSoftWrapTranscript(true, null) === false, 'null text no wrap')

if (failed) {
  console.error(`\n${failed} failure(s)`)
  process.exit(1)
}
console.log('\nAll transcript display checks passed.')
