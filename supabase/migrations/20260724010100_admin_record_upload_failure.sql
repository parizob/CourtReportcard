-- Service-role helper so analyze-case can fingerprint failed transcripts
-- without depending on auth.uid() (worker has no end-user JWT).

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

revoke all on function public.admin_record_upload_failure(uuid, text, text) from public;
grant execute on function public.admin_record_upload_failure(uuid, text, text) to service_role;
