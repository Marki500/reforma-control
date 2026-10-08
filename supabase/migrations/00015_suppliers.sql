BEGIN;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  trade TEXT NOT NULL DEFAULT 'Otro' CHECK (trade IN ('Albañilería', 'Electricidad', 'Fontanería', 'Carpintería', 'Pintura', 'Arquitectura', 'Tienda', 'Otro')),
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Candidato', 'Activo', 'Archivado')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own suppliers" ON public.suppliers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own suppliers" ON public.suppliers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX suppliers_user_name_idx ON public.suppliers(user_id, name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS expenses_supplier_id_idx ON public.expenses(supplier_id);

DROP POLICY IF EXISTS "Users can create own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
CREATE POLICY "Users can create own expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND (room_id IS NULL OR EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = expenses.room_id AND (rooms.user_id IS NULL OR rooms.user_id = auth.uid())))
  AND (supplier_id IS NULL OR EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.id = expenses.supplier_id AND suppliers.user_id = auth.uid()))
);
CREATE POLICY "Users can update own expenses" ON public.expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (
  auth.uid() = user_id
  AND (room_id IS NULL OR EXISTS (SELECT 1 FROM public.rooms WHERE rooms.id = expenses.room_id AND (rooms.user_id IS NULL OR rooms.user_id = auth.uid())))
  AND (supplier_id IS NULL OR EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.id = expenses.supplier_id AND suppliers.user_id = auth.uid()))
);

COMMIT;
