-- Promo codes: definition + per-user redemption tracking.
-- Redeem via redeem_promo RPC (authenticated); credits balance + token_ledger.

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  token_amount integer not null check (token_amount > 0),
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  max_per_user integer not null default 1 check (max_per_user > 0),
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists promo_codes_code_upper_key
  on public.promo_codes (upper(code));

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references public.promo_codes (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  tokens_granted integer not null check (tokens_granted > 0),
  redeemed_at timestamptz not null default now()
);

create index if not exists promo_redemptions_user_id_idx
  on public.promo_redemptions (user_id);

create index if not exists promo_redemptions_promo_user_idx
  on public.promo_redemptions (promo_id, user_id);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- No client policies on promo_codes: codes are not listable from the app.
-- Users may read their own redemption history if needed later.
create policy "Users can view own promo redemptions"
  on public.promo_redemptions
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.redeem_promo(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_promo public.promo_codes%rowtype;
  v_code text;
  v_global_count integer;
  v_user_count integer;
  v_new_balance integer;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_code := upper(trim(coalesce(p_code, '')));
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_promo
  from public.promo_codes
  where upper(code) = v_code
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if not v_promo.active then
    return jsonb_build_object('ok', false, 'error', 'inactive');
  end if;

  if v_promo.starts_at is not null and now() < v_promo.starts_at then
    return jsonb_build_object('ok', false, 'error', 'inactive');
  end if;

  if v_promo.expires_at is not null and now() > v_promo.expires_at then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select count(*)::integer into v_user_count
  from public.promo_redemptions
  where promo_id = v_promo.id and user_id = v_user;

  if v_user_count >= v_promo.max_per_user then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  if v_promo.max_redemptions is not null then
    select count(*)::integer into v_global_count
    from public.promo_redemptions
    where promo_id = v_promo.id;

    if v_global_count >= v_promo.max_redemptions then
      return jsonb_build_object('ok', false, 'error', 'exhausted');
    end if;
  end if;

  begin
    insert into public.promo_redemptions (promo_id, user_id, tokens_granted)
    values (v_promo.id, v_user, v_promo.token_amount);
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end;

  insert into public.token_ledger (user_id, amount, type, description)
  values (v_user, v_promo.token_amount, 'promo', 'Promo: ' || v_promo.code);

  update public.user_profiles
     set balance = balance + v_promo.token_amount,
         updated_at = now()
   where user_id = v_user
  returning balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'redeem_promo: no user_profiles row for %', v_user;
  end if;

  return jsonb_build_object(
    'ok', true,
    'tokens', v_promo.token_amount,
    'balance', v_new_balance,
    'code', v_promo.code
  );
end;
$$;

revoke all on function public.redeem_promo(text) from public;
revoke all on function public.redeem_promo(text) from anon;
grant execute on function public.redeem_promo(text) to authenticated;
grant execute on function public.redeem_promo(text) to service_role;
