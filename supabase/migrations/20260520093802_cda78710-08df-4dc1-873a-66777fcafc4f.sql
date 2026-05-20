-- Server-side, concurrency-safe Event Ref Code generation
-- 1) Postgres sequence seeded from existing data
DO $$
DECLARE
  _max_num int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(event_ref_code, '^BWC', ''), '')::int), 0)
    INTO _max_num
  FROM public.events
  WHERE event_ref_code ~ '^BWC[0-9]+$';

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'event_ref_seq' AND relkind = 'S') THEN
    EXECUTE format('CREATE SEQUENCE public.event_ref_seq START WITH %s', GREATEST(_max_num + 1, 1));
  ELSE
    PERFORM setval('public.event_ref_seq', GREATEST(_max_num, 1), _max_num > 0);
  END IF;
END $$;

-- 2) Trigger function: assign event_ref_code on INSERT if missing (atomic via nextval)
CREATE OR REPLACE FUNCTION public.assign_event_ref_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next bigint;
BEGIN
  IF NEW.event_ref_code IS NULL OR NEW.event_ref_code = '' OR NEW.event_ref_code !~ '^BWC[0-9]+$' THEN
    LOOP
      _next := nextval('public.event_ref_seq');
      NEW.event_ref_code := 'BWC' || lpad(_next::text, 3, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE event_ref_code = NEW.event_ref_code);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Trigger BEFORE INSERT (must run before auto_populate_event_fields ordering doesn't matter for ref code)
DROP TRIGGER IF EXISTS trg_assign_event_ref_code ON public.events;
CREATE TRIGGER trg_assign_event_ref_code
BEFORE INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.assign_event_ref_code();

-- 4) Unique constraint (partial — allow nulls historically, enforce uniqueness on non-null)
CREATE UNIQUE INDEX IF NOT EXISTS events_event_ref_code_unique
  ON public.events (event_ref_code)
  WHERE event_ref_code IS NOT NULL;