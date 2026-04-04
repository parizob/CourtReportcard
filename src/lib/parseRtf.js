/**
 * Minimal RTF-to-plain-text extractor.
 * Strips RTF control words, groups, and special characters to produce readable text.
 * Handles \par and \line as newlines, unicode escapes, and hex escapes.
 */
export function rtfToText(rtf) {
  if (!rtf || typeof rtf !== 'string') return ''

  // If it doesn't look like RTF at all, return as-is (plain text / CRE)
  if (!rtf.trimStart().startsWith('{\\rtf')) return rtf

  let text = ''
  let depth = 0
  let skipGroup = false
  let skipDepth = 0
  let i = 0

  // Groups to skip entirely (they contain metadata, not visible text)
  const skipDestinations = ['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerf', 'footerf', 'object', 'datafield']

  while (i < rtf.length) {
    const ch = rtf[i]

    if (ch === '{') {
      depth++
      if (skipGroup) { i++; continue }

      // Look ahead for destination group
      const ahead = rtf.substring(i + 1, i + 30)
      for (const dest of skipDestinations) {
        if (ahead.startsWith(`\\${dest}`) || ahead.startsWith(`\\*\\${dest}`)) {
          skipGroup = true
          skipDepth = depth
          break
        }
      }
      i++
      continue
    }

    if (ch === '}') {
      if (skipGroup && depth === skipDepth) skipGroup = false
      depth--
      i++
      continue
    }

    if (skipGroup) { i++; continue }

    if (ch === '\\') {
      i++
      if (i >= rtf.length) break

      const next = rtf[i]

      // Escaped literal characters
      if (next === '\\' || next === '{' || next === '}') {
        text += next
        i++
        continue
      }

      // Hex character \'xx
      if (next === "'") {
        const hex = rtf.substring(i + 1, i + 3)
        text += String.fromCharCode(parseInt(hex, 16))
        i += 3
        continue
      }

      // Unicode \uN
      if (next === 'u') {
        const match = rtf.substring(i).match(/^u(-?\d+)/)
        if (match) {
          let code = parseInt(match[1], 10)
          if (code < 0) code += 65536
          text += String.fromCharCode(code)
          i += match[0].length
          // Skip the substitution character that follows
          if (i < rtf.length && rtf[i] === ' ') i++
          continue
        }
      }

      // Control word
      const wordMatch = rtf.substring(i).match(/^([a-z]+)(-?\d+)?[ ]?/)
      if (wordMatch) {
        const word = wordMatch[1]
        i += wordMatch[0].length

        if (word === 'par' || word === 'line') {
          text += '\n'
        } else if (word === 'tab') {
          text += '\t'
        } else if (word === 'emdash') {
          text += '—'
        } else if (word === 'endash') {
          text += '–'
        } else if (word === 'lquote' || word === 'rquote') {
          text += "'"
        } else if (word === 'ldblquote' || word === 'rdblquote') {
          text += '"'
        } else if (word === 'bullet') {
          text += '•'
        }
        continue
      }

      // Unknown control symbol, skip
      i++
      continue
    }

    // Regular character
    if (ch === '\r' || ch === '\n') {
      i++
      continue
    }

    text += ch
    i++
  }

  return text
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
