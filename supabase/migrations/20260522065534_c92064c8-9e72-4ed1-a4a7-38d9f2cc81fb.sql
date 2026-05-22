UPDATE public.events
SET is_locked = false,
    status = 'active',
    full_payment_received = false
WHERE is_locked = true OR status = 'locked';