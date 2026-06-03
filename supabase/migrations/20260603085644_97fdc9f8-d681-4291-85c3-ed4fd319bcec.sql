-- 1. Restrict Realtime channel subscriptions to role holders.
-- The events table is published to Realtime; without RLS on realtime.messages,
-- any authenticated user can subscribe and receive financial row payloads.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role holders can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Role holders can subscribe to realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'events_user'::public.app_role)
  OR public.has_role(auth.uid(), 'finance_user'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- 2. Lock down SECURITY DEFINER functions so they cannot be invoked via the API.
-- All of these are trigger functions or RLS helpers — none should be callable
-- by anon or authenticated through PostgREST.
REVOKE EXECUTE ON FUNCTION public.audit_log_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_event_expenses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_event_revenue() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.map_financial_year() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_event_ref_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_populate_event_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_event_from_payments() FROM PUBLIC, anon, authenticated;

-- has_role / has_any_role are used inside RLS policies. RLS evaluation
-- runs as the policy owner so EXECUTE on these is not required from clients.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid) FROM PUBLIC, anon, authenticated;