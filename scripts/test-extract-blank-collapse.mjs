/**
 * Collapse extract-prompt gutter padding without touching originalText.
 *   npm run test:extract-blank-collapse
 *
 * Guards Mattran-class extract death (caption + thousands of \\n → truncated JSON).
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { collapseExtractPromptBlankLines } from '../src/lib/gemini.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

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

console.log('collapseExtractPromptBlankLines — leaves real text alone')
{
  const src = 'Q. State your name.\nA. Bruce Mattran.'
  assert(collapseExtractPromptBlankLines(src) === src, 'single newlines unchanged')
  const para = 'First paragraph.\n\nSecond paragraph.'
  assert(collapseExtractPromptBlankLines(para) === para, 'one blank line (\\n\\n) kept')
}

console.log('collapseExtractPromptBlankLines — 3+ line breaks become one')
{
  assert(
    collapseExtractPromptBlankLines('A\n\n\nB') === 'A\nB',
    'three \\n collapse to one',
  )
  assert(
    collapseExtractPromptBlankLines('A\n\n\n\n\nB') === 'A\nB',
    'five \\n collapse to one',
  )
  assert(
    collapseExtractPromptBlankLines('A\r\n\r\n\r\nB') === 'A\nB',
    'three \\r\\n collapse to one \\n',
  )
}

console.log('collapseExtractPromptBlankLines — Mattran-style caption padding')
{
  const caption =
    'Bruce Mattran,\n                 Plaintiff,\nv.\n John Kleek,\n                 Defendant.\n' +
    '-----------------------------------------------------\n'
  const padded = caption + '\n'.repeat(12000) + 'Q. Please state your name.'
  const original = padded
  const collapsed = collapseExtractPromptBlankLines(padded)
  assert(original === padded, 'source string not mutated')
  assert(!collapsed.includes('\n\n\n'), 'no 3+ newline run remains')
  assert(collapsed.includes('Bruce Mattran'), 'keeps caption words')
  assert(collapsed.includes('Q. Please state your name.'), 'keeps testimony after gap')
  assert(collapsed.length < 400, `collapsed is small (${collapsed.length} chars), not 12k-newline blob`)
  assert(padded.length > 12000, 'original still has the padding')
}

console.log('collapseExtractPromptBlankLines — analyze-case mirror')
{
  const edge = readFileSync(join(root, 'supabase/functions/analyze-case/index.ts'), 'utf8')
  const browser = readFileSync(join(root, 'src/lib/gemini.js'), 'utf8')
  const needle = ".replace(/(?:\\r\\n|\\n|\\r){3,}/g, '\\n')"
  assert(edge.includes(needle), 'analyze-case uses the same collapse regex')
  assert(browser.includes(needle), 'gemini.js uses the same collapse regex')
  assert(
    edge.includes('originalText = fileOrText as string') &&
      edge.includes('collapseExtractPromptBlankLines(originalText)'),
    'analyze-case collapses the prompt copy, not the originalText assignment',
  )
}

console.log('collapseExtractPromptBlankLines — empty / null')
{
  assert(collapseExtractPromptBlankLines('') === '', 'empty string')
  assert(collapseExtractPromptBlankLines(null) === '', 'null')
  assert(collapseExtractPromptBlankLines(undefined) === '', 'undefined')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
