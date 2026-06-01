ALTER TABLE public.events ADD COLUMN IF NOT EXISTS expected_payment_date date;
CREATE INDEX IF NOT EXISTS idx_events_expected_payment_date ON public.events(expected_payment_date);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_zone ON public.events(zone);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);