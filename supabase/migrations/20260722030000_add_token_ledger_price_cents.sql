-- Store what the customer actually paid (Stripe amount_total, in cents) on
-- purchase ledger rows so billing history can show dollars later without
-- reconstructing price from current pack tables (which can change).
-- Non-purchase rows and legacy purchases leave this null.

alter table public.token_ledger
  add column if not exists price_cents integer;

-- Signature change: drop the old 4-arg overload, then recreate with price.
drop function if exists public.credit_tokens(uuid, integer, text, text);

create or replace function public.credit_tokens(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_stripe_session_id text,
  p_price_cents integer default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 or p_stripe_session_id is null then
    return null;
  end if;

  if p_price_cents is not null and p_price_cents < 0 then
    return null;
  end if;

  insert into public.token_ledger (user_id, amount, type, description, stripe_checkout_session_id, price_cents)
  values (p_user_id, p_amount, 'purchase', p_description, p_stripe_session_id, p_price_cents)
  on conflict (stripe_checkout_session_id) where stripe_checkout_session_id is not null do nothing;

  if not found then
    -- Already fulfilled this checkout session (webhook retry/duplicate
    -- delivery) — return the current balance without crediting again.
    select balance into v_new from public.user_profiles where user_id = p_user_id;
    return v_new;
  end if;

  update public.user_profiles
     set balance = balance + p_amount,
         updated_at = now()
   where user_id = p_user_id
  returning balance into v_new;

  return v_new;
end;
$$;

revoke all on function public.credit_tokens(uuid, integer, text, text, integer) from public;
revoke all on function public.credit_tokens(uuid, integer, text, text, integer) from authenticated;
revoke all on function public.credit_tokens(uuid, integer, text, text, integer) from anon;
grant execute on function public.credit_tokens(uuid, integer, text, text, integer) to service_role;
