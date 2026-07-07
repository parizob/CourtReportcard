-- Failed analyses were previously undiagnosable after the fact: the case row
-- and its files get cleaned up (refund + soft-delete) with only the raw error
-- reaching a Deno console.error, which the Edge Function log viewer doesn't
-- reliably surface once a request's own HTTP entry ages out. Persist the
-- error message itself so a failure can always be triaged from the DB.
alter table public.cases
  add column if not exists last_error text;
