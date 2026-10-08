BEGIN;

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  category TEXT NOT NULL DEFAULT 'Otro' CHECK (category IN ('Material', 'Mano de obra', 'Transporte', 'Licencia', 'Otro')),
  vendor TEXT NOT NULL DEFAULT '',
  budgeted_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (budgeted_amount >= 0),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= amount),
  expense_date DATE,
  due_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own expenses" ON public.expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (room_id IS NULL OR EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = expenses.room_id AND (rooms.user_id IS NULL OR rooms.user_id = auth.uid()))));
CREATE POLICY "Users can update own expenses" ON public.expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND (room_id IS NULL OR EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = expenses.room_id AND (rooms.user_id IS NULL OR rooms.user_id = auth.uid()))));
CREATE POLICY "Users can delete own expenses" ON public.expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX expenses_user_date_idx ON public.expenses(user_id, expense_date DESC);
CREATE INDEX expenses_user_due_date_idx ON public.expenses(user_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

COMMIT;
