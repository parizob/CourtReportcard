-- fixAnnotationPositions (supabase/functions/analyze-case/index.ts) now drops
-- an annotation instead of guessing its location when Gemini's entry_id
-- doesn't match anywhere nearby/unique. That's the safer failure mode than
-- displaying a wrong, confusing correction, but it was previously only
-- visible via console.warn — which, like the case-failure errors this
-- mirrors the fix for (see last_error), doesn't reliably survive past the
-- request's own log entry. Persisting a per-case count here means we can
-- actually see how often this happens across every user, not just the ones
-- who happen to notice and report it.
alter table public.case_metrics
  add column if not exists dropped_annotations_count integer not null default 0;
