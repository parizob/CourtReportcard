# User Settings (v1)

## Goal
Persisted preferences for export defaults and editor auto-advance, edited on a Settings page. Export page uses Settings as the starting point only (one-off override per visit).

## Storage
Three booleans on `user_profiles`:
- `export_include_line_numbers` default `true`
- `export_include_page_numbers` default `true`
- `auto_advance_on_accept` default `false`

Updates via `update_user_preferences(...)` SECURITY DEFINER RPC (authenticated). No direct client UPDATE on `user_profiles`.

## UI
- `/dashboard/settings` with three toggles
- Link in account dropdown (SiteHeader)
- Export seeds local checkboxes from prefs when the transcript has that numbering; does not write prefs back
- Editor: when auto-advance is on, after successful Accept/Ignore jump to next open flag in sidebar order
