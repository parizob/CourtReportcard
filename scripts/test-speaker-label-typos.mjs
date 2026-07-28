#!/usr/bin/env node
/**
 * Unit tests for deterministic speaker-label typo detection (no Gemini).
 * Usage: node scripts/test-speaker-label-typos.mjs
 */
import {
  resolveSpeakerRoleTypo,
  detectSpeakerLabelTypos,
  mergeSpeakerLabelTypoAnnotations,
  mergeStructuralReviewAnnotations,
  isReviewOnlyAnnotation,
  SPEAKER_LABEL_TYPO_TYPE,
  ensureAcceptedCorrectionsInOriginalText,
} from '../src/lib/gemini.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed++
    console.error('FAIL:', msg)
  } else {
    console.log('ok:', msg)
  }
}
function assertEq(a, b, msg) {
  assert(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`)
}

// resolveSpeakerRoleTypo
assertEq(resolveSpeakerRoleTypo('THE CUORT'), 'THE COURT', 'CUORT → COURT')
assertEq(resolveSpeakerRoleTypo('THE WITNES'), 'THE WITNESS', 'WITNES → WITNESS')
assertEq(resolveSpeakerRoleTypo('THE COURT'), null, 'exact COURT not flagged')
assertEq(resolveSpeakerRoleTypo('MR. SMITH'), null, 'attorney name ignored')
assertEq(resolveSpeakerRoleTypo('MS. JONES'), null, 'MS. ignored')
assertEq(resolveSpeakerRoleTypo('THE COUNT'), null, 'false friend COUNT')
assertEq(resolveSpeakerRoleTypo('THE CLEARK'), 'THE CLERK', 'CLEARK → CLERK')

const originalText =
  '     1                  Q.  First question?\r\n\r\n' +
  '     2                  A.  First answer.\r\n\r\n' +
  '     3                  THE CUORT:  Please proceed.\r\n\r\n' +
  '     4                  Q.  After the court.\r\n\r\n' +
  '     5                  THE WITNES:  Yes, your Honor.\r\n\r\n' +
  '     6                  THE COURT:  Correct spelling is fine.\r\n\r\n' +
  '     7                  MR. SMTH:  Attorney typos are out of scope.\r\n\r\n'

const entries = [
  { id: 1, speaker: 'Q', text: 'First question?' },
  { id: 2, speaker: 'A', text: 'First answer.' },
  { id: 3, speaker: 'THE CUORT', text: 'Please proceed.' },
  { id: 4, speaker: 'Q', text: 'After the court.' },
  { id: 5, speaker: 'THE WITNES', text: 'Yes, your Honor.' },
  { id: 6, speaker: 'THE COURT', text: 'Correct spelling is fine.' },
  { id: 7, speaker: 'MR. SMTH', text: 'Attorney typos are out of scope.' },
]

const flags = detectSpeakerLabelTypos(originalText, entries)
assertEq(flags.length, 2, 'exactly two role-label typos')
assert(
  flags.every((f) => f.type === SPEAKER_LABEL_TYPO_TYPE && isReviewOnlyAnnotation(f)),
  'flags are review-only speaker_label_typo',
)
assert(
  flags.some((f) => /CUORT/i.test(f.original) && f.suggestion.includes('THE COURT')),
  'CUORT flag points at THE COURT',
)
assert(
  flags.some((f) => /WITNES/i.test(f.original) && f.suggestion.includes('THE WITNESS')),
  'WITNES flag points at THE WITNESS',
)
assert(
  flags.every((f) => (f.suggestion || '').includes('will not change speaker labels')),
  'suggestion says we will not change labels',
)
assert(
  !flags.some((f) => /SMTH/i.test(f.original)),
  'attorney last-name typo not flagged',
)

const merged = mergeSpeakerLabelTypoAnnotations(originalText, entries, [])
assertEq(merged.length, 2, 'merge adds both')
const mergedAgain = mergeSpeakerLabelTypoAnnotations(originalText, entries, merged)
assertEq(mergedAgain.length, 2, 'merge is idempotent')

// Accept must not rewrite transcript
const accepted = merged.map((a) => ({ ...a, status: 'accepted' }))
const { text, failed: ensureFailed } = ensureAcceptedCorrectionsInOriginalText(
  originalText,
  entries,
  accepted,
)
assertEq(text, originalText, 'accept does not rewrite originalText')
assertEq(ensureFailed.length, 0, 'no export verify failures for review-only')

const withStructural = mergeStructuralReviewAnnotations(originalText, entries, [])
assert(
  withStructural.filter((a) => a.type === SPEAKER_LABEL_TYPO_TYPE).length === 2,
  'structural merge includes speaker labels',
)

if (failed) {
  console.error(`\n${failed} failure(s)`)
  process.exit(1)
}
console.log('\nAll speaker-label typo tests passed.')
