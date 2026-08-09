# Reporter Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each reporter opt out of ordinal-date proofreading flags and remember export line/page number toggles, via a new Settings page under Account in the auth dropdown.

**Architecture:** One `reporter_preferences` row per user (`proofread_opt_outs` jsonb array + `export_defaults` jsonb). Edge `analyze-case` loads opt-outs with service role and builds the proofread prompt via omit-rule + negative addendum. Browser Settings page upserts prefs; Export page reads/writes `export_defaults` only. Prompt assembly is mirrored in `src/lib/gemini.js` and `supabase/functions/analyze-case/prompts.ts`.

**Tech Stack:** Supabase Postgres + RLS, Vite/React dashboard, Deno Edge `analyze-case`, Gemini proofread harness (`scripts/run-proofread-test.mjs`).

## Global Constraints

- **Dev first:** Schema + Edge deploy target **Dev** (`jotklhjskmewzfsgzkvp`) only until Brandon explicitly says ship to Prod (`wyexjojoezttbzhcpkco`).
- **No "AI" / no em-dashes** in any user-facing Settings or Export copy.
- **Project Invariant:** Accepted corrections must always reach export. Prefer toggles that only change pre-selected Export UI state; do not change accept/apply/export text pipelines.
- **Prompt edits:** Propose in `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md` and get Brandon sign-off before changing live `PROOFREAD_ONLY_PROMPT` / assembly in `gemini.js` + Edge `prompts.ts`. Keep both copies in sync.
- **Opt-out key (only one for v1):** `ordinal_date_mdy_suffix` — complete month-day-year dates with ordinal day suffix (e.g. `August 6th, 2026`). Do **not** disable NUMBERS rule #12 (spell-out ordinals through tenth).
- **Scope:** No generic rule-tagging framework. One opt-out + export defaults + Settings page.
- **Existing cases:** Opt-out applies on the next analyze only; already-flagged ordinal annotations stay until re-upload / re-analyze.
- **Package safety:** Do not install packages published < 7 days ago (none needed for this feature).

---

## File map

| Path | Role |
|------|------|
| `supabase/migrations/20260806120000_reporter_preferences.sql` | Table + RLS |
| `scripts/check-schema-parity.mjs` | Add `reporter_preferences` table check |
| `src/lib/reporterPreferences.js` | Opt-out id constant, normalize helpers, upsert helpers |
| `supabase/functions/analyze-case/prompts.ts` | Extract ordinal-date rule; `buildProofreadPrompt(optOuts)`; `buildReporterPreferenceAddendum` |
| `src/lib/gemini.js` | Mirror prompt assembly; thread `optOuts` into proofread call |
| `supabase/functions/analyze-case/index.ts` | Fetch prefs; pass opt-outs into `proofreadContent` |
| `src/pages/dashboard/DashboardSettings.jsx` | **New** Settings page |
| `src/App.jsx` | Route `settings` |
| `src/components/SiteHeader.jsx` | Dropdown link **Settings** immediately under **Account** |
| `src/pages/dashboard/DashboardExport.jsx` | Load/persist `export_defaults` |
| `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md` | Sign-off entry before prompt edit |
| `scripts/test-reporter-preferences-prompt.mjs` | Pure unit tests for prompt assembly |
| `scripts/test-transcripts/ordinal_date_optout.txt` + `.manifest.json` | Harness fixture (optional live) |
| `scripts/run-proofread-test.mjs` | Support `PROOFREAD_OPT_OUTS` env for fixture runs |

---

### Task 0: Prompt change proposal (sign-off gate)

**Files:**
- Modify: `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md`

- [ ] **Step 1: Append a proposed entry** (status `proposed`) describing:
  - Extract NUMBERS rule #2 text into a named constant / placeholder.
  - `buildProofreadPrompt(optOuts: string[])` omits that rule when `ordinal_date_mdy_suffix` is present and appends a negative addendum.
  - Empty `optOuts` must produce the same rule text as today (no behavior change for default reporters).
  - Does not touch rule #12.

- [ ] **Step 2: Pause for Brandon sign-off** before Task 3 edits live prompts.

---

### Task 1: Schema on Dev + parity tripwire

**Files:**
- Create: `supabase/migrations/20260806120000_reporter_preferences.sql`
- Modify: `scripts/check-schema-parity.mjs` (add table check)

**Interfaces:**
- Produces: `public.reporter_preferences(user_id PK, proofread_opt_outs jsonb default [], export_defaults jsonb default {}, updated_at timestamptz)`

- [ ] **Step 1: Write migration**

```sql
-- reporter_preferences: per-user proofread opt-outs + export UI defaults
create table public.reporter_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  proofread_opt_outs jsonb not null default '[]'::jsonb,
  export_defaults jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.reporter_preferences is
  'Per-reporter proofread opt-outs and export toggle defaults.';

alter table public.reporter_preferences enable row level security;

create policy reporter_preferences_select
  on public.reporter_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy reporter_preferences_insert
  on public.reporter_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy reporter_preferences_update
  on public.reporter_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No DELETE policy: row is upserted; cascade from auth.users handles cleanup.
-- Service role (analyze-case) bypasses RLS.

revoke all on table public.reporter_preferences from anon;
grant select, insert, update on table public.reporter_preferences to authenticated;
```

- [ ] **Step 2: Confirm CLI target is Dev, then push**

```bash
cat supabase/.temp/project-ref
# Expected: jotklhjskmewzfsgzkvp
# Say out loud: "This will hit Dev (jotklhjskmewzfsgzkvp)"
supabase db push
```

Do **not** push to Prod in this task.

- [ ] **Step 3: Add parity check**

In `scripts/check-schema-parity.mjs` `CHECKS` array, add:

```js
{ kind: 'table', table: 'reporter_preferences' },
```

Note: parity will fail until Prod also has the table. That is expected while Dev-only. Do not treat that failure as a blocker for Dev work; when shipping Prod later, apply the same migration then re-run.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260806120000_reporter_preferences.sql scripts/check-schema-parity.mjs
git commit -m "$(cat <<'EOF'
Add reporter_preferences table for opt-outs and export defaults.

EOF
)"
```

---

### Task 2: Shared prefs helpers (client)

**Files:**
- Create: `src/lib/reporterPreferences.js`
- Test: `scripts/test-reporter-preferences-prompt.mjs` (helpers portion; prompt tests land in Task 3)

**Interfaces:**
- Produces:
  - `ORDINAL_DATE_MDY_SUFFIX = 'ordinal_date_mdy_suffix'`
  - `KNOWN_PROOFREAD_OPT_OUTS = [ORDINAL_DATE_MDY_SUFFIX]`
  - `normalizeOptOuts(raw) => string[]` (intersection with known ids only)
  - `normalizeExportDefaults(raw) => { includeLineNumbers?: boolean, includePageNumbers?: boolean }`
  - `async fetchReporterPreferences(supabase, userId)`
  - `async upsertProofreadOptOuts(supabase, userId, optOuts)`
  - `async upsertExportDefaults(supabase, userId, defaults)`

- [ ] **Step 1: Implement `src/lib/reporterPreferences.js`**

```js
export const ORDINAL_DATE_MDY_SUFFIX = 'ordinal_date_mdy_suffix'
export const KNOWN_PROOFREAD_OPT_OUTS = [ORDINAL_DATE_MDY_SUFFIX]

export function normalizeOptOuts(raw) {
  const list = Array.isArray(raw) ? raw : []
  return KNOWN_PROOFREAD_OPT_OUTS.filter((id) => list.includes(id))
}

export function normalizeExportDefaults(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const out = {}
  if (typeof o.includeLineNumbers === 'boolean') out.includeLineNumbers = o.includeLineNumbers
  if (typeof o.includePageNumbers === 'boolean') out.includePageNumbers = o.includePageNumbers
  return out
}

export async function fetchReporterPreferences(supabase, userId) {
  const { data, error } = await supabase
    .from('reporter_preferences')
    .select('proofread_opt_outs, export_defaults')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return {
    proofread_opt_outs: normalizeOptOuts(data?.proofread_opt_outs),
    export_defaults: normalizeExportDefaults(data?.export_defaults),
  }
}

export async function upsertProofreadOptOuts(supabase, userId, optOuts) {
  const proofread_opt_outs = normalizeOptOuts(optOuts)
  const { error } = await supabase.from('reporter_preferences').upsert(
    { user_id: userId, proofread_opt_outs, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

export async function upsertExportDefaults(supabase, userId, defaults) {
  const export_defaults = normalizeExportDefaults(defaults)
  // Preserve existing opt-outs on upsert: fetch-merge, or upsert only export_defaults
  // via read-modify-write so we never wipe proofread_opt_outs with defaults.
  const current = await fetchReporterPreferences(supabase, userId)
  const { error } = await supabase.from('reporter_preferences').upsert(
    {
      user_id: userId,
      proofread_opt_outs: current.proofread_opt_outs,
      export_defaults,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}
```

Also make `upsertProofreadOptOuts` preserve `export_defaults` the same way (read-modify-write).

- [ ] **Step 2: Commit**

```bash
git add src/lib/reporterPreferences.js
git commit -m "$(cat <<'EOF'
Add reporterPreferences helpers for opt-outs and export defaults.

EOF
)"
```

---

### Task 3: Prompt assembly (gemini.js + Edge prompts.ts)

**Files:**
- Modify: `supabase/functions/analyze-case/prompts.ts`
- Modify: `src/lib/gemini.js` (mirror — browser source of truth comment already exists; keep both identical)
- Create: `scripts/test-reporter-preferences-prompt.mjs`
- Modify: `scripts/test-transcripts/PROMPT_IMPROVEMENTS.md` (mark applied after green)

**Interfaces:**
- Consumes: opt-out id `ordinal_date_mdy_suffix`
- Produces:
  - `ORDINAL_DATE_MDY_RULE` string (exact current rule #2 body text)
  - `buildReporterPreferenceAddendum(optOuts: string[]): string`
  - `buildProofreadPrompt(optOuts: string[]): string` — full prompt for Gemini (no entries JSON)

**Approach (keep empty-optOuts identical):**
- Keep `PROOFREAD_ONLY_PROMPT` as the full current string, but replace the literal rule #2 line with a unique placeholder token, e.g. `__ORDINAL_DATE_MDY_RULE__`, whose replacement text is exactly today's rule line including leading spaces and trailing newline.
- `buildProofreadPrompt([])` replaces placeholder with the rule line → byte-identical to today's prompt.
- When opted out: replace placeholder with `''` (collapse any resulting double blank carefully — prefer replacing the entire indented line including its newline), then append `\n` + addendum.

Negative addendum text (user-facing to the model, not the reporter UI):

```
REPORTER PREFERENCE — ORDINAL DATES:
Do not flag ordinal date suffixes (e.g., "6th" in "August 6th, 2026") as a grammar or style issue when the date is in standard month-day-year order. The verbatim record preserves what was spoken. Do not suggest removing "st"/"nd"/"rd"/"th" from such dates.
```

- [ ] **Step 1: After Brandon signs off Task 0, implement assembly in `prompts.ts` and mirror in `gemini.js`**

Export from Edge `prompts.ts`:

```ts
export const ORDINAL_DATE_MDY_SUFFIX = 'ordinal_date_mdy_suffix'

export const ORDINAL_DATE_MDY_RULE_LINE =
  `  2. A complete date uses figures for the day and year with no ordinal suffix in standard month-day-year order ("March 4, 2023"); an ordinal suffix is used when the day is separated from or precedes the month ("the 4th of March").\n`

// PROOFREAD_ONLY_PROMPT contains __ORDINAL_DATE_MDY_RULE__ where that line was.

export function buildReporterPreferenceAddendum(optOuts: string[]): string {
  const set = new Set(optOuts || [])
  let addendum = ''
  if (set.has(ORDINAL_DATE_MDY_SUFFIX)) {
    addendum += `REPORTER PREFERENCE — ORDINAL DATES:\nDo not flag ordinal date suffixes (e.g., "6th" in "August 6th, 2026") as a grammar or style issue when the date is in standard month-day-year order. The verbatim record preserves what was spoken. Do not suggest removing "st"/"nd"/"rd"/"th" from such dates.\n`
  }
  return addendum
}

export function buildProofreadPrompt(optOuts: string[] = []): string {
  const set = new Set(optOuts || [])
  const ruleLine = set.has(ORDINAL_DATE_MDY_SUFFIX) ? '' : ORDINAL_DATE_MDY_RULE_LINE
  let prompt = PROOFREAD_ONLY_PROMPT.replace('__ORDINAL_DATE_MDY_RULE__', ruleLine)
  const addendum = buildReporterPreferenceAddendum([...set])
  if (addendum) prompt = `${prompt}\n${addendum}`
  return prompt
}
```

Mirror the same functions/constants in `gemini.js` (can live next to `PROOFREAD_ONLY_PROMPT`). Export `buildProofreadPrompt` from `gemini.js` for the unit test and harness.

- [ ] **Step 2: Write pure unit tests**

`scripts/test-reporter-preferences-prompt.mjs`:

```js
import assert from 'assert'
import {
  buildProofreadPrompt,
  ORDINAL_DATE_MDY_SUFFIX,
  ORDINAL_DATE_MDY_RULE_LINE,
} from '../src/lib/gemini.js'

const baseline = buildProofreadPrompt([])
assert.ok(baseline.includes('A complete date uses figures for the day and year with no ordinal suffix'))
assert.ok(!baseline.includes('__ORDINAL_DATE_MDY_RULE__'))
assert.ok(!baseline.includes('REPORTER PREFERENCE — ORDINAL DATES'))

const opted = buildProofreadPrompt([ORDINAL_DATE_MDY_SUFFIX])
assert.ok(!opted.includes(ORDINAL_DATE_MDY_RULE_LINE.trim()))
assert.ok(opted.includes('REPORTER PREFERENCE — ORDINAL DATES'))
assert.ok(opted.includes('Do not flag ordinal date suffixes'))
// Rule 12 still present
assert.ok(opted.includes('Ordinals are spelled out through "tenth"'))

console.log('test-reporter-preferences-prompt: OK')
```

Add npm script optional: `"test:reporter-prefs-prompt": "node scripts/test-reporter-preferences-prompt.mjs"`.

- [ ] **Step 3: Run unit test**

```bash
node scripts/test-reporter-preferences-prompt.mjs
```

Expected: `OK`

- [ ] **Step 4: Wire call sites to use `buildProofreadPrompt`**

In `gemini.js` `extractTranscriptWithGemini` (and any other proofread call that concatenates `PROOFREAD_ONLY_PROMPT`):

```js
// signature: extractTranscriptWithGemini(fileOrText, mimeType, { proofreadOptOuts } = {})
const prompt = `${buildProofreadPrompt(proofreadOptOuts || [])}\n\n${JSON.stringify(entries, null, 2)}`
```

In Edge `proofreadContent`, accept `optOuts` and use `buildProofreadPrompt(optOuts)` the same way. Do not leave a direct `${PROOFREAD_ONLY_PROMPT}` proofread path that skips assembly.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini.js supabase/functions/analyze-case/prompts.ts scripts/test-reporter-preferences-prompt.mjs package.json scripts/test-transcripts/PROMPT_IMPROVEMENTS.md
git commit -m "$(cat <<'EOF'
Assemble proofread prompt with ordinal-date opt-out support.

EOF
)"
```

---

### Task 4: Edge fetch prefs + deploy Dev

**Files:**
- Modify: `supabase/functions/analyze-case/index.ts`

**Interfaces:**
- Consumes: `caseRow.user_id` → `reporter_preferences.proofread_opt_outs`
- Produces: `optOuts` passed into every `proofreadContent(...)` call (including batched proofread)

- [ ] **Step 1: Fetch once after case claim / when user id known**

```ts
const { data: prefsRow } = await admin
  .from('reporter_preferences')
  .select('proofread_opt_outs')
  .eq('user_id', caseRow.user_id)
  .maybeSingle()
const proofreadOptOuts = Array.isArray(prefsRow?.proofread_opt_outs)
  ? prefsRow.proofread_opt_outs.filter((x: unknown) => x === 'ordinal_date_mdy_suffix')
  : []
```

Thread `proofreadOptOuts` into `proofreadContent(entries, deadlineAt, ownIdRange, proofreadOptOuts)`.

- [ ] **Step 2: Deploy Edge to Dev only**

```bash
# Confirm: This will hit Dev (jotklhjskmewzfsgzkvp)
supabase functions deploy analyze-case --project-ref jotklhjskmewzfsgzkvp
```

- [ ] **Step 3: Smoke on Dev** — upload a tiny case as a Dev user with no prefs; confirm analysis still completes.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/analyze-case/index.ts
git commit -m "$(cat <<'EOF'
Pass reporter proofread opt-outs into analyze-case proofread.

EOF
)"
```

---

### Task 5: Settings page + dropdown (under Account)

**Files:**
- Create: `src/pages/dashboard/DashboardSettings.jsx`
- Modify: `src/App.jsx` — add `<Route path="settings" element={<DashboardSettings />} />`
- Modify: `src/components/SiteHeader.jsx` — insert Settings link **immediately below** Account

**UI / nav order (dropdown):**

1. Account → `/dashboard/account` (unchanged)
2. **Settings** → `/dashboard/settings` (**new**, directly under Account)
3. Plans & Billing
4. Dashboard
5. Help Center
6. Sign Out

```jsx
<Link
  to="/dashboard/settings"
  onClick={() => setAccountOpen(false)}
  className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
>
  <span className="material-symbols-outlined text-base">tune</span>
  Settings
</Link>
```

**DashboardSettings page structure** (match Account visual language: `font-headline` title, `editorial-shadow` cards, `material-symbols-outlined`, design tokens only):

- Header: eyebrow "Settings", title "Settings", one short line of support copy (no AI, no em-dashes).
- Card 1 — **Proofreading:** checkbox labeled roughly: `Don't flag ordinal endings on complete dates (for example, August 6th, 2026)`. Helper text: applies to new uploads; existing cases keep current flags unless re-uploaded. Save (or autosave on toggle with saved toast).
- Card 2 — **Export defaults:** toggles for include line numbers / include page numbers. Helper: pre-selects these next time you open Export; if a file has no line or page numbers, Export still turns that option off.

Load via `fetchReporterPreferences`; save via upsert helpers. Use `useAuth().user.id`.

- [ ] **Step 1: Implement page + route + dropdown link**
- [ ] **Step 2: Manual Dev check** — open Account menu, confirm Settings sits under Account; toggle opt-out; confirm row in Dev `reporter_preferences`.
- [ ] **Step 3: Commit**

```bash
git add src/pages/dashboard/DashboardSettings.jsx src/App.jsx src/components/SiteHeader.jsx
git commit -m "$(cat <<'EOF'
Add Settings page under Account for reporter preferences.

EOF
)"
```

---

### Task 6: Export page reads/writes defaults

**Files:**
- Modify: `src/pages/dashboard/DashboardExport.jsx`

**Merge rules (important):**
1. Detect numbering from file (`detectExportNumbering`) → `hasLineNumbers` / `hasPageNumbers` (unchanged).
2. Initial include flags:
   - If file lacks line numbers → `includeLineNumbers = false` (ignore preference).
   - Else if `export_defaults.includeLineNumbers` is boolean → use it.
   - Else → current behavior (`hasLineNumbers`).
   - Same for page numbers.
3. On toggle change (when the control is enabled): debounce or immediate `upsertExportDefaults` with both current include flags. Do not change download blob logic.

- [ ] **Step 1: Implement load + persist**
- [ ] **Step 2: Manual Dev check** — set defaults on Settings or Export; reload Export on a case that has both; confirm pre-select.
- [ ] **Step 3: Run export gates**

```bash
npm run test:export
npm run test:export-stress
```

Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add src/pages/dashboard/DashboardExport.jsx
git commit -m "$(cat <<'EOF'
Persist export line/page toggles via reporter_preferences.

EOF
)"
```

---

### Task 7: Proofread harness coverage

**Files:**
- Create: `scripts/test-transcripts/ordinal_date_optout.txt` (tiny fake transcript with one clear `August 6th, 2026` in testimony)
- Create: `scripts/test-transcripts/ordinal_date_optout.manifest.json` (seeded error expecting catch of ordinal date when opt-out **off**)
- Modify: `scripts/run-proofread-test.mjs` — read `process.env.PROOFREAD_OPT_OUTS` (comma-separated), pass into `extractTranscriptWithGemini(..., { proofreadOptOuts })`

**Protocol (CTO non-determinism):**
1. Baseline (no env): run the ordinal fixture **3×**. Expect the seeded ordinal-date issue caught most runs (document flaky miss if any).
2. Opt-out: `PROOFREAD_OPT_OUTS=ordinal_date_mdy_suffix` run **3×**. Expect that seeded error **not** caught (or caught 0/3). Report numbers.
3. Full suite without opt-outs: spot-check no broad regression (or run usual harness if time allows).

- [ ] **Step 1: Add fixture + harness wiring**
- [ ] **Step 2: Run baseline 3× and opt-out 3×; record results in PROMPT_IMPROVEMENTS entry**
- [ ] **Step 3: Commit**

```bash
git add scripts/test-transcripts/ordinal_date_optout.txt scripts/test-transcripts/ordinal_date_optout.manifest.json scripts/run-proofread-test.mjs scripts/test-transcripts/PROMPT_IMPROVEMENTS.md
git commit -m "$(cat <<'EOF'
Add ordinal-date opt-out proofread harness coverage.

EOF
)"
```

---

### Task 8: Dev end-to-end + Tonie prep (still Dev)

- [ ] **Step 1: Dev E2E**
  1. Settings → enable ordinal opt-out as your Dev user.
  2. Upload a short `.txt` containing `March 4th, 2023` (or similar MDY ordinal).
  3. Confirm Edge Dev analyze does not open that as a style/grammar flag (or you ignore if model still slips — compare to same file with opt-out off).
  4. Export toggles remember across reloads.

- [ ] **Step 2: Document Prod ship checklist (do not execute until asked)**
  1. `supabase db push --project-ref wyexjojoezttbzhcpkco` (or relink + push) — say “This will hit Prod” and get confirmation.
  2. `supabase functions deploy analyze-case --project-ref wyexjojoezttbzhcpkco`
  3. Ship frontend (Vercel via git as usual).
  4. `npm run check:schema-parity` green.
  5. Optionally set Tonie’s Prod row / tell her to use Settings; remind her **next upload** picks up the opt-out.

---

## Out of scope (explicit)

- Generic multi-rule tagging UI / admin rule catalog
- Re-analyze existing cases with new prefs
- Appearances or other rule opt-outs
- Changing accept/apply/export text algorithms
- Prod migration/deploy until Brandon asks

---

## Spec coverage self-check

| Requirement | Task |
|-------------|------|
| `reporter_preferences` + RLS, Dev first | 1 |
| Ordinal-date opt-out omit + negative addendum | 0, 3, 4 |
| Mirror gemini.js ↔ Edge prompts | 3 |
| Edge fetch opt-outs | 4 |
| Export defaults load/persist | 6 |
| Settings under Account in dropdown | 5 |
| `test:export` + `test:export-stress` | 6 |
| Proofread harness with/without opt-out | 7 |
| No generic framework | Global + Out of scope |
