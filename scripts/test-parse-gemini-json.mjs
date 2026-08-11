#!/usr/bin/env node
/**
 * Unit tests for Gemini JSON parse helpers (control-char repair + structural
 * classification for extract recovery). Run: node scripts/test-parse-gemini-json.mjs
 */
import {
  extractFirstJsonValue,
  escapeRawControlCharsInJsonStrings,
  parseGeminiJsonResponse,
  isControlCharParseError,
  isStructuralJsonParseError,
  isGeminiJsonParseError,
  normalizeProofreadGeminiResult,
  extractGeminiResponseText,
  repairMissingEntryTextKeys,
  parseExtractJsonWithRepairs,
} from '../src/lib/parseGeminiJson.js'

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed++
    console.log(`  ok  ${msg}`)
  } else {
    failed++
    console.error(`  FAIL ${msg}`)
  }
}

console.log('parseGeminiJson')

{
  const valid = '{"entries":[{"id":1,"text":"hello"}]}'
  assert(JSON.stringify(parseGeminiJsonResponse(valid)) === JSON.stringify(JSON.parse(valid)), 'valid JSON unchanged')
}

{
  const withFence = '```json\n{"a":1}\n```'
  assert(parseGeminiJsonResponse(withFence).a === 1, 'strips markdown fences')
}

{
  const trailing = '{"a":1}\nEXTRA JUNK'
  assert(parseGeminiJsonResponse(trailing).a === 1, 'trims trailing junk after balanced value')
}

{
  // Raw newline inside a JSON string — the Mallory / Roberts failure class.
  const bad = '{"entries":[{"id":1,"text":"line one\nline two"}]}'
  let threw = false
  try {
    JSON.parse(bad)
  } catch {
    threw = true
  }
  assert(threw, 'raw fixture is illegal for bare JSON.parse')
  const parsed = parseGeminiJsonResponse(bad)
  assert(parsed.entries[0].text === 'line one\nline two', 'repairs raw newline into real newline in value')
}

{
  const badTab = '{"t":"a\tb"}'
  assert(parseGeminiJsonResponse(badTab).t === 'a\tb', 'repairs raw tab')
}

{
  const alreadyEscaped = '{"t":"a\\nb"}'
  assert(parseGeminiJsonResponse(alreadyEscaped).t === 'a\nb', 'already-escaped \\n still works')
}

{
  const repaired = escapeRawControlCharsInJsonStrings('{"t":"a\nb"}')
  assert(repaired === '{"t":"a\\nb"}', 'escape helper produces \\n')
}

{
  const extracted = extractFirstJsonValue('prefix {"x":1} trailing')
  assert(extracted === '{"x":1}', 'extractFirstJsonValue finds object')
}

{
  let threw = false
  try {
    parseGeminiJsonResponse('{not json')
  } catch {
    threw = true
  }
  assert(threw, 'still throws on genuinely broken JSON')
}

{
  // Alison McConville class — structural, not control-char. Must NOT be "repaired"
  // into invented text; callers re-ask the model instead.
  const structural = '{"title":"x","entries":[{"id":1,"text":"hello}'
  let err
  try {
    parseGeminiJsonResponse(structural)
  } catch (e) {
    err = e
  }
  assert(!!err, 'structural bad JSON throws')
  assert(isStructuralJsonParseError(err), 'classified as structural')
  assert(!isControlCharParseError(err), 'not classified as control-char')
  assert(isGeminiJsonParseError(err), 'counts as Gemini JSON parse error (recovery eligible)')
}

{
  const ctrlErr = new Error('Bad control character in string literal in JSON at position 12')
  assert(isControlCharParseError(ctrlErr), 'control-char classifier')
  assert(!isStructuralJsonParseError(ctrlErr), 'control-char is not structural')
  assert(isGeminiJsonParseError(ctrlErr), 'control-char is recovery-eligible')
}

{
  const structMsg = new Error("Expected ',' or '}' after property value in JSON at position 42")
  assert(isStructuralJsonParseError(structMsg), 'Expected comma/brace classifier')
  assert(isGeminiJsonParseError(structMsg), 'Expected comma/brace is recovery-eligible')
}

console.log('\nnormalizeProofreadGeminiResult')
{
  const bare = [{ id: 1, entry_id: 10, original: 'A A lot.', suggestion: 'A lot.' }]
  const n = normalizeProofreadGeminiResult(bare)
  assert(n.shape === 'array', 'bare array → shape array')
  assert(n.annotations.length === 1 && n.annotations[0].entry_id === 10, 'bare array → annotations preserved')
}
{
  const wrapped = { annotations: [{ id: 1, entry_id: 2, original: 'x', suggestion: 'y' }] }
  const n = normalizeProofreadGeminiResult(wrapped)
  assert(n.shape === 'object', 'object wrapper → shape object')
  assert(n.annotations.length === 1, 'object wrapper → annotations')
}
{
  assert(normalizeProofreadGeminiResult({}).shape === 'other', 'empty object → other')
  assert(normalizeProofreadGeminiResult(null).shape === 'empty', 'null → empty')
  assert(normalizeProofreadGeminiResult({ annotations: [] }).annotations.length === 0, 'explicit empty array ok')
}

console.log('\nextractGeminiResponseText')
{
  const multi = {
    candidates: [{
      finishReason: 'STOP',
      content: {
        parts: [
          { thought: true, text: '' },
          { text: '{"entries":[{"id":1}]}' },
        ],
      },
    }],
    usageMetadata: { totalTokenCount: 9 },
  }
  const { rawText, diag } = extractGeminiResponseText(multi)
  assert(rawText === '{"entries":[{"id":1}]}', 'joins later-part text when parts[0] empty')
  assert(diag.finishReason === 'STOP', 'diag finishReason')
  assert(diag.partCount === 2, 'diag partCount')
}
{
  const withThoughtText = {
    candidates: [{
      finishReason: 'STOP',
      content: {
        parts: [
          { thought: true, text: 'reasoning dump' },
          { text: '{"ok":true}' },
        ],
      },
    }],
  }
  const { rawText } = extractGeminiResponseText(withThoughtText)
  assert(rawText === '{"ok":true}', 'skips thought-part text when joining')
}
{
  const empty = {
    candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ thought: true }] } }],
    promptFeedback: { blockReason: null },
  }
  const { rawText, diag } = extractGeminiResponseText(empty)
  assert(rawText === '', 'empty when no text parts')
  assert(diag.finishReason === 'MAX_TOKENS', 'empty diag keeps finishReason')
  assert(diag.partSummaries?.[0]?.thought === true, 'part summary notes thought')
}

console.log('\nrepairMissingEntryTextKeys / parseExtractJsonWithRepairs')
{
  // Prod Childress 2026-08-11 shape (escaped quotes inside bare token)
  const broken = `{
  "title": "Sora Childress",
  "entries": [
    { "id": 75, "speaker": "Q", "text": "And what was his response to that?" },
    { "id": 76, "speaker": "A", "\\"Talk to Josh about it.\\"" },
    { "id": 77, "speaker": "Q", "text": "Was there anything else said?" }
  ]
}`
  const { text, repairedCount } = repairMissingEntryTextKeys(broken)
  assert(repairedCount === 1, 'Childress shape: one repair')
  const parsed = JSON.parse(text)
  assert(parsed.entries[1].text === 'Talk to Josh about it.', 'Childress shape: text restored')
  assert(parsed.entries[0].text.startsWith('And what'), 'Childress shape: neighbors unchanged')
}
{
  const bare = `{ "entries": [ { "id": 1, "speaker": "A", "Hello there." } ] }`
  const { value, repairedCount } = parseExtractJsonWithRepairs(bare)
  assert(repairedCount === 1, 'bare spoken line: repairedCount 1')
  assert(value.entries[0].text === 'Hello there.', 'bare spoken line: text key inserted')
}
{
  const valid = `{ "entries": [ { "id": 1, "speaker": "A", "text": "Already fine." } ] }`
  const { text, repairedCount } = repairMissingEntryTextKeys(valid)
  assert(repairedCount === 0, 'valid entry: no repair')
  assert(text === valid, 'valid entry: text unchanged')
  const parsed = parseExtractJsonWithRepairs(valid)
  assert(parsed.repairedCount === 0 && parsed.value.entries[0].text === 'Already fine.', 'valid parses without repair')
}
{
  const unrelated = `{ "entries": [ { "id": 1, "speaker": "A", "text": "oops" ` // truncated
  let threw = false
  try {
    parseExtractJsonWithRepairs(unrelated)
  } catch {
    threw = true
  }
  assert(threw, 'unrelated broken JSON still throws')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
