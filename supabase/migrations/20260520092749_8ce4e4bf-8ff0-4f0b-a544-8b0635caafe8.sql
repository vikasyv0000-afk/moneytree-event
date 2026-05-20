
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS paytm_commission numeric(14,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.auto_populate_event_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total_sales numeric(14,2);
  _total_cost numeric(14,2);
  _total_payment_received numeric(14,2);
  _commission_amount numeric(14,2);
  _commission_with_invoice numeric(14,2);
  _commission_without_invoice numeric(14,2);
  _paytm_commission numeric(14,2);
  _ebitda numeric(14,2);
BEGIN
  NEW.month := to_char(NEW.event_date, 'Month');

  _total_sales := ROUND((COALESCE(NEW.net_sales, 0) + COALESCE(NEW.gst_amount, 0))::numeric, 2);
  _total_cost := ROUND((
    COALESCE(NEW.cogs, 0) + COALESCE(NEW.other_consumables, 0) + COALESCE(NEW.wastages_variance, 0) +
    COALESCE(NEW.manpower_cost, 0) + COALESCE(NEW.logistic_expense, 0) + COALESCE(NEW.staff_food_expense, 0) +
    COALESCE(NEW.local_purchase, 0) + COALESCE(NEW.rent_commission, 0) + COALESCE(NEW.miscellaneous_expense, 0)
  )::numeric, 2);
  _ebitda := ROUND((COALESCE(NEW.net_sales, 0) - _total_cost)::numeric, 2);
  _total_payment_received := ROUND((COALESCE(NEW.cash_deposit, 0) + COALESCE(NEW.online_payment, 0))::numeric, 2);
  _commission_amount := CASE
    WHEN COALESCE(NEW.commission_paid_from_sale, false) THEN COALESCE(NEW.commission_amount, 0)
    ELSE 0
  END;
  _commission_with_invoice := COALESCE(NEW.commission_rent_with_invoice, 0);
  _commission_without_invoice := COALESCE(NEW.commission_rent_without_invoice, 0);
  _paytm_commission := COALESCE(NEW.paytm_commission, 0);

  NEW.total_sales := _total_sales;
  NEW.total_cost := _total_cost;
  NEW.ebitda := _ebitda;
  NEW.ebitda_percent := CASE
    WHEN COALESCE(NEW.net_sales, 0) > 0 THEN ROUND(((_ebitda / COALESCE(NEW.net_sales, 0)) * 100)::numeric, 2)
    ELSE 0
  END;
  NEW.total_revenue := _total_sales;
  NEW.total_expenses := _total_cost;
  NEW.profit := _ebitda;
  NEW.total_payment_received := _total_payment_received;
  NEW.total_paid := _total_payment_received;
  NEW.outstanding := GREATEST(
    CASE
      WHEN COALESCE(NEW.full_payment_received, false) THEN 0
      ELSE ROUND((_total_sales - _total_payment_received - _commission_amount - _commission_with_invoice - _commission_without_invoice - _paytm_commission - COALESCE(NEW.adjustment, 0))::numeric, 2)
    END,
    0
  );

  IF COALESCE(NEW.full_payment_received, false) THEN
    NEW.is_locked := true;
    NEW.status := 'locked';
  ELSIF COALESCE(NEW.status, '') = '' THEN
    NEW.status := 'active';
  END IF;

  NEW.payment_status := CASE
    WHEN COALESCE(NEW.full_payment_received, false) THEN 'Full Paid'
    WHEN _total_payment_received > 0 OR NEW.advance_received = 'Yes' THEN 'Partial'
    ELSE 'Pending'
  END;

  NEW.modified_by := auth.uid();

  RETURN NEW;
END;
$function$;

-- Backfill outstanding for all existing rows
UPDATE public.events SET updated_at = now();
