-- Close the open-mint refund_tokens RPC: any authenticated user could credit
-- an arbitrary amount. Replace with a case-scoped refund that only returns
-- cases.tokens_charged for a case the caller owns, once (then zeros the charge).

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
  v_new integer;
begin
  if v_uid is null or p_case_id is null then
    return null;
  end if;

  select tokens_charged into v_charge
  from public.cases
  where id = p_case_id
    and user_id = v_uid
  for update;

  if not found then
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
grant execute on function public.refund_case_tokens(uuid, text) to authenticated;

-- Disable the previous open-mint signature. Callers must use refund_case_tokens.
create or replace function public.refund_tokens(
  p_amount integer,
  p_description text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'refund_tokens is disabled; use refund_case_tokens(case_id)';
end;
$$;
