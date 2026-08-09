-- Track successful Export downloads so we can measure upload → download completion.
-- Clients cannot UPDATE arbitrary cases columns (column grants); use RPC instead.

alter table public.cases
  add column if not exists last_exported_at timestamptz,
  add column if not exists export_count integer not null default 0;

comment on column public.cases.last_exported_at is
  'Last time the owner successfully downloaded an export (.txt/.rtf) from the Export page.';
comment on column public.cases.export_count is
  'Number of successful Export downloads for this case.';

create or replace function public.record_case_export(p_case_id uuid, p_format text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.record_case_export(uuid, text) from public;
revoke all on function public.record_case_export(uuid, text) from anon;
grant execute on function public.record_case_export(uuid, text) to authenticated;
grant execute on function public.record_case_export(uuid, text) to service_role;
