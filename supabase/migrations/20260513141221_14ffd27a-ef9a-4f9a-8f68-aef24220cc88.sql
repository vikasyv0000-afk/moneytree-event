-- Add optional remark column to events table for Banking & Collection section
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS remark TEXT;

COMMENT ON COLUMN public.events.remark IS 'Optional remark field for Banking & Collection section';