import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '../public/og-image.png')

// Badge: exact same path as LogoBadge.jsx, scaled to 320px tall
// viewBox 100x116 → scale = 320/116 ≈ 2.759 → width ≈ 276px
// Badge centered vertically: y = (630-320)/2 = 155
const BADGE_HEIGHT = 320
const BADGE_SCALE = BADGE_HEIGHT / 116
const BADGE_X = 70
const BADGE_Y = Math.round((630 - BADGE_HEIGHT) / 2)
const BADGE_CENTER_Y = BADGE_Y + BADGE_HEIGHT / 2
const TEXT_X = BADGE_X + Math.round(100 * BADGE_SCALE) + 40

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <!-- Background -->
  <rect width="1200" height="630" fill="#f8f9fa"/>

  <!-- Badge: exact path from LogoBadge.jsx -->
  <g transform="translate(${BADGE_X}, ${BADGE_Y}) scale(${BADGE_SCALE.toFixed(4)})">
    <path d="M14,0 H86 Q100,0 100,14 V80 Q100,116 50,116 Q0,116 0,80 V14 Q0,0 14,0 Z" fill="#001939"/>
    <text
      x="50" y="86"
      text-anchor="middle"
      fill="white"
      font-family="Arial, sans-serif"
      font-weight="900"
      font-size="82"
    >C</text>
  </g>

  <!-- Court Reportcard — vertically centered with badge -->
  <text
    x="${TEXT_X}" y="${Math.round(BADGE_CENTER_Y - 10)}"
    font-family="Arial, sans-serif"
    font-weight="800"
    font-size="82"
    fill="#001939"
  >Court Reportcard</text>

  <!-- Subtitle -->
  <text
    x="${TEXT_X}" y="${Math.round(BADGE_CENTER_Y + 52)}"
    font-family="Arial, sans-serif"
    font-weight="400"
    font-size="32"
    fill="#43474f"
  >AI-powered proofreading for court reporters.</text>

  <!-- Domain -->
  <text
    x="1130" y="608"
    text-anchor="end"
    font-family="Arial, sans-serif"
    font-size="22"
    fill="#747780"
  >courtreportcard.com</text>
</svg>`

await sharp(Buffer.from(svg)).png().toFile(outPath)
console.log(`✓ OG image written to ${outPath}`)
