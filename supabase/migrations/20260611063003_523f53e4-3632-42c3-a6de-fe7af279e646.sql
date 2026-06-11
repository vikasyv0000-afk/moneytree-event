CREATE OR REPLACE FUNCTION public.unlock_event(_event_id uuid)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.events;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can unlock events';
  END IF;

  UPDATE public.events
     SET is_locked = false,
         full_payment_received = false,
         status = 'active'
   WHERE id = _event_id
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  RETURN _row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unlock_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_event(uuid) TO authenticated;