-- Schema-only bootstrap for Court Reportcard Dev (from prod, no user data).
-- Apply only to jotklhjskmewzfsgzkvp — do not run against prod.

-- ── Tables (dependency order) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  plan text,
  plan_started_at timestamp with time zone,
  plan_renews_at timestamp with time zone,
  heard_about_status text NOT NULL DEFAULT 'pending'::text,
  heard_about text,
  heard_about_detail text,
  heard_about_at timestamp with time zone,
  CONSTRAINT user_tokens_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_profiles_heard_about_status_check CHECK ((heard_about_status = ANY (ARRAY['pending'::text, 'answered'::text, 'skipped'::text, 'legacy'::text])))
);

CREATE TABLE IF NOT EXISTS public.cases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  purged_at timestamp with time zone,
  deleted_at timestamp with time zone,
  tokens_charged integer,
  last_error text,
  analysis_restart_count integer NOT NULL DEFAULT 0,
  last_exported_at timestamp with time zone,
  export_count integer NOT NULL DEFAULT 0,
  CONSTRAINT cases_pkey PRIMARY KEY (id),
  CONSTRAINT cases_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'analyzed'::text, 'reviewed'::text, 'exported'::text, 'purged'::text, 'deleted'::text]))),
  CONSTRAINT cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.case_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  file_type text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT case_files_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT case_files_file_type_check CHECK ((file_type = ANY (ARRAY['transcript'::text, 'audio'::text, 'extracted'::text]))),
  CONSTRAINT case_files_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.case_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  total_entries integer NOT NULL DEFAULT 0,
  total_issues integer NOT NULL DEFAULT 0,
  accepted integer NOT NULL DEFAULT 0,
  ignored integer NOT NULL DEFAULT 0,
  open integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  annotations_by_type jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_changed integer DEFAULT 0,
  dropped_annotations_count integer NOT NULL DEFAULT 0,
  CONSTRAINT case_metrics_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT case_metrics_case_id_key UNIQUE (case_id),
  CONSTRAINT case_metrics_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.token_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  stripe_checkout_session_id text,
  price_cents integer,
  CONSTRAINT token_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT token_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  anonymous_id text NOT NULL,
  session_id text,
  event_type text NOT NULL,
  event_name text,
  track_id text,
  element_type text,
  path text NOT NULL,
  destination text,
  referrer text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT telemetry_events_pkey PRIMARY KEY (id),
  CONSTRAINT telemetry_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  token_amount integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  max_redemptions integer,
  max_per_user integer NOT NULL DEFAULT 1,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_max_per_user_check CHECK ((max_per_user > 0)),
  CONSTRAINT promo_codes_max_redemptions_check CHECK (((max_redemptions IS NULL) OR (max_redemptions > 0))),
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id),
  CONSTRAINT promo_codes_token_amount_check CHECK ((token_amount > 0))
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tokens_granted integer NOT NULL,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT promo_redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT promo_redemptions_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES promo_codes(id) ON DELETE RESTRICT,
  CONSTRAINT promo_redemptions_tokens_granted_check CHECK ((tokens_granted > 0)),
  CONSTRAINT promo_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.upload_failure_fingerprints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_hash text NOT NULL,
  failure_count integer NOT NULL DEFAULT 0,
  last_file_name text,
  last_failed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT upload_failure_fingerprints_failure_count_check CHECK ((failure_count >= 0)),
  CONSTRAINT upload_failure_fingerprints_pkey PRIMARY KEY (id),
  CONSTRAINT upload_failure_fingerprints_user_hash_key UNIQUE (user_id, content_hash),
  CONSTRAINT upload_failure_fingerprints_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ── Indexes (non-PK / non-unique-constraint duplicates use IF NOT EXISTS) ───

CREATE INDEX IF NOT EXISTS idx_case_files_case_id ON public.case_files USING btree (case_id);
CREATE INDEX IF NOT EXISTS idx_case_metrics_case_id ON public.case_metrics USING btree (case_id);
CREATE INDEX IF NOT EXISTS cases_active_idx ON public.cases USING btree (user_id, created_at DESC) WHERE ((deleted_at IS NULL) AND (purged_at IS NULL));
CREATE INDEX IF NOT EXISTS cases_created_at_active_idx ON public.cases USING btree (created_at) WHERE (purged_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_upper_key ON public.promo_codes USING btree (upper(code));
CREATE INDEX IF NOT EXISTS promo_redemptions_promo_user_idx ON public.promo_redemptions USING btree (promo_id, user_id);
CREATE INDEX IF NOT EXISTS promo_redemptions_user_id_idx ON public.promo_redemptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS telemetry_events_anonymous_id_idx ON public.telemetry_events USING btree (anonymous_id);
CREATE INDEX IF NOT EXISTS telemetry_events_created_at_idx ON public.telemetry_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_events_event_name_idx ON public.telemetry_events USING btree (event_name);
CREATE INDEX IF NOT EXISTS telemetry_events_event_type_idx ON public.telemetry_events USING btree (event_type);
CREATE INDEX IF NOT EXISTS telemetry_events_user_id_idx ON public.telemetry_events USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS token_ledger_stripe_checkout_session_id_key ON public.token_ledger USING btree (stripe_checkout_session_id) WHERE (stripe_checkout_session_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS upload_failure_fingerprints_user_id_idx ON public.upload_failure_fingerprints USING btree (user_id);

-- ── Views ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.telemetry_page_views AS
 SELECT path,
    count(*) AS views,
    count(DISTINCT anonymous_id) AS unique_visitors,
    count(DISTINCT user_id) AS unique_users,
    max(created_at) AS last_seen
   FROM telemetry_events
  WHERE event_type = 'page_view'::text
  GROUP BY path
  ORDER BY (count(*)) DESC;

CREATE OR REPLACE VIEW public.telemetry_prospect_vs_user AS
 SELECT
        CASE
            WHEN user_id IS NULL THEN 'prospect'::text
            ELSE 'authenticated'::text
        END AS audience,
    event_type,
    count(*) AS event_count,
    count(DISTINCT COALESCE(user_id::text, anonymous_id)) AS unique_actors
   FROM telemetry_events
  GROUP BY (
        CASE
            WHEN user_id IS NULL THEN 'prospect'::text
            ELSE 'authenticated'::text
        END), event_type
  ORDER BY (count(*)) DESC;

CREATE OR REPLACE VIEW public.telemetry_top_events AS
 SELECT event_type,
    event_name,
    path,
    count(*) AS event_count,
    count(DISTINCT user_id) AS unique_users,
    count(DISTINCT anonymous_id) AS unique_visitors,
    max(created_at) AS last_seen
   FROM telemetry_events
  GROUP BY event_type, event_name, path
  ORDER BY (count(*)) DESC;

-- ── Functions ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_tokens()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (user_id, balance)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_telemetry_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'brandon@courtreportcard.com',
    'courtreportcard@gmail.com',
    'parizob1@gmail.com'
  );
$function$;

CREATE OR REPLACE FUNCTION public.record_case_export(p_case_id uuid, p_format text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.cases
  set
    last_exported_at = now(),
    export_count = coalesce(export_count, 0) + 1,
    status = case
      when status in ('analyzed', 'reviewed', 'exported') then 'exported'
      else status
    end,
    updated_at = now()
  where id = p_case_id
    and user_id = auth.uid()
    and deleted_at is null;

  if not found then
    raise exception 'Case not found or not owned by caller';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.spend_tokens(p_amount integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_new integer;
begin
  if v_uid is null or p_amount is null or p_amount <= 0 then
    return null;
  end if;

  update public.user_profiles
     set balance = balance - p_amount,
         updated_at = now()
   where user_id = v_uid
     and balance >= p_amount
  returning balance into v_new;

  if v_new is null then
    return null;
  end if;

  insert into public.token_ledger (user_id, amount, type)
  values (v_uid, -p_amount, 'spend');

  return v_new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.credit_tokens(p_user_id uuid, p_amount integer, p_description text, p_stripe_session_id text, p_price_cents integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new integer;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 or p_stripe_session_id is null then
    return null;
  end if;

  if p_price_cents is not null and p_price_cents < 0 then
    return null;
  end if;

  insert into public.token_ledger (user_id, amount, type, description, stripe_checkout_session_id, price_cents)
  values (p_user_id, p_amount, 'purchase', p_description, p_stripe_session_id, p_price_cents)
  on conflict (stripe_checkout_session_id) where stripe_checkout_session_id is not null do nothing;

  if not found then
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
$function$;

CREATE OR REPLACE FUNCTION public.refund_case_tokens(p_case_id uuid, p_description text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_charge integer;
  v_status text;
  v_new integer;
begin
  if v_uid is null or p_case_id is null then
    return null;
  end if;

  select tokens_charged, status
    into v_charge, v_status
  from public.cases
  where id = p_case_id
    and user_id = v_uid
  for update;

  if not found then
    return null;
  end if;

  -- Only pre-completion failures. Finished work must stay charged.
  if v_status is distinct from 'uploaded'
     and v_status is distinct from 'processing' then
    return null;
  end if;

  if v_charge is null or v_charge <= 0 then
    return null;
  end if;

  update public.cases
     set tokens_charged = 0
   where id = p_case_id;

  update public.user_profiles
     set balance = balance + v_charge,
         updated_at = now()
   where user_id = v_uid
  returning balance into v_new;

  if v_new is null then
    update public.cases set tokens_charged = v_charge where id = p_case_id;
    return null;
  end if;

  insert into public.token_ledger (user_id, amount, type, description)
  values (
    v_uid,
    v_charge,
    'refund',
    coalesce(p_description, 'Refund — failed upload')
  );

  return v_new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refund_tokens(p_amount integer, p_description text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  raise exception 'refund_tokens is disabled; use refund_case_tokens(case_id)';
end;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_promo(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.purge_expired_cases()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  expired_paths text[];
  expired_case_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO expired_case_ids
  FROM public.cases
  WHERE created_at < now() - interval '90 days'
    AND purged_at IS NULL;

  IF expired_case_ids IS NOT NULL THEN
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
  END IF;

  -- Also drop short-lived extract JSON fail blobs (48h TTL).
  PERFORM public.purge_extract_raw_fail_blobs();
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_extract_raw_fail_blobs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_upload_failure_count(p_hash text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.record_upload_failure(p_hash text, p_file_name text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_record_upload_failure(p_user_id uuid, p_hash text, p_file_name text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ── Triggers ────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_cases_updated_at ON public.cases;
CREATE TRIGGER set_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created_tokens ON auth.users;
CREATE TRIGGER on_auth_user_created_tokens
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_tokens();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_failure_fingerprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tokens" ON public.user_profiles;
CREATE POLICY "Users can view own tokens" ON public.user_profiles
  FOR SELECT TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS cases_select ON public.cases;
CREATE POLICY cases_select ON public.cases FOR SELECT TO public USING (auth.uid() = user_id);
DROP POLICY IF EXISTS cases_insert ON public.cases;
CREATE POLICY cases_insert ON public.cases FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS cases_update ON public.cases;
CREATE POLICY cases_update ON public.cases FOR UPDATE TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS cases_delete ON public.cases;
CREATE POLICY cases_delete ON public.cases FOR DELETE TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS case_files_select ON public.case_files;
CREATE POLICY case_files_select ON public.case_files FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM cases WHERE cases.id = case_files.case_id AND cases.user_id = auth.uid()));
DROP POLICY IF EXISTS case_files_insert ON public.case_files;
CREATE POLICY case_files_insert ON public.case_files FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM cases WHERE cases.id = case_files.case_id AND cases.user_id = auth.uid()));
DROP POLICY IF EXISTS case_files_delete ON public.case_files;
CREATE POLICY case_files_delete ON public.case_files FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM cases WHERE cases.id = case_files.case_id AND cases.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their own case metrics" ON public.case_metrics;
CREATE POLICY "Users can view their own case metrics" ON public.case_metrics FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM cases WHERE cases.id = case_metrics.case_id AND cases.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own case metrics" ON public.case_metrics;
CREATE POLICY "Users can insert their own case metrics" ON public.case_metrics FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM cases WHERE cases.id = case_metrics.case_id AND cases.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own case metrics" ON public.case_metrics;
CREATE POLICY "Users can update their own case metrics" ON public.case_metrics FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM cases WHERE cases.id = case_metrics.case_id AND cases.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own case metrics" ON public.case_metrics;
CREATE POLICY "Users can delete their own case metrics" ON public.case_metrics FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM cases WHERE cases.id = case_metrics.case_id AND cases.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own ledger" ON public.token_ledger;
CREATE POLICY "Users can view own ledger" ON public.token_ledger FOR SELECT TO public USING (auth.uid() = user_id);
-- No authenticated INSERT policy: ledger rows are written only by SECURITY DEFINER RPCs / service_role.

DROP POLICY IF EXISTS telemetry_events_insert ON public.telemetry_events;
CREATE POLICY telemetry_events_insert ON public.telemetry_events FOR INSERT TO anon, authenticated
  WITH CHECK ((user_id IS NULL) OR (user_id = auth.uid()));
DROP POLICY IF EXISTS telemetry_events_admin_select ON public.telemetry_events;
CREATE POLICY telemetry_events_admin_select ON public.telemetry_events FOR SELECT TO authenticated
  USING (is_telemetry_admin());

DROP POLICY IF EXISTS "Users can view own promo redemptions" ON public.promo_redemptions;
CREATE POLICY "Users can view own promo redemptions" ON public.promo_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own upload failure fingerprints" ON public.upload_failure_fingerprints;
CREATE POLICY "Users can view own upload failure fingerprints" ON public.upload_failure_fingerprints FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ── Storage bucket + policies ───────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('case-files', 'case-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_case_files_select ON storage.objects;
CREATE POLICY storage_case_files_select ON storage.objects FOR SELECT TO authenticated
  USING ((bucket_id = 'case-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

DROP POLICY IF EXISTS storage_case_files_insert ON storage.objects;
CREATE POLICY storage_case_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'case-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

DROP POLICY IF EXISTS storage_case_files_update ON storage.objects;
CREATE POLICY storage_case_files_update ON storage.objects FOR UPDATE TO authenticated
  USING ((bucket_id = 'case-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))
  WITH CHECK ((bucket_id = 'case-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

DROP POLICY IF EXISTS storage_case_files_delete ON storage.objects;
CREATE POLICY storage_case_files_delete ON storage.objects FOR DELETE TO authenticated
  USING ((bucket_id = 'case-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

-- ── Grants (match prod defaults) ────────────────────────────────────────────

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Re-lock sensitive SECURITY DEFINER RPCs after the blanket EXECUTE grant above.
-- Keep in sync with supabase/migrations/20260728120000_harden_security_definer_grants.sql

REVOKE ALL ON FUNCTION public.admin_record_upload_failure(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_upload_failure(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.credit_tokens(uuid, integer, text, text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_tokens(uuid, integer, text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.purge_expired_cases() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_cases() TO service_role;

REVOKE ALL ON FUNCTION public.purge_extract_raw_fail_blobs() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_extract_raw_fail_blobs() TO service_role;

REVOKE ALL ON FUNCTION public.refund_tokens(integer, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_tokens(integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_tokens() FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_upload_failure_count(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_upload_failure_count(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_upload_failure(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_upload_failure(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.refund_case_tokens(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.refund_case_tokens(uuid, text) TO authenticated, service_role;

-- Clients may update workflow fields only — never billing/analysis internals.
REVOKE UPDATE ON TABLE public.cases FROM anon, authenticated;
GRANT UPDATE (name, status, deleted_at, updated_at) ON TABLE public.cases TO authenticated;

REVOKE ALL ON FUNCTION public.spend_tokens(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.spend_tokens(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_promo(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_telemetry_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_telemetry_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_case_export(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_case_export(uuid, text) TO authenticated, service_role;
