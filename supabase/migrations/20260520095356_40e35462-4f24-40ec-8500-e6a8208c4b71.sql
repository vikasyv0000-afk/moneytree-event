-- 1. Add per-payment columns
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cash_deposit numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_payment numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remark text NOT NULL DEFAULT '';

-- 2. Recalc function: sums payments into events.cash_deposit/online_payment
CREATE OR REPLACE FUNCTION public.recalc_event_from_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _eid uuid;
  _cash numeric(14,2);
  _online numeric(14,2);
  _last_method text;
  _last_date date;
  _last_ref text;
BEGIN
  _eid := COALESCE(NEW.event_id, OLD.event_id);

  SELECT COALESCE(SUM(cash_deposit), 0), COALESCE(SUM(online_payment), 0)
    INTO _cash, _online
  FROM public.payments WHERE event_id = _eid;

  SELECT payment_method, payment_date, reference
    INTO _last_method, _last_date, _last_ref
  FROM public.payments
  WHERE event_id = _eid
  ORDER BY payment_date DESC NULLS LAST, created_at DESC
  LIMIT 1;

  UPDATE public.events SET
    cash_deposit = _cash,
    online_payment = _online,
    payment_mode = COALESCE(_last_method, payment_mode),
    cash_banking_date = COALESCE(_last_date, cash_banking_date),
    event_qr_reference = COALESCE(_last_ref, event_qr_reference)
  WHERE id = _eid;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_event_from_payments ON public.payments;
CREATE TRIGGER trg_recalc_event_from_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_event_from_payments();

-- 3. Backfill: convert legacy single-payment events to one payments row
INSERT INTO public.payments (event_id, amount, payment_method, payment_date, reference, cash_deposit, online_payment, remark)
SELECT
  e.id,
  COALESCE(e.cash_deposit, 0) + COALESCE(e.online_payment, 0),
  COALESCE(NULLIF(e.payment_mode, ''), 'Online'),
  COALESCE(e.cash_banking_date, e.event_date, CURRENT_DATE),
  COALESCE(e.event_qr_reference, ''),
  COALESCE(e.cash_deposit, 0),
  COALESCE(e.online_payment, 0),
  COALESCE(e.remark, '')
FROM public.events e
WHERE (COALESCE(e.cash_deposit, 0) + COALESCE(e.online_payment, 0)) > 0
  AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.event_id = e.id);

-- 4. Widen RLS so events_user can also manage payments
DROP POLICY IF EXISTS "FinanceUser or SuperAdmin can manage payments" ON public.payments;
CREATE POLICY "Event roles can manage payments"
  ON public.payments
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'events_user'::app_role)
    OR has_role(auth.uid(), 'finance_user'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'events_user'::app_role)
    OR has_role(auth.uid(), 'finance_user'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );