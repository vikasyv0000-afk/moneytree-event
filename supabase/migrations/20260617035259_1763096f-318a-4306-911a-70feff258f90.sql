
-- Event documents table
CREATE TABLE public.event_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  document_type TEXT,
  remarks TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_documents TO authenticated;
GRANT ALL ON public.event_documents TO service_role;

ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view event documents"
  ON public.event_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert event documents"
  ON public.event_documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader or admin can delete"
  ON public.event_documents FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_event_documents_event_id ON public.event_documents(event_id);

-- Audit trigger
CREATE TRIGGER event_documents_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.event_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Storage policies for event-documents bucket
CREATE POLICY "Authenticated can read event-documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'event-documents');

CREATE POLICY "Authenticated can upload event-documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-documents' AND auth.uid() = owner);

CREATE POLICY "Owner or admin can delete event-documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-documents'
    AND (auth.uid() = owner OR public.has_role(auth.uid(), 'super_admin'))
  );

-- Delete event cascade (events table cascades to payments/expense/revenue via FK normally,
-- but we enforce permission rules + return success). event_documents already cascades.
CREATE OR REPLACE FUNCTION public.delete_event_cascade(_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ev public.events;
BEGIN
  SELECT * INTO _ev FROM public.events WHERE id = _event_id;
  IF _ev.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF _ev.is_locked THEN
      RAISE EXCEPTION 'Locked events can only be deleted by super admins';
    END IF;
    IF _ev.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only delete events you created';
    END IF;
  END IF;

  DELETE FROM public.payments WHERE event_id = _event_id;
  DELETE FROM public.expense_items WHERE event_id = _event_id;
  DELETE FROM public.revenue_items WHERE event_id = _event_id;
  DELETE FROM public.event_documents WHERE event_id = _event_id;
  DELETE FROM public.events WHERE id = _event_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_event_cascade(UUID) TO authenticated;
