-- Close two related token holes:
-- 1) refund_case_tokens could refund successful analyzed/reviewed cases
--    (tokens_charged is kept as a page-count for the dashboard).
-- 2) authenticated users could UPDATE cases.tokens_charged, then refund a
--    fabricated amount.
--
-- Legitimate client refund path (DashboardUpload failed handoff) only runs
-- while status is still 'uploaded' or 'processing'. Server-side analysis
-- failures refund via service_role directly, not this RPC.

create or replace function public.refund_case_tokens(
  p_case_id uuid,
  p_description text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_charge integer;
  v_status text;
  v_new integer;
begin
  if v_uid is null or p_case_id is null then
    return null;
  end if;

  select tokens_charged, status
    into v_charge, v_status
  from public.cases
  where id = p_case_id
    and user_id = v_uid
  for update;

  if not found then
    return null;
  end if;

  -- Only pre-completion failures. Finished work must stay charged.
  if v_status is distinct from 'uploaded'
     and v_status is distinct from 'processing' then
    return null;
  end if;

  if v_charge is null or v_charge <= 0 then
    return null; -- already refunded or never charged
  end if;

  update public.cases
     set tokens_charged = 0
   where id = p_case_id;

  update public.user_profiles
     set balance = balance + v_charge,
         updated_at = now()
   where user_id = v_uid
  returning balance into v_new;

  if v_new is null then
    -- No profile row: restore the charge so we don't silently drop it.
    update public.cases set tokens_charged = v_charge where id = p_case_id;
    return null;
  end if;

  insert into public.token_ledger (user_id, amount, type, description)
  values (
    v_uid,
    v_charge,
    'refund',
    coalesce(p_description, 'Refund — failed upload')
  );

  return v_new;
end;
$$;

revoke all on function public.refund_case_tokens(uuid, text) from public;
revoke all on function public.refund_case_tokens(uuid, text) from anon;
grant execute on function public.refund_case_tokens(uuid, text) to authenticated;
grant execute on function public.refund_case_tokens(uuid, text) to service_role;

-- Clients may update workflow fields only — never billing/analysis internals.
revoke update on table public.cases from anon;
revoke update on table public.cases from authenticated;
grant update (
  name,
  status,
  deleted_at,
  updated_at
) on table public.cases to authenticated;
