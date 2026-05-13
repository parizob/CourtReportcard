import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '../public/og-image.png')

// Badge: exact same path as LogoBadge.jsx, scaled to 220px tall
// viewBox 100x116 → scale = 220/116 = 1.897 → width ≈ 190px
// Badge sits at x=80, y=(630-220)/2=205
const BADGE_SCALE = 220 / 116
const BADGE_X = 80
const BADGE_Y = Math.round((630 - 220) / 2)

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

  <!-- Court Reportcard -->
  <text
    x="350" y="290"
    font-family="Arial, sans-serif"
    font-weight="800"
    font-size="74"
    fill="#001939"
  >Court Reportcard</text>

  <!-- Subtitle -->
  <text
    x="352" y="348"
    font-family="Arial, sans-serif"
    font-weight="400"
    font-size="28"
    fill="#43474f"
  >AI-powered proofreading for court reporters.</text>

  <!-- Domain -->
  <text
    x="1120" y="608"
    text-anchor="end"
    font-family="Arial, sans-serif"
    font-size="20"
    fill="#747780"
  >courtreportcard.com</text>
</svg>`

await sharp(Buffer.from(svg)).png().toFile(outPath)
console.log(`✓ OG image written to ${outPath}`)
