
-- Add comprehensive P&L columns to events table

-- Basic Event Information
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_ref_code text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS month text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS invoice_date date;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS invoice_code text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS erp_invoice_no text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS posist_code text DEFAULT '';

-- Client Information
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_sub_name text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS referral_details text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS registration_status text DEFAULT 'Not Registered';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS gst_exempted boolean DEFAULT false;

-- Location Details
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS area text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS city text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS state text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS zone text DEFAULT '';

-- Event Management
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS spoc text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category text DEFAULT 'Corporate';

-- Sales Section
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS total_waffwich_sold numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS total_premix_sold numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS total_crisps_sold numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS net_sales numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS gst_amount numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS total_sales numeric(14,2) DEFAULT 0;

-- Expense Section
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cogs numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS other_consumables numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS wastages_variance numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS manpower_cost numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS logistic_expense numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS staff_food_expense numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS local_purchase numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rent_commission numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS miscellaneous_expense numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS total_cost numeric(14,2) DEFAULT 0;

-- Profitability (auto-calculated)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ebitda numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ebitda_percent numeric(8,2) DEFAULT 0;

-- Banking & Collection
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'Online';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cash_deposit numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cash_banking_date date;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS online_payment numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_qr_reference text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS total_payment_received numeric(14,2) DEFAULT 0;

-- Commission & Adjustments
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS commission_paid_from_sale boolean DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS commission_amount numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS commission_rent_with_invoice numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS commission_rent_without_invoice numeric(14,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS adjustment numeric(14,2) DEFAULT 0;

-- Payment Status
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS advance_received text DEFAULT 'NA';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS full_payment_received boolean DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'Pending';

-- Remarks & Finance
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS additional_remarks text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_team_remarks text DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS finance_clearance text DEFAULT 'Pending';

-- Audit
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS modified_by uuid;

-- Add unique constraint on event_ref_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_ref_code ON public.events (event_ref_code) WHERE event_ref_code IS NOT NULL AND event_ref_code != '';

-- Auto-populate month from event_date
CREATE OR REPLACE FUNCTION public.auto_populate_event_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auto month
  NEW.month := to_char(NEW.event_date, 'Month');
  
  -- Auto total_sales
  NEW.total_sales := COALESCE(NEW.net_sales, 0) + COALESCE(NEW.gst_amount, 0);
  
  -- Auto total_cost
  NEW.total_cost := COALESCE(NEW.cogs, 0) + COALESCE(NEW.other_consumables, 0) 
    + COALESCE(NEW.wastages_variance, 0) + COALESCE(NEW.manpower_cost, 0) 
    + COALESCE(NEW.logistic_expense, 0) + COALESCE(NEW.staff_food_expense, 0) 
    + COALESCE(NEW.local_purchase, 0) + COALESCE(NEW.rent_commission, 0) 
    + COALESCE(NEW.miscellaneous_expense, 0);
  
  -- Auto EBITDA
  NEW.ebitda := NEW.total_sales - NEW.total_cost;
  NEW.ebitda_percent := CASE WHEN NEW.total_sales > 0 THEN ROUND((NEW.ebitda / NEW.total_sales) * 100, 2) ELSE 0 END;
  
  -- Also set old columns for compatibility
  NEW.total_revenue := NEW.total_sales;
  NEW.total_expenses := NEW.total_cost;
  NEW.profit := NEW.ebitda;
  
  -- Auto total_payment_received
  NEW.total_payment_received := COALESCE(NEW.cash_deposit, 0) + COALESCE(NEW.online_payment, 0);
  NEW.total_paid := NEW.total_payment_received;
  
  -- Auto outstanding
  NEW.outstanding := NEW.total_sales 
    - NEW.total_payment_received 
    - COALESCE(NEW.commission_amount, 0) 
    - COALESCE(NEW.adjustment, 0);
  
  -- If full payment received, outstanding = 0 and lock
  IF NEW.full_payment_received = true THEN
    NEW.outstanding := 0;
    NEW.is_locked := true;
    NEW.status := 'locked';
  END IF;
  
  -- Payment status logic
  IF NEW.full_payment_received = true THEN
    NEW.payment_status := 'Full Paid';
  ELSIF NEW.advance_received = 'Yes' AND NEW.full_payment_received = false THEN
    NEW.payment_status := 'Partial';
  ELSE
    NEW.payment_status := 'Pending';
  END IF;
  
  -- Modified by
  NEW.modified_by := auth.uid();
  
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS auto_populate_event_fields_trigger ON public.events;
CREATE TRIGGER auto_populate_event_fields_trigger
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_populate_event_fields();
