-- Fix credit_tokens: token_ledger_stripe_checkout_session_id_key is a partial
-- unique index (where stripe_checkout_session_id is not null). Postgres can
-- only infer a partial unique index for ON CONFLICT if the same WHERE
-- predicate is repeated in the ON CONFLICT clause itself — without it, every
-- call failed with "42P10: no unique or exclusion constraint matching the ON
-- CONFLICT specification", which is why no purchase ever actually credited.
create or replace function public.credit_tokens(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_stripe_session_id text
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

  insert into public.token_ledger (user_id, amount, type, description, stripe_checkout_session_id)
  values (p_user_id, p_amount, 'purchase', p_description, p_stripe_session_id)
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
