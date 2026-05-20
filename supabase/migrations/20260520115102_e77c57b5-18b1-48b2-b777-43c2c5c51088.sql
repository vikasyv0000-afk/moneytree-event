DROP POLICY IF EXISTS "EventsUser or SuperAdmin can update events" ON public.events;

CREATE POLICY "EventsUser or SuperAdmin can update events"
ON public.events
FOR UPDATE
TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'events_user'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  AND (
    public.events.is_locked = false
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'events_user'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);