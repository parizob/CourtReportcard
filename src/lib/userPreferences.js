/**
 * User Settings prefs — export defaults + editor auto-advance.
 * Stored on user_profiles; updated via update_user_preferences RPC.
 */

export const DEFAULT_PREFERENCES = {
  export_include_line_numbers: true,
  export_include_page_numbers: true,
  auto_advance_on_accept: false,
}

/** Normalize a user_profiles row (or RPC return) into safe booleans. */
export function normalizePreferences(row) {
  if (!row) return { ...DEFAULT_PREFERENCES }
  return {
    export_include_line_numbers: row.export_include_line_numbers !== false,
    export_include_page_numbers: row.export_include_page_numbers !== false,
    auto_advance_on_accept: row.auto_advance_on_accept === true,
  }
}

/**
 * Seed Export page toggles from Settings + what the transcript actually has.
 * Local toggles after this are one-off and must not write prefs back.
 */
export function seedExportToggles(numbering, prefs) {
  const p = prefs || DEFAULT_PREFERENCES
  return {
    includeLineNumbers: !!numbering?.hasLineNumbers && p.export_include_line_numbers !== false,
    includePageNumbers: !!numbering?.hasPageNumbers && p.export_include_page_numbers !== false,
  }
}

/**
 * After Accept/Ignore of closedId, pick the next open flag in sidebar order.
 * @param {Array<{ id: number|string, status?: string }>} orderedOpen — open anns in sidebar order, before resolve
 * @param {number|string} closedId
 * @returns {object|null}
 */
export function nextOpenAfterResolve(orderedOpen, closedId) {
  const list = Array.isArray(orderedOpen) ? orderedOpen : []
  const idx = list.findIndex((a) => a.id === closedId)
  const remaining = list.filter((a) => a.id !== closedId)
  if (!remaining.length) return null
  if (idx < 0) return remaining[0]
  if (idx >= remaining.length) return null
  return remaining[idx]
}
