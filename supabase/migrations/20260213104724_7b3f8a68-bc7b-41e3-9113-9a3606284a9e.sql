
-- ============================================
-- Event P&L Management SaaS - Full Schema
-- ============================================

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'events_user', 'finance_user');

-- 2. User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Financial years table
CREATE TABLE public.financial_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;

-- 5. Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'cancelled')),
  financial_year_id UUID REFERENCES public.financial_years(id),
  total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  profit NUMERIC(14,2) GENERATED ALWAYS AS (total_revenue - total_expenses) STORED,
  outstanding NUMERIC(14,2) GENERATED ALWAYS AS (total_revenue - total_paid) STORED,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 6. Revenue line items
CREATE TABLE public.revenue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.revenue_items ENABLE ROW LEVEL SECURITY;

-- 7. Expense line items
CREATE TABLE public.expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

-- 8. Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 9. Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_events_financial_year ON public.events(financial_year_id);
CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_revenue_items_event ON public.revenue_items(event_id);
CREATE INDEX idx_expense_items_event ON public.expense_items(event_id);
CREATE INDEX idx_payments_event ON public.payments(event_id);
CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

-- Check role function (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check any role (authenticated user has at least one role)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- user_roles: SuperAdmin manages, users see own
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "SuperAdmin can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- profiles: users see own, SuperAdmin sees all
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- financial_years: all authenticated can read
CREATE POLICY "Authenticated can read financial years" ON public.financial_years
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "SuperAdmin can manage financial years" ON public.financial_years
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- events: all authenticated can read, EventsUser+SuperAdmin can write
CREATE POLICY "Authenticated can read events" ON public.events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "EventsUser or SuperAdmin can insert events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'events_user') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "EventsUser or SuperAdmin can update events" ON public.events
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'events_user') OR public.has_role(auth.uid(), 'super_admin'))
    AND is_locked = false
  );

CREATE POLICY "SuperAdmin can delete events" ON public.events
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- revenue_items: same as events
CREATE POLICY "Authenticated can read revenue" ON public.revenue_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "EventsUser or SuperAdmin can manage revenue" ON public.revenue_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'events_user') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'events_user') OR public.has_role(auth.uid(), 'super_admin'));

-- expense_items: same as events
CREATE POLICY "Authenticated can read expenses" ON public.expense_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "EventsUser or SuperAdmin can manage expenses" ON public.expense_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'events_user') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'events_user') OR public.has_role(auth.uid(), 'super_admin'));

-- payments: FinanceUser+SuperAdmin can manage
CREATE POLICY "Authenticated can read payments" ON public.payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "FinanceUser or SuperAdmin can manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'finance_user') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'finance_user') OR public.has_role(auth.uid(), 'super_admin'));

-- audit_logs: SuperAdmin can read, system inserts
CREATE POLICY "SuperAdmin can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_revenue_items_updated_at BEFORE UPDATE ON public.revenue_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_expense_items_updated_at BEFORE UPDATE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Recalc event totals when revenue changes
CREATE OR REPLACE FUNCTION public.recalc_event_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
BEGIN
  _event_id := COALESCE(NEW.event_id, OLD.event_id);
  UPDATE public.events SET total_revenue = (
    SELECT COALESCE(SUM(amount), 0) FROM public.revenue_items WHERE event_id = _event_id
  ) WHERE id = _event_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER recalc_revenue AFTER INSERT OR UPDATE OR DELETE ON public.revenue_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_event_revenue();

-- Recalc event totals when expenses change
CREATE OR REPLACE FUNCTION public.recalc_event_expenses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
BEGIN
  _event_id := COALESCE(NEW.event_id, OLD.event_id);
  UPDATE public.events SET total_expenses = (
    SELECT COALESCE(SUM(amount), 0) FROM public.expense_items WHERE event_id = _event_id
  ) WHERE id = _event_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER recalc_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_event_expenses();

-- Recalc payments and auto-lock
CREATE OR REPLACE FUNCTION public.recalc_event_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
  _total_paid NUMERIC(14,2);
  _total_revenue NUMERIC(14,2);
BEGIN
  _event_id := COALESCE(NEW.event_id, OLD.event_id);
  
  SELECT COALESCE(SUM(amount), 0) INTO _total_paid
  FROM public.payments WHERE event_id = _event_id;
  
  SELECT total_revenue INTO _total_revenue
  FROM public.events WHERE id = _event_id;
  
  UPDATE public.events SET
    total_paid = _total_paid,
    is_locked = (_total_paid >= _total_revenue AND _total_revenue > 0),
    status = CASE
      WHEN _total_paid >= _total_revenue AND _total_revenue > 0 THEN 'locked'
      ELSE status
    END
  WHERE id = _event_id;
  
  RETURN NULL;
END;
$$;

CREATE TRIGGER recalc_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_event_payments();

-- Auto-map financial year from event_date
CREATE OR REPLACE FUNCTION public.map_financial_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT id INTO NEW.financial_year_id
  FROM public.financial_years
  WHERE NEW.event_date BETWEEN start_date AND end_date
  LIMIT 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER map_fy_on_event BEFORE INSERT OR UPDATE OF event_date ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.map_financial_year();

-- Audit log trigger function
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_events AFTER INSERT OR UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_revenue AFTER INSERT OR UPDATE OR DELETE ON public.revenue_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Seed default financial years
INSERT INTO public.financial_years (label, start_date, end_date) VALUES
  ('FY 2024-25', '2024-04-01', '2025-03-31'),
  ('FY 2025-26', '2025-04-01', '2026-03-31'),
  ('FY 2026-27', '2026-04-01', '2027-03-31');
