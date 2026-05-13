import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '../public/og-image.png')

const LOGO_FONT    = 110
const BADGE_HEIGHT = Math.round(LOGO_FONT * 1.12)  // 123px
const BADGE_SCALE  = BADGE_HEIGHT / 116
const BADGE_WIDTH  = Math.round(100 * BADGE_SCALE) // ~106px

// Force "ourt Reportcard" to an exact pixel width so centering is mathematically precise.
// Total = badge(106) + gap(4) + text(900) = 1010px → equal 95px margins each side.
const TEXT_LENGTH = 900
const LOGO_W  = BADGE_WIDTH + 4 + TEXT_LENGTH
const LOGO_X  = Math.round((1200 - LOGO_W) / 2)
const TEXT_X  = LOGO_X + BADGE_WIDTH + 4

const LOGO_Y       = Math.round((630 - BADGE_HEIGHT - 60 - 44) / 2) - 10
const BADGE_CTR_Y  = LOGO_Y + BADGE_HEIGHT / 2
const TEXT_BASE    = Math.round(BADGE_CTR_Y + LOGO_FONT * 0.36)
const DESC_Y       = LOGO_Y + BADGE_HEIGHT + 52

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#f8f9fa"/>

  <!-- Badge: exact LogoBadge.jsx path -->
  <g transform="translate(${LOGO_X}, ${LOGO_Y}) scale(${BADGE_SCALE.toFixed(4)})">
    <path d="M14,0 H86 Q100,0 100,14 V80 Q100,116 50,116 Q0,116 0,80 V14 Q0,0 14,0 Z" fill="#001939"/>
    <text x="50" y="86" text-anchor="middle" fill="white"
      font-family="Arial, sans-serif" font-weight="900" font-size="82">C</text>
  </g>

  <!-- "ourt Reportcard" forced to exact TEXT_LENGTH so centering is pixel-perfect -->
  <text x="${TEXT_X}" y="${TEXT_BASE}"
    font-family="Arial, sans-serif" font-weight="800" font-size="${LOGO_FONT}"
    textLength="${TEXT_LENGTH}" lengthAdjust="spacingAndGlyphs"
    fill="#001939"
  >ourt Reportcard</text>

  <!-- Description left-aligned under the lockup, flush with the badge -->
  <text x="${LOGO_X}" y="${DESC_Y}" text-anchor="start"
    font-family="Arial, sans-serif" font-weight="400" font-size="34" fill="#43474f"
  >AI-powered proofreading for court reporters.</text>
</svg>`

await sharp(Buffer.from(svg)).png().toFile(outPath)
console.log(`✓ OG image written to ${outPath}`)
