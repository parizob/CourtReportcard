#!/usr/bin/env node
/**
 * Connie Parchman orphan-period seed — offline accept check (no Gemini).
 *
 * Seed: scripts/test-transcripts/seed_connie_orphan_period.txt
 * Run:  node scripts/test-connie-orphan-period.mjs
 *
 * Manual UI: upload that .txt, accept key strokes → keystrokes, confirm
 * line 9 is "keystrokes." not a lone ".".
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { applyCorrectionDetailed } from '../src/lib/gemini.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const seedPath = join(__dirname, 'test-transcripts/seed_connie_orphan_period.txt')
const seed = readFileSync(seedPath, 'utf8')

const beforeSnippet = seed.match(/8\s+injuries[\s\S]*?10\s+It doesn't/)
console.log('=== BEFORE (lines 8–10) ===')
console.log(beforeSnippet ? beforeSnippet[0] : seed.slice(0, 400))

const detail = applyCorrectionDetailed(seed, 'key strokes', 'keystrokes')
const afterSnippet = detail.text.match(/8\s+injuries[\s\S]*?10\s+It doesn't/)
console.log('\n=== AFTER accept key strokes → keystrokes ===')
console.log(afterSnippet ? afterSnippet[0] : detail.text.slice(detail.start - 40, detail.end + 80))

const expanded = applyCorrectionDetailed(seed, 'key strokes', 'bubbly tubbly wubbly')
const expandedSnippet = expanded.text.match(/8\s+injuries[\s\S]*?10\s+It doesn't/)
console.log('\n=== AFTER accept key strokes → bubbly tubbly wubbly (more words) ===')
console.log(expandedSnippet ? expandedSnippet[0] : expanded.text.slice(expanded.start - 40, expanded.end + 80))

const sameLineSeed = seed.replace(/key\r\n\r\n\s+9\s+strokes\./, 'keystrokes.')
const longPhrase = 'bubbly tubbly wubbly keystrokes extra words'
const sameLine = applyCorrectionDetailed(sameLineSeed, 'keystrokes', longPhrase)
const sameLineSnippet = sameLine.text.match(/8\s+injuries[\s\S]*?10\s+It doesn't/)
console.log('\n=== AFTER same-line keystrokes → long phrase (no unnumbered wrap) ===')
console.log(sameLineSnippet ? sameLineSnippet[0] : sameLine.text.slice(sameLine.start - 40, sameLine.end + 80))

const checks = [
  ['found match', detail.start !== -1],
  ['has keystrokes.', detail.text.includes('keystrokes.')],
  ['no orphan period-only gutter line', !/(?:^|\n)\s*\d+\s+\.\s*(?:\r?\n|$)/.test(detail.text)],
  ['line 9 is keystrokes.', /9\s+keystrokes\./.test(detail.text)],
  ['expanded found match', expanded.start !== -1],
  ['expanded has …wubbly.', expanded.text.includes('bubbly tubbly wubbly.')],
  ['expanded no orphan period line', !/(?:^|\n)\s*\d+\s+\.\s*(?:\r?\n|$)/.test(expanded.text)],
  ['expanded on line 9', /9\s+bubbly tubbly wubbly\./.test(expanded.text)],
  ['expanded not stacked on line 8', !/clicks and bubbly tubbly wubbly/.test(expanded.text)],
  ['same-line stays on numbered line', sameLine.text.includes(`clicks and ${longPhrase}`)],
  ['same-line has full phrase', sameLine.text.includes(longPhrase)],
]

console.log('\n=== CHECKS ===')
let failed = 0
for (const [name, ok] of checks) {
  console.log(ok ? 'PASS' : 'FAIL', name)
  if (!ok) failed++
}
process.exit(failed ? 1 : 0)
