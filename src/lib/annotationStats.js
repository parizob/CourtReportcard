export function countByType(annotations) {
  if (!Array.isArray(annotations)) return {}
  const counts = {}
  for (const a of annotations) {
    const t = a?.type || 'other'
    counts[t] = (counts[t] || 0) + 1
  }
  return counts
}
