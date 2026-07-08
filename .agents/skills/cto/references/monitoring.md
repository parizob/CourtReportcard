# Production Health Signals

Two durable, queryable signals exist for catching pipeline problems that
users don't report themselves. Both were added 2026-07-08 after a real
incident (an 82-page upload that failed silently, and a separate case where
several proofreading annotations displayed on the wrong sentence) made clear
that Supabase's Edge Function log viewer doesn't reliably surface anything
after a request's own HTTP log entry ages out — so anything worth knowing
later has to be written to the database, not just logged to console.

There is currently no dashboard or alerting wired to either of these. Check
them periodically (e.g., whenever doing other CTO-skill work, or on a
recurring cadence — see "Suggested cadence" below) and whenever a user
reports something that smells like a processing failure or a
wrong/confusing annotation, even if they don't have screenshots like Zoe did.

## Signal 1 — `cases.last_error` (why did a case fail?)

Populated by `handleFailure` in `supabase/functions/analyze-case/index.ts`
whenever a case is soft-deleted after exhausting retries. Format:
`[stage] error message`, truncated to 2000 chars. The `stage` prefix tells
you which pass/file/chunk/batch/attempt died (e.g.
`extract file 0 chunk 5 attempt 2`, `proofread merge file 0 batch 1 attempt 0`)
without needing to reconstruct it from logs.

**Check:**
```sql
select c.id, c.name, c.created_at, c.tokens_charged, c.last_error
from public.cases c
where c.last_error is not null
order by c.created_at desc
limit 20;
```

**What's worth acting on:**
- The same `stage` prefix recurring across multiple unrelated cases —
  suggests a systemic bug, not a one-off (this is exactly how the
  `extractFirstJsonValue` trailing-JSON bug was confirmed: the same chunk
  index and error message on every attempt, reproducibly).
- Any error mentioning a Gemini response-shape problem (`JSON`, `no content`,
  `finishReason`) — check `references/prompt-engineering.md`'s "don't touch
  the prompt without sign-off" rule still applies even for a bug fix; most of
  these are `callGemini`/parsing issues in `index.ts`, not prompt issues.
- A spike in volume for one user right after they upload a distinctive
  document type (long, unusual formatting, non-English content, etc.) — worth
  asking them what's different about it before assuming it's random.

## Signal 2 — `case_metrics.dropped_annotations_count` (are we silently losing real catches?)

Populated at case finalize time in `index.ts`, summed from every proofread
batch's `fixAnnotationPositions` call. This counts annotations Gemini
produced but that couldn't be confidently placed anywhere in the transcript
(entry_id didn't match, and no unique nearby/document-wide match existed
either) — see `debugging.md` → "Highlight is in the wrong place" for the
full mechanism. These are dropped rather than guessed at, on purpose (a
wrong, confusing placement is worse than a miss), but every drop is a
possible real error the reporter never sees.

**Check:**
```sql
select c.name, c.created_at, cm.total_entries, cm.total_issues, cm.dropped_annotations_count
from public.case_metrics cm
join public.cases c on c.id = cm.case_id
where cm.dropped_annotations_count > 0
order by c.created_at desc
limit 20;
```

**What's worth acting on:**
- **Any nonzero count at all**, early on — we have zero production baseline
  for this yet (shipped 2026-07-08). The first handful of hits are pure
  signal: read `console.warn` output for that request if the logs haven't
  aged out yet (`entry_id`, `type`, `original` are all logged), otherwise
  just note the case and move on.
- **A rate that scales with document length** — expected, since a bigger
  document/more batches means more chances for a mistagged `entry_id`.
  Compare `dropped_annotations_count` against `total_entries`, not against
  other cases in isolation.
- **A rate that isn't dropping over time** — the prompt change (self-verify
  `entry_id`, use unique phrasing for common words — see
  `PROMPT_IMPROVEMENTS.md` → "Unique locatability + entry_id
  self-verification") is a bet that this should get rarer, not a guarantee.
  If it stays flat or climbs over several weeks of real uploads, the bet
  didn't pay off and it's worth revisiting — likely by having the model
  include a short verbatim quote/snippet per annotation instead of relying
  on `entry_id` + a bare word at all, which would need its own prompt
  proposal and harness validation.

## Suggested cadence

Neither signal has automated alerting (no dashboard, no email, nothing —
this is a manual `execute_sql` check for now). Until that changes:
- Check both after any batch of user-reported issues, even ones that don't
  sound related — `last_error` in particular is cheap to check and rules
  things in/out fast.
- Check both after shipping any change to `analyze-case/index.ts` or either
  prompt, as part of confirming the change didn't regress anything (the test
  harness catches recall/false-positive regressions on seeded transcripts,
  but neither signal is exercised by the harness — real production traffic
  is the only way to see them).
- If usage grows enough that manual checks stop being practical, this is a
  good candidate for a scheduled Supabase Edge Function (or just a cron
  querying and emailing a summary) rather than continuing to rely on someone
  remembering to run the query.
