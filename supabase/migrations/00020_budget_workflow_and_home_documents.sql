BEGIN;

ALTER TABLE public.budget_pdfs
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) CHECK (total_amount IS NULL OR total_amount >= 0),
  ADD COLUMN IF NOT EXISTS issued_date DATE,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Recibido' CHECK (status IN ('Solicitado', 'Recibido', 'Comparando', 'Aceptado', 'Rechazado')),
  ADD COLUMN IF NOT EXISTS payment_terms TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS warranty TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS budget_pdfs_user_status_idx ON public.budget_pdfs(user_id, status);

CREATE TABLE IF NOT EXISTS public.home_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  document_type TEXT NOT NULL DEFAULT 'Otro',
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  document_date DATE,
  expiry_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.home_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own home documents" ON public.home_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own home documents" ON public.home_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own home documents" ON public.home_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own home documents" ON public.home_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS home_documents_user_expiry_idx ON public.home_documents(user_id, expiry_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_documents TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('home-documents', 'home-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own home documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'home-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own home documents" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'home-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own home documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'home-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own home documents files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'home-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.accept_budget_pdf(p_budget_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  selected_budget public.budget_pdfs%ROWTYPE;
  created_expense_id UUID;
BEGIN
  SELECT * INTO selected_budget FROM public.budget_pdfs
  WHERE id = p_budget_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Presupuesto no encontrado'; END IF;
  IF selected_budget.total_amount IS NULL OR selected_budget.total_amount <= 0 THEN
    RAISE EXCEPTION 'Indica el importe antes de aceptar el presupuesto';
  END IF;

  IF selected_budget.expense_id IS NOT NULL THEN
    UPDATE public.budget_pdfs SET status = 'Aceptado', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
    WHERE id = p_budget_id;
    RETURN selected_budget.expense_id;
  END IF;

  INSERT INTO public.expenses (user_id, supplier_id, title, category, vendor, budgeted_amount, amount, paid_amount, expense_date, notes)
  VALUES (
    auth.uid(), selected_budget.supplier_id, selected_budget.name, 'Mano de obra',
    COALESCE((SELECT name FROM public.suppliers WHERE id = selected_budget.supplier_id), ''),
    selected_budget.total_amount, selected_budget.total_amount, 0, CURRENT_DATE,
    concat_ws(E'\n', selected_budget.notes, NULLIF(selected_budget.payment_terms, ''), NULLIF(selected_budget.warranty, ''))
  ) RETURNING id INTO created_expense_id;

  UPDATE public.budget_pdfs SET status = 'Aceptado', accepted_at = now(), expense_id = created_expense_id, updated_at = now()
  WHERE id = p_budget_id;
  RETURN created_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_budget_pdf(UUID) TO authenticated;

COMMIT;
