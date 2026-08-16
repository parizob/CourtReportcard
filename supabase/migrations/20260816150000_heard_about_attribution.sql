-- Attribution: how did you hear about us?
-- One answer (or skip) per account. Existing users marked legacy so they are never prompted.

alter table public.user_profiles
  add column if not exists heard_about_status text not null default 'pending',
  add column if not exists heard_about text,
  add column if not exists heard_about_detail text,
  add column if not exists heard_about_at timestamptz;

alter table public.user_profiles
  drop constraint if exists user_profiles_heard_about_status_check;

alter table public.user_profiles
  add constraint user_profiles_heard_about_status_check
  check (heard_about_status in ('pending', 'answered', 'skipped', 'legacy'));

comment on column public.user_profiles.heard_about_status is
  'pending = show prompt once; answered/skipped/legacy = never show again.';
comment on column public.user_profiles.heard_about is
  'Channel source when answered (facebook_group, colleague, association_email, blog_search, other).';
comment on column public.user_profiles.heard_about_detail is
  'Optional free text (e.g. which group, Other detail).';

-- Everyone already on the platform: do not spam.
update public.user_profiles
set
  heard_about_status = 'legacy',
  heard_about_at = coalesce(heard_about_at, now())
where heard_about_status = 'pending';

create or replace function public.set_heard_about(
  p_skipped boolean default false,
  p_source text default null,
  p_detail text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_source text;
  v_detail text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select heard_about_status into v_status
  from public.user_profiles
  where user_id = v_uid;

  if not found then
    raise exception 'Profile not found';
  end if;

  -- Idempotent: already decided.
  if v_status is distinct from 'pending' then
    return v_status;
  end if;

  if p_skipped then
    update public.user_profiles
    set
      heard_about_status = 'skipped',
      heard_about = null,
      heard_about_detail = null,
      heard_about_at = now(),
      updated_at = now()
    where user_id = v_uid;
    return 'skipped';
  end if;

  v_source := nullif(trim(p_source), '');
  if v_source is null or v_source not in (
    'facebook_group',
    'socials',
    'colleague',
    'association_email',
    'blog_search',
    'ad',
    'other'
  ) then
    raise exception 'Invalid source';
  end if;

  v_detail := nullif(trim(p_detail), '');
  if v_detail is not null then
    v_detail := left(v_detail, 200);
  end if;

  update public.user_profiles
  set
    heard_about_status = 'answered',
    heard_about = v_source,
    heard_about_detail = v_detail,
    heard_about_at = now(),
    updated_at = now()
  where user_id = v_uid;

  return 'answered';
end;
$$;

revoke all on function public.set_heard_about(boolean, text, text) from public;
revoke all on function public.set_heard_about(boolean, text, text) from anon;
grant execute on function public.set_heard_about(boolean, text, text) to authenticated;
grant execute on function public.set_heard_about(boolean, text, text) to service_role;
