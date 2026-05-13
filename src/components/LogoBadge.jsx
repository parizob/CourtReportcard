/**
 * Shield/crest badge icon — the "C" mark for Court Reportcard.
 * Designed to sit inline next to "ourt Reportcard" text at matching cap height.
 */
export default function LogoBadge({ size = 26 }) {
  const w = Math.round(size * 0.79)
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 100 126"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {/* Shield / crest silhouette */}
      <path
        d="M14,0 H86 Q100,0 100,14 V78 Q100,112 50,126 Q0,112 0,78 V14 Q0,0 14,0 Z"
        fill="#001939"
      />
      {/* Bold white C */}
      <text
        x="50"
        y="89"
        textAnchor="middle"
        fill="white"
        fontFamily="'Manrope', sans-serif"
        fontWeight="900"
        fontSize="70"
      >C</text>
    </svg>
  )
}
