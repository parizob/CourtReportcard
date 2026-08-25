# User Finds Implementation Plan

> **For agentic workers:** Implement task-by-task. Spec: `docs/superpowers/specs/2026-08-24-user-finds-design.md`

**Goal:** Highlight → optional note → persist `userFinds` on extracted JSON; list in editor; download from editor + dashboard files modal.

**Architecture:** No new table. `userFinds` array on extracted blob. Map DOM selection → clean offset → page/line via `buildCleanContentMap` / `parsedLines`.

## File map
- `src/lib/userFinds.js` — format download text, next id, locate selection helpers
- `src/pages/dashboard/DashboardEditor.jsx` — state, selection UI, panel, persist
- `src/pages/dashboard/Dashboard.jsx` — modal download row
- `scripts/test-user-finds.mjs` — unit tests for format + id

## Tasks
1. Add `userFinds.js` + unit test for download formatter / nextId
2. Editor: load/save `userFinds` with extracted JSON; selection → add
3. Editor: My finds list (jump/edit note/remove) + download button
4. Dashboard modal: My finds download when length > 0
5. Manual smoke: add find, refresh, download
