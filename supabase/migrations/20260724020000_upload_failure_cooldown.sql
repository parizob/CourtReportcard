-- Failures older than 1 hour no longer count toward the retry gate.
-- Transient Gemini/storage blips shouldn't permanently block a transcript.

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
  where user_id = v_user
    and content_hash = lower(trim(p_hash))
    and last_failed_at > now() - interval '1 hour';

  return coalesce(v_count, 0);
end;
$$;

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
    set failure_count = case
          when public.upload_failure_fingerprints.last_failed_at <= now() - interval '1 hour' then 1
          else public.upload_failure_fingerprints.failure_count + 1
        end,
        last_file_name = coalesce(
          nullif(trim(coalesce(excluded.last_file_name, '')), ''),
          public.upload_failure_fingerprints.last_file_name
        ),
        last_failed_at = now()
  returning failure_count into v_count;

  return v_count;
end;
$$;

create or replace function public.admin_record_upload_failure(
  p_user_id uuid,
  p_hash text,
  p_file_name text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_count integer;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;

  v_hash := lower(trim(coalesce(p_hash, '')));
  if length(v_hash) < 32 then
    raise exception 'invalid hash';
  end if;

  insert into public.upload_failure_fingerprints (user_id, content_hash, failure_count, last_file_name, last_failed_at)
  values (p_user_id, v_hash, 1, nullif(trim(coalesce(p_file_name, '')), ''), now())
  on conflict (user_id, content_hash) do update
    set failure_count = case
          when public.upload_failure_fingerprints.last_failed_at <= now() - interval '1 hour' then 1
          else public.upload_failure_fingerprints.failure_count + 1
        end,
        last_file_name = coalesce(
          nullif(trim(coalesce(excluded.last_file_name, '')), ''),
          public.upload_failure_fingerprints.last_file_name
        ),
        last_failed_at = now()
  returning failure_count into v_count;

  return v_count;
end;
$$;
