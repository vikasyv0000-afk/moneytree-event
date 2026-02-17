
CREATE OR REPLACE FUNCTION public.auto_populate_event_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.month := to_char(NEW.event_date, 'Month');
  
  NEW.total_sales := COALESCE(NEW.net_sales, 0) + COALESCE(NEW.gst_amount, 0);
  
  NEW.total_cost := COALESCE(NEW.cogs, 0) + COALESCE(NEW.other_consumables, 0) 
    + COALESCE(NEW.wastages_variance, 0) + COALESCE(NEW.manpower_cost, 0) 
    + COALESCE(NEW.logistic_expense, 0) + COALESCE(NEW.staff_food_expense, 0) 
    + COALESCE(NEW.local_purchase, 0) + COALESCE(NEW.rent_commission, 0) 
    + COALESCE(NEW.miscellaneous_expense, 0);
  
  -- EBITDA = Net Sales - Total Cost (GST EXCLUDED)
  NEW.ebitda := COALESCE(NEW.net_sales, 0) - NEW.total_cost;
  NEW.ebitda_percent := CASE WHEN COALESCE(NEW.net_sales, 0) > 0 THEN ROUND((NEW.ebitda / COALESCE(NEW.net_sales, 0)) * 100, 2) ELSE 0 END;
  
  NEW.total_revenue := NEW.total_sales;
  NEW.total_expenses := NEW.total_cost;
  
  NEW.total_payment_received := COALESCE(NEW.cash_deposit, 0) + COALESCE(NEW.online_payment, 0);
  NEW.total_paid := NEW.total_payment_received;
  
  NEW.outstanding := NEW.total_sales 
    - NEW.total_payment_received 
    - COALESCE(NEW.commission_amount, 0) 
    - COALESCE(NEW.adjustment, 0);
  
  IF NEW.full_payment_received = true THEN
    NEW.outstanding := 0;
    NEW.is_locked := true;
    NEW.status := 'locked';
  END IF;
  
  IF NEW.full_payment_received = true THEN
    NEW.payment_status := 'Full Paid';
  ELSIF NEW.advance_received = 'Yes' AND NEW.full_payment_received = false THEN
    NEW.payment_status := 'Partial';
  ELSE
    NEW.payment_status := 'Pending';
  END IF;
  
  NEW.modified_by := auth.uid();
  
  RETURN NEW;
END;
$function$;

-- Touch events to re-trigger the function and recalculate
UPDATE public.events SET updated_at = now();
