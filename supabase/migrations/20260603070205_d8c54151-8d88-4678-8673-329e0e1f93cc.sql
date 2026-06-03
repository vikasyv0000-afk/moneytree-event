-- Redefine outstanding & profit generated columns to match approved business formulas

ALTER TABLE public.events DROP COLUMN outstanding;
ALTER TABLE public.events ADD COLUMN outstanding numeric GENERATED ALWAYS AS (
  GREATEST(
    CASE WHEN COALESCE(full_payment_received, false) THEN 0
    ELSE
      COALESCE(total_sales, 0)
      - COALESCE(total_payment_received, 0)
      - CASE WHEN COALESCE(commission_paid_from_sale, false) THEN COALESCE(commission_amount, 0) ELSE 0 END
      - COALESCE(commission_rent_with_invoice, 0)
      - COALESCE(commission_rent_without_invoice, 0)
      - COALESCE(paytm_commission, 0)
      - COALESCE(adjustment, 0)
    END,
    0
  )
) STORED;

ALTER TABLE public.events DROP COLUMN profit;
ALTER TABLE public.events ADD COLUMN profit numeric GENERATED ALWAYS AS (
  COALESCE(total_sales, 0) - COALESCE(total_cost, 0)
) STORED;