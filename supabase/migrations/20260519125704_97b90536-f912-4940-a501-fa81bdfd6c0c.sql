-- Attach trigger so event financial fields (outstanding, total_sales, ebitda, etc.)
-- are recalculated automatically on every insert/update.
DROP TRIGGER IF EXISTS auto_populate_event_fields_trigger ON public.events;
CREATE TRIGGER auto_populate_event_fields_trigger
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.auto_populate_event_fields();

-- Map financial year on insert
DROP TRIGGER IF EXISTS map_financial_year_trigger ON public.events;
CREATE TRIGGER map_financial_year_trigger
BEFORE INSERT OR UPDATE OF event_date ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.map_financial_year();

-- Updated_at maintenance
DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Audit logging on events
DROP TRIGGER IF EXISTS events_audit ON public.events;
CREATE TRIGGER events_audit
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_trigger();

-- Backfill: recompute all existing events so stale outstanding values get refreshed.
UPDATE public.events SET updated_at = now();