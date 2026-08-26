-- Stop SQL purge from DELETEing storage.objects (Supabase now rejects that:
-- "Direct deletion from storage tables is not allowed. Use the Storage API").
-- Content purge moves to Edge Function purge-expired-cases (Storage API).
-- This RPC becomes a safe no-op marker for cases that already have no files,
-- so a leftover SQL cron does not abort the whole job.

CREATE OR REPLACE FUNCTION public.purge_extract_raw_fail_blobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- Storage deletes must go through the Storage API (Edge: purge-expired-cases /
  -- sweep-stuck-cases). Direct DELETE FROM storage.objects is blocked.
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_extract_raw_fail_blobs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_extract_raw_fail_blobs() FROM anon;
REVOKE ALL ON FUNCTION public.purge_extract_raw_fail_blobs() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_extract_raw_fail_blobs() TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_cases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  expired_case_ids uuid[];
BEGIN
  -- Only mark cases that already have no case_files rows. Cases with storage
  -- objects are handled by Edge Function purge-expired-cases.
  SELECT array_agg(c.id) INTO expired_case_ids
  FROM public.cases c
  WHERE c.created_at < now() - interval '90 days'
    AND c.purged_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.case_files cf WHERE cf.case_id = c.id
    );

  IF expired_case_ids IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.cases
  SET purged_at = now(), status = 'purged'
  WHERE id = ANY(expired_case_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_cases() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_cases() FROM anon;
REVOKE ALL ON FUNCTION public.purge_expired_cases() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_cases() TO service_role;
