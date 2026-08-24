-- User preferences for export defaults + editor auto-advance.
-- Stored on user_profiles (no separate settings table). Clients update via RPC
-- so balance / plan columns stay write-protected.

alter table public.user_profiles
  add column if not exists export_include_line_numbers boolean not null default true,
  add column if not exists export_include_page_numbers boolean not null default true,
  add column if not exists auto_advance_on_accept boolean not null default false;

comment on column public.user_profiles.export_include_line_numbers is
  'Default for Export "include line numbers". Export page may override for one download only.';
comment on column public.user_profiles.export_include_page_numbers is
  'Default for Export "include page numbers". Export page may override for one download only.';
comment on column public.user_profiles.auto_advance_on_accept is
  'When true, after Accept/Ignore jump to the next open suggestion in the editor. Default off.';

create or replace function public.update_user_preferences(
  p_export_include_line_numbers boolean default null,
  p_export_include_page_numbers boolean default null,
  p_auto_advance_on_accept boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.user_profiles
  set
    export_include_line_numbers = coalesce(p_export_include_line_numbers, export_include_line_numbers),
    export_include_page_numbers = coalesce(p_export_include_page_numbers, export_include_page_numbers),
    auto_advance_on_accept = coalesce(p_auto_advance_on_accept, auto_advance_on_accept),
    updated_at = now()
  where user_id = v_uid
  returning * into v_row;

  if not found then
    raise exception 'Profile not found';
  end if;

  return jsonb_build_object(
    'export_include_line_numbers', v_row.export_include_line_numbers,
    'export_include_page_numbers', v_row.export_include_page_numbers,
    'auto_advance_on_accept', v_row.auto_advance_on_accept
  );
end;
$$;

revoke all on function public.update_user_preferences(boolean, boolean, boolean) from public;
revoke all on function public.update_user_preferences(boolean, boolean, boolean) from anon;
grant execute on function public.update_user_preferences(boolean, boolean, boolean) to authenticated;
grant execute on function public.update_user_preferences(boolean, boolean, boolean) to service_role;
