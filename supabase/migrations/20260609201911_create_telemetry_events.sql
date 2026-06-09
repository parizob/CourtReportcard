-- Telemetry events: first-party click/page tracking for prospects and authenticated users.
-- Applied to the remote Supabase project as migration 20260609201911_create_telemetry_events.

create table public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text not null,
  session_id text,
  event_type text not null,
  event_name text,
  track_id text,
  element_type text,
  path text not null,
  destination text,
  referrer text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create index telemetry_events_created_at_idx on public.telemetry_events (created_at desc);
create index telemetry_events_user_id_idx on public.telemetry_events (user_id);
create index telemetry_events_anonymous_id_idx on public.telemetry_events (anonymous_id);
create index telemetry_events_event_type_idx on public.telemetry_events (event_type);
create index telemetry_events_event_name_idx on public.telemetry_events (event_name);

alter table public.telemetry_events enable row level security;

-- Admin allowlist used to gate reads of telemetry data.
create or replace function public.is_telemetry_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') in ('courtreportcard@gmail.com', 'parizob1@gmail.com');
$$;

-- Prospects (anon) and authenticated users may write events; no spoofing of another user's id.
create policy telemetry_events_insert on public.telemetry_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Only admins may read raw events.
create policy telemetry_events_admin_select on public.telemetry_events
  for select to authenticated
  using (public.is_telemetry_admin());

grant insert on public.telemetry_events to anon, authenticated;
grant select on public.telemetry_events to authenticated;

-- Reporting views (security_invoker so the admin-only RLS on the base table applies).
create view public.telemetry_top_events
with (security_invoker = true) as
select
  event_type,
  event_name,
  path,
  count(*) as event_count,
  count(distinct user_id) as unique_users,
  count(distinct anonymous_id) as unique_visitors,
  max(created_at) as last_seen
from public.telemetry_events
group by event_type, event_name, path
order by event_count desc;

create view public.telemetry_page_views
with (security_invoker = true) as
select
  path,
  count(*) as views,
  count(distinct anonymous_id) as unique_visitors,
  count(distinct user_id) as unique_users,
  max(created_at) as last_seen
from public.telemetry_events
where event_type = 'page_view'
group by path
order by views desc;

create view public.telemetry_prospect_vs_user
with (security_invoker = true) as
select
  case when user_id is null then 'prospect' else 'authenticated' end as audience,
  event_type,
  count(*) as event_count,
  count(distinct coalesce(user_id::text, anonymous_id)) as unique_actors
from public.telemetry_events
group by 1, 2
order by event_count desc;

grant select on public.telemetry_top_events, public.telemetry_page_views, public.telemetry_prospect_vs_user to authenticated;
