-- Restore intended EXECUTE grants on sensitive SECURITY DEFINER functions.
-- Blanket GRANT EXECUTE ON ALL FUNCTIONS TO anon, authenticated (bootstrap /
-- historical defaults) re-opened these after earlier hardening migrations.

-- ── service_role only ────────────────────────────────────────────────────────

revoke all on function public.admin_record_upload_failure(uuid, text, text) from public;
revoke all on function public.admin_record_upload_failure(uuid, text, text) from anon;
revoke all on function public.admin_record_upload_failure(uuid, text, text) from authenticated;
grant execute on function public.admin_record_upload_failure(uuid, text, text) to service_role;

revoke all on function public.credit_tokens(uuid, integer, text, text, integer) from public;
revoke all on function public.credit_tokens(uuid, integer, text, text, integer) from anon;
revoke all on function public.credit_tokens(uuid, integer, text, text, integer) from authenticated;
grant execute on function public.credit_tokens(uuid, integer, text, text, integer) to service_role;

revoke all on function public.purge_expired_cases() from public;
revoke all on function public.purge_expired_cases() from anon;
revoke all on function public.purge_expired_cases() from authenticated;
grant execute on function public.purge_expired_cases() to service_role;

-- Disabled open-mint shim: keep callable only by service_role (still raises).
revoke all on function public.refund_tokens(integer, text) from public;
revoke all on function public.refund_tokens(integer, text) from anon;
revoke all on function public.refund_tokens(integer, text) from authenticated;
grant execute on function public.refund_tokens(integer, text) to service_role;

-- Trigger helper: not a client RPC.
revoke all on function public.handle_new_user_tokens() from public;
revoke all on function public.handle_new_user_tokens() from anon;
revoke all on function public.handle_new_user_tokens() from authenticated;

-- ── authenticated (+ service_role) ───────────────────────────────────────────

revoke all on function public.get_upload_failure_count(text) from public;
revoke all on function public.get_upload_failure_count(text) from anon;
grant execute on function public.get_upload_failure_count(text) to authenticated;
grant execute on function public.get_upload_failure_count(text) to service_role;

revoke all on function public.record_upload_failure(text, text) from public;
revoke all on function public.record_upload_failure(text, text) from anon;
grant execute on function public.record_upload_failure(text, text) to authenticated;
grant execute on function public.record_upload_failure(text, text) to service_role;

revoke all on function public.refund_case_tokens(uuid, text) from public;
revoke all on function public.refund_case_tokens(uuid, text) from anon;
grant execute on function public.refund_case_tokens(uuid, text) to authenticated;
grant execute on function public.refund_case_tokens(uuid, text) to service_role;

revoke all on function public.spend_tokens(integer) from public;
revoke all on function public.spend_tokens(integer) from anon;
grant execute on function public.spend_tokens(integer) to authenticated;
grant execute on function public.spend_tokens(integer) to service_role;

revoke all on function public.redeem_promo(text) from public;
revoke all on function public.redeem_promo(text) from anon;
grant execute on function public.redeem_promo(text) to authenticated;
grant execute on function public.redeem_promo(text) to service_role;

revoke all on function public.is_telemetry_admin() from public;
revoke all on function public.is_telemetry_admin() from anon;
grant execute on function public.is_telemetry_admin() to authenticated;
grant execute on function public.is_telemetry_admin() to service_role;
