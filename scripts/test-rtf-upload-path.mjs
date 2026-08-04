/**
 * Unit tests for the RTF upload fix + stuck-case resume decisions.
 *   node scripts/test-rtf-upload-path.mjs
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { prepareTranscriptUpload } from '../src/lib/prepareTranscriptUpload.js'
import { decideStuckAction } from '../src/lib/stuckCaseResume.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed++
    console.log(`  ok  ${msg}`)
  } else {
    failed++
    console.error(`  FAIL  ${msg}`)
  }
}

console.log('prepareTranscriptUpload')
{
  // Build RTF directly so centered page markers (30+ spaces) survive stripRtf —
  // encodeRtf→stripRtf can normalize leading whitespace on marker lines.
  const marker = (n) => `${' '.repeat(55)}${n}`
  const body = [
    marker(1),
    ' 1  Q. What is your name?',
    ' 2  A. Jane Doe.',
    marker(2),
    ' 1  Q. Where do you live?',
    ' 2  A. Chicago.',
  ].map((l) => `${l}\\par`).join('\n')
  const bloat = Array.from({ length: 2000 }, (_, i) => `{\\*\\generator Cat${i};}`).join('')
  const fat = `{\\rtf1\\ansi\\deff0\n${bloat}\n{\\fonttbl{\\f0\\fmodern Courier New;}}\n\\f0\\fs20\n${body}\n}`

  const prep = prepareTranscriptUpload('WellsDR042926.rtf', fat)
  assert(prep.wasRtf === true, 'marks RTF uploads')
  assert(prep.uploadFileName === 'WellsDR042926.txt', 'renames .rtf → .txt for storage')
  assert(!prep.plainText.trimStart().startsWith('{\\rtf'), 'stripped body is not RTF markup')
  assert(prep.mimeType === 'text/plain', 'mime is text/plain')
  assert(prep.pages >= 1, `page count at least 1 (got ${prep.pages})`)
  assert(prep.plainText.includes('What is your name'), 'keeps testimony text')
  assert(prep.plainText.length < fat.length / 2, 'stripped text much smaller than fat RTF')
}

{
  // Real CAT files keep 30+ space page markers through stripRtf (Wells=9 in
  // prod). Assert page counting on the plain-text path the Edge worker sees
  // after our upload rename.
  const plain = [
    `${' '.repeat(55)}1`,
    ' 1  Q. Hello?',
    ' 2  A. Hi.',
    `${' '.repeat(55)}2`,
    ' 1  Q. Next?',
    ' 2  A. Yes.',
  ].join('\n')
  const prep = prepareTranscriptUpload('hearing.txt', plain)
  assert(prep.wasRtf === false, 'plain .txt is not treated as RTF')
  assert(prep.uploadFileName === 'hearing.txt', 'keeps .txt name')
  assert(prep.pages === 2, `plain text page markers counted (got ${prep.pages})`)
  assert(prep.plainText.includes('Hello'), 'passes .txt through')
}

{
  // Content looks like RTF even if extension is wrong
  const prep = prepareTranscriptUpload('odd.txt', '{\\rtf1\\ansi Hello\\par}')
  assert(prep.wasRtf === true, 'content-based RTF detection')
  assert(prep.uploadFileName === 'odd.txt', 'non-.rtf name kept when only content is RTF')
  assert(!prep.plainText.includes('\\par'), 'still strips RTF content')
}

{
  // StenoCAT nbsp (\~) + hyphen-as-\_ for compounds.
  const rtf =
    '{\\rtf1\\ansi Go ahead, Ms.\\~Jackoboice.\\par Guillian\\_Barre\\par long\\_distance\\par}'
  const prep = prepareTranscriptUpload('stenocat.rtf', rtf)
  assert(prep.plainText.includes('Ms. Jackoboice'), 'nbsp \\~ becomes space (not Ms.Jackoboice)')
  assert(!prep.plainText.includes('Ms.Jackoboice'), 'does not glue Ms. to surname')
  assert(prep.plainText.includes('Guillian-Barre'), 'StenoCAT \\_ becomes hyphen')
  assert(prep.plainText.includes('long-distance'), 'compound \\_ becomes hyphen')
  assert(!prep.plainText.includes('Guillian_Barre'), 'does not leave literal underscore')
}

{
  // Real Wells fixture: testimony sites use Ms.\\~Name
  const wells = readFileSync(join(__dirname, '.repro/WellsDR042926.rtf'), 'utf8')
  const prep = prepareTranscriptUpload('WellsDR042926.rtf', wells)
  assert(prep.plainText.includes('Ms. Jackoboice'), 'Wells keeps space after Ms.')
  assert(
    (prep.plainText.match(/Ms\.Jackoboice/g) || []).length === 0,
    'Wells has no glued Ms.Jackoboice after strip',
  )
  assert(
    (prep.plainText.match(/Ms\.Medlock/g) || []).length === 0,
    'Wells has no glued Ms.Medlock after strip',
  )
  assert(prep.plainText.includes('long-distance'), 'Wells long-distance uses hyphen')
  assert(prep.plainText.includes('three-week'), 'Wells three-week uses hyphen')
  assert(
    !prep.plainText.includes('long_distance') && !prep.plainText.includes('Guillian_Barre'),
    'Wells has no StenoCAT underscore leftovers',
  )
}

console.log('decideStuckAction')
{
  assert(
    decideStuckAction({ hasExtracted: true, extractingNames: [], restartCount: 0 }) === 'recover_analyzed',
    'extracted present → recover',
  )
  assert(
    decideStuckAction({
      hasExtracted: false,
      extractingNames: ['Wells_entries.json'],
      restartCount: 0,
    }) === 'resume_proofread',
    'entries present, first stuck → resume proofread',
  )
  assert(
    decideStuckAction({
      hasExtracted: false,
      extractingNames: ['Wells_entries.json'],
      restartCount: 1,
    }) === 'fail',
    'entries present, already restarted → fail (no resume loop)',
  )
  assert(
    decideStuckAction({ hasExtracted: false, extractingNames: ['Wells_chunk0.json'], restartCount: 0 }) ===
      're_kick_extract',
    'partial chunks only → re-kick extract',
  )
  assert(
    decideStuckAction({ hasExtracted: false, extractingNames: [], restartCount: 0 }) === 're_kick_extract',
    'nothing yet → re-kick extract',
  )
  assert(
    decideStuckAction({ hasExtracted: false, extractingNames: [], restartCount: 1 }) === 'fail',
    'already restarted, no progress → fail',
  )
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
