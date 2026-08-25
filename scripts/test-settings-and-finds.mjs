/**
 * Unit tests for Settings prefs + My finds (no Gemini, no network).
 *
 * Covers:
 * - preference defaults / normalize (export toggles + auto-advance)
 * - Export page seed from Settings (one-off; does not write back)
 * - auto-advance next-open selection after Accept/Ignore
 * - userFinds normalize / download format / id allocate
 * - finds round-trip on extracted JSON shape (separate from transcript export)
 *
 * Run: npm run test:settings-finds
 *
 * Manual smoke (Dev) when UI changes:
 * 1. Settings toggles survive reload
 * 2. Export seeds from Settings; flipping a checkbox does not change Settings
 * 3. Auto-advance off stays put; on jumps after Accept and Ignore
 * 4. Add find → refresh → still there; download from editor, Files modal, Export
 */
import assert from 'assert'
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  seedExportToggles,
  nextOpenAfterResolve,
} from '../src/lib/userPreferences.js'
import {
  nextUserFindId,
  normalizeUserFinds,
  formatUserFindsDownload,
  lineNumberFromPrefix,
  buildUserFindFromLine,
  sortUserFinds,
} from '../src/lib/userFinds.js'

// --- Preferences ---
assert.deepStrictEqual(normalizePreferences(null), DEFAULT_PREFERENCES)
assert.strictEqual(normalizePreferences({}).export_include_line_numbers, true)
assert.strictEqual(normalizePreferences({}).export_include_page_numbers, true)
assert.strictEqual(normalizePreferences({}).auto_advance_on_accept, false)
assert.strictEqual(
  normalizePreferences({ export_include_line_numbers: false }).export_include_line_numbers,
  false,
)
assert.strictEqual(
  normalizePreferences({ auto_advance_on_accept: true }).auto_advance_on_accept,
  true,
)
assert.strictEqual(
  normalizePreferences({ auto_advance_on_accept: 'yes' }).auto_advance_on_accept,
  false,
)

// Export seed: missing numbering forces off even if prefs say on
assert.deepStrictEqual(
  seedExportToggles({ hasLineNumbers: false, hasPageNumbers: false }, DEFAULT_PREFERENCES),
  { includeLineNumbers: false, includePageNumbers: false },
)
assert.deepStrictEqual(
  seedExportToggles(
    { hasLineNumbers: true, hasPageNumbers: true },
    { export_include_line_numbers: false, export_include_page_numbers: true },
  ),
  { includeLineNumbers: false, includePageNumbers: true },
)
assert.deepStrictEqual(
  seedExportToggles({ hasLineNumbers: true, hasPageNumbers: true }, DEFAULT_PREFERENCES),
  { includeLineNumbers: true, includePageNumbers: true },
)

// Auto-advance: next open in order after closing one
const open = [{ id: 1 }, { id: 2 }, { id: 3 }]
assert.strictEqual(nextOpenAfterResolve(open, 1).id, 2)
assert.strictEqual(nextOpenAfterResolve(open, 2).id, 3)
assert.strictEqual(nextOpenAfterResolve(open, 3), null)
assert.strictEqual(nextOpenAfterResolve([{ id: 9 }], 9), null)
assert.strictEqual(nextOpenAfterResolve(open, 99).id, 1)

// --- User finds ---
assert.strictEqual(nextUserFindId([]), 1)
assert.strictEqual(nextUserFindId([{ id: 3 }, { id: 1 }]), 4)

assert.strictEqual(lineNumberFromPrefix('   12 '), '12')
assert.strictEqual(lineNumberFromPrefix(''), null)

const find = buildUserFindFromLine(
  { prefix: '  8  ', content: 'He said word , then left.', cleanStart: 100, pageNum: '12', lineIdx: 40 },
  'word ,',
  8,
  1,
)
assert.ok(find)
assert.strictEqual(find.page, '12')
assert.strictEqual(find.line, '8')
assert.strictEqual(find.text, 'word ,')
assert.strictEqual(find.cleanStart, 108)

const formatted = formatUserFindsDownload([
  { id: 1, page: '12', line: '8', text: 'word ,', note: 'comma to period', created_at: 'x' },
  { id: 2, page: null, line: '3', text: 'teh', note: '', created_at: 'y' },
])
assert.ok(formatted.includes('Page 12, Line 8'))
assert.ok(formatted.includes('"word ,"'))
assert.ok(formatted.includes('Note: comma to period'))
assert.ok(formatted.includes('Line 3'))
assert.ok(formatted.includes('"teh"'))

assert.strictEqual(normalizeUserFinds([{ id: 1, text: '  ok  ' }])[0].text, 'ok')
assert.strictEqual(normalizeUserFinds([{ id: 1, text: '' }]).length, 0)
assert.strictEqual(normalizeUserFinds(null).length, 0)

const sorted = sortUserFinds([
  { id: 1, page: '2', line: '1', text: 'minutes', note: '', created_at: 'a' },
  { id: 2, page: '1', line: '3', text: 'Did', note: '', created_at: 'b' },
  { id: 3, page: '1', line: '2', text: 'Whitfield', note: '', created_at: 'c' },
  { id: 4, page: '1', line: null, text: 'no-line', note: '', created_at: 'd' },
])
assert.deepStrictEqual(sorted.map((f) => f.text), ['Whitfield', 'Did', 'no-line', 'minutes'])

const downloadOrder = formatUserFindsDownload([
  { id: 1, page: '2', line: '1', text: 'second', note: '', created_at: 'a' },
  { id: 2, page: '1', line: '2', text: 'first', note: '', created_at: 'b' },
])
assert.ok(downloadOrder.indexOf('first') < downloadOrder.indexOf('second'))

// Extracted JSON round-trip: userFinds sit beside originalText, not inside it
const extracted = {
  originalText: 'Line with no finds applied here.',
  annotations: [],
  entries: [],
  userFinds: normalizeUserFinds([
    { id: 1, page: '1', line: '1', text: 'finds', note: 'fix in CAT', created_at: 'z' },
  ]),
}
const reloaded = JSON.parse(JSON.stringify(extracted))
assert.strictEqual(reloaded.originalText, extracted.originalText)
assert.strictEqual(normalizeUserFinds(reloaded.userFinds).length, 1)
assert.ok(!reloaded.originalText.includes('fix in CAT'))

console.log('test-settings-and-finds: ok')
