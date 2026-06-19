-- Track how many tokens were charged up front for a case so the background
-- analysis worker can refund the exact amount if analysis fails.
alter table public.cases
  add column if not exists tokens_charged integer;
