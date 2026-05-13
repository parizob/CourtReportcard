/**
 * Badge icon — the "C" mark for Court Reportcard.
 * Rounded top corners, smooth arched bottom (no point).
 * C is sized to match the cap height of adjacent brand text.
 */
export default function LogoBadge({ size = 22 }) {
  const w = Math.round(size * 0.86)
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 100 116"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {/* Rounded top corners, smooth arched bottom — no point */}
      <path
        d="M14,0 H86 Q100,0 100,14 V80 Q100,116 50,116 Q0,116 0,80 V14 Q0,0 14,0 Z"
        fill="#001939"
      />
      {/* Bold white C — sized to match adjacent cap-height text */}
      <text
        x="50"
        y="86"
        textAnchor="middle"
        fill="white"
        fontFamily="'Manrope', sans-serif"
        fontWeight="900"
        fontSize="82"
      >C</text>
    </svg>
  )
}
