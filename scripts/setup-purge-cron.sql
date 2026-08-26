-- Schedule daily 90-day purge via Edge Function (Storage API).
-- Run in Supabase SQL Editor on the target project (Dev then Prod).
--
-- Replaces legacy job that called public.purge_expired_cases() (broken:
-- direct DELETE FROM storage.objects is blocked).

create extension if not exists pg_net with schema extensions;

-- Unschedule old SQL-only purge if present
select cron.unschedule(jobid)
from cron.job
where jobname in ('purge-expired-cases', 'purge-expired-cases-daily');

-- Store / refresh service role for HTTP invoke (name reused pattern from sweep)
do $outer$
begin
  delete from vault.secrets where name = 'purge_expired_service_role';
exception when others then
  null;
end
$outer$;

-- NOTE: replace SERVICE_ROLE_KEY_HERE before running, or use vault.create_secret
-- from a script that injects the key (never commit the key).

-- After creating the vault secret, schedule:
-- select cron.schedule(
--   'purge-expired-cases-daily',
--   '0 3 * * *',
--   $cron$
--   select net.http_post(
--     url := 'https://PROJECT_REF.supabase.co/functions/v1/purge-expired-cases',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (
--         select decrypted_secret from vault.decrypted_secrets
--         where name = 'purge_expired_service_role'
--       ),
--       'apikey', (
--         select decrypted_secret from vault.decrypted_secrets
--         where name = 'purge_expired_service_role'
--       )
--     ),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 120000
--   ) as request_id;
--   $cron$
-- );
