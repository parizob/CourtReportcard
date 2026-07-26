-- Progress breadcrumb for analyze-case so silent Edge kills are diagnosable
-- from the DB (last known stage) instead of only STUCK_ANALYSIS_TIMEOUT.
alter table public.cases
  add column if not exists analysis_stage text;

comment on column public.cases.analysis_stage is
  'Last known analyze-case stage (e.g. downloading, extracting, proofreading). Null when idle/analyzed.';
