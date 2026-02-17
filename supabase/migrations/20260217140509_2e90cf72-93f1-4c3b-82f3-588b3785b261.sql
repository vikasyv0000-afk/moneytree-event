
-- Recalculate EBITDA for all existing events (excluding generated column 'profit')
UPDATE public.events SET
  ebitda = COALESCE(net_sales, 0) - COALESCE(total_cost, 0),
  ebitda_percent = CASE WHEN COALESCE(net_sales, 0) > 0 THEN ROUND(((COALESCE(net_sales, 0) - COALESCE(total_cost, 0)) / net_sales) * 100, 2) ELSE 0 END;
