-- Track per-user content hashes of transcripts that failed analysis/upload.
-- Used to stop repeated retries of the same file (Gemini cost) after 2 failures.

create table if not exists public.upload_failure_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_hash text not null,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_file_name text,
  last_failed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint upload_failure_fingerprints_user_hash_key unique (user_id, content_hash)
);

create index if not exists upload_failure_fingerprints_user_id_idx
  on public.upload_failure_fingerprints (user_id);

alter table public.upload_failure_fingerprints enable row level security;

create policy "Users can view own upload failure fingerprints"
  on public.upload_failure_fingerprints
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Returns current failure count for this user + hash (0 if none).
create or replace function public.get_upload_failure_count(p_hash text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    return 0;
  end if;
  if p_hash is null or length(trim(p_hash)) < 32 then
    return 0;
  end if;

  select failure_count into v_count
  from public.upload_failure_fingerprints
  where user_id = v_user and content_hash = lower(trim(p_hash));

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.get_upload_failure_count(text) from public;
grant execute on function public.get_upload_failure_count(text) to authenticated;

-- Increment failure count; returns the new count.
create or replace function public.record_upload_failure(p_hash text, p_file_name text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hash text;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_hash := lower(trim(coalesce(p_hash, '')));
  if length(v_hash) < 32 then
    raise exception 'invalid hash';
  end if;

  insert into public.upload_failure_fingerprints (user_id, content_hash, failure_count, last_file_name, last_failed_at)
  values (v_user, v_hash, 1, nullif(trim(coalesce(p_file_name, '')), ''), now())
  on conflict (user_id, content_hash) do update
    set failure_count = public.upload_failure_fingerprints.failure_count + 1,
        last_file_name = coalesce(
          nullif(trim(coalesce(excluded.last_file_name, '')), ''),
          public.upload_failure_fingerprints.last_file_name
        ),
        last_failed_at = now()
  returning failure_count into v_count;

  return v_count;
end;
$$;

revoke all on function public.record_upload_failure(text, text) from public;
grant execute on function public.record_upload_failure(text, text) to authenticated;
