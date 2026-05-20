-- Remove legacy auto-lock trigger that locks events when total_paid >= total_revenue.
-- This was the cause of ~90 events being unexpectedly marked as locked after the
-- multi-payment migration backfilled the payments table. Locking is now owned solely
-- by auto_populate_event_fields via the explicit full_payment_received flag.
DROP TRIGGER IF EXISTS recalc_payments ON public.payments;
DROP FUNCTION IF EXISTS public.recalc_event_payments();

-- Safely unlock events that were auto-locked by mistake.
-- Only unlocks rows where the admin/system did NOT set full_payment_received = true.
UPDATE public.events
SET is_locked = false,
    status = 'active'
WHERE status = 'locked'
  AND is_locked = true
  AND COALESCE(full_payment_received, false) = false;