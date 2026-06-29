-- Budget PDFs storage

CREATE TABLE IF NOT EXISTS budget_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Presupuesto',
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE budget_pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget PDFs"
  ON budget_pdfs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget PDFs"
  ON budget_pdfs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget PDFs"
  ON budget_pdfs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget PDFs"
  ON budget_pdfs FOR DELETE
  USING (auth.uid() = user_id);
