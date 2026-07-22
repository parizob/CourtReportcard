-- Stripe one-time token purchases: idempotent fulfillment support.
-- stripe_checkout_session_id ties a ledger row to the Checkout Session that
-- paid for it. The unique index (nullable-safe — only enforced when set) is
-- the idempotency guard: a webhook retry/duplicate delivery for the same
-- session can never credit tokens twice.
alter table public.token_ledger
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists token_ledger_stripe_checkout_session_id_key
  on public.token_ledger (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- Credits tokens for a completed Stripe purchase. Unlike spend_tokens/
-- refund_tokens (which use auth.uid() because the caller IS the user), this
-- takes an explicit p_user_id because the caller is the stripe-webhook Edge
-- Function acting on Stripe's behalf, with no user JWT context. Restricted
-- to service_role only below — a logged-in user must never be able to call
-- this directly to credit themselves.
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
  on conflict (stripe_checkout_session_id) do nothing;

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

revoke all on function public.credit_tokens(uuid, integer, text, text) from public;
revoke all on function public.credit_tokens(uuid, integer, text, text) from authenticated;
revoke all on function public.credit_tokens(uuid, integer, text, text) from anon;
grant execute on function public.credit_tokens(uuid, integer, text, text) to service_role;
