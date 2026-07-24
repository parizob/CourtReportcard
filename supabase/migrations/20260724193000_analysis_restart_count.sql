-- Tracks how many times the stuck-case sweeper has re-kicked analysis.
-- 0 = never restarted; sweeper re-kicks once, then refunds via handleFailure.
alter table public.cases
  add column if not exists analysis_restart_count integer not null default 0;

comment on column public.cases.analysis_restart_count is
  'Stuck-case sweeper: 0 = eligible for one automatic re-kick; >=1 = refund+fail.';
