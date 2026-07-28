-- Short-lived support artifacts from extract JSON parse failures.
-- Written to case-files as …/extracting/*_raw_fail.txt; kept out of the
-- immediate handleFailure wipe so ops can download them. Not shown in UI.
-- Auto-delete after 48 hours (also invoked from sweep-stuck-cases).

CREATE OR REPLACE FUNCTION public.purge_extract_raw_fail_blobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  n integer;
BEGIN
  WITH doomed AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'case-files'
      AND name LIKE '%_raw_fail.txt'
      AND created_at < now() - interval '48 hours'
    RETURNING 1
  )
  SELECT count(*)::integer INTO n FROM doomed;
  RETURN coalesce(n, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_extract_raw_fail_blobs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_extract_raw_fail_blobs() FROM anon;
REVOKE ALL ON FUNCTION public.purge_extract_raw_fail_blobs() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_extract_raw_fail_blobs() TO service_role;

-- Belt-and-suspenders: same cleanup whenever the 90-day case purge runs.
CREATE OR REPLACE FUNCTION public.purge_expired_cases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  expired_paths text[];
  expired_case_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO expired_case_ids
  FROM public.cases
  WHERE created_at < now() - interval '90 days'
    AND purged_at IS NULL;

  IF expired_case_ids IS NULL THEN
    PERFORM public.purge_extract_raw_fail_blobs();
    RETURN;
  END IF;

  SELECT array_agg(storage_path) INTO expired_paths
  FROM public.case_files
  WHERE case_id = ANY(expired_case_ids);

  IF expired_paths IS NOT NULL THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'case-files' AND name = ANY(expired_paths);
  END IF;

  DELETE FROM public.case_files WHERE case_id = ANY(expired_case_ids);

  UPDATE public.cases
  SET purged_at = now(), status = 'purged'
  WHERE id = ANY(expired_case_ids);

  PERFORM public.purge_extract_raw_fail_blobs();
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_cases() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_cases() FROM anon;
REVOKE ALL ON FUNCTION public.purge_expired_cases() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_cases() TO service_role;
