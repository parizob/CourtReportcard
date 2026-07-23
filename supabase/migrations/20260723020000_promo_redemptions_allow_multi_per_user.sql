-- Allow multiple redemptions per user when max_per_user > 1.
-- redeem_promo already enforces the per-user and global caps via counts.

alter table public.promo_redemptions
  drop constraint if exists promo_redemptions_promo_id_user_id_key;

create index if not exists promo_redemptions_promo_user_idx
  on public.promo_redemptions (promo_id, user_id);
