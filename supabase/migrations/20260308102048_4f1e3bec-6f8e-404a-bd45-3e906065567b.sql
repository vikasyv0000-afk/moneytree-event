
-- Create SPOCs table
CREATE TABLE public.spocs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_sub_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  gst_number TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.spocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated can read
CREATE POLICY "Authenticated can read spocs" ON public.spocs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read clients" ON public.clients FOR SELECT TO authenticated USING (true);

-- RLS: Events users and super admins can manage
CREATE POLICY "EventsUser or SuperAdmin can manage spocs" ON public.spocs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'events_user'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'events_user'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "EventsUser or SuperAdmin can manage clients" ON public.clients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'events_user'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'events_user'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
