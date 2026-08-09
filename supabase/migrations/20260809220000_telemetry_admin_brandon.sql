-- Primary admin identity is now brandon@courtreportcard.com (Google Workspace).
-- Keep legacy Gmail aliases so existing sessions still pass is_telemetry_admin().

create or replace function public.is_telemetry_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'brandon@courtreportcard.com',
    'courtreportcard@gmail.com',
    'parizob1@gmail.com'
  );
$$;
