
-- Tighten profiles SELECT: split own vs super_admin
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Restrict events SELECT to role holders only
DROP POLICY IF EXISTS "Authenticated can read events" ON public.events;

CREATE POLICY "Role holders can read events"
ON public.events FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'events_user'::app_role)
  OR has_role(auth.uid(), 'finance_user'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Audit logs: explicitly deny UPDATE/DELETE for everyone (immutable)
CREATE POLICY "No one can update audit logs"
ON public.audit_logs FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No one can delete audit logs"
ON public.audit_logs FOR DELETE
TO authenticated
USING (false);
