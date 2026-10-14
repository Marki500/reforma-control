BEGIN;

ALTER TABLE public.budget_pdfs
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS budget_pdfs_supplier_id_idx ON public.budget_pdfs(supplier_id);

DROP POLICY IF EXISTS "Users can insert own budget PDFs" ON public.budget_pdfs;
DROP POLICY IF EXISTS "Users can update own budget PDFs" ON public.budget_pdfs;
CREATE POLICY "Users can insert own budget PDFs" ON public.budget_pdfs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (supplier_id IS NULL OR EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = budget_pdfs.supplier_id AND suppliers.user_id = auth.uid()
    ))
  );
CREATE POLICY "Users can update own budget PDFs" ON public.budget_pdfs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (supplier_id IS NULL OR EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = budget_pdfs.supplier_id AND suppliers.user_id = auth.uid()
    ))
  );

CREATE TABLE IF NOT EXISTS public.home_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  property_type TEXT NOT NULL DEFAULT '',
  cadastral_reference TEXT NOT NULL DEFAULT '',
  construction_year INTEGER CHECK (construction_year IS NULL OR construction_year BETWEEN 1500 AND 2200),
  built_area NUMERIC(10,2) CHECK (built_area IS NULL OR built_area >= 0),
  usable_area NUMERIC(10,2) CHECK (usable_area IS NULL OR usable_area >= 0),
  bedrooms INTEGER CHECK (bedrooms IS NULL OR bedrooms >= 0),
  bathrooms INTEGER CHECK (bathrooms IS NULL OR bathrooms >= 0),
  electricity_cups TEXT NOT NULL DEFAULT '',
  gas_cups TEXT NOT NULL DEFAULT '',
  water_contract TEXT NOT NULL DEFAULT '',
  habitability_certificate_number TEXT NOT NULL DEFAULT '',
  habitability_certificate_date DATE,
  habitability_certificate_expiry DATE,
  energy_certificate_number TEXT NOT NULL DEFAULT '',
  energy_rating TEXT NOT NULL DEFAULT '',
  energy_certificate_expiry DATE,
  community_contact TEXT NOT NULL DEFAULT '',
  insurance_policy TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.home_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own home info" ON public.home_info FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own home info" ON public.home_info FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own home info" ON public.home_info FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own home info" ON public.home_info FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_info TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_pdfs TO authenticated;

COMMIT;
