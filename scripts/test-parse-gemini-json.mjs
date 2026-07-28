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

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
